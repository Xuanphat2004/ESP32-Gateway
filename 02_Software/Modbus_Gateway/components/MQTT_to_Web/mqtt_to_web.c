#include "mqtt_user.h"
#include "cJSON.h"
#include "esp_log.h"
#include "modbus_rtu.h"
#include "freertos/semphr.h"

static const char *TAG = "MQTT_TASK";
TaskHandle_t mqtt_handle_task = NULL;
esp_mqtt_client_handle_t mqtt_client;

// Các biến extern từ hệ thống của Phát
extern float *final_data;
extern uint16_t register_count;
extern SemaphoreHandle_t xDataMutex;
extern bool is_change_baud;
extern bool is_scan_device;

char *pack_data_to_json(void)
{
    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "device", "ESP32_Gateway_Phat");

    cJSON *data_obj = cJSON_CreateObject();

    // Lấy Mutex để đảm bảo dữ liệu không bị thay đổi khi đang đóng gói
    if (xSemaphoreTake(xDataMutex, pdMS_TO_TICKS(500)) == pdTRUE)
    {
        for (int i = 0; i < register_count; i++)
        {
            // Kiểm tra khẩn cấp để nhả Mutex nếu có lệnh hệ thống
            if (is_change_baud || is_scan_device)
            {
                xSemaphoreGive(xDataMutex);
                cJSON_Delete(root);
                return NULL;
            }
            cJSON_AddNumberToObject(data_obj, basic_dict[i].param_key, final_data[i]);
        }
        xSemaphoreGive(xDataMutex);
    }
    else
    {
        cJSON_Delete(root);
        return NULL;
    }

    cJSON_AddItemToObject(root, "values", data_obj);
    char *my_json_string = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    return my_json_string;
}

void mqtt_publish_task(void *pvParameters)
{
    while (1)
    {
        // VỊ TRÍ 1: Kiểm tra cờ hệ thống trước khi làm việc
        if (is_change_baud || is_scan_device)
        {
            vTaskDelay(pdMS_TO_TICKS(500));
            continue;
        }

        // Đóng gói dữ liệu
        char *json_data = pack_data_to_json();

        if (json_data != NULL)
        {
            // Gửi lên MQTT Broker
            esp_mqtt_client_publish(mqtt_client, "/hcmut/energy/data", json_data, 0, 1, 0);
            ESP_LOGI(TAG, "Sent MQTT: %s", json_data);

            // BẮT BUỘC phải free vùng nhớ cJSON_Print tạo ra
            free(json_data);
        }

        // Chu kỳ gửi tin (ví dụ 10 giây một lần)
        vTaskDelay(pdMS_TO_TICKS(10000));
    }
}