#ifndef LCD_USER_H
#define LCD_USER_H

#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "driver/gpio.h"
#include "esp_log.h"

#include "lcd_16x4.h"
#include "encoder_ec11.h"

#define SELECT_PIN GPIO_NUM_47         // Nút Select
#define BACK_PIN GPIO_NUM_35           // Nút Back
#define NEXT_PIN GPIO_NUM_21           // Nút Next
#define ENCODER_SELECT_PIN GPIO_NUM_36 // Nút nhấn của Encoder

// EVENT cho nút nhấn
typedef enum
{
    EVENT_UP,     // Dùng cho Encoder khi xoay lên
    EVENT_DOWN,   // Dùng cho Encoder khi xoay xuống
    EVENT_SELECT, // Chung chức năng với nút chọn của encoder
    EVENT_EN_SELECT,
    EVENT_BACK,
    EVENT_NEXT
} ui_event_t;

// Các trang hiện có trong thiết bị
typedef enum
{
    PAGE_1_HOME,
    PAGE_2_SETTINGS,
    PAGE_3_INFO_DEVICE,
    PAGE_SCAN_RESULT,
    PAGE_SCAN_DETAIL,
    PAGE_SET_BAUDRATE,
    PAGE_SET_POLL,
    PAGE_BLE_CONTROL,
} ui_page_t;

// Biến trạng thái
extern bool is_scanning;
extern bool wifi_connected;
extern bool eth_connected;
extern bool blu_connected;

void ui_task(void);

#endif