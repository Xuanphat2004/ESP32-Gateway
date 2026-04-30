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
#include "change_baudrate.h"

// static const char *TAG = "[LCD USER]";
ui_page_t current_page = PAGE_1_HOME; // Trang mặc định ban đầu khi khởi động
static int menu_cursor = 1;           // Dòng đang chọn 1, 2, 3 cho Page 2
static QueueHandle_t ui_queue = NULL;
uint32_t baud_options[] = {1200, 2400, 4800, 9600, 19200, 38400, 115200};
int baudrate_id = 3; // Mặc định là 9600

bool wifi_connected = false;
bool eth_connected = false;
bool blu_connected = false;
bool is_scanning = false; // Biền trạng thái để khóa UI khi thực hiện chức năng scan
bool is_baudrate = false; // trạng thái có đang thực hiện chức năng chỉnh tốc độ baudrate

extern id_scan_result_t list_p1;
extern id_scan_result_t list_p2;
extern id_scan_result_t active_list;
extern id_scan_result_t inactive_list;
extern uint8_t original_id[248];
extern uint8_t original_id_count;
extern scan_analysis_t scan_result;

//=============================================================================================
// Hàm chuyển mảng ID thành chuỗi "1, 4, 5"
static void format_id_list(uint8_t *ids, int count, char *output)
{
    output[0] = '\0';
    char temp[5];
    for (int i = 0; i < count; i++)
    {
        snprintf(temp, sizeof(temp), (i == count - 1) ? "%d" : "%d,", ids[i]);

        // Kiểm tra nếu thêm ID tiếp theo sẽ vượt quá 12 ký tự (để vừa dòng LCD)
        if (strlen(output) + strlen(temp) > 16) // strlen: đếm số lượng ký tự không tính \0
        {
            strcat(output, ".."); // Thêm dấu .. báo hiệu còn nữa nhưng hết chỗ
            break;
        }
        strcat(output, temp); // nối chuỗi
    }
}
//============================================================================================

//=============================================================================================
// Các page
static void page_1_home(void)
{
    char buffer[20] = {0};
    rtc_time_t now;
    rtc_read_time(&now); // Thời gian từ module RTC rời

    LCD_SetCursor(0, 2);
    snprintf(buffer, sizeof(buffer), "TIME:  %02d:%02d:%02d", now.hour, now.minute, now.second);
    LCD_Print(buffer);
    LCD_SetCursor(1, 2);
    LCD_Print(eth_connected ? "ETH : Connected   " : "ETH : Disconnect  f");
    LCD_SetCursor(2, 2);
    LCD_Print(wifi_connected ? "WIFI: Connected  " : "WIFI: Disconnect  ");
    LCD_SetCursor(3, 2);
    LCD_Print(blu_connected ? "BLU : Connected   " : "BLU : Disconnect  ");
}

static void page_2_settings(void)
{
    LCD_SetCursor(0, 1);
    LCD_Print("-=MENU SETTINGS=-");
    LCD_SetCursor(1, 1);
    LCD_Print(menu_cursor == 1 ? "-->Baudrate   " : "   Baudrate       ");
    LCD_SetCursor(2, 1);
    LCD_Print(menu_cursor == 2 ? "-->Scan Device   " : "   Scan Device    ");
    LCD_SetCursor(3, 1);
    LCD_Print(menu_cursor == 3 ? "-->Network Info   " : "   Network Info   ");
}

static void page_3_info_device(void)
{
    LCD_SetCursor(0, 2);
    LCD_Print("-=DEVICE INFO=- ");
    LCD_SetCursor(1, 0);
    LCD_Print("  Name  : MB-Gateway");
    LCD_SetCursor(2, 0);
    LCD_Print("Firmware: v1.0.0");
    LCD_SetCursor(3, 0);
    char buffer[21] = {0}; // 20 Ký tự + 1 ký tự \0
    time_t now_time;
    struct tm time_active;
    time(&now_time);
    localtime_r(&now_time, &time_active); // Thời gian trong bộ RTC nội của ESP
    snprintf(buffer, sizeof(buffer), " Active : %02d:%02d:%02d", time_active.tm_hour, time_active.tm_min, time_active.tm_sec);
    LCD_Print(buffer);
}

static void page_scan_result(void)
{
    // lcd_clear();
    char buffer[21] = {0};
    LCD_SetCursor(0, 2);
    LCD_Print("-=SCAN RESULT=-");
    get_active_list();

    // Hiển thị danh sách ID Active
    LCD_SetCursor(1, 1);
    LCD_Print("Active  :");
    LCD_SetCursor(1, 11);
    if (active_list.count > 0)
    {
        format_id_list(active_list.id, active_list.count, buffer); // Biến mảng thành chuỗi string
        LCD_Print(buffer);                                         // In danh sách ID
    }
    else
        LCD_Print("None"); // Nếu danh sách trống

    // Hiển thị danh sách ID Inactive
    get_inactive_list();
    LCD_SetCursor(2, 1);
    LCD_Print("Inactive:");
    LCD_SetCursor(2, 11);
    if (inactive_list.count > 0)
    {
        format_id_list(inactive_list.id, inactive_list.count, buffer);
        LCD_Print(buffer);
    }
    else
        LCD_Print("None"); // Nếu danh sách trống

    LCD_SetCursor(3, 12);
    LCD_Print("Detail->");
}

