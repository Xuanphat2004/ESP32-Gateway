#include <stdio.h>
#include <string.h>
#include "esp_log.h"
#include "esp_err.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/event_groups.h"
#include "esp_modbus_slave.h"
#include "esp_modbus_common.h"
#include "esp_netif.h"

// user library
#include "modbus_rtu.h"
#include "modbus_tcp.h"
#include "system_event.h"

static const char *TAG = "[Modbus-TCP]";

// Tài liệu PDF yêu cầu handler phải được khởi tạo và quản lý xuyên suốt
void *tcp_slave_handler = NULL;
void *target_netif = NULL;
float *tcp_virtual_storage = NULL;

extern mb_parameter_descriptor_t *basic_dict;
extern SemaphoreHandle_t xDataMutex;
extern EventGroupHandle_t event_group;
extern uint16_t register_count;
extern float *final_data;

extern bool is_change_baud;
extern bool is_scan_device;

bool is_tcp_running = false;

static const char *slave_ip_addr_list[] = {"0.0.0.0", NULL};

static void modbus_tcp_destroy(void)
{
    if (tcp_slave_handler != NULL)
    {
        // mbc_slave_stop();
        mbc_slave_destroy();
        tcp_slave_handler = NULL;
        is_tcp_running = false;
        ESP_LOGW(TAG, "Đã giải phóng tài nguyên Modbus TCP.");
    }
}
static void print_modbus_tcp_table(void)
{
    if (tcp_virtual_storage == NULL || basic_dict == NULL || register_count == 0)
    {
        ESP_LOGW(TAG, "Table empty: TCP Virtual Storage not initialized yet.");
        return;
    }

    printf("\n");
    printf("|---------------------------------------------------------------|\n");
    printf("| Index  |      Parameter       |   Slave ID    |     Value     |\n");
    printf("|--------|----------------------|---------------|---------------|\n");

    for (int i = 0; i < register_count; i++)
    {
        // Lấy tên từ Dictionary và giá trị từ mảng ảo
        const char *param_name = basic_dict[i].param_key;
        uint8_t slave_id = basic_dict[i].mb_slave_addr;
        float value = tcp_virtual_storage[i];
        printf("| %-4d   | %-20s |        %d      |  %-13.2f|\n",
               i, param_name, slave_id, value);
    }
    printf("|--------|----------------------|---------------|---------------|\n");
}

