#include <string.h>
#include "esp_wifi.h"
#include "esp_event.h"
#include "nvs_flash.h"
#include "esp_netif.h"
#include "esp_log.h"
#include "wifi.h"
#include "esp_err.h"
#include "esp_mac.h"

static const char *TAG = "[MODBUS GATEWAY - WIFI]";
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
        ESP_LOGI(TAG, "Failed to get MAC address !!!\n");
    }
}

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

    /*  Khởi tạo bộ LwIP bên trong ESP (Bộ dịch ngôn ngữ TCP/IP)
        Dữ liệu liên quan tới netif đều nằm trên RAM */
    ESP_ERROR_CHECK(esp_netif_init());

    // Tạo Vòng lặp sự kiện (Event Loop)
    ESP_ERROR_CHECK(esp_event_loop_create_default());

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
    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT, ESP_EVENT_ANY_ID, &wifi_event_handler, NULL, &instance_any_id));

    // Đăng ký bắt riêng sự kiện Router cấp phát IP thành công
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &wifi_event_handler, NULL, &instance_got_ip));

    // Thông tin đăng nhập SSID và Password được lưu vào phân vùng NVS
    wifi_config_t wifi_config = {
        .sta = {
            .ssid = ESP_WIFI_SSID,
            .password = ESP_WIFI_PASS,
            .threshold.authmode = WIFI_AUTH_WPA2_PSK,
            /* Ngưỡng tiêu chuẩn bảo mật tối thiểu mà router phát wifi cần có
            Router Wifi cần có chuẩn WPA2 trở lên thì esp mới chấp nhận kết nối vào */
        },
    };

    // Thiết lập chế độ Sta (Station) - Đóng vai trò là 1 Client
    ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));

    // Thực hiện thao tác đăng nhập vào wifi thông qua SSID và Password
    ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));

    // Kích hoạt bộ thu phát wifi trên ESP
    ESP_ERROR_CHECK(esp_wifi_start());

    printf("\n");
    ESP_LOGI(TAG, "Completed to configure for Wifi ....\n");
}

static void wifi_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    ip_event_got_ip_t *event_pkt; // Chứa gói tin Router mạng gửi đến
    static uint8_t try_count = 0;

    if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START)
    {
        esp_wifi_connect(); // Thực hiện kết nối tới wifi
    }

    else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED)
    {
        try_count++;
        printf("\n");
        ESP_LOGI(TAG, "Disconnected to Wifi, retry to connect to Wifi ....(attempt: %d)\n", try_count);
        esp_wifi_connect();
    }

    else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP)
    {
        event_pkt = (ip_event_got_ip_t *)event_data;
        printf("\n");
        ESP_LOGI(TAG, "Connected to Wifi SSID: %s", ESP_WIFI_SSID);
        ESP_LOGI(TAG, "Got ip: " IPSTR, IP2STR(&event_pkt->ip_info.ip));
        try_count = 0; // Reset bộ đếm

        // Đánh thức luồng chính đang chờ đợi
        // xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
    }
}