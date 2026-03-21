#include <string.h>
#include <stdio.h>
#include "sdkconfig.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/i2c_master.h"
#include "eeprom.h"
#include "i2c_config.h"
#include "rtc_mb.h"

static const char *TAG = "[MODBUS GATEWAY - RTC]";

// handle for eeprom
static i2c_master_dev_handle_t rtc_handle = NULL;
esp_err_t rtc_init(void);
esp_err_t rtc_set_time(uint8_t hours, uint8_t minutes, uint8_t seconds, uint8_t day, uint8_t date, uint8_t month, uint8_t year);
esp_err_t rtc_read_time(rtc_time_t *time_buffer);
static uint8_t dec_to_bcd(uint8_t dec_num);
static uint8_t bcd_to_dec(uint8_t bcd_num);

esp_err_t rtc_a_init(void)
{
    // Verify I2C bus configuration status
    if (bus_i2c_handle == NULL)
    {
        ESP_LOGE(TAG, "I2C bus handle is NULL !!!");
        return ESP_ERR_INVALID_STATE;
    }

    // Set parameter for EEPROM - AT24C256C
    i2c_device_config_t rtc_config = {
        .dev_addr_length = LEN_RTC_ADDR,
        .device_address = DEV_RTC_ADDR,
        .scl_speed_hz = RTC_SPEED, // 100kHz
    };

    // Add device into I2C bus
    esp_err_t err = i2c_master_bus_add_device(bus_i2c_handle, &rtc_config, &rtc_handle);
    if (err == ESP_OK)
    {
        ESP_LOGI(TAG, "Successful to configure for RTC and add device into I2C bus");
    }
    else
    {
        ESP_LOGE(TAG, "Failed to configure for RTC");
    }
    return err; // 1 or 0
}

// Transform Decimal into BCD
static uint8_t dec_to_bcd(uint8_t dec_num)
{
    uint8_t bcd_num = 0;
    bcd_num = (((dec_num / 10) << 4) | (dec_num % 10));
    return bcd_num;
}
static uint8_t bcd_to_dec(uint8_t bcd_num)
{
    uint8_t dec_num = 0;
    dec_num = ((bcd_num >> 4) * 10) + (bcd_num & 0x0F);
    return dec_num;
}

esp_err_t rtc_set_time(uint8_t hours, uint8_t minutes, uint8_t seconds, uint8_t day, uint8_t date, uint8_t month, uint8_t year)
{
    uint8_t buffer[8];
    if (rtc_handle == NULL)
    {
        return ESP_ERR_INVALID_STATE;
    }
    buffer[0] = 0x00; // Starting address to write time data
    buffer[1] = dec_to_bcd(seconds);
    buffer[2] = dec_to_bcd(minutes);
    buffer[3] = dec_to_bcd(hours);
    buffer[4] = dec_to_bcd(day);
    buffer[5] = dec_to_bcd(date);
    buffer[6] = dec_to_bcd(month);
    buffer[7] = dec_to_bcd(year);

    esp_err_t err = i2c_master_transmit(rtc_handle, buffer, sizeof(buffer), -1);

    return err;
}

esp_err_t rtc_read_time(rtc_time_t *time_buffer)
{
    if (rtc_handle == NULL)
    {
        return ESP_ERR_INVALID_STATE;
    }

    uint8_t start_addr = 0x00; // The start address to read
    uint8_t buffer[7];         // Empty buffer to receive 7 bytes of time data

    esp_err_t err = i2c_master_transmit_receive(rtc_handle, &start_addr, 1, buffer, 7, -1);

    if (err == ESP_OK)
    {
        time_buffer->second = bcd_to_dec(buffer[0]);
        time_buffer->minute = bcd_to_dec(buffer[1]);

        // Mask 0x3F (0011 1111) - bit 6 = 0 for user 24h format
        time_buffer->hour = bcd_to_dec(buffer[2] & 0x3F);

        time_buffer->day = bcd_to_dec(buffer[3]);
        time_buffer->date = bcd_to_dec(buffer[4]);

        // 0001 1111 - bit 7 = 0 for user century
        time_buffer->month = bcd_to_dec(buffer[5] & 0x1F);

        time_buffer->year = bcd_to_dec(buffer[6]);
    }

    return err;
}