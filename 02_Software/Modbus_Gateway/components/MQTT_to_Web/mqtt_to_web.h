#ifndef MQTT_USER_H
#define MQTT_USER_H

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "mqtt_client.h"

// Sử dụng HiveMQT Broker
// #define URL_BROKER "mqtts://f9baba6964f846fea65e27aeb2ac2c34.s1.eu.hivemq.cloud:8883" // HiveMQ Broker
// #define USER_NAME "xuanphat_mqtt"
// #define PASSWORD "Xp123456"

// Sử dụng test.mosquitto.org làm Broker
// #define URL_BROKER "mqtt://test.mosquitto.org:1883"
#define URL_BROKER "mqtt://broker.emqx.io:1883"
// #define URL_BROKER "mqtt://broker.hivemq.com"
#define BROKER_PORT 1883
#define PUBLISH_TOPIC "xuanphat2004/mbgateway/meter/update/data"
#define CLIENT_ID "XTXP-251104"

// Hàm khởi tạo và task thực thi
void mqtt_app_start(void);
void mqtt_publish_task(void *pvParameters);
void mqtt_network_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data);
char *pack_data_to_json(int id, char *name, char *model);

#endif
