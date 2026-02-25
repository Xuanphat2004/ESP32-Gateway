#include "eth_w5500.h"
#include "esp_netif.h"
#include "esp_eth.h"
#include "esp_event.h"
#include "esp_log.h"
#include "driver/spi_master.h"
#include "driver/gpio.h"
#include "driver/spi_common.h" // sử dụng cấu hình cho DMA - thông số SPI_DMA_CH_AUTO

// Thư viện tự tạo
#include "ethernet.h"

static const char *TAG = "[MODBUS GATEWAY - ETHERNET]";
static void eth_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data);
static void got_ip_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data);

void eth_w5500_init(void)
{
    esp_err_t ret = ESP_OK;
    ESP_LOGI(TAG, "Start to configure Ethernet use W5500 for device .....")

    // Khởi tạo bộ nhớ NVS - lưu các thông tin cấu hình mạng cho wifi
    ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    // ESP_ERROR_CHECK(esp_netif_init());
    // ESP_ERROR_CHECK(esp_event_loop_create_default());

    // Khởi tạo SPI bus và tốc độ dùng cho bus
    spi_bus_config_t w5500_spi_bus_config = {
        .miso_io_num = MISO_ETH_PIN,
        .mosi_io_num = MOSI_ETH_PIN,
        .sclk_io_num = CLK_ETH_PIN,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
    };
    spi_device_interface_config_t w5500_spi_config = {
        .command_bits = 0,
        .address_bits = 0,
        .dummy_bits = 0,
        .clock_speed_hz = CLK_SPEED,
        .mode = 0, // SPI mode 0
        .spics_io_num = CS_ETH_PIN,
        .queue_size = 20,
    };

    eth_w5500_config_t w5500_config = ETH_W5500_DEFAULT_CONFIG(SPI_ETH_HOST, &w5500_spi_config);

    // ESP_GOTO_ON_ERROR(bieu_thuc_kiem_tra, nhan_goto, the_log, cau_thong_bao, cac_bien_di_kem);
    ESP_GOTO_ON_ERROR(spi_bus_initialize(SPI_ETH_HOST, &w5500_spi_bus_config, SPI_DMA_CH_AUTO),
                      err,
                      TAG,
                      "SPI host #%d init failed !!!",
                      SPI_ETH_HOST);

    // Khởi tạo MAC và PHY cho W5500 - Sử dụng cấu hình mặc định trong thư viện của IDF
    eth_mac_config_t w5500_mac_config = ETH_MAC_DEFAULT_CONFIG();
    eth_phy_config_t w5500_phy_config = ETH_PHY_DEFAULT_CONFIG();

    // Gán chân Int của W5500 cho ESP
    w5500_config.int_gpio_num = spi_eth_module_config->INT_ETH_PIN;

    // Thời gian kiểm tra tình trạng kết nối mạng vật lý
    w5500_config.poll_period_ms = spi_eth_module_config->POLLING_STATUS_TIME;

    // Hàm này cấp phát RAM và tạo ra một thực thể MAC (đại diện cho phần xử lý logic gói tin của chip W5500)
    esp_eth_mac_t *mac = esp_eth_mac_new_w5500(&w5500_config, &w5500_mac_config);

    // Hàm này tạo ra một thực thể PHY (đại diện cho phần giao tiếp vật lý với sợi cáp mạng RJ45)
    esp_eth_phy_t *phy = esp_eth_phy_new_w5500(&w5500_phy_config);

    // Nạp cấu hình phy và mac cho ethernet
    esp_eth_config_t eth_config = ETH_DEFAULT_CONFIG(mac, phy);

    // Cài đặt Ethernet Driver (Đây là bước tạo ra eth_handle thực sự)
    // eth_handle đại diện cho phần cứng
    esp_eth_handle_t eth_handle = NULL;
    ESP_ERROR_CHECK(esp_eth_driver_install(&eth_config, &eth_handle));

    // Tạo Netif cho Ethernet
    // netif ethernet đại diện cho phần mềm
    esp_netif_config_t netif_eth_cfg = ESP_NETIF_DEFAULT_ETH();
    esp_netif_t *eth_netif = esp_netif_new(&netif_eth_cfg);

    // Gắn Ethernet Driver với Netif vừa tạo
    ESP_ERROR_CHECK(esp_netif_attach(eth_netif, esp_eth_new_netif_glue(eth_handle)));

    // Tắt DHCP
    ESP_ERROR_CHECK(esp_netif_dhcpc_stop(eth_netif));

    // Set IP tĩnh cho khối Ethernet
    esp_netif_ip_info_t ip_info;
    IP4_ADDR(&ip_info.ip, 192, 168, 1, 26); // IP tĩnh muốn set
    IP4_ADDR(&ip_info.gw, 192, 168, 1, 1);
    IP4_ADDR(&ip_info.netmask, 255, 255, 255, 0);

    // Áp dụng IP tĩnh
    ESP_ERROR_CHECK(esp_netif_set_ip_info(eth_netif, &ip_info));

    // Gọi hàm quản lý các sự kiện ngắt
    esp_event_handler_register(ETH_EVENT,
                               ESP_EVENT_ANY_ID,
                               &eth_event_handler,
                               NULL);

    esp_event_handler_register(IP_EVENT,
                               IP_EVENT_ETH_GOT_IP,
                               &got_ip_event_handler,
                               NULL);

    // Khởi động Ethernet
    esp_eth_handle_t eth_handle = NULL;
    ESP_ERROR_CHECK(esp_eth_start(eth_handle));
    ESP_LOGI(TAG, "Successful configure Ethernet use W5500.");
}

// Khai báo các Handler ngay trong module để bắt sự kiện cắm cáp, có IP...
static void eth_event_handler(void *arg,
                              esp_event_base_t event_base,
                              int32_t event_id,
                              void *event_data)
{
    // Xử lý báo cáp kết nối / ngắt kết nối
    uint8_t mac_addr[6] = {0};
    /* we can get the ethernet driver handle from event data */
    esp_eth_handle_t eth_handle = *(esp_eth_handle_t *)event_data;

    switch (event_id)
    {
    case ETHERNET_EVENT_CONNECTED:
        esp_eth_ioctl(eth_handle, ETH_CMD_G_MAC_ADDR, mac_addr);
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
    ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
    ESP_LOGI(TAG, "Got IP: " IPSTR, IP2STR(&event->ip_info.ip));
    ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
    const esp_netif_ip_info_t *ip_info = &event->ip_info;
}
