// #include "eth_w5500.h"
#include "esp_netif.h"
#include "esp_eth.h"
#include "esp_mac.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_check.h"
#include "nvs_flash.h"
#include "driver/spi_master.h"
#include "driver/gpio.h"
#include "driver/spi_common.h" // sử dụng cấu hình cho DMA - thông số SPI_DMA_CH_AUTO
#include "lwip/ip4_addr.h"     // Dành cho macro gán IP tĩnh IP4_ADDR
// #include "esp_eth_mac_w5500.h"
#include "esp_eth_mac_spi.h"
//  Thư viện tự tạo
#include "ethernet.h"

static const char *TAG = "[MODBUS GATEWAY - ETHERNET]";
esp_err_t eth_init(void);
static void eth_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data);
static void got_ip_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data);

esp_err_t eth_init(void)
{
    esp_err_t ret = ESP_OK;
    ESP_LOGI(TAG, "Start to configure Ethernet use W5500 for device .....");

    // Dịch vụ ngắt
    esp_err_t isr_ret = gpio_install_isr_service(0);
    if (isr_ret != ESP_OK && isr_ret != ESP_ERR_INVALID_STATE)
    {
        ESP_LOGE(TAG, "Khong the bat dich vu ngach GPIO (ISR) !!!");
        goto err;
    }

    // Khởi tạo bộ nhớ NVS - lưu các thông tin cấu hình mạng cho wifi
    ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    // Tạo Netif cho Ethernet
    // netif ethernet đại diện cho phần mềm
    esp_netif_config_t netif_eth_cfg = ESP_NETIF_DEFAULT_ETH();
    esp_netif_t *eth_netif = esp_netif_new(&netif_eth_cfg);

    // Khởi tạo SPI bus và tốc độ dùng cho bus
    spi_bus_config_t w5500_spi_bus_config = {
        .miso_io_num = MISO_ETH_PIN,
        .mosi_io_num = MOSI_ETH_PIN,
        .sclk_io_num = CLK_ETH_PIN,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
    };

    spi_device_interface_config_t w5500_spi_config = {
        .mode = 0, // SPI mode 0
        .clock_speed_hz = CLK_SPEED,
        .spics_io_num = CS_ETH_PIN,
        .queue_size = 20,
    };

    ESP_GOTO_ON_ERROR(spi_bus_initialize(SPI_ETH_HOST, &w5500_spi_bus_config, SPI_DMA_CH_AUTO),
                      err,
                      TAG,
                      "SPI host #%d init failed !!!",
                      SPI_ETH_HOST);

    spi_device_handle_t spi_handle = NULL;
    ESP_ERROR_CHECK(spi_bus_add_device(SPI_ETH_HOST, &w5500_spi_config, &spi_handle));

    eth_w5500_config_t w5500_config = ETH_W5500_DEFAULT_CONFIG(SPI_ETH_HOST, &w5500_spi_config);

    // ESP_GOTO_ON_ERROR(bieu_thuc_kiem_tra, nhan_goto, the_log, cau_thong_bao, cac_bien_di_kem);
    // ESP_GOTO_ON_ERROR(spi_bus_initialize(SPI_ETH_HOST, &w5500_spi_bus_config, SPI_DMA_CH_AUTO),
    //                   err,
    //                   TAG,
    //                   "SPI host #%d init failed !!!",
    //                   SPI_ETH_HOST);

    // Khởi tạo MAC và PHY cho W5500 - Sử dụng cấu hình mặc định trong thư viện của IDF
    eth_mac_config_t mac_config = ETH_MAC_DEFAULT_CONFIG();
    eth_phy_config_t phy_config = ETH_PHY_DEFAULT_CONFIG();

    // Gán chân Int của W5500 cho ESP
    w5500_config.int_gpio_num = INT_ETH_PIN;

    // Thời gian kiểm tra tình trạng kết nối mạng vật lý
    w5500_config.poll_period_ms = POLLING_STATUS_TIME;

    // Hàm này cấp phát RAM và tạo ra một thực thể MAC (đại diện cho phần xử lý logic gói tin của chip W5500)
    esp_eth_mac_t *mac = esp_eth_mac_new_w5500(&w5500_config, &mac_config);

    // Hàm này tạo ra một thực thể PHY (đại diện cho phần giao tiếp vật lý với sợi cáp mạng RJ45)
    esp_eth_phy_t *phy = esp_eth_phy_new_w5500(&phy_config);

    // Nạp cấu hình phy và mac cho ethernet
    esp_eth_config_t eth_config = ETH_DEFAULT_CONFIG(mac, phy);

    // Cài đặt Ethernet Driver (Đây là bước tạo ra eth_handle thực sự)
    // eth_handle đại diện cho phần cứng
    esp_eth_handle_t eth_handle = NULL;
    ESP_ERROR_CHECK(esp_eth_driver_install(&eth_config, &eth_handle));

    // Gắn Ethernet Driver với Netif vừa tạo
    ESP_ERROR_CHECK(esp_netif_attach(eth_netif, esp_eth_new_netif_glue(eth_handle)));

    // Tắt DHCP
    ESP_ERROR_CHECK(esp_netif_dhcpc_stop(eth_netif));

    // Set IP tĩnh cho khối Ethernet
    esp_netif_ip_info_t ip_info;
    IP4_ADDR(&ip_info.ip, 192, 168, 137, 26); // IP tĩnh muốn set
    IP4_ADDR(&ip_info.gw, 192, 168, 137, 1);
    IP4_ADDR(&ip_info.netmask, 255, 255, 255, 0);

    // Gán địa chỉ ETH MAC của ESP cho W5500 - B4:3A:45:CF:4D:2F
    static uint8_t eth_mac_addr[6] = {0};
    ESP_ERROR_CHECK(esp_read_mac(eth_mac_addr, ESP_MAC_ETH));
    ESP_ERROR_CHECK(esp_eth_ioctl(eth_handle, ETH_CMD_S_MAC_ADDR, eth_mac_addr));
    ESP_LOGI(TAG, "Configure Ethernet MAC address for W5500: %02x:%02x:%02x:%02x:%02x:%02x",
             eth_mac_addr[0], eth_mac_addr[1], eth_mac_addr[2],
             eth_mac_addr[3], eth_mac_addr[4], eth_mac_addr[5]);

    // Áp dụng IP tĩnh
    ESP_ERROR_CHECK(esp_netif_set_ip_info(eth_netif, &ip_info));

    // Gọi hàm quản lý các sự kiện ngắt
    ESP_ERROR_CHECK(esp_event_handler_register(ETH_EVENT,
                                               ESP_EVENT_ANY_ID,
                                               &eth_event_handler,
                                               NULL));

    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT,
                                               IP_EVENT_ETH_GOT_IP,
                                               &got_ip_event_handler,
                                               NULL));

    // Khởi động Ethernet
    ESP_ERROR_CHECK(esp_eth_start(eth_handle));
    ESP_LOGI(TAG, "Successful configure Ethernet use W5500.");
    return ESP_OK;

