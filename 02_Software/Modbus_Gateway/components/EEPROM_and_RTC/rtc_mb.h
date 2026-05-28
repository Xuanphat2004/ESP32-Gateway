#ifndef RTC_H
#define RTC_H

#include <string.h>
#include <stdio.h>
#include "sdkconfig.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/i2c_master.h"
#include "esp_err.h"
#include "i2c_config.h"

// Parameter of RTC - DS3231#
#define LEN_RTC_ADDR 7
#define DEV_RTC_ADDR 0x68
#define RTC_SPEED 100000 // 100kHz

typedef struct
{
    uint8_t second; // 0-59
    uint8_t minute; // 0-59
    uint8_t hour;   // 0-23
    uint8_t day;    // Monday = 1, Tuesday = 2, ..., Sunday = 7
    uint8_t date;   // 1-31
    uint8_t month;  // 1-12
    uint8_t year;   // 0-99
} rtc_time_t;

esp_err_t rtc_a_init(void);
esp_err_t rtc_set_time(uint8_t hours, uint8_t minutes, uint8_t seconds, uint8_t day, uint8_t date, uint8_t month, uint8_t year);
esp_err_t rtc_read_time(rtc_time_t *time_buffer);
esp_err_t get_time(void);
void rtc_get_iso_timestamp(char *buf, size_t len);
#endif