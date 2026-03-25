#include <string.h>
#include <stdio.h>
#include "sdkconfig.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/i2c_master.h"
#include "lwip/err.h"
#include "lwip/sockets.h"
#include "lwip/netdb.h"
#include "esp_err.h"
#include "i2c_config.h"
#include "rtc_mb.h"
#include "time.h"

static const char *TAG = "[MODBUS GATEWAY - RTC]";

// handle for eeprom
static i2c_master_dev_handle_t rtc_handle = NULL;

esp_err_t rtc_init(void);
esp_err_t rtc_set_time(uint8_t hours, uint8_t minutes, uint8_t seconds, uint8_t day, uint8_t date, uint8_t month, uint8_t year);
esp_err_t rtc_read_time(rtc_time_t *time_buffer);
esp_err_t get_time(void);
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

    i2c_device_config_t rtc_config = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
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
    uint8_t buffer[8] = {0}; // Buffer to hold the starting address and time data (7 bytes)
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
    // printf("Read time from RTC: %02d-%02d-20%02d --%d-- %02d:%02d:%02d\n",
    //        time_buffer->date,
    //        time_buffer->month,
    //        time_buffer->year,
    //        time_buffer->day,
    //        time_buffer->hour,
    //        time_buffer->minute,
    //        time_buffer->second);
    return err;
}

// Get time from NTP server and print it in human-readable format
esp_err_t get_time(void)
{
    uint8_t data_buffer[48] = {0};
    data_buffer[0] = 0x1B;

    // Create socket - open port and declare UDP protocol
    // addrinfo describes all information about the address of the server we want to connect to

    // Input - your request for the type of address you want to connect to
    struct addrinfo request_info = {0};

    // Output - endpoint lists (IP + port + protocol + type)
    struct addrinfo *response_info;

    // Declare what type of address you want to connect to (IPv4 + UDP) - tờ khai xin thông tin nơi muốn kết nối tới
    // User IPv4
    request_info.ai_family = AF_INET;

    // DGRAM (Datagram) is UDP, STREAM is TCP
    request_info.ai_socktype = SOCK_DGRAM;

    int err = getaddrinfo("pool.ntp.org", "123", &request_info, &response_info);
    if (err != 0 || response_info == NULL)
    {
        ESP_LOGE(TAG, "Don't have address information for NTP server !!!");
        return ESP_ERR_NOT_FOUND;
    }

    int sock = socket(response_info->ai_family,
                      response_info->ai_socktype,
                      response_info->ai_protocol);

    if (sock < 0)
    {
        ESP_LOGE(TAG, "Failed to create socket for NTP client !!!");

        // free the memory allocated of the address info DNS response
        freeaddrinfo(response_info);

        // Save error code
        int err = errno;
        printf("%d\n", err);
        return ESP_ERR_INVALID_STATE;
    }
    else
    {
        ESP_LOGI(TAG, "Successful to create UDP socket for NTP client");
    }

    // Timeout = second + microsecond
    struct timeval timeout;
    timeout.tv_sec = 3;  // 3 seconds
    timeout.tv_usec = 0; // 0 microseconds

    // Set timeout for receiving response from NTP server
    setsockopt(sock, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));

    sendto(sock,
           data_buffer,
           sizeof(data_buffer),
           0,
           response_info->ai_addr,
           response_info->ai_addrlen);

    int len = recvfrom(sock, data_buffer, sizeof(data_buffer), 0, NULL, NULL);
    if (len < 0)
    {
        ESP_LOGE(TAG, "Timeout or receive error !!!");

        close(sock);
        freeaddrinfo(response_info);

        return ESP_FAIL;
    }
    uint32_t ntp_time = 0;
    ntp_time = (data_buffer[40] << 24) |
               (data_buffer[41] << 16) |
               (data_buffer[42] << 8) |
               (data_buffer[43]);

    ntp_time = ntp_time - 2208988800U;

    // printf("time is: %lu\n", ntp_time);

    // Use time.h to convert raw NTP time into human-readable format
    // All function in time.h only work with time_t type
    time_t raw = (time_t)ntp_time;

    // UTC+7 = (UTC+0) + 7 hours -> add 7 hours to raw time
    raw += 7 * 3600;
    // printf("time after adding 7 hours: %llu\n", raw);
    // 3. Convert to struct tm
    struct tm time_info;
    gmtime_r(&raw, &time_info);

    printf("Time: %04d-%02d-%02d --%d-- %02d:%02d:%02d\n",
           time_info.tm_year + 1900,
           time_info.tm_mon + 1,
           time_info.tm_mday,
           time_info.tm_wday,
           time_info.tm_hour,
           time_info.tm_min,
           time_info.tm_sec);
    // rtc_set_time(uint8_t hours, uint8_t minutes, uint8_t seconds, uint8_t day, uint8_t date, uint8_t month, uint8_t year)
    // update time for RTC
    esp_err_t rtc_err = rtc_set_time(time_info.tm_hour,
                                     time_info.tm_min,
                                     time_info.tm_sec,
                                     time_info.tm_wday,
                                     time_info.tm_mday,
                                     time_info.tm_mon + 1,
                                     time_info.tm_year + 1900 - 2000);
    if (rtc_err == ESP_OK)
    {
        ESP_LOGI(TAG, "Successful to set time for RTC");
    }
    else
    {
        ESP_LOGE(TAG, "Failed to set time for RTC");
    }
    rtc_time_t my_time;
    rtc_err = rtc_read_time(&my_time);
    if (rtc_err == ESP_OK)
    {
        ESP_LOGI(TAG, "Successful to read time from RTC");
    }
    else
    {
        ESP_LOGE(TAG, "Failed to read time from RTC");
    }
    close(sock);                 // Close the UDP socket at port 123
    freeaddrinfo(response_info); // Free the memory allocated of the address info DNS response

    return ESP_OK;
}