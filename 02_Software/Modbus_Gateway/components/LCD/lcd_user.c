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
#include "scan_device.h"

static const char *TAG = "[LCD USER]";
ui_page_t current_page = PAGE_1_HOME; // Trang mặc định ban đầu khi khởi động
static int menu_cursor = 1;           // Dòng đang chọn 1, 2, 3 cho Page 2
static QueueHandle_t ui_queue = NULL;

bool wifi_connected = false;
bool eth_connected = false;
bool blu_connected = false;
bool is_scanning = false; // Biền trạng thái để khóa UI khi thực hiện chức năng scan

// Các biến kết quả từ scan_device.h
extern id_scan_result_t list_p1;
extern uint8_t original_id[248];
extern uint8_t original_id_count;

// --- CÁC HÀM VẼ GIAO DIỆN ---

static void page_1_home(void)
{
    char buffer[20] = {0};
    rtc_time_t now;
    rtc_read_time(&now);

    LCD_SetCursor(0, 0);
    snprintf(buffer, sizeof(buffer), "TIME:  %02d:%02d:%02d", now.hour, now.minute, now.second);
    LCD_Print(buffer);
    LCD_SetCursor(1, 0);
    LCD_Print(eth_connected ? "ETH : Connected  " : "ETH : Disconnected");
    LCD_SetCursor(2, 0);
    LCD_Print(wifi_connected ? "WIFI: Connected  " : "WIFI: Disconnected");
    LCD_SetCursor(3, 0);
    LCD_Print(blu_connected ? "BLU : Connected  " : "BLU : Disconnected");
}

static void page_2_settings(void)
{
    LCD_SetCursor(0, 0);
    LCD_Print("-Menu Settings-");
    LCD_SetCursor(1, 0);
    LCD_Print(menu_cursor == 1 ? "->Baudrate" : "  Baudrate");
    LCD_SetCursor(2, 0);
    LCD_Print(menu_cursor == 2 ? "->Scan Device" : "  Scan Device");
    LCD_SetCursor(3, 0);
    LCD_Print(menu_cursor == 3 ? "->Info Network" : "  Info Network");
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
    time(&now_time);
    localtime_r(&now_time, &time_active);
    snprintf(buffer, sizeof(buffer), "Active: %02d:%02d:%02d",
             time_active.tm_hour, time_active.tm_min, time_active.tm_sec);
    LCD_Print(buffer);
}

// Hàm chuyển mảng ID thành chuỗi "1, 4, 5"
void format_id_list(uint8_t *ids, int count, char *output)
{
    output[0] = '\0';
    char temp[5];
    for (int i = 0; i < count; i++)
    {
        snprintf(temp, sizeof(temp), (i == count - 1) ? "%d" : "%d,", ids[i]);

        // Kiểm tra nếu thêm ID tiếp theo sẽ vượt quá 12 ký tự (để vừa dòng LCD)
        if (strlen(output) + strlen(temp) > 12)
        {
            strcat(output, ".."); // Thêm dấu .. báo hiệu còn nữa nhưng hết chỗ
            break;
        }
        strcat(output, temp);
    }
}

// TRANG HIỂN THỊ KẾT QUẢ SAU KHI SCAN
static void page_scan_result(void)
{
    lcd_clear();
    char buffer[17] = {0}; // Giới hạn đúng 16 ký tự + 1 null cho LCD 1604
    LCD_SetCursor(0, 0);
    LCD_Print("-Scan ID Detail-");

    // Hiển thị danh sách ID Active
    LCD_SetCursor(1, 0);
    LCD_Print("Active:"); // In nhãn trước
    LCD_SetCursor(1, 8);  // Nhảy con trỏ đến vị trí thứ 5 (sau chữ "Act:")
    format_id_list(list_p1.id, list_p1.count, buffer);
    LCD_Print(buffer); // In danh sách ID

    // Tìm ID Inactive
    uint8_t inactive_ids[20];
    int inactive_count = 0;
    for (int i = 0; i < original_id_count; i++)
    {
        bool found = false;
        for (int j = 0; j < list_p1.count; j++)
        {
            if (original_id[i] == list_p1.id[j])
            {
                found = true;
                break;
            }
        }
        if (!found)
            inactive_ids[inactive_count++] = original_id[i];
    }

    // Hiển thị danh sách ID Inactive
    LCD_SetCursor(2, 0);
    LCD_Print("Inactive:");
    LCD_SetCursor(2, 10);
    if (inactive_count > 0)
    {
        format_id_list(inactive_ids, inactive_count, buffer);
        LCD_Print(buffer);
    }
    else
    {
        LCD_Print("None");
    }
}

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
        if (gpio_get_level(SELECT_PIN) == 0)
        {
            vTaskDelay(pdMS_TO_TICKS(100));
            if (gpio_get_level(SELECT_PIN) == 0)
            {
                button_event = EVENT_SELECT;
                xQueueSend(ui_queue, &button_event, 0);
                while (gpio_get_level(SELECT_PIN) == 0)
                    vTaskDelay(pdMS_TO_TICKS(10));
            }
        }
        if (gpio_get_level(BACK_PIN) == 0)
        {
            vTaskDelay(pdMS_TO_TICKS(100));
            if (gpio_get_level(BACK_PIN) == 0)
            {
                button_event = EVENT_BACK;
                xQueueSend(ui_queue, &button_event, 0);
                while (gpio_get_level(BACK_PIN) == 0)
                    vTaskDelay(pdMS_TO_TICKS(10));
            }
        }
        if (gpio_get_level(NEXT_PIN) == 0)
        {
            vTaskDelay(pdMS_TO_TICKS(100));
            if (gpio_get_level(NEXT_PIN) == 0)
            {
                button_event = EVENT_NEXT;
                xQueueSend(ui_queue, &button_event, 0);
                while (gpio_get_level(NEXT_PIN) == 0)
                    vTaskDelay(pdMS_TO_TICKS(10));
            }
        }
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}