err:
    ESP_LOGE(TAG, "Fail to configure for Ethernet W5500 !!!");
    return ESP_FAIL;
}

// Khai báo các Handler ngay trong module để bắt sự kiện cắm cáp, có IP...
static void eth_event_handler(void *arg,
                              esp_event_base_t event_base,
                              int32_t event_id,
                              void *event_data)
{
    // Xử lý báo cáp kết nối / ngắt kết nối
    uint8_t mac_addr[6] = {0};
    esp_eth_handle_t *eth_isr_handle = (esp_eth_handle_t *)event_data;

    switch (event_id)
    {
    case ETHERNET_EVENT_CONNECTED:
        esp_eth_ioctl(*eth_isr_handle, ETH_CMD_G_MAC_ADDR, mac_addr);
        ESP_LOGI(TAG, "Ethernet Link Up");
        ESP_LOGI(TAG, "Ethernet HW Addr %02x:%02x:%02x:%02x:%02x:%02x",
                 mac_addr[0], mac_addr[1], mac_addr[2], mac_addr[3], mac_addr[4], mac_addr[5]);
        break;
    case ETHERNET_EVENT_DISCONNECTED:
        ESP_LOGI(TAG, "Ethernet Link Down");
        break;
    case ETHERNET_EVENT_START:
        ESP_LOGI(TAG, "Ethernet Started");
        break;
    case ETHERNET_EVENT_STOP:
        ESP_LOGI(TAG, "Ethernet Stopped");
        break;
    default:
        break;
    }
}

static void got_ip_event_handler(void *arg,
                                 esp_event_base_t event_base,
                                 int32_t event_id,
                                 void *event_data)
{
    // static uint32_t eth_sub_netmask = 0;
    // static uint32_t eth_ip_addr = 0;
    // static uint32_t eth_gateway_addr = 0;

    ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;

    // eth_sub_netmask = event->ip_info.netmask.addr;
    // eth_ip_addr = event->ip_info.ip.addr;
    // eth_gateway_addr = event->ip_info.gw.addr;

    // Sử dụng hàm của IDF để in giá trị IP ra màn hình
    ESP_LOGI(TAG, "Got IP address (function): " IPSTR, IP2STR(&event->ip_info.ip));

    // Sử dụng mặt nạ bit để tách từng byte trong eth_ip_addr có kiểu uint32_t để in giá trị IP ra màn hình
    // ESP_LOGI(TAG, "Got IP address (manual): %d.%d.%d.%d",
    //          (eth_ip_addr) & 0xFF,
    //          (eth_ip_addr >> 8) & 0xFF,
    //          (eth_ip_addr >> 16) & 0xFF,
    //          (eth_ip_addr >> 24) & 0xFF);
    ESP_LOGI(TAG, "Got subnet mask (function): " IPSTR, IP2STR(&event->ip_info.netmask));
    ESP_LOGI(TAG, "Got gateway address (function): " IPSTR, IP2STR(&event->ip_info.gw));
}
