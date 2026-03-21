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

// User components
#include "wifi.h"
#include "ethernet.h"
#include "modbus_rtu.h"
#include "i2c_config.h"
#include "eeprom.h"
#include "rtc_mb.h"

static const char *TAG = "[APP MAIN]";

void app_main(void)
{

    // Khởi tạo Netif chung cho tất cả các giao tiếp với mạng
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    wifi_Init();
    eth_init();
    ESP_ERROR_CHECK(i2c_config());

    eeprom_init();
    esp_err_t err = rtc_a_init();

    //  modbus_rtu_port_1_init();
    modbus_rtu_port_2_init();

    xTaskCreate((void *)modbus_test_read, "modbus_rtu_test_task", 4096, NULL, 5, NULL);

    ESP_LOGI(TAG, "Run to here");
    vTaskDelay(pdMS_TO_TICKS(5000));
}
