#include <stdio.h>
#include <stdlib.h>
#include <time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "driver/gpio.h"
#include "esp_log.h"
#include "rom/ets_sys.h"

#include "lcd_16x4.h"
#include "encoder_ec11.h"
#include "lcd_user.h"
#include "rtc_mb.h"
#include "scan_device.h"
#include "change_baudrate.h"
#include "change_poll.h"
#include "esp_mac.h"
#include "ble.h"
#include "eeprom.h"

ui_page_t current_page = PAGE_1_HOME;
uint32_t baud_options[] = {1200, 2400, 4800, 9600, 19200, 38400, 115200};
int baudrate_id = 3;

bool wifi_connected = false;
bool eth_connected = false;
bool blu_connected = false;
bool is_scanning = false;
bool is_baudrate = false;

static int menu_cursor = 1;
static QueueHandle_t ui_queue = NULL;
static uint8_t enc_scroll = 0;
static uint32_t cached_baud = 0;
static uint32_t cached_poll = 0;
static bool need_clear_after_scan = false;
static int8_t sync_state = 0; // 0=idle, 1=success, 2=no network
static bool has_synced = false;
static rtc_time_t last_sync_time = {0};

extern char ble_device_name[24];
extern id_scan_result_t list_p1;
extern id_scan_result_t list_p2;
extern id_scan_result_t active_list;
extern id_scan_result_t inactive_list;
extern uint8_t original_id[248];
extern uint8_t original_id_count;
extern scan_analysis_t scan_result;
extern bool wire_p1_ok;
extern bool wire_p2_ok;
extern bool is_manual_scan;
extern char ble_device_name[24];

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

// Page 1
static void page_1_home(void)
{
    char buffer[20] = {0};
    rtc_time_t now;
    rtc_read_time(&now); // Thời gian từ module RTC rời

    LCD_SetCursor(0, 2);
    snprintf(buffer, sizeof(buffer), "TIME:  %02d:%02d:%02d", now.hour, now.minute, now.second);
    LCD_Print(buffer);
    LCD_SetCursor(1, 2);
    LCD_Print(eth_connected ? "ETH : Connected   " : "ETH : Disconnect  ");
    LCD_SetCursor(2, 2);
    LCD_Print(wifi_connected ? "WIFI: Connected  " : "WIFI: Disconnect  ");
    LCD_SetCursor(3, 2);
    LCD_Print(blu_connected ? "BLU : Connected   " : "BLU : Disconnect  ");
}

// Page 2 — 4 mục, scroll theo menu_cursor giống Device Info
static void page_2_settings(void)
{
    const char *items[] = {
        "Baudrate     ",
        "Scan Device  ",
        "Poll Interval",
        "Bluetooth    ",
        "Sync Time    "};
    const int num_items = 5;
    const int visible = 3;

    int offset = menu_cursor - visible;
    if (offset < 0)
        offset = 0;

    LCD_SetCursor(0, 1);
    LCD_Print("-=MENU SETTINGS=-  ");

    char buf[21];
    for (int row = 0; row < visible; row++)
    {
        int idx = offset + row;
        LCD_SetCursor(row + 1, 0);

        if (idx < num_items)
        {
            int selected = (menu_cursor == idx + 1);
            snprintf(buf, sizeof(buf), "%s%-17.17s", selected ? "-->" : "   ", items[idx]);
            LCD_Print(buf);
        }
        else
        {
            LCD_Print("                    ");
        }
    }
}

