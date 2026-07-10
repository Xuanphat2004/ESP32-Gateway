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
#include "driver/spi_common.h"
// #include "esp_eth_mac_w5500.h"
#include "esp_eth_mac_spi.h"
#include "lwip/sockets.h"
#include "netdb.h"
//  Thư viện tự tạo
#include "ethernet.h"
#include "rtc_mb.h"
#include "mqtt_client.h"
#include "system_event.h"

static const char *TAG = "[ETHERNET]";
extern bool eth_connected;
extern EventGroupHandle_t event_group;

esp_err_t eth_init(void);
static void eth_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data);
static void got_ip_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data);
void internet_test_task(void);
void start_mqtt_test_simple(void);

esp_err_t eth_init(void)
{
    // ESP_ERROR_CHECK(esp_netif_init());
    // ESP_ERROR_CHECK(esp_event_loop_create_default());
    esp_err_t ret = ESP_OK;
    ESP_LOGI(TAG, "Start to configure Ethernet use W5500 for device .....");

    // Dịch vụ ngắt
    esp_err_t isr_ret = gpio_install_isr_service(0);
    if (isr_ret != ESP_OK && isr_ret != ESP_ERR_INVALID_STATE)
    {
        ESP_LOGE(TAG, "Khong the bat dich vu ngach GPIO (ISR) !!!");
        goto err;
    }

    // Khởi tạo bộ nhớ NVS - lưu các thông tin cấu hình
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
    assert(eth_netif);

    // Kiểm tra DHCP client có đang chạy không
    // 0 = STARTED, 1 = STOPPED
    esp_netif_dhcp_status_t dhcp_status;
    esp_netif_dhcpc_get_status(eth_netif, &dhcp_status);
    ESP_LOGI(TAG, "DHCP client status: %d", dhcp_status);

    // Khởi tạo SPI bus và tốc độ dùng cho bus
    spi_bus_config_t w5500_spi_bus_config = {
        .miso_io_num = MISO_ETH_PIN,
        .mosi_io_num = MOSI_ETH_PIN,
        .sclk_io_num = CLK_ETH_PIN,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .max_transfer_sz = 4096,
    };

    spi_device_interface_config_t w5500_spi_config = {
        .mode = 0, // SPI mode 0
        .clock_speed_hz = CLK_SPEED,
        .spics_io_num = CS_ETH_PIN,
        .queue_size = 20,
    };

    ESP_GOTO_ON_ERROR(spi_bus_initialize(SPI_ETH_HOST, &w5500_spi_bus_config, SPI_DMA_CH_AUTO),
                      err, TAG, "SPI host #%d init failed !!!", SPI_ETH_HOST);

    eth_w5500_config_t w5500_config = ETH_W5500_DEFAULT_CONFIG(SPI_ETH_HOST, &w5500_spi_config);

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

    // Tạo Ethernet Driver
    // eth_handle đại diện cho phần cứng
    esp_eth_handle_t eth_handle = NULL;
    ESP_ERROR_CHECK(esp_eth_driver_install(&eth_config, &eth_handle));

    // Gán địa chỉ ETH MAC của ESP cho W5500
    static uint8_t eth_mac_addr[6] = {0};
    ESP_ERROR_CHECK(esp_read_mac(eth_mac_addr, ESP_MAC_ETH));
    ESP_ERROR_CHECK(esp_eth_ioctl(eth_handle, ETH_CMD_S_MAC_ADDR, eth_mac_addr));
    ESP_LOGI(TAG, "Configure Ethernet MAC address for W5500: %02x:%02x:%02x:%02x:%02x:%02x",
             eth_mac_addr[0], eth_mac_addr[1], eth_mac_addr[2],
             eth_mac_addr[3], eth_mac_addr[4], eth_mac_addr[5]);

    // Gọi hàm quản lý các sự kiện ngắt
    ESP_ERROR_CHECK(esp_event_handler_register(ETH_EVENT, ESP_EVENT_ANY_ID, &eth_event_handler, NULL));
    ESP_ERROR_CHECK(esp_event_handler_register(IP_EVENT, IP_EVENT_ETH_GOT_IP, &got_ip_event_handler, NULL));

    // Gắn Ethernet Driver với Netif vừa tạo
    ESP_ERROR_CHECK(esp_netif_attach(eth_netif, esp_eth_new_netif_glue(eth_handle)));

    // Khởi động Ethernet
    ESP_ERROR_CHECK(esp_eth_start(eth_handle));

    ESP_LOGI(TAG, "Successful configure Ethernet use W5500.");

    return ESP_OK;

err:
    ESP_LOGE(TAG, "Fail to configure for Ethernet W5500 !!!");
    return ESP_FAIL;
}

static void eth_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    uint8_t mac_addr[6] = {0};
    esp_eth_handle_t *eth_isr_handle = (esp_eth_handle_t *)event_data;

    switch (event_id)
    {
    case ETHERNET_EVENT_CONNECTED:
        esp_eth_ioctl(*eth_isr_handle, ETH_CMD_G_MAC_ADDR, mac_addr);
        ESP_LOGI(TAG, "Ethernet Link Up");
        xEventGroupSetBits(event_group, ETHERNET_CONNECTED_BIT);
        break;

    case ETHERNET_EVENT_DISCONNECTED:
        ESP_LOGI(TAG, "Ethernet Link Down");
        xEventGroupClearBits(event_group, ETHERNET_CONNECTED_BIT);
        eth_connected = false;
        break;

    case ETHERNET_EVENT_START:
        ESP_LOGI(TAG, "Ethernet Started");
        xEventGroupSetBits(event_group, ETHERNET_CONNECTED_BIT);
        break;

    case ETHERNET_EVENT_STOP:
        ESP_LOGI(TAG, "Ethernet Stopped");
        xEventGroupClearBits(event_group, ETHERNET_CONNECTED_BIT);
        eth_connected = false;
        break;

    default:
        break;
    }
}

static void got_ip_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
    ESP_LOGI(TAG, "Got IP address: " IPSTR, IP2STR(&event->ip_info.ip));
    ESP_LOGI(TAG, "Got subnet mask: " IPSTR, IP2STR(&event->ip_info.netmask));
    ESP_LOGI(TAG, "Got gateway address: " IPSTR, IP2STR(&event->ip_info.gw));
    xEventGroupSetBits(event_group, ETHERNET_CONNECTED_BIT);
    vTaskDelay(pdMS_TO_TICKS(2000));
    eth_connected = true;
    get_time();
}
