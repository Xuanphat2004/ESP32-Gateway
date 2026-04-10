#include <string.h>
#include "esp_wifi.h"
#include "esp_event.h"
#include "nvs_flash.h"
#include "esp_netif.h"
#include "esp_log.h"
#include "wifi.h"
#include "esp_err.h"
#include "esp_mac.h"
#include "rtc_mb.h"
#include "eeprom.h"
#include "esp_http_server.h"
#include "config_wifi_web.h"
#include "modbus_tcp.h"
#include "system_event.h"
static const char *TAG = "[MODBUS GATEWAY - WIFI]";

static void wifi_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data);
extern bool web_running;
void wifi_Init(void)
{
    printf("\n");
    ESP_LOGI(TAG, "Started to Configure for Wifi ....\n");

    // Khởi tạo bộ nhớ NVS - lưu các thông tin cấu hình mạng cho wifi
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }

    // ESP_ERROR_CHECK() - Nếu lỗi sẽ thông báo ra console, nếu không có lỗi sẽ đi tiếp mà không thông báo gì
    ESP_ERROR_CHECK(ret);
    esp_netif_create_default_wifi_ap(); // Thêm dòng này để tạo Access Point
    // Tạo Interface mạng chuẩn cho Wi-Fi Station - netif cho wifi sta
    esp_netif_create_default_wifi_sta();

    // Khởi tạo các thông số cấu hình như bộ đệm RAM cấu hình bao nhiêu, dùng thuật toán mã hóa nào, chạy core nào, ...
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();

    // Bắt đầu khởi tạo WiFi
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    // esp_event_handler_instance_t = void* - Đăng ký Hàm xử lý sự kiện
    esp_event_handler_instance_t instance_any_id;
    esp_event_handler_instance_t instance_got_ip;

    // Đăng ký bắt mọi sự kiện liên quan đến trạng thái Wi-Fi (Start, Disconnect...)
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT,
                                                        ESP_EVENT_ANY_ID,
                                                        &wifi_event_handler,
                                                        NULL,
                                                        &instance_any_id));

    // Đăng ký bắt riêng sự kiện Router cấp phát IP cho thiết bị
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT,
                                                        IP_EVENT_STA_GOT_IP,
                                                        &wifi_event_handler, NULL,
                                                        &instance_got_ip));

    // --- LUỒNG LOGIC ĐỌC EEPROM ---
    wifi_config_t wifi_config = {0};

    // Đọc SSID (32 bytes) và Password (64 bytes) từ địa chỉ đã định nghĩa
    eeprom_read(0x0100, (uint8_t *)wifi_config.sta.ssid, 32);
    eeprom_read(0x0120, (uint8_t *)wifi_config.sta.password, 64);
    vTaskDelay(pdMS_TO_TICKS(1000)); // Delay để đảm bảo đọc EEPROM ổn định
    // Kiểm tra nếu EEPROM trống (thường byte đầu là 0xFF hoặc 0)
    if (wifi_config.sta.ssid[0] == 0xFF || wifi_config.sta.ssid[0] == 0)
    {
        ESP_LOGW(TAG, "EEPROM trống hoặc dữ liệu lỗi, bật AP Mode để cấu hình...");

        // Cấu hình chế độ phát WiFi (AP) để User kết nối vào
        wifi_config_t ap_config = {
            .ap = {
                .ssid = AP_SSID_CONFIG,
                .password = AP_PASS_CONFIG,
                .max_connection = 4,
                .authmode = WIFI_AUTH_WPA2_PSK},
        };
        ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_APSTA));
        ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &ap_config));

        start_webserver();
    }
    else
    {
        ESP_LOGI(TAG, "Tìm thấy cấu hình trong EEPROM, đang thử kết nối Station...");
        ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
        ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    }

    esp_wifi_start();
}

static void wifi_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    ip_event_got_ip_t *event_pkt;
    static uint8_t try_count = 0;

    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START)
    {
        esp_wifi_connect();
    }
    else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED)
    {
        try_count++;
        ESP_LOGE(TAG, "Disconnected! Retry attempt: %d", try_count);

        if (try_count >= MAX_WIFI_RETRY)
        {
            ESP_LOGE(TAG, "Max retries reached. Opening config portal...");

            if (web_running == false)
            {
                wifi_config_t ap_config = {
                    .ap = {
                        .ssid = AP_SSID_CONFIG,
                        .password = AP_PASS_CONFIG,
                        .max_connection = 4,
                        .authmode = WIFI_AUTH_WPA2_PSK},
                };
                ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_APSTA));
                ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &ap_config));

                start_webserver();
                web_running = true;
            }
            try_count = 0;
            return;
        }
        esp_wifi_connect();
    }
    else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP)
    {
        xEventGroupSetBits(event_group, WIFI_CONNECTED_BIT);
        event_pkt = (ip_event_got_ip_t *)event_data;

        wifi_config_t config = {0};
        esp_wifi_get_config(WIFI_IF_STA, &config);

        ESP_LOGI(TAG, "Connected to: %s", (char *)config.sta.ssid);
        ESP_LOGI(TAG, "IP: " IPSTR, IP2STR(&event_pkt->ip_info.ip));
        get_time();
        try_count = 0;

        if (web_running == true)
        {
            ESP_LOGI(TAG, "New config verified. Saving to EEPROM ......");
            eeprom_write(0x0100, (uint8_t *)config.sta.ssid, 32);
            eeprom_write(0x0120, (uint8_t *)config.sta.password, 64);
            web_running = false;
            vTaskDelay(pdMS_TO_TICKS(500));
            // esp_restart();
        }
    }
}