void modbus_tcp_server_task(void *arg)
{
    printf("==================================================================================================================\n");
    ESP_LOGW(TAG, "TCP Task is starting...");
    esp_err_t err = ESP_OK;

    // Đợi cấu hình từ NVS - phải có để biết số lượng thanh ghi
    while (register_count == 0)
    {
        vTaskDelay(pdMS_TO_TICKS(1000));
    }

    // Khởi tạo vùng nhớ ảo để lưu dữ liệu đọc về từ task rtu
    if (tcp_virtual_storage == NULL)
    {
        tcp_virtual_storage = (float *)calloc(register_count, sizeof(float));
    }

    while (1)
    {
        if (is_change_baud == true || is_scan_device == true)
        {
            vTaskDelay(pdMS_TO_TICKS(200));
            continue;
        }

        EventBits_t uxBits = xEventGroupWaitBits(
            event_group,
            WIFI_CONNECTED_BIT | ETHERNET_CONNECTED_BIT,
            pdFALSE,
            pdFALSE,
            pdMS_TO_TICKS(2000));

        bool network_ready = (uxBits & (WIFI_CONNECTED_BIT | ETHERNET_CONNECTED_BIT));

        if (network_ready && !is_tcp_running)
        {
            ESP_LOGI(TAG, "Network ready, starting init Modbus TCP Server...");
            err = mbc_slave_init_tcp(&tcp_slave_handler);
            if (err != ESP_OK)
            {
                ESP_LOGE(TAG, "Fail to init tcp_slave, error code: 0x%x", err);
                vTaskDelay(pdMS_TO_TICKS(2000));
                continue;
            }

            // Kiểm tra mạng hiện có trên gateway
            if (uxBits & ETHERNET_CONNECTED_BIT)
            {
                target_netif = (void *)esp_netif_get_handle_from_ifkey("ETH_DEF");
                ESP_LOGI(TAG, "Select Ethernet for Modbus TCP");
            }
            else if (uxBits & WIFI_CONNECTED_BIT)
            {
                target_netif = (void *)esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
                ESP_LOGI(TAG, "Select WiFi for Modbus TCP");
            }
            if (target_netif != NULL)
            {
                esp_netif_ip_info_t ip_info;
                // Lấy thông tin IP từ handle netif đã chọn
                if (esp_netif_get_ip_info(target_netif, &ip_info) == ESP_OK)
                {
                    // In ra địa chỉ IP dưới dạng số (dùng IPSTR để định dạng chuỗi)
                    ESP_LOGI(TAG, "Modbus TCP Server is binding to IP: " IPSTR, IP2STR(&ip_info.ip));
                }
            }
            // Khắc phục lỗi iface address bằng cách truyền đúng mảng con trỏ
            mb_communication_info_t tcp_info = {
                .ip_mode = MB_MODE_TCP,
                .slave_uid = 1,
                .ip_port = 502,
                .ip_addr_type = MB_IPV4,
                .ip_addr = (void **)slave_ip_addr_list,
                .ip_netif_ptr = target_netif};

            err = mbc_slave_setup(&tcp_info);
            if (err != ESP_OK)
            {
                ESP_LOGW(TAG, "Fail to setup, error code: 0x%x", err);
                modbus_tcp_destroy();
                vTaskDelay(pdMS_TO_TICKS(5000)); // Đợi lâu hơn nếu lỗi tham số
                continue;
            }

            // Configuring Slave Data Access
            mb_register_area_descriptor_t reg_area = {
                .type = MB_PARAM_HOLDING,
                .start_offset = 0,
                .address = (void *)tcp_virtual_storage,
                .size = register_count * sizeof(float)};

            err = mbc_slave_set_descriptor(reg_area);
            if (err != ESP_OK)
            {
                ESP_LOGW(TAG, "Fail to set descriptor, error code: 0x%x", err);
                modbus_tcp_destroy();
                continue;
            }

            err = mbc_slave_start();
            if (err == ESP_OK)
            {
                is_tcp_running = true;
                ESP_LOGI(TAG, "Modbus TCP Server is running on Port 502");
            }
            else
            {
                is_tcp_running = false;
                ESP_LOGE(TAG, "Fail to start Modbus TCP server: 0x%x", err);
                modbus_tcp_destroy();
                continue;
            }
        }
        printf("==================================================================================================================\n");
        if (!network_ready && is_tcp_running)
        {

            ESP_LOGW(TAG, " Disconnect the network, free TCP Server memorry ..."); // Xử lý rớt mạng
            modbus_tcp_destroy();
            continue;
        }
        if (is_change_baud == true || is_scan_device == true)
        {
            vTaskDelay(pdMS_TO_TICKS(200));
            continue;
        }

        // Dùng timeout dài hơn để tránh priority inheritance timeout trên dual-core
        // RTU task có thể giữ mutex đến vài trăm ms khi chờ thiết bị Modbus trả lời
        if (is_tcp_running && xSemaphoreTake(xDataMutex, pdMS_TO_TICKS(2000)) == pdTRUE)
        {
            if (is_change_baud == true || is_scan_device == true)
            {
                xSemaphoreGive(xDataMutex);
                vTaskDelay(pdMS_TO_TICKS(200));
                continue;
            }
            // Copy toàn bộ final_data vào tcp_virtual_storage
            memcpy(tcp_virtual_storage, final_data, register_count * sizeof(float));
            xSemaphoreGive(xDataMutex);
        }
        else if (is_tcp_running)
        {
            // Timeout sau 2 giây — RTU task có vấn đề, bỏ qua lần này
            ESP_LOGW(TAG, "xDataMutex timeout sau 2s, bỏ qua lần copy này.");
        }

        vTaskDelay(pdMS_TO_TICKS(7000));
    }
}