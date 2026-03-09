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
// Thư viện tự khởi tạo
#include "wifi.h"
#include "ethernet.h"
#include "modbus_rtu.h"
static const char *TAG = "[APP MAIN]";

void app_main(void)
{
    // Khởi tạo Netif chung cho tất cả các giao tiếp với mạng
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    // get_wifi_mac_addr();
    wifi_Init();
    // ESP_ERROR_CHECK(eth_init());

    eth_init();
    // udp_send_task_test();
    // tcp_send_task_test();
    modbus_rtu_port_1_init();
    // xTaskCreate((void *)udp_send_task_test, "UDP_test_task", 4096, NULL, 5, NULL);
    // xTaskCreate((void *)tcp_send_task_test, "TCP_test_task", 4096, NULL, 5, NULL);
    xTaskCreate((void *)modbus_test_read, "modbus_rtu_test_task", 4096, NULL, 5, NULL);

    ESP_LOGI(TAG, "Run to here");
    vTaskDelay(pdMS_TO_TICKS(5000));
}
