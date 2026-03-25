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

// User components
#include "wifi.h"
#include "ethernet.h"
#include "modbus_rtu.h"
#include "modbus_tcp.h"
#include "i2c_config.h"
#include "eeprom.h"
#include "rtc_mb.h"
#include "lcd_16x4.h"

// static const char *TAG = "[APP MAIN]";

void app_main(void)
{
    // ets_delay_us(50000); // Delay 30ms
    //  Khởi tạo Netif chung cho tất cả các giao tiếp với mạng
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());
    eth_init();
    ESP_ERROR_CHECK(i2c_config());
    eeprom_init();
    rtc_a_init();
    // wifi_Init();
    // get_time();
    //  modbus_rtu_port_1_init();
    modbus_rtu_port_2_init();
    modbus_tcp_init();
    lcd_1604_init();
    vTaskDelay(pdMS_TO_TICKS(10000));
    xTaskCreate((void *)modbus_test_read, "modbus_rtu_test_task", 4096, NULL, 5, NULL);

    vTaskDelay(pdMS_TO_TICKS(1000));
}