// hiển thị chi tiết tình trạng trên đường truyền
static void page_scan_detail(void)
{
    char line_2[32] = ""; // Chứa thông tin đoạn dây đứt
    char line_3[32] = ""; // Chứa danh sách Lose
    char line_4[32] = ""; // Chứa thông tin Master port

    // Nếu chỉ đứt 1 chỗ
    if (scan_result.final_id_p1 + 1 == scan_result.final_id_p2 ||
        (scan_result.final_id_p2 == original_id_count && scan_result.final_id_p1 == original_id_count - 2) ||
        (scan_result.final_id_p1 == -1 && scan_result.final_id_p2 == 1))
    {
        if (scan_result.final_id_p1 == -1) // Nếu đứt tại port 1
            sprintf(line_2, "    P1-X-%d", original_id[0]);
        else if (scan_result.final_id_p2 == original_id_count)
            sprintf(line_2, "    %d-X-P2", original_id[original_id_count - 1]);
        else
            sprintf(line_2, "    %d-X-%d", original_id[scan_result.final_id_p1], original_id[scan_result.final_id_p2]);
    }

    // Nếu đứt 2 chỗ
    else if (scan_result.final_id_p1 + 1 < scan_result.final_id_p2)
    {
        char cut_1[10] = "";
        char cut_2[10] = "";

        if (scan_result.final_id_p1 == -1) // Nếu đứt tại port 1
        {
            sprintf(cut_1, "P1-X-%d", original_id[0]);
            // printf("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n");
        }

        else
        {
            sprintf(cut_1, "%d-X-%d", original_id[scan_result.final_id_p1], original_id[scan_result.final_id_p1 + 1]);
            // printf("try_1111111111111111\n");
        }

        if (scan_result.final_id_p2 == original_id_count) // Nếu đứt tại port 2
        {
            sprintf(cut_2, "%d-X-P2", original_id[original_id_count - 1]);
            // printf("bbbbbbbbbbbbbbb\n");
        }
        else
        {
            sprintf(cut_2, "%d-X-%d", original_id[scan_result.final_id_p2 - 1], original_id[scan_result.final_id_p2]);
            // printf("try_22222222222222\n");
        }

        sprintf(line_2, "%s  %s", cut_1, cut_2); // Gộp 2 điểm đứt vào cùng 1 dòng
    }
    else
    {
        sprintf(line_2, "   Line Normal");
    }

    // Hiển thị Lose List
    if (scan_result.lose_count > 0)
    {
        char lose_str[16] = "";
        format_id_list(scan_result.lose_list, scan_result.lose_count, lose_str); // Ghép chuỗi các id mất kết nối
        sprintf(line_3, "Lose: %s", lose_str);
    }
    else
    {
        sprintf(line_3, "No Lose   ");
    }

    // Xử lý dòng 4
    sprintf(line_4, "Master: Port %d ", scan_result.active_port);

    char buf2[21], buf3[21], buf4[21];
    sprintf(buf2, "%-20.20s", line_2); //"-16.16s", -: căn lề trái, 16.16: đảm bảo chỉ 16 ký tự
    sprintf(buf3, "%-20.20s", line_3);
    sprintf(buf4, "%-20.20s", line_4);

    LCD_SetCursor(0, 2);
    LCD_Print("-=LINE DETAIL=-  ");
    LCD_SetCursor(1, 2);
    LCD_Print(buf2);
    LCD_SetCursor(2, 2);
    LCD_Print(buf3);
    LCD_SetCursor(3, 2);
    LCD_Print(buf4);
}

// Page người dùng set baudrate
static void page_set_baud(void)
{
    char buffer_1[21], buffer_2[21]; // Dừng để giá trị tốc độ hiện tại đọc ra từ NVS và giá trị tốc độ người dùng muốn chọn
    uint32_t current_baud = load_baud_from_nvs();
    LCD_SetCursor(0, 2);
    LCD_Print("-=SET BAUDRATE=-  ");
    LCD_SetCursor(1, 1);
    snprintf(buffer_1, sizeof(buffer_1), "Current %ld bps", current_baud);
    LCD_Print(buffer_1);
    LCD_SetCursor(2, 1);
    snprintf(buffer_2, sizeof(buffer_2), "Select -> %ld ", baud_options[baudrate_id]);
    LCD_Print(buffer_2);
}
//=====================================================================================================

