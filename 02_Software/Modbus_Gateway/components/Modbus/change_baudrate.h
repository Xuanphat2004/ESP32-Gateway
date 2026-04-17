// File: components/Modbus/change_baudrate.h
#ifndef CHANGE_BAUDRATE_H
#define CHANGE_BAUDRATE_H

#include <stdio.h>
#include "esp_err.h"
#include "nvs_flash.h"

uint32_t load_baud_from_nvs(void);
esp_err_t save_baud_to_nvs(uint32_t baud);
void change_baudrate(void);

#endif