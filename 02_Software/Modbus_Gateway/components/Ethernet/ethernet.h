#ifndef SPI_H
#define SPI_H

#include <stdint.h>
#include "esp_log.h"
#include "driver/spi_master.h"
#include "driver/gpio.h"
#include "driver/spi_common.h"

#define SPI_ETH_HOST SPI2_HOST
#define INT_ETH_PIN GPIO_NUM_10
#define MOSI_ETH_PIN GPIO_NUM_11
#define CLK_ETH_PIN GPIO_NUM_12
#define MISO_ETH_PIN GPIO_NUM_13
#define CS_ETH_PIN GPIO_NUM_14

#define CLK_SPEED (20 * 1000 * 1000)
#define POLLING_STATUS_TIME 1000

#endif // SPI_H