#include <stdio.h>
#include <string.h>
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"

// user library
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

void modbus_tcp_server_task(void *arg)
{
    ESP_LOGW(TAG, "Data copy task is starting...");

    // Đợi cấu hình từ NVS - phải có để biết số lượng thanh ghi
    while (register_count == 0)
    {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }

    // Khởi tạo vùng nhớ ảo để lưu dữ liệu đọc về từ task rtu
    if (tcp_virtual_storage == NULL)
    {
        tcp_virtual_storage = (float *)calloc(register_count, sizeof(float));
        if (tcp_virtual_storage == NULL)
        {
            ESP_LOGE(TAG, "Không thể cấp phát tcp_virtual_storage!");
            vTaskDelete(NULL);
            return;
        }
    }

    while (1)
    {
        if (is_change_baud == true || is_scan_device == true)
        {
            vTaskDelay(pdMS_TO_TICKS(200));
            continue;
        }

        // Dùng timeout dài hơn để tránh priority inheritance timeout trên dual-core
        // RTU task có thể giữ mutex đến vài trăm ms khi chờ thiết bị Modbus trả lời
        if (xSemaphoreTake(xDataMutex, pdMS_TO_TICKS(2000)) == pdTRUE)
        {
            if (is_change_baud == true || is_scan_device == true)
            {
                xSemaphoreGive(xDataMutex);
                vTaskDelay(pdMS_TO_TICKS(200));
                continue;
            }
            // Copy toàn bộ final_data vào tcp_virtual_storage
            memcpy(tcp_virtual_storage, final_data, register_count * sizeof(float));
            xSemaphoreGive(xDataMutex);
        }
        else
        {
            // Timeout sau 2 giây — RTU task có vấn đề, bỏ qua lần này
            ESP_LOGW(TAG, "xDataMutex timeout sau 2s, bỏ qua lần copy này.");
        }

        vTaskDelay(pdMS_TO_TICKS(7000));
    }
}