// Page 3
static void page_3_info_device(void)
{
    char active_buf[21] = " ";
    char mac_buf[21] = " "; // Chứa chuỗi địa chỉ MAC
    uint8_t mac_addr[6] = {0};
    time_t now_time;
    struct tm time_active;
    time(&now_time);

    localtime_r(&now_time, &time_active); // Thời gian trong bộ RTC nội của ESP
    snprintf(active_buf, sizeof(active_buf), "Active  : %02d:%02d:%02ds ", time_active.tm_hour, time_active.tm_min, time_active.tm_sec);

    esp_read_mac(mac_addr, ESP_MAC_EFUSE_FACTORY);
    snprintf(mac_buf, sizeof(mac_buf), " %02X:%02X:%02X:%02X:%02X:%02X", mac_addr[0], mac_addr[1], mac_addr[2], mac_addr[3], mac_addr[4], mac_addr[5]);

    LCD_SetCursor(0, 2);
    LCD_Print("-=DEVICE INFO=- ");

    // ID -> Name -> Active
    if (enc_scroll == 0)
    {
        LCD_SetCursor(1, 0);
        LCD_Print(mac_buf);
        LCD_SetCursor(2, 0);
        LCD_Print("Name    : MB-Gateway");
        LCD_SetCursor(3, 0);
        LCD_Print(active_buf);
    }

    // Name -> Active -> Hardware
    if (enc_scroll == 1)
    {
        LCD_SetCursor(1, 0);
        LCD_Print("Name    : MB-Gateway");
        LCD_SetCursor(2, 0);
        LCD_Print(active_buf);
        LCD_SetCursor(3, 0);
        LCD_Print("Hardware:  v1.0.0   ");
    }

    // Active-> Hardware -> Software
    if (enc_scroll == 2)
    {
        LCD_SetCursor(1, 0);
        LCD_Print(active_buf);
        LCD_SetCursor(2, 0);
        LCD_Print("Hardware:  v1.0.0   ");
        LCD_SetCursor(3, 0);
        LCD_Print("Firmware:  v2.0.0   ");
    }
    // Hardware -> Software -> Update
    if (enc_scroll == 3)
    {
        LCD_SetCursor(1, 0);
        LCD_Print("Hardware:  v1.0.0   ");
        LCD_SetCursor(2, 0);
        LCD_Print("Firmware:  v2.0.0   ");
        LCD_SetCursor(3, 0);
        LCD_Print("DC-In   : 12-24V/3A ");
    }
    // Hardware -> Software -> Update
    if (enc_scroll == 4)
    {
        LCD_SetCursor(1, 0);
        LCD_Print("Firmware:  v2.0.0   ");
        LCD_SetCursor(2, 0);
        LCD_Print("DC-In   : 12-24V/3A ");
        LCD_SetCursor(3, 0);
        LCD_Print("Update  : 30/4/2026 ");
    }
}

// hiển thị kết quả scan trên LCD
static void page_scan_result(void)
{
    // lcd_clear();
    char buffer[21] = {0};
    LCD_SetCursor(0, 2);
    LCD_Print("-=SCAN RESULT=-");
    get_active_list();

    // Hiển thị danh sách ID Active
    LCD_SetCursor(1, 1);
    LCD_Print("Online  :");
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
    LCD_Print("Offline :");
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

    // Dây bình thường
    if (wire_p1_ok == true || wire_p2_ok == true)
    {
        snprintf(line_2, sizeof(line_2), "State Line Normal");
    }

    // Nếu đứt 1 chỗ
    else if (scan_result.final_id_p1 + 1 == scan_result.final_id_p2 ||
             (scan_result.final_id_p2 == original_id_count && scan_result.final_id_p1 == original_id_count - 1) ||
             (scan_result.final_id_p1 == -1 && scan_result.final_id_p2 == 0))
    {
        if (scan_result.final_id_p1 == -1) // Nếu đứt tại port 1
            snprintf(line_2, sizeof(line_2), "State %d-X-P1", original_id[0]);
        else if (scan_result.final_id_p2 == original_id_count) // Nếu đứt tại port 2
            snprintf(line_2, sizeof(line_2), "State P2-X-%d", original_id[original_id_count - 1]);
        else // Nếu đứt tại một điểm bất kì
            snprintf(line_2, sizeof(line_2), "State %d-X-%d", original_id[scan_result.final_id_p2], original_id[scan_result.final_id_p1]);
    }

    // Nếu đứt 2 chỗ
    else if (scan_result.final_id_p1 + 1 < scan_result.final_id_p2)
    {
        char cut_1[10] = ""; // Hai chuỗi này sẽ xếp chung vô 1 dòng
        char cut_2[10] = "";

        if (scan_result.final_id_p1 == -1) // Nếu đứt tại port 1
            snprintf(cut_1, sizeof(cut_1), "%d-X-P1", original_id[0]);
        else
            snprintf(cut_1, sizeof(cut_1), "%d-X-%d", original_id[scan_result.final_id_p1 + 1], original_id[scan_result.final_id_p1]);

        if (scan_result.final_id_p2 == original_id_count) // Nếu đứt tại port 2
            snprintf(cut_2, sizeof(cut_2), "P2-X-%d", original_id[original_id_count - 1]);
        else
            snprintf(cut_2, sizeof(cut_2), "%d-X-%d", original_id[scan_result.final_id_p2], original_id[scan_result.final_id_p2 - 1]);

        snprintf(line_2, sizeof(line_2), "State %s %s", cut_2, cut_1); // Gộp 2 điểm đứt vào cùng 1 dòng
    }
    else
    {
        snprintf(line_2, sizeof(line_2), "State Line Normal");
    }

    // Hiển thị Lose List
    if (scan_result.lose_count > 0)
    {
        char lose_str[16] = "";
        format_id_list(scan_result.lose_list, scan_result.lose_count, lose_str); // Ghép chuỗi các id mất kết nối
        snprintf(line_3, sizeof(line_3), "ID Offline %s", lose_str);
    }
    else
    {
        snprintf(line_3, sizeof(line_3), "No Lose   ");
    }

    // snprintf(line_4, sizeof(line_4), "Master Port %d ", scan_result.active_port);

    char buf2[21], buf3[21], buf4[21];
    snprintf(buf2, sizeof(buf2), "%-20.20s", line_2); //"-20.20s", -: căn lề trái, 20.20: đảm bảo chỉ 20 ký tự
    snprintf(buf3, sizeof(buf3), "%-20.20s", line_3);
    snprintf(buf4, sizeof(buf4), "%-20.20s", line_4);

    LCD_SetCursor(0, 2);
    LCD_Print("-=LINE DETAIL=-  ");
    LCD_SetCursor(1, 0);
    LCD_Print(buf2);
    LCD_SetCursor(2, 0);
    LCD_Print(buf3);
    LCD_SetCursor(3, 0);
    LCD_Print(buf4);
}

