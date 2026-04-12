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
#include "lcd_user.h"
#include "rtc_mb.h"

static const char *TAG = "[LCD USER]";
static ui_page_t current_page = PAGE_1_HOME; // Trang mặc định ban đầu khi khởi động
static int menu_cursor = 1;                  // Dòng đang chọn 1, 2, 3 cho Page 2
static QueueHandle_t ui_queue = NULL;

bool wifi_connected = false;
bool eth_connected = false;
bool blu_connected = false;

// Quản lý tình trạng các nút nhấn
void button_handler_task(void *arg)
{
    gpio_config_t btn_cfg = {
        .pin_bit_mask = (1ULL << SELECT_PIN) | (1ULL << BACK_PIN) | (1ULL << NEXT_PIN),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE};
    gpio_config(&btn_cfg);
    ui_event_t button_event;
    while (1)
    {
        // Kiểm tra nút SELECT
        if (gpio_get_level(SELECT_PIN) == 0)
        {
            vTaskDelay(pdMS_TO_TICKS(100)); // Chống rung
            if (gpio_get_level(SELECT_PIN) == 0)
            {
                button_event = EVENT_SELECT;
                xQueueSend(ui_queue, &button_event, 0);
                while (gpio_get_level(SELECT_PIN) == 0)
                    vTaskDelay(pdMS_TO_TICKS(10)); // Người dùng nhấn giữ nút
            }
        }
        // Kiểm tra nút BACK
        if (gpio_get_level(BACK_PIN) == 0)
        {
            vTaskDelay(pdMS_TO_TICKS(100)); // Chống rung
            if (gpio_get_level(BACK_PIN) == 0)
            {
                button_event = EVENT_BACK;
                xQueueSend(ui_queue, &button_event, 0); // 0: thời gian đợi queue - nếu còn tróng thì bỏ vô không thì bỏ dữ liệu đó luôn :)))
                while (gpio_get_level(BACK_PIN) == 0)
                    vTaskDelay(pdMS_TO_TICKS(10)); // Người dùng nhấn giữ nút
            }
        }
        // Kiểm tra nút NEXT
        if (gpio_get_level(NEXT_PIN) == 0)
        {
            vTaskDelay(pdMS_TO_TICKS(100)); // Chống rung
            if (gpio_get_level(NEXT_PIN) == 0)
            {
                button_event = EVENT_NEXT;
                xQueueSend(ui_queue, &button_event, 0);
                while (gpio_get_level(NEXT_PIN) == 0)
                    vTaskDelay(pdMS_TO_TICKS(10)); // Người dùng nhấn giữ nút
            }
        }
        vTaskDelay(pdMS_TO_TICKS(50)); // 50ms kiểm tra nút nhấn 1 lần
    }
}

// Quản lý tình trạng Encoder
static void encoder_handler_task(void *arg)
{
    int last_count = 0, current_count = 0;
    ui_event_t encoder_event;
    while (1)
    {
        pcnt_unit_get_count(pcnt_unit, &current_count);
        if (current_count != last_count)
        {
            encoder_event = (current_count > last_count) ? EVENT_DOWN : EVENT_UP;
            xQueueSend(ui_queue, &encoder_event, 0);
            last_count = current_count;
        }
        vTaskDelay(pdMS_TO_TICKS(50)); // 50ms kiểm tra encoder 1 lần
    }
}

// Hàm vẽ Home page
static void page_1_home(void)
{
    char buffer[20] = {0};
    rtc_time_t now;      // Lấy thời gian từ RTC
    rtc_read_time(&now); // Lấy thời gian từ RTC

    LCD_SetCursor(0, 0);
    snprintf(buffer, sizeof(buffer), "TIME:  %02d:%02d:%02d", now.hour, now.minute, now.second);
    LCD_Print(buffer);

    LCD_SetCursor(1, 0);
    LCD_Print(eth_connected ? "ETH : Connected" : "ETH : Disconnected");

    LCD_SetCursor(2, 0);
    LCD_Print(wifi_connected ? "WIFI: Connected" : "WIFI: Disconnected");

    LCD_SetCursor(3, 0);
    LCD_Print(blu_connected ? "BLU : Connected" : "BLU : Disconnected");
}

