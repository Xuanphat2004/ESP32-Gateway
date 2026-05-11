#pragma once

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"

// user library
#include "modbus_rtu.h"

void modbus_tcp_server_task(void *pvParameters);