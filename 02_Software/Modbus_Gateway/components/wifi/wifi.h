#ifndef WIFI_H
#define WIFI_H

#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "freertos/portmacro.h"
#include "freertos/task.h"
#include "freertos/portable.h"
#include "freertos/event_groups.h"

#include <time.h>
#include "esp_sntp.h"
#include "eeprom.h"

// #define ESP_WIFI_SSID "xuanphat_2.4GHz"
// #define ESP_WIFI_PASS "12345678"

// Thay đổi SSID mặc định thành SSID dùng cho chế độ cấu hình (AP)
#define AP_SSID_CONFIG "Modbus_Gateway_Setup"
#define AP_PASS_CONFIG "12345678"
#define MAX_WIFI_RETRY 3

// Cấu trúc để lưu SSID/PASS tạm thời từ Web
typedef struct
{
    char ssid[64];
    char password[64];
} wifi_config_web_t;

void wifi_Init(void);
void start_webserver(void); // Hàm khởi tạo Web Server
void get_wifi_mac_addr(void);

#endif

// Các giá trị trả về khi sử dụng kiểu dữ liệu esp_err_t (int)
// ESP_OK (giá trị là 0): Nghĩa là mọi thứ đều ổn, không có lỗi.
// ESP_FAIL (giá trị là -1): Lỗi chung, không xác định rõ nguyên nhân.
// ESP_ERR_NO_MEM (0x101): Hết bộ nhớ RAM để cấp phát cho driver.
// ESP_ERR_INVALID_ARG (0x102): Tham số truyền vào hàm bị sai (ví dụ sai số chân GPIO).