// Hàm vẽ Menu Setting page
static void page_2_settings(void)
{
    LCD_SetCursor(0, 0);
    LCD_Print("-Menu Settings-"); // Dòng tiêu đề

    LCD_SetCursor(1, 0);
    LCD_Print(menu_cursor == 1 ? ">Baudrate" : " Baudrate");

    LCD_SetCursor(2, 0);
    LCD_Print(menu_cursor == 2 ? ">Scan Device" : " Scan Device");

    LCD_SetCursor(3, 0);
    LCD_Print(menu_cursor == 3 ? ">Info Network" : " Info Network");
}

static void page_3_info_device(void)
{
    LCD_SetCursor(0, 0);
    LCD_Print("--Info Device--");

    LCD_SetCursor(1, 0);
    LCD_Print("Name: MB-Gateway");

    LCD_SetCursor(2, 0);
    LCD_Print("Firmware: v1.0.0");

    LCD_SetCursor(3, 0);
    char buffer[20] = {0};
    time_t now_time;
    struct tm time_active;
    time(&now_time);                      // Lấy số giây tổng hiện tại
    localtime_r(&now_time, &time_active); // Chuyển số giây tổng thành giờ phút giây để hiển thị
    snprintf(buffer, sizeof(buffer), "Active: %02d:%02d:%02d",
             time_active.tm_hour, time_active.tm_min, time_active.tm_sec);
    LCD_Print(buffer);
}

void ui_task(void)
{
    ui_queue = xQueueCreate(10, sizeof(ui_event_t));
    ui_event_t event;
    // Các task phụ trách input
    xTaskCreatePinnedToCore(button_handler_task, "button_task", 4096, NULL, 5, NULL, 1);
    xTaskCreatePinnedToCore(encoder_handler_task, "encoder_task", 4096, NULL, 5, NULL, 1);

    while (1)
    {
        // Kiểm tra hàng đợi sự kiện
        if (xQueueReceive(ui_queue, &event, pdMS_TO_TICKS(100)) == pdTRUE)
        {
            switch (event)
            {
            case EVENT_SELECT:
                // Nếu đang ở Home, nhấn SELECT để vào Menu
                if (current_page == PAGE_1_HOME)
                {
                    current_page = PAGE_2_SETTINGS;
                    menu_cursor = 1; // Bắt đầu ở mục đầu tiên
                    lcd_clear();
                }
                // Nếu đang ở Menu, nhấn SELECT để thực thi mục đang trỏ vào
                else if (current_page == PAGE_2_SETTINGS)
                {
                    ESP_LOGI(TAG, "Thuc thi muc: %d", menu_cursor);
                }
                break;

            case EVENT_BACK:
                // Nếu đang ở Menu, nhấn BACK thì vẫn là Home page
                if (current_page == PAGE_2_SETTINGS)
                {
                    current_page = PAGE_1_HOME;
                    lcd_clear();
                }
                else if (current_page == PAGE_3_INFO_DEVICE)
                {
                    current_page = PAGE_2_SETTINGS;
                    menu_cursor = 1; // Quay về Menu Settings và trỏ vào mục đầu tiên
                    lcd_clear();
                }
                break;

            case EVENT_DOWN:
                if (current_page == PAGE_2_SETTINGS && menu_cursor < 3)
                    menu_cursor++;
                break;

            case EVENT_UP:
                if (current_page == PAGE_2_SETTINGS && menu_cursor > 1)
                    menu_cursor--;
                break;

            case EVENT_NEXT:
                if (current_page == PAGE_1_HOME)
                {
                    current_page = PAGE_2_SETTINGS;
                }
                else if (current_page == PAGE_2_SETTINGS)
                {
                    current_page = PAGE_3_INFO_DEVICE; // Trang mới của em
                }
                else
                {
                    current_page = PAGE_1_HOME; // Quay vòng về trang đầu
                }
                lcd_clear(); // Quan trọng: Xóa màn hình để vẽ trang mới sạch sẽ
                break;

            default:
                break;
            }
        }

        // Vẽ màn hình dựa trên trang hiện tại
        if (current_page == PAGE_1_HOME)
        {
            page_1_home();
        }
        else if (current_page == PAGE_2_SETTINGS)
        {
            page_2_settings();
        }
        else if (current_page == PAGE_3_INFO_DEVICE)
        {
            page_3_info_device();
        }
    }
}