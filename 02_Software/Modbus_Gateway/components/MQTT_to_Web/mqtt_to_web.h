#ifndef MQTT_USER_H
#define MQTT_USER_H

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "mqtt_client.h"

// Task handle để có thể xóa task khi đổi baudrate hoặc scan
extern TaskHandle_t mqtt_handle_task;

// Hàm khởi tạo và task thực thi
void mqtt_app_start(void);
void mqtt_publish_task(void *pvParameters);

// Hàm đóng gói cJSON (để gọn code)
char *pack_data_to_json(void);

#endif