#ifndef SD_CARD_H
#define SD_CARD_H

#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "driver/gpio.h"
#include "esp_err.h"

// Định nghĩa chân SPI2 cho SD Card
// version 1.0.0
// #define MISO_SD_PIN GPIO_NUM_48
// #define MOSI_SD_PIN GPIO_NUM_19
// #define CLK_SD_PIN GPIO_NUM_8
// #define CS_SD_PIN GPIO_NUM_20

// version 2.0.0
#define MISO_SD_PIN GPIO_NUM_18
#define MOSI_SD_PIN GPIO_NUM_19
#define CLK_SD_PIN GPIO_NUM_8
#define CS_SD_PIN GPIO_NUM_20

void sd_card_init(void);
void sd_card_logger_task(void *pvParameters);

#endif // SD_LOGGER_H