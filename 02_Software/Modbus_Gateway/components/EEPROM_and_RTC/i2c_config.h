#ifndef I2C_MANAGER_H
#define I2C_MANAGER_H

#include <string.h>
#include <stdio.h>
#include "sdkconfig.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/i2c_master.h"

#define I2C_MASTER_PORT I2C_NUM_1
#define SCL_PIN GPIO_NUM_5
#define SDA_PIN GPIO_NUM_4
#define I2C_MASTER_FREQ_HZ 100000 // 100K Hz

extern i2c_master_bus_handle_t bus_i2c_handle;
esp_err_t i2c_config(void);

#endif