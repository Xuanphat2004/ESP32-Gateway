#ifndef MQTT_USER_H
#define MQTT_USER_H

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "mqtt_client.h"

#define URL_BROKER "mqtt://broker.emqx.io:1883"
#define BROKER_PORT 1883
#define PUBLISH_TOPIC "xuanphat2004/mbgateway/meter/update/data"
#define SCAN_TOPIC "xuanphat2004/mbgateway/scan/result"
#define CLIENT_ID "XTXP-251104"

void mqtt_app_start(void);
void mqtt_publish_task(void *pvParameters);
void publish_scan_result(void);
void mqtt_network_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data);
char *pack_data_to_json(int id, char *name, char *model, float *src_data, char *timestamp);

#endif