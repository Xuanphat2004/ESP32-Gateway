#include <stdio.h>
#include <string.h>
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "modbus_rtu.h"
#include "modbus_tcp.h"

static const char *TAG = "[Data-Copy]";

float *tcp_virtual_storage = NULL;

extern mb_parameter_descriptor_t *basic_dict;
extern SemaphoreHandle_t xDataMutex;
extern uint16_t register_count;
extern float *final_data;
extern bool is_change_baud;
extern bool is_scan_device;
extern volatile bool dual_port_polling; // block khi RTU đang poll dual port

void modbus_tcp_server_task(void *arg)
{
    ESP_LOGW(TAG, "Data copy task starting...");

    // Chờ có cấu hình thanh ghi
    while (register_count == 0)
        vTaskDelay(pdMS_TO_TICKS(1000));

    // Cấp phát bộ nhớ lưu bản sao dữ liệu cho MQTT đọc
    if (tcp_virtual_storage == NULL)
    {
        tcp_virtual_storage = calloc(register_count, sizeof(float));
        if (tcp_virtual_storage == NULL)
        {
            ESP_LOGE(TAG, "Alloc tcp_virtual_storage failed!");
            vTaskDelete(NULL);
            return;
        }
    }

    while (1)
    {
        // Chờ nếu hệ thống đang bận hoặc dual port chưa poll xong cả 2 port
        if (is_change_baud || is_scan_device || dual_port_polling)
        {
            vTaskDelay(pdMS_TO_TICKS(200));
            continue;
        }

        // Copy final_data → tcp_virtual_storage
        if (xSemaphoreTake(xDataMutex, pdMS_TO_TICKS(2000)) == pdTRUE)
        {
            // Kiểm tra lại sau khi lấy mutex (tránh race condition)
            if (!is_change_baud && !is_scan_device && !dual_port_polling)
                memcpy(tcp_virtual_storage, final_data, register_count * sizeof(float));
            xSemaphoreGive(xDataMutex);
        }
        else
        {
            ESP_LOGW(TAG, "xDataMutex timeout, skip copy.");
        }

        vTaskDelay(pdMS_TO_TICKS(7000));
    }
}