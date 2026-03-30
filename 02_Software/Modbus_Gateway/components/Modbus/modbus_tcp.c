#include <stdio.h>
#include <string.h>
#include <sys/param.h>
#include "driver/uart.h" // for the uart driver access
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "freertos/portmacro.h"
#include "freertos/task.h"
#include "freertos/portable.h"
#include "freertos/event_groups.h"
#include "esp_err.h"
#include "esp_netif.h"
// Modbus library
#include "esp_modbus_master.h"
#include "esp_modbus_common.h"
#include "pm710_dictionary.h"

// user library
#include "modbus_rtu.h"
#include "modbus_tcp.h"
#include "esp_modbus_slave.h"
#include "esp_modbus_common.h"
#include "pm710_dictionary.h"
#include "system_event.h"

static const char *TAG = "[MODBUS GATEWAY - Modbus TCP]";

// handler for Modbus TCP slave
void *slave_mb_tcp_handler = NULL;

// // Save IP address from WIFI
// static char ip_addr_str[16] = {0};

// static const char *slave_ip_list[] = {ip_addr_str, NULL};

esp_err_t modbus_tcp_init(void)
{
    pm710_data_t pm710_ram_data;
    esp_err_t err = ESP_OK;
    // EventBits_t uxBits = xEventGroupWaitBits(
    //     event_group,        // Nhóm sự kiện
    //     WIFI_CONNECTED_BIT, // Bit cần chờ
    //     pdFALSE,            // Không xóa bit (để các Task khác cũng biết là có WiFi)
    //     pdTRUE,             // Đợi bit này lên 1
    //     portMAX_DELAY       // Đợi vô tận cho đến khi có mạng
    // );
    // if ((uxBits && WIFI_CONNECTED_BIT) != 0)
    // {
    ESP_LOGI(TAG, "WiFi connected, proceeding with Modbus TCP initialization...");
    err = mbc_slave_init_tcp(&slave_mb_tcp_handler);
    if (err == ESP_OK)
    {
        ESP_LOGI(TAG, "Modbus TCP Slave initialized successfully");
    }
    else
    {
        ESP_LOGE(TAG, "Modbus TCP Slave initialization failed with error: %d", err);
        return err;
    }

    mb_communication_info_t tcp_info = {
        .ip_mode = MB_MODE_TCP,
        .slave_uid = 1,
        .ip_port = TCP_PORT, // Port mặc định
        .ip_addr = NULL,     // Sử dụng địa chỉ IP mặc định (tất cả các giao diện)
        .ip_addr_type = MB_IPV4};

    err = mbc_slave_setup(&tcp_info);
    if (err == ESP_OK)
    {
        ESP_LOGI(TAG, "Modbus TCP Slave setup successful");
    }
    else
    {
        ESP_LOGE(TAG, "Modbus TCP Slave setup failed with error: %d", err);
        return err;
    }
    mb_register_area_descriptor_t dict = {
        .type = MB_PARAM_HOLDING,
        .start_offset = 0,
        .address = (void *)&pm710_ram_data,
        .size = sizeof(pm710_ram_data)};

    err = mbc_slave_set_descriptor(dict);
    if (err != ESP_OK)
    {
        ESP_LOGW(TAG, "Fail to set PM710 Dictionary for TCP Slave!!!");
    }
    else
    {
        ESP_LOGI(TAG, "Success to set PM710 Dictionary for TCP Slave");
    }
    mbc_slave_start();
    return err;
    // }
    // else
    // {
    //     ESP_LOGE(TAG, "Failed to connect to WiFi, cannot initialize Modbus TCP.");
    //     return ESP_FAIL;
    // }
}