// Page người dùng set baudrate
static void page_set_baud(void)
{
    char buffer_1[21], buffer_2[21]; // Dừng để giá trị tốc độ hiện tại đọc ra từ NVS và giá trị tốc độ người dùng muốn chọn
    // uint32_t current_baud = load_baud_from_nvs();
    LCD_SetCursor(0, 2);
    LCD_Print("-=SET BAUDRATE=-  ");
    LCD_SetCursor(1, 1);
    snprintf(buffer_1, sizeof(buffer_1), "Current %ld bps", cached_baud);
    LCD_Print(buffer_1);
    LCD_SetCursor(2, 1);
    snprintf(buffer_2, sizeof(buffer_2), "Select -> %ld  ", baud_options[baudrate_id]);
    LCD_Print(buffer_2);
}

// Page người dùng set poll interval
static void page_set_poll(void)
{
    // uint32_t ms = load_poll_from_nvs();
    char buffer_1[21], buffer_2[21];
    LCD_SetCursor(0, 1);
    LCD_Print("-=SET POLL TIME=-");
    LCD_SetCursor(1, 1);
    snprintf(buffer_1, sizeof(buffer_1), "Current %lu s   ", cached_poll / 1000);
    LCD_Print(buffer_1);
    LCD_SetCursor(2, 1);
    snprintf(buffer_2, sizeof(buffer_2), "Select -> %lu s ", poll_options[poll_id]);
    LCD_Print(buffer_2);
}

//  Bật tắt bluetooth
static void page_ble_control(void)
{
    char buffer[24];
    LCD_SetCursor(0, 2);
    LCD_Print("-=BLE CONTROL=- ");
    LCD_SetCursor(1, 1);
    snprintf(buffer, sizeof(buffer), "Name : %-15.15s", ble_device_name);
    LCD_Print(buffer);
    LCD_SetCursor(2, 1);
    LCD_Print(ble_enabled ? "Status : ON " : "Status : OFF ");
}

