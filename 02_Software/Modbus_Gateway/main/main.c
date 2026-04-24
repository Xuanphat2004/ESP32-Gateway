#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "freertos/portmacro.h"
#include "freertos/task.h"
#include "freertos/portable.h"
#include "freertos/event_groups.h"
#include "esp_netif.h"
#include "esp_err.h"
#include "esp_log.h"
#include "esp_event.h"
#include "rom/ets_sys.h"
#include "esp_partition.h"
#include "esp_log.h"
#include "esp_heap_caps.h"
#include "esp_flash.h"
#include "esp_psram.h"

// User components
#include "wifi.h"
#include "ethernet.h"
#include "modbus_rtu.h"
#include "modbus_tcp.h"
#include "i2c_config.h"
#include "eeprom.h"
#include "rtc_mb.h"
#include "lcd_16x4.h"
#include "system_event.h"
#include "ble.h"
// #include "nvs_view.h"
// #include "check_device.h"
#include "encoder_ec11.h"
#include "lcd_user.h"
#include "mqtt_to_web.h"
#include "sd_card.h"

SemaphoreHandle_t xDataMutex = NULL;
EventGroupHandle_t event_group;
TaskHandle_t tcp_handle_task = NULL; // biến handle cho task tcp
TaskHandle_t rtu_handle_task = NULL; // biến handle cho task rt
TaskHandle_t mqtt_handle_task = NULL;

void print_partition_table_info(void);
void check_spi_bus_mode(void);
void app_main(void)
{

    event_group = xEventGroupCreate();
    if (event_group == NULL)
    {
        ESP_LOGE("[APP MAIN]", "Couldn't create Event Group !!!");
    }
    else
    {
        ESP_LOGW("MAIN", "Event Group created successfully.");
    }

    xDataMutex = xSemaphoreCreateMutex();

    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    eth_init();
    i2c_config();
    eeprom_init();
    rtc_a_init();
    wifi_Init();
    ble_server_init();
    sd_card_init();
    modbus_rtu_port_1_init();
    lcd_1604_init();
    init_pcnt_encoder();

    vTaskDelay(pdMS_TO_TICKS(2000)); // đợi hệ thông ổn định trước khi tạo task
    mqtt_app_start();

    // Core 0: Các task liên quan tới mạng
    // xTaskCreatePinnedToCore((void *)internet_test_task, "test_internet_task", 4096, NULL, 5, NULL, 0);
    xTaskCreatePinnedToCore(modbus_tcp_server_task, "tcp_server_task", 4096, NULL, 8, &tcp_handle_task, 0);
    xTaskCreatePinnedToCore(mqtt_publish_task, "mqtt_task", 4096, NULL, 9, &mqtt_handle_task, 0);

    // Core 1: Các task liên quan tới giao diện người dùng và xử lý tại thiết bị
    xTaskCreatePinnedToCore((void *)modbus_test_read, "rtu_server_task", 4096, NULL, 8, &rtu_handle_task, 1);
    xTaskCreatePinnedToCore((void *)ui_task, "ui_manager_task", 4096, NULL, 5, NULL, 1);
    xTaskCreatePinnedToCore(sd_card_logger_task, "sd_card_logger", 8192, NULL, 4, NULL, 1);
    vTaskDelay(pdMS_TO_TICKS(1000));
}
