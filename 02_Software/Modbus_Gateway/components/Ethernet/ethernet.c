#include "eth_w5500.h"
#include "esp_netif.h"
#include "esp_eth.h"
#include "esp_event.h"
#include "esp_log.h"
#include "driver/spi_master.h"
#include "driver/gpio.h"

static const char *TAG = "[MODBUS GATEWAY - ETHERNET]";

esp_err_t eth_w5500_init(void)
{
    esp_err_t ret = ESP_OK;
    ESP_LOGI(TAG, "Start to configure Ethernet use W5500 for ESP .....")

    // Khởi tạo bộ nhớ NVS - lưu các thông tin cấu hình mạng cho wifi
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(esp_netif_init());
    esp_event_loop_create_default();

    // Init SPI bus
    spi_bus_config_t bus_config = {
        .miso_io_num = CONFIG_EXAMPLE_ETH_SPI_MISO_GPIO,
        .mosi_io_num = CONFIG_EXAMPLE_ETH_SPI_MOSI_GPIO,
        .sclk_io_num = CONFIG_EXAMPLE_ETH_SPI_SCLK_GPIO,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
    };
    spi_device_interface_config_t devcfg = {
        .clock_speed_hz = clock_speed, // Set the clock speed
        .mode = 0,                     // SPI mode 0
        .spics_io_num = cs_pin         // CS pin
    };

    ESP_GOTO_ON_ERROR(spi_bus_initialize(CONFIG_EXAMPLE_ETH_SPI_HOST, &bus_config, SPI_DMA_CH_AUTO), err, TAG, "SPI host #%d init failed !!!", CONFIG_EXAMPLE_ETH_SPI_HOST);
    // Khởi tạo MAC và PHY cho W5500
    eth_w5500_config_t w5500_config = ETH_W5500_DEFAULT_CONFIG(CONFIG_EXAMPLE_ETH_SPI_HOST, &spi_devcfg);
    w5500_config.int_gpio_num = spi_eth_module_config->int_gpio;
    w5500_config.poll_period_ms = spi_eth_module_config->polling_ms;
    esp_eth_mac_t *mac = esp_eth_mac_new_w5500(&w5500_config, &mac_config);
    esp_eth_phy_t *phy = esp_eth_phy_new_w5500(&phy_config);

    esp_event_handler_register(ETH_EVENT, ESP_EVENT_ANY_ID, &eth_event_handler, NULL);
    esp_event_handler_register(IP_EVENT, IP_EVENT_ETH_GOT_IP, &got_ip_event_handler, NULL);

    // Khởi động Ethernet
    esp_eth_start(eth_handle);

    ESP_LOGI(TAG, "Successful configure Ethernet use W5500.");
    return ret;
}

// Khai báo các Handler ngay trong module để bắt sự kiện cắm cáp, có IP...
static void eth_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    // Xử lý báo cáp kết nối / ngắt kết nối
}

static void got_ip_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
    ESP_LOGI(TAG, "Đã nhận IP: " IPSTR, IP2STR(&event->ip_info.ip));
}
