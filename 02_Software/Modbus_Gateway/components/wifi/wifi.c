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

static const char *TAG = "[MODBUS GATEWAY - WIFI]";
static bool web_running = false;

static void wifi_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data);
void get_wifi_mac_addr(void)
{
    static uint8_t wifi_mac_addr[6] = {0};
    static uint8_t blu_mac_addr[6] = {0};
    static uint8_t eth_mac_addr[6] = {0};
    esp_err_t wf_ret = esp_read_mac(wifi_mac_addr, ESP_MAC_WIFI_STA);
    esp_err_t bt_ret = esp_read_mac(blu_mac_addr, ESP_MAC_BT);
    esp_err_t eth_ret = esp_read_mac(eth_mac_addr, ESP_MAC_ETH);

    if (wf_ret == ESP_OK || bt_ret == ESP_OK || eth_ret == ESP_OK)
    {
        if (wf_ret == ESP_OK)
        {
            printf("\n");
            ESP_LOGI(TAG, "MAC address of Wifi Station: %02X:%02X:%02X:%02X:%02X:%02X",
                     wifi_mac_addr[0], wifi_mac_addr[1], wifi_mac_addr[2], wifi_mac_addr[3], wifi_mac_addr[4], wifi_mac_addr[5]);
        }
        if (bt_ret == ESP_OK)
        {
            ESP_LOGI(TAG, "MAC address of BLE: %02X:%02X:%02X:%02X:%02X:%02X",
                     blu_mac_addr[0], blu_mac_addr[1], blu_mac_addr[2], blu_mac_addr[3], blu_mac_addr[4], blu_mac_addr[5]);
        }
        if (eth_ret == ESP_OK)
        {
            ESP_LOGI(TAG, "MAC address of Ethernet: %02X:%02X:%02X:%02X:%02X:%02X \n",
                     eth_mac_addr[0], eth_mac_addr[1], eth_mac_addr[2], eth_mac_addr[3], eth_mac_addr[4], eth_mac_addr[5]);
        }
    }

    else
    {
        printf("\n");
        ESP_LOGE(TAG, "Failed to get MAC address !!!\n");
    }
}
void start_webserver(void);
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
        ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_APSTA)); // Vừa AP vừa STA để scan wifi
        ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_AP, &ap_config));

        // Khởi động Web Server (Phát sẽ viết hàm này ở file web_server.c)
        start_webserver();
    }
    else
    {
        ESP_LOGI(TAG, "Tìm thấy cấu hình trong EEPROM, đang thử kết nối Station...");
        ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
        ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
    }
    // // Thông tin đăng nhập SSID và Password được lưu vào phân vùng NVS
    // wifi_config_t wifi_config = {
    //     .sta = {
    //         .ssid = ESP_WIFI_SSID,
    //         .password = ESP_WIFI_PASS,
    //         .threshold.authmode = WIFI_AUTH_WPA2_PSK,
    //         /* Ngưỡng tiêu chuẩn bảo mật tối thiểu mà router phát wifi cần có
    //         Router Wifi cần có chuẩn WPA2 trở lên thì esp mới chấp nhận kết nối vào */
    //     },
    // };
    // ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    // ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));

    ESP_ERROR_CHECK(esp_wifi_start());
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
        event_pkt = (ip_event_got_ip_t *)event_data;

        wifi_config_t config = {0};
        esp_wifi_get_config(WIFI_IF_STA, &config);

        ESP_LOGI(TAG, "Connected to: %s", (char *)config.sta.ssid);
        ESP_LOGI(TAG, "IP: " IPSTR, IP2STR(&event_pkt->ip_info.ip));

        get_time();
        try_count = 0;

        // Nếu trước đó đang bật webserver (do nhập sai), giờ đúng thì reset để lưu EEPROM và chạy mode STA thuần
        if (web_running == true)
        {
            // Đây là lúc bạn thực hiện flow: Ghi EEPROM -> Restart
            ESP_LOGI(TAG, "New config verified. Saving to EEPROM...");
            eeprom_write(0x0100, (uint8_t *)config.sta.ssid, 32);
            eeprom_write(0x0120, (uint8_t *)config.sta.password, 64);

            vTaskDelay(pdMS_TO_TICKS(500));
            esp_restart(); // Restart để vào mode STA sạch sẽ
        }
    }
}