//  đồng bộ thời gian RTC qua NTP khi có mạng
static void page_sync_time(void)
{
    char buf[24];
    rtc_time_t now;
    rtc_read_time(&now);

    LCD_SetCursor(0, 4);
    LCD_Print("-=SYNC TIME=-  ");

    LCD_SetCursor(1, 1);
    snprintf(buf, sizeof(buf), "Now : %02d:%02d:%02d", now.hour, now.minute, now.second);
    LCD_Print(buf);

    LCD_SetCursor(2, 1);
    if (has_synced)
        snprintf(buf, sizeof(buf), "Last: %02d:%02d:%02d", last_sync_time.hour, last_sync_time.minute, last_sync_time.second);
    else
        snprintf(buf, sizeof(buf), "Last: --:--:--");
    LCD_Print(buf);
}

// Hiện khi app BLE đang kết nối vào thiết bị để gửi cấu hình
static void page_ble_waiting(void)
{
    // lcd_clear();
    LCD_SetCursor(1, 2);
    LCD_Print("Updating ...        ");
}

static void page_sync_waiting(void)
{
    // lcd_clear();
    LCD_SetCursor(1, 2);
    LCD_Print("Syncing ...        ");
}

// Xử lý sự kiện của các nút bấm
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

// Xử lý sự kiện của Encoder
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

    // Đọc lại thời gian sync cuối từ EEPROM
    uint8_t magic = 0;
    eeprom_read(0x0180, &magic, 1);
    if (magic == 0xA5)
    {
        eeprom_read(0x0181, (uint8_t *)&last_sync_time, sizeof(rtc_time_t));
        has_synced = true;
    }

    while (1)
    {

        if (xQueueReceive(ui_queue, &event, pdMS_TO_TICKS(100)) == pdTRUE)
        {
            if (is_scanning == false) // Tránh người dùng bấm nút khi đang scan
            {
                switch (event)
                {
                case EVENT_EN_SELECT:
                case EVENT_SELECT:
                    if (current_page == PAGE_1_HOME)
                    {
                        cached_baud = load_baud_from_nvs();
                        lcd_clear();
                        current_page = PAGE_2_SETTINGS;
                        menu_cursor = 1;
                    }
                    else if (current_page == PAGE_2_SETTINGS)
                    {
                        if (menu_cursor == 1)
                        {
                            cached_baud = load_baud_from_nvs();
                            lcd_clear();
                            current_page = PAGE_SET_BAUDRATE;
                        }
                        else if (menu_cursor == 2)
                        {
                            lcd_clear();
                            scan_device();
                        }
                        else if (menu_cursor == 3)
                        {
                            cached_poll = load_poll_from_nvs();
                            lcd_clear();
                            current_page = PAGE_SET_POLL;
                        }
                        else if (menu_cursor == 4)
                        {
                            lcd_clear();
                            current_page = PAGE_BLE_CONTROL;
                        }
                        else if (menu_cursor == 5)
                        {
                            lcd_clear();
                            sync_state = 0;
                            current_page = PAGE_SYNC_TIME;
                        }
                    }
                    else if (current_page == PAGE_BLE_CONTROL)
                    {
                        ble_toggle();
                    }
                    else if (current_page == PAGE_SYNC_TIME)
                    {
                        if (wifi_connected || eth_connected)
                        {
                            lcd_clear();
                            page_sync_waiting();
                            LCD_SetCursor(3, 0);
                            LCD_Print("Syncing ....        ");
                            get_time();
                            rtc_read_time(&last_sync_time);
                            has_synced = true;
                            sync_state = 1;
                            uint8_t magic = 0xA5;
                            eeprom_write(0x0180, &magic, 1);
                            eeprom_write(0x0181, (uint8_t *)&last_sync_time, sizeof(rtc_time_t));
                        }
                        else
                        {
                            sync_state = 2;
                        }
                    }
                    else if (current_page == PAGE_SET_BAUDRATE)
                    {
                        lcd_clear();
                        is_scanning = true;
                        LCD_SetCursor(1, 2);
                        LCD_Print("Changing ....");
                        LCD_SetCursor(2, 2);
                        LCD_Print("Please wait ....");
                        change_baudrate();
                    }
                    else if (current_page == PAGE_SET_POLL)
                    {
                        lcd_clear();
                        is_scanning = true;
                        LCD_SetCursor(1, 2);
                        LCD_Print("Changing .... ");
                        LCD_SetCursor(2, 2);
                        LCD_Print("Please wait .... ");
                        change_poll_interval();
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
                        enc_scroll = 0;
                    }
                    else if (current_page == PAGE_SET_BAUDRATE)
                    {
                        lcd_clear();
                        current_page = PAGE_2_SETTINGS;
                        menu_cursor = 1;
                    }
                    else if (current_page == PAGE_SET_POLL)
                    {
                        lcd_clear();
                        current_page = PAGE_2_SETTINGS;
                        menu_cursor = 3;
                    }
                    else if (current_page == PAGE_BLE_CONTROL)
                    {
                        lcd_clear();
                        current_page = PAGE_2_SETTINGS;
                        menu_cursor = 4;
                    }
                    else if (current_page == PAGE_SYNC_TIME)
                    {
                        lcd_clear();
                        sync_state = 0;
                        current_page = PAGE_2_SETTINGS;
                        menu_cursor = 5;
                    }
                    break;

                case EVENT_DOWN:
                    if (current_page == PAGE_2_SETTINGS && menu_cursor < 5)
                        menu_cursor++;
                    else if (current_page == PAGE_SET_BAUDRATE && baudrate_id < 6)
                        baudrate_id++;
                    else if (current_page == PAGE_SET_POLL && poll_id < 4)
                        poll_id++;
                    else if (current_page == PAGE_3_INFO_DEVICE && enc_scroll < 4)
                        enc_scroll++;
                    break;

                case EVENT_UP:
                    if (current_page == PAGE_2_SETTINGS && menu_cursor > 1)
                        menu_cursor--;
                    else if (current_page == PAGE_SET_BAUDRATE && baudrate_id > 0)
                        baudrate_id--;
                    else if (current_page == PAGE_SET_POLL && poll_id > 0)
                        poll_id--;
                    else if (current_page == PAGE_3_INFO_DEVICE && enc_scroll > 0)
                        enc_scroll--;
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

        if (is_scan_device == true && is_manual_scan == true)
        {
            need_clear_after_scan = true;
            LCD_SetCursor(0, 0);
            LCD_Print("                    ");
            LCD_SetCursor(1, 2);
            LCD_Print("Scanning ....       ");
            LCD_SetCursor(2, 2);
            LCD_Print("Please wait ....    ");
            LCD_SetCursor(3, 0);
            LCD_Print("                    ");
            vTaskDelay(pdMS_TO_TICKS(200));
        }
        else if (blu_connected == true)
        {
            lcd_clear();
            page_ble_waiting();
        }
        else if (is_scan_device == true && is_manual_scan == false)
        {
            if (current_page == PAGE_1_HOME)
                page_1_home();
            else if (current_page == PAGE_2_SETTINGS)
                page_2_settings();
            else if (current_page == PAGE_SCAN_RESULT)
                page_scan_result();
            else if (current_page == PAGE_SCAN_DETAIL)
                page_scan_detail();
            else if (current_page == PAGE_SET_BAUDRATE)
                page_set_baud();
            else if (current_page == PAGE_SET_POLL)
                page_set_poll();
            else if (current_page == PAGE_3_INFO_DEVICE)
                page_3_info_device();
            else if (current_page == PAGE_BLE_CONTROL)
                page_ble_control();
            else if (current_page == PAGE_SYNC_TIME)
                page_sync_time();
        }
        else if (is_scanning == false)
        {
            if (need_clear_after_scan == true)
            {
                lcd_clear();
                need_clear_after_scan = false;
            }
            if (current_page == PAGE_1_HOME)
                page_1_home();
            else if (current_page == PAGE_2_SETTINGS)
                page_2_settings();
            else if (current_page == PAGE_SCAN_RESULT)
                page_scan_result();
            else if (current_page == PAGE_SCAN_DETAIL)
                page_scan_detail();
            else if (current_page == PAGE_SET_BAUDRATE)
                page_set_baud();
            else if (current_page == PAGE_SET_POLL)
                page_set_poll();
            else if (current_page == PAGE_3_INFO_DEVICE)
                page_3_info_device();
            else if (current_page == PAGE_BLE_CONTROL)
                page_ble_control();
            else if (current_page == PAGE_SYNC_TIME)
                page_sync_time();
        }
        else
        {
            vTaskDelay(pdMS_TO_TICKS(100));
        }
    }
}