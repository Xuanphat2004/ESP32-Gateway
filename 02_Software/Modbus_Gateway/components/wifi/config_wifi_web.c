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

static const char *TAG = "[MODBUS GATEWAY - WIFI]";
bool web_running = false;
extern const uint8_t wifi_html_start[] asm("_binary_wificonfig_html_start");
extern const uint8_t wifi_html_end[] asm("_binary_wificonfig_html_end");

void start_webserver(void)
{
    httpd_handle_t server = NULL;
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.stack_size = 8192;
    config.max_uri_handlers = 8;
    ESP_LOGI(TAG, "Starting Web Server...");

    if (httpd_start(&server, &config) == ESP_OK)
    {
        // Đăng ký trang chủ (Hiện file HTML từ Flash)
        httpd_uri_t uri_root = {
            .uri = "/",
            .method = HTTP_GET,
            .handler = wifi_config_get_handler,
            .user_ctx = NULL};
        httpd_register_uri_handler(server, &uri_root);

        // Đăng ký Handler quét WiFi
        httpd_uri_t uri_scan = {
            .uri = "/scan",
            .method = HTTP_GET,
            .handler = get_scan_handler,
            .user_ctx = NULL};
        httpd_register_uri_handler(server, &uri_scan);

        // Đăng ký Handler lưu dữ liệu (POST)
        httpd_uri_t uri_save = {
            .uri = "/save",
            .method = HTTP_POST,
            .handler = post_save_handler,
            .user_ctx = NULL};
        httpd_register_uri_handler(server, &uri_save);

        web_running = true;
    }
    else
    {
        ESP_LOGE(TAG, "Error starting server!");
    }
}
// Handler hiện trang chủ
esp_err_t wifi_config_get_handler(httpd_req_t *req)
{
    const size_t wifi_html_size = (wifi_html_end - wifi_html_start);
    // Thiết lập kiểu nội dung là HTML
    httpd_resp_set_type(req, "text/html");
    // export html file in flash from binary data and send to client
    return httpd_resp_send(req, (const char *)wifi_html_start, wifi_html_size);
}

// Handler quét WiFi và trả về JSON
esp_err_t get_scan_handler(httpd_req_t *req)
{
    uint16_t number = 10;
    wifi_ap_record_t ap_info[10];
    uint16_t ap_count = 0;

    esp_wifi_scan_start(NULL, true);
    esp_wifi_scan_get_ap_records(&number, ap_info);
    esp_wifi_scan_get_ap_num(&ap_count);

    char json[512] = "[";
    for (int i = 0; i < ap_count; i++)
    {
        char item[64];
        snprintf(item, sizeof(item), "\"%s\"%s", (char *)ap_info[i].ssid, (i == ap_count - 1) ? "" : ",");
        strcat(json, item);
    }
    strcat(json, "]");

    httpd_resp_set_type(req, "application/json");
    return httpd_resp_send(req, json, HTTPD_RESP_USE_STRLEN);
}

// Xử lý khi có người dùng nhập SSID/Pass và gửi lên (POST)
esp_err_t post_save_handler(httpd_req_t *req)
{
    int retry = 0;
    bool connected = false;
    char buf[128] = {0};
    httpd_req_recv(req, buf, req->content_len);
    buf[req->content_len] = '\0';

    char ssid[32] = {0}, pass[64] = {0};
    httpd_query_key_value(buf, "ssid", ssid, sizeof(ssid));
    httpd_query_key_value(buf, "password", pass, sizeof(pass));

    ESP_LOGI(TAG, "Đang thử kết nối với SSID: %s", ssid);

    // 1. Cấu hình WiFi Station với thông tin mới
    wifi_config_t sta_config = {0};
    strncpy((char *)sta_config.sta.ssid, ssid, sizeof(sta_config.sta.ssid));
    strncpy((char *)sta_config.sta.password, pass, sizeof(sta_config.sta.password));

    esp_wifi_set_config(WIFI_IF_STA, &sta_config);
    esp_wifi_disconnect();
    esp_wifi_connect();

    // 2. Vòng lặp đợi kết nối (Đợi tối đa 10 giây)

    while (retry < 10)
    {
        vTaskDelay(pdMS_TO_TICKS(1000));
        esp_netif_ip_info_t ip_info;
        esp_netif_t *netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");

        if (esp_netif_get_ip_info(netif, &ip_info) == ESP_OK && ip_info.ip.addr != 0)
        {
            connected = true;
            break;
        }
        retry++;
    }

    // 3. Phản hồi dựa trên kết quả
    if (connected == true)
    {
        httpd_resp_send(req, "<h1>Successful to Connect WiFi - Restart WiFi .....</h1>", HTTPD_RESP_USE_STRLEN);
        vTaskDelay(pdMS_TO_TICKS(2000));
        // esp_restart();
    }
    else
    {
        // httpd_resp_send(req, "<h1> Fail to connect WiFi !!! Please check again SSID/Pass.</h1>", HTTPD_RESP_USE_STRLEN);
        // Tạo nội dung HTML thông báo lỗi và tự động quay lại trang chủ "/" sau 5 giây
        const char *error_msg = "<html><head><meta http-equiv=\"refresh\" content=\"3;url=/\" /></head>"
                                "<body><h1 style='color:red;'>Fail to connect WiFi !!! Please check again SSID/Pass.</h1>"
                                "<p>TRY AGAIN IN 3 SECOND ......</p></body></html>";

        httpd_resp_set_type(req, "text/html");
        httpd_resp_send(req, error_msg, HTTPD_RESP_USE_STRLEN);
    }

    return ESP_OK;
}