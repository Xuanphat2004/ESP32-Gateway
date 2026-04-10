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
#include "nvs_view.h"

static const char *TAG = "FLASH_INFO";
SemaphoreHandle_t xDataMutex = NULL;
EventGroupHandle_t event_group;
void print_partition_table_info(void);
void app_main(void)
{
    // print_partition_table_info();
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
    ble_server_init();
    run_nvs_diagnostic();
    //  modbus_rtu_port_1_init();
    modbus_rtu_port_2_init();
    lcd_1604_init();

    vTaskDelay(pdMS_TO_TICKS(1000));
    xTaskCreatePinnedToCore((void *)modbus_test_read, "rtu_server_task", 4096, NULL, 8, NULL, 1);
    // xTaskCreatePinnedToCore((void *)lcd_display_task, "lcd_task", 4096, NULL, 4, NULL, 1);
    // xTaskCreatePinnedToCore((void *)internet_test_task, "test_internet_task", 4096, NULL, 5, NULL, 0);
    // xTaskCreatePinnedToCore((void *)modbus_tcp_task, "tcp_server_task", 4096, NULL, 10, NULL, 0);

    vTaskDelay(pdMS_TO_TICKS(1000));
}
void print_partition_table_info(void)
{
    ESP_LOGI(TAG, "--------------------------------------------------");
    ESP_LOGI(TAG, "        DANH SACH PHAN VUNG TRÊN CHIP FLASH       ");
    ESP_LOGI(TAG, "--------------------------------------------------");

    // Tìm iterator để duyệt qua toàn bộ phân vùng
    esp_partition_iterator_t it = esp_partition_find(ESP_PARTITION_TYPE_ANY,
                                                     ESP_PARTITION_SUBTYPE_ANY,
                                                     NULL);

    while (it != NULL)
    {
        const esp_partition_t *p = esp_partition_get(it);

        // Tính toán kích thước ra KB cho dễ đọc
        float size_kb = (float)p->size / 1024.0f;

        ESP_LOGI(TAG, "Vung: %-10s | Loai: 0x%02x | Sub: 0x%02x | Size: %7.2f KB | Offset: 0x%08x",
                 p->label, p->type, p->subtype, size_kb, (unsigned int)p->address);

        it = esp_partition_next(it);
    }

    ESP_LOGI(TAG, "--------------------------------------------------");
    esp_partition_iterator_release(it);
}
