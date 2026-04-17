#ifndef SYSTEM_EVENTS_H
#define SYSTEM_EVENTS_H

#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"

#define WIFI_CONNECTED_BIT (1 << 0)     // Bit 0
#define WIFI_FAIL_BIT (1 << 1)          // Bit 1
#define MODBUS_TCP_READY (1 << 2)       // Bit 2
#define MODBUS_RTU_READY (1 << 3)       // Bit 3
#define MQTT_CONNECTED_BIT (1 << 4)     // Bit 4
#define ETHERNET_CONNECTED_BIT (1 << 5) // Bit 5
extern EventGroupHandle_t event_group;

#endif