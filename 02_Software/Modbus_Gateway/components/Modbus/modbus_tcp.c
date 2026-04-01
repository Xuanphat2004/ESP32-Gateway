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
pm710_data_t slave_data = {0};
extern pm710_data_t pm710_latest_data;
extern SemaphoreHandle_t xDataMutex;
static const char *slave_ip_address_list[] = {"0.0.0.0", NULL};

void modbus_tcp_task(void)
{
    ESP_LOGW(TAG, "Modbus TCP Task started, waiting for WiFi connection...");
    // pm710_data_t pm710_ram_data;
    esp_err_t err = ESP_OK;
    while (1)
    {

        EventBits_t uxBits = xEventGroupWaitBits(
            event_group,        // Nhóm sự kiện
            WIFI_CONNECTED_BIT, // Bit cần chờ
            pdFALSE,            // Không xóa bit (để các Task khác cũng biết là có WiFi)
            pdTRUE,             // Đợi bit này lên 1
            portMAX_DELAY       // Đợi vô tận cho đến khi có mạng
        );
        if ((uxBits & WIFI_CONNECTED_BIT) != 0)
        {
            ESP_LOGI(TAG, "WiFi connected, proceeding with Modbus TCP initialization...");
            err = mbc_slave_init_tcp(&slave_mb_tcp_handler);
            if (err == ESP_OK)
            {
                ESP_LOGI(TAG, "Modbus TCP Slave initialized successfully");
            }
            else
            {
                ESP_LOGE(TAG, "Modbus TCP Slave initialization failed with error: %d", err);
                // mbc_slave_destroy();
                continue;
            }
            esp_netif_t *wifi_netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
            mb_communication_info_t tcp_info = {
                .ip_mode = MB_MODE_TCP,
                .slave_uid = 1,
                .ip_port = TCP_PORT,
                .ip_addr_type = MB_IPV4,
                .ip_addr = (void **)slave_ip_address_list,
                .ip_netif_ptr = (void *)wifi_netif,
            };
            err = mbc_slave_setup(&tcp_info);
            if (err == ESP_OK)
            {
                ESP_LOGI(TAG, "Modbus TCP Slave setup successful");
            }
            else
            {
                ESP_LOGE(TAG, "Modbus TCP Slave setup failed with error: %d", err);
                mbc_slave_destroy();
                continue;
            }
            mb_register_area_descriptor_t dict = {
                .type = MB_PARAM_HOLDING,
                .start_offset = 0,
                .address = (void *)&slave_data,
                .size = sizeof(slave_data)};

            err = mbc_slave_set_descriptor(dict);
            if (err != ESP_OK)
            {
                ESP_LOGW(TAG, "Fail to set modbus data for TCP Server !!!");
                mbc_slave_destroy();
                continue;
            }
            else
            {
                ESP_LOGI(TAG, "Success to set modbus data for TCP Server");
            }
            err = mbc_slave_start();
            if (err == ESP_OK)
            {
                ESP_LOGI(TAG, "Modbus TCP Slave started successfully");
            }
            else
            {
                ESP_LOGE(TAG, "Modbus TCP Slave failed to start with error: %d", err);
                mbc_slave_destroy();
                continue;
            }

            while (1)
            {
                if ((xEventGroupGetBits(event_group) & WIFI_CONNECTED_BIT) != 0)
                {
                    if (wifi_netif != 0)
                    {
                        esp_netif_ip_info_t ip_info = {0}; // KHỞI TẠO {0} Ở ĐÂY ĐỂ HẾT LỖI
                        if (esp_netif_get_ip_info(wifi_netif, &ip_info) == ESP_OK)
                        {
                            ESP_LOGI(TAG, "Modbus TCP Server is listening at: " IPSTR ":%d", IP2STR(&ip_info.ip), TCP_PORT);
                        }
                    }

                    if (xSemaphoreTake(xDataMutex, pdMS_TO_TICKS(100)) == pdTRUE)
                    {
                        memcpy(&slave_data, &pm710_latest_data, sizeof(pm710_data_t)); // Copy data to the second located memory for Modbus TCP
                        xSemaphoreGive(xDataMutex);
                    }
                    ESP_LOGI(TAG, "Modbus TCP Slave is running...");
                    vTaskDelay(pdMS_TO_TICKS(1000));
                }
                else
                {
                    ESP_LOGW(TAG, "WiFi disconnected! Stopping Modbus TCP Slave...");
                    mbc_slave_destroy();
                    break;
                }
            }
        }
        else
        {
            ESP_LOGW(TAG, "Failed to connect to Network, cannot initialize Modbus TCP !!!");
            continue;
        }
    }
}