//=====================================================================================================
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
        if (gpio_get_level(SELECT_PIN) == 0) // Nút Select thường
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

        if (gpio_get_level(ENCODER_SELECT_PIN) == 0) // Nút Select của Encoder
        {
            vTaskDelay(pdMS_TO_TICKS(100));
            if (gpio_get_level(ENCODER_SELECT_PIN) == 0)
            {
                button_event = EVENT_EN_SELECT;
                xQueueSend(ui_queue, &button_event, 0);
                while (gpio_get_level(ENCODER_SELECT_PIN) == 0)
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

// Xử lý tác vụ của Encoder khi người dừng thao tác với nó
static void encoder_handler_task(void *arg)
{
    int last_count = 0;    // Số đếm lần gần nhất trước đó
    int current_count = 0; // Số đếm hiện tại
    ui_event_t encoder_event;
    while (1)
    {
        pcnt_unit_get_count(pcnt_unit, &current_count); // Đọc số đếm hiện tại trong thanh ghi của bộ PCNT
        if (current_count != last_count)
        {
            if (current_count > last_count) // Số đếm mà tăng lên thì là sẽ cuộn xuống
                encoder_event = EVENT_DOWN;
            else
                encoder_event = EVENT_UP; // Số đếm giảm thì cuộn lên
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

        if (xQueueReceive(ui_queue, &event, pdMS_TO_TICKS(100)) == pdTRUE)
        {
            if (is_scanning == false) // Tránh người dùng bấm nút khi đang scan
            {
                switch (event)
                {

                case EVENT_EN_SELECT: // 2 nút này có chung 1 chức năng
                case EVENT_SELECT:
                    if (current_page == PAGE_1_HOME)
                    {
                        lcd_clear();
                        current_page = PAGE_2_SETTINGS;
                        menu_cursor = 1;
                    }
                    else if (current_page == PAGE_2_SETTINGS)
                    {
                        if (menu_cursor == 1)
                        {
                            lcd_clear();
                            current_page = PAGE_SET_BAUDRATE;
                        }
                        else if (menu_cursor == 2) // Chọn Scan Device
                        {
                            lcd_clear();
                            is_scanning = true; // Khóa UI
                            LCD_SetCursor(1, 2);
                            LCD_Print("Scanning ....  ");
                            LCD_SetCursor(2, 2);
                            LCD_Print("Please wait ....  ");
                            vTaskDelay(pdMS_TO_TICKS(1000));
                            lcd_clear();
                            scan_device(); // Gọi hàm scan đã cấu hình task
                        }
                    }
                    else if (current_page == PAGE_SET_BAUDRATE)
                    {
                        lcd_clear();
                        is_scanning = true; // Khóa UI để tránh người dùng bấm nút khác lúc đang nạp
                        LCD_SetCursor(1, 2);
                        LCD_Print("Changing ....");
                        LCD_SetCursor(2, 2);
                        LCD_Print("Please wait ....");
                        change_baudrate();
                    }
                    break;

                case EVENT_BACK:
                    if (current_page == PAGE_1_HOME)
                        current_page = PAGE_1_HOME;

                    else if (current_page == PAGE_2_SETTINGS)
                    {
                        lcd_clear();
                        current_page = PAGE_1_HOME;
                    }
                    else if (current_page == PAGE_SCAN_RESULT)
                    {
                        lcd_clear();
                        current_page = PAGE_2_SETTINGS;
                    }

                    else if (current_page == PAGE_SCAN_DETAIL)
                    {
                        lcd_clear();
                        current_page = PAGE_SCAN_RESULT;
                    }

                    else if (current_page == PAGE_3_INFO_DEVICE)
                    {
                        lcd_clear();
                        current_page = PAGE_2_SETTINGS;
                        menu_cursor = 1;
                    }
                    else if (current_page == PAGE_SET_BAUDRATE)
                    {
                        lcd_clear();
                        current_page = PAGE_2_SETTINGS;
                        menu_cursor = 1;
                    }
                    break;

                case EVENT_DOWN:
                    if (current_page == PAGE_2_SETTINGS && menu_cursor < 3)
                        menu_cursor++;
                    else if (current_page == PAGE_SET_BAUDRATE && baudrate_id < 6)
                        baudrate_id++;
                    break;

                case EVENT_UP:
                    if (current_page == PAGE_2_SETTINGS && menu_cursor > 1)
                        menu_cursor--;
                    else if (current_page == PAGE_SET_BAUDRATE && baudrate_id > 0)
                        baudrate_id--;
                    break;

                case EVENT_NEXT:
                    lcd_clear();
                    if (current_page == PAGE_1_HOME)
                        current_page = PAGE_1_HOME;
                    else if (current_page == PAGE_2_SETTINGS)
                        current_page = PAGE_3_INFO_DEVICE;
                    else if (current_page == PAGE_SCAN_RESULT)
                        current_page = PAGE_SCAN_DETAIL;
                    break;

                default:
                    break;
                }
            }
        }

        if (is_scanning == false)
        {
            // Page Home
            if (current_page == PAGE_1_HOME)
                page_1_home();

            // Page settings
            else if (current_page == PAGE_2_SETTINGS)

                page_2_settings();
            else if (current_page == PAGE_SCAN_RESULT)
                page_scan_result();

            else if (current_page == PAGE_SCAN_DETAIL)
                page_scan_detail();

            else if (current_page == PAGE_SET_BAUDRATE)
                page_set_baud();

            // Page info device
            else if (current_page == PAGE_3_INFO_DEVICE)
                page_3_info_device();
        }
        else
        {
            vTaskDelay(pdMS_TO_TICKS(100));
        }
    }
}