#ifndef SPI_H
#define SPI_H

#include <stdint.h>
#include "esp_log.h"
#include "driver/spi_master.h"
#include "driver/gpio.h"

typedef enum
{
    SPI_CLOCK_100kHz = 100000,
    SPI_CLOCK_400kHz = 400000,
    SPI_CLOCK_1MHz = 1000000,
    SPI_CLOCK_5MHz = 5000000,
    SPI_CLOCK_10MHz = 10000000,
    SPI_CLOCK_20MHz = 20000000,
    SPI_CLOCK_40MHz = 40000000,
} spi_config_clock_t;

#endif // SPI_H