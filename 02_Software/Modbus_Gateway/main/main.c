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
#include "i2c_config.h"
#include "eeprom.h"
#include "rtc_mb.h"
#include "lcd_16x4.h"
#include "system_event.h"
#include "ble.h"
#include "encoder_ec11.h"
#include "lcd_user.h"
#include "mqtt_to_web.h"
#include "sd_card.h"
#include "scan_device.h"
#include "offline_buffer.h"
#include "change_poll.h"

SemaphoreHandle_t xDataMutex = NULL;
SemaphoreHandle_t scan_sem = NULL;
SemaphoreHandle_t data_ready_sem = NULL;
EventGroupHandle_t event_group;
TaskHandle_t rtu_handle_task = NULL;
TaskHandle_t mqtt_handle_task = NULL;
extern scan_analysis_t scan_result;

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
    scan_sem = xSemaphoreCreateBinary();
    data_ready_sem = xSemaphoreCreateBinary();
    lcd_clear();
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    eth_init();
    i2c_config();
    eeprom_init();
    rtc_a_init();
    wifi_Init();
    ble_server_init();
    modbus_rtu_port_1_init();
    lcd_1604_init();
    init_pcnt_encoder();
    sd_card_init();
    offline_buf_init();
    poll_interval_ms = load_poll_from_nvs();
    ESP_LOGI("MAIN", "Poll interval: %lu ms", poll_interval_ms);
    vTaskDelay(pdMS_TO_TICKS(2000));
    ESP_LOGW("MAIN", "Total heap: %lu | Internal DRAM: %u bytes",
             esp_get_free_heap_size(),
             heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT));
    mqtt_app_start();

    // Core 0: Các task liên quan tới mạng
    xTaskCreatePinnedToCore(mqtt_publish_task, "mqtt_task", 10240, NULL, 9, &mqtt_handle_task, 0);

    // Core 1: Các task liên quan tới giao diện và xử lý tại thiết bị
    xTaskCreatePinnedToCore((void *)modbus_test_read, "rtu_server_task", 8192, NULL, 10, &rtu_handle_task, 1);
    xTaskCreatePinnedToCore(passive_scan_task, "passive_scan", 6144, NULL, 6, NULL, 0);
    xTaskCreatePinnedToCore(auto_rescan_task, "auto_rescan", 2048, NULL, 4, NULL, 0);
    xTaskCreatePinnedToCore((void *)ui_task, "ui_manager_task", 6144, NULL, 5, NULL, 1);
    xTaskCreatePinnedToCore(sd_card_logger_task, "sd_card_logger", 8192, NULL, 4, NULL, 1);
    vTaskDelay(pdMS_TO_TICKS(1000));
    ESP_LOGW("MAIN", "After tasks — Total: %lu | Internal DRAM: %u bytes",
             esp_get_free_heap_size(),
             heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT));
}