static void encoder_handler_task(void *arg)
{
    int last_count = 0;
    int current_count = 0;
    ui_event_t encoder_event;
    while (1)
    {
        pcnt_unit_get_count(pcnt_unit, &current_count);
        if (current_count != last_count)
        {
            if (current_count > last_count)
                encoder_event = EVENT_DOWN;
            else
                encoder_event = EVENT_UP;
            xQueueSend(ui_queue, &encoder_event, 0);
            last_count = current_count;
        }
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}

// Task chính xử lý giao diện
void ui_task(void)
{
    ui_queue = xQueueCreate(10, sizeof(ui_event_t));
    ui_event_t event;
    xTaskCreatePinnedToCore(button_handler_task, "button_task", 4096, NULL, 5, NULL, 1);
    xTaskCreatePinnedToCore(encoder_handler_task, "encoder_task", 4096, NULL, 5, NULL, 1);

    while (1)
    {
        // 1. CHỈ XỬ LÝ NÚT NHẤN KHI KHÔNG SCANNING
        if (xQueueReceive(ui_queue, &event, pdMS_TO_TICKS(100)) == pdTRUE)
        {
            if (!is_scanning)
            {
                switch (event)
                {
                case EVENT_SELECT:
                    if (current_page == PAGE_1_HOME)
                    {
                        current_page = PAGE_2_SETTINGS;
                        menu_cursor = 1;
                        lcd_clear();
                    }
                    else if (current_page == PAGE_2_SETTINGS)
                    {
                        if (menu_cursor == 2) // Chọn Scan Device
                        {
                            is_scanning = true; // Khóa UI
                            lcd_clear();
                            LCD_SetCursor(1, 1);
                            LCD_Print("System Scanning");
                            LCD_SetCursor(2, 1);
                            LCD_Print("Please wait...");
                            scan_device(); // Gọi hàm scan đã cấu hình task
                        }
                    }
                    break;

                case EVENT_BACK:
                    if (current_page == PAGE_2_SETTINGS || current_page == PAGE_SCAN_RESULT)
                    {
                        current_page = PAGE_1_HOME;
                        lcd_clear();
                    }
                    else if (current_page == PAGE_3_INFO_DEVICE)
                    {
                        current_page = PAGE_2_SETTINGS;
                        menu_cursor = 1;
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
                        current_page = PAGE_2_SETTINGS;
                    else if (current_page == PAGE_2_SETTINGS)
                        current_page = PAGE_3_INFO_DEVICE;
                    lcd_clear(); // Quan trọng: Xóa màn hình để vẽ trang mới sạch sẽ
                    break;

                default:
                    break;
                }
            }
        }

                if (!is_scanning)
        {
            if (current_page == PAGE_1_HOME)
                page_1_home();
            else if (current_page == PAGE_2_SETTINGS)
                page_2_settings();
            else if (current_page == PAGE_3_INFO_DEVICE)
                page_3_info_device();
            else if (current_page == PAGE_SCAN_RESULT)
                page_scan_result();
        }
        else
        {
            // Trong lúc scan, không làm gì cả để giữ nguyên thông báo "Please wait"
            vTaskDelay(pdMS_TO_TICKS(200));
        }
    }
}