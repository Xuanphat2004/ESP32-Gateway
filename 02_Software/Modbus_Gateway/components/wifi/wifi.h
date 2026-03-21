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

#define ESP_WIFI_SSID "xuanphat_2.4GHz"
#define ESP_WIFI_PASS "12345678"

void wifi_Init(void);
void get_wifi_mac_addr(void);

#endif

// Các giá trị trả về khi sử dụng kiểu dữ liệu esp_err_t (int)
// ESP_OK (giá trị là 0): Nghĩa là mọi thứ đều ổn, không có lỗi.
// ESP_FAIL (giá trị là -1): Lỗi chung, không xác định rõ nguyên nhân.
// ESP_ERR_NO_MEM (0x101): Hết bộ nhớ RAM để cấp phát cho driver.
// ESP_ERR_INVALID_ARG (0x102): Tham số truyền vào hàm bị sai (ví dụ sai số chân GPIO).