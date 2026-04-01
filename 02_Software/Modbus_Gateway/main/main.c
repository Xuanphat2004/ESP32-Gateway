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
#include "system_event.h"

SemaphoreHandle_t xDataMutex = NULL;
EventGroupHandle_t event_group;

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
    ESP_ERROR_CHECK(i2c_config());
    eeprom_init();
    rtc_a_init();
    wifi_Init();
    //  modbus_rtu_port_1_init();
    modbus_rtu_port_2_init();
    lcd_1604_init();

    xTaskCreatePinnedToCore((void *)modbus_test_read, "rtu_server_task", 4096, NULL, 8, NULL, 1);
    // xTaskCreatePinnedToCore((void *)lcd_display_task, "lcd_task", 4096, NULL, 4, NULL, 1);
    // xTaskCreatePinnedToCore((void *)modbus_tcp_task, "tcp_server_task", 4096, NULL, 10, NULL, 0);
    vTaskDelay(pdMS_TO_TICKS(1000));
}
