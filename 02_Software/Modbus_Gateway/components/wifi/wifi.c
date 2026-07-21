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
#include "system_event.h"
#include "modbus_tcp.h"

static const char *TAG = "[WIFI]";
extern bool wifi_connected;

static void wifi_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data);

void wifi_Init(void)
{
    printf("\n");
    ESP_LOGI(TAG, "Started to Configure for Wifi ....\n");

    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);
    esp_netif_create_default_wifi_ap();
    esp_netif_create_default_wifi_sta();

    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_wifi_init(&cfg));

    esp_event_handler_instance_t instance_any_id;
    esp_event_handler_instance_t instance_got_ip;

    ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT,
                                                        ESP_EVENT_ANY_ID,
                                                        &wifi_event_handler,
                                                        NULL,
                                                        &instance_any_id));
    ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT,
                                                        IP_EVENT_STA_GOT_IP,
                                                        &wifi_event_handler, NULL,
                                                        &instance_got_ip));

    wifi_config_t wifi_config = {0};
    eeprom_read(0x0100, (uint8_t *)wifi_config.sta.ssid, 32);
    eeprom_read(0x0140, (uint8_t *)wifi_config.sta.password, 64);
    vTaskDelay(pdMS_TO_TICKS(1000));

    if (wifi_config.sta.ssid[0] == 0xFF || wifi_config.sta.ssid[0] == 0)
    {
        ESP_LOGW(TAG, "EEPROM empty — no WiFi config found. Configure via BLE app.");
        ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
    }
    else
    {
        ESP_LOGI(TAG, "Found WiFi config in EEPROM, connecting...");
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
        wifi_connected = false;
        ESP_LOGE(TAG, "Disconnected! Retry attempt: %d", try_count);
        xEventGroupClearBits(event_group, WIFI_CONNECTED_BIT);
        mb_tcp_change_network();

        if (try_count >= MAX_WIFI_RETRY)
        {
            ESP_LOGE(TAG, "Max retries reached. Configure WiFi via BLE app.");
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
        wifi_connected = true;
        try_count = 0;
        mb_tcp_change_network();
    }
}
