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

#define SELECT_PIN GPIO_NUM_47     // Nút Select
#define BACK_PIN GPIO_NUM_35       // Nút Back
#define NEXT_PIN GPIO_NUM_21       // Nút Next
#define ENCODER_SW_PIN GPIO_NUM_36 // Nút nhấn của Encoder

// ====== QUẢN LÝ TRẠNG THÁI =======
typedef enum
{
    EVENT_UP,   // Dùng cho Encoder khi xoay lên
    EVENT_DOWN, // Dùng cho Encoder khi xoay xuống
    EVENT_SELECT,
    EVENT_BACK,
    EVENT_NEXT
} ui_event_t;

typedef enum
{
    PAGE_1_HOME,
    PAGE_2_SETTINGS,
    PAGE_3_INFO_DEVICE
} ui_page_t;

// // Các mục bên trong các mục con ở Menu Settings
// typedef enum
// {

// } ui_baurate_t;

// typedef enum
// {

// } ui_scan_t;
// typedef enum
// {

// } ui_info_t;

void ui_task(void);

#endif