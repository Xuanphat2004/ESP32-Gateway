#ifndef EEPROM_H
#define EEPROM_H

#include <string.h>
#include <stdio.h>
#include "sdkconfig.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/i2c_master.h"
#include "esp_err.h"
#include "i2c_config.h"

// Parameter of EEPROM - AT24C256C
#define LEN_ADDR 7
#define DEV_ADDR 0x50
#define EEP_SPEED 100000

esp_err_t eeprom_init(void);

// Max write 64 bytes in 1 page
esp_err_t eeprom_write(uint16_t address, const uint8_t *data, size_t size);

esp_err_t eeprom_read(uint16_t address, uint8_t *data, size_t size);

#endif