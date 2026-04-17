#include <stdio.h>
#include <string.h>
#include <sys/param.h>
#include "driver/uart.h" // for the uart driver access
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "freertos/portmacro.h"
#include "freertos/task.h"
#include "freertos/portable.h"
#include "freertos/event_groups.h"

// Modbus library
#include "esp_modbus_master.h"
#include "esp_modbus_common.h"
#include "rtc_mb.h"

// user library
#include "modbus_rtu.h"

#define TCP_PORT 502
#define TCP_SLAVE_ADDRESS 1

void modbus_tcp_server_init(void);
void modbus_tcp_server_task(void *pvParameters);