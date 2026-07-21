#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "esp_log.h"
#include "nvs_flash.h"
#include "nvs.h"
#include "lwip/sockets.h"
#include "lwip/inet.h"
#include "cJSON.h"

#include "esp_netif.h"
#include "modbus_tcp.h"
#include "modbus_rtu.h"
#include "esp_modbus_master.h"

static const char *TAG = "[MODBUS_TCP]";

// Bảng mapping trong RAM
typedef struct
{
    uint16_t tcp_address;
    int cid; // -1 nếu không có mpping trong basic_dict
} tcp_lookup_t;

static tcp_lookup_t tcp_lookup[TCP_MAX_REGISTERS];
static int tcp_lookup_count = 0;
static uint16_t tcp_port = 502;
static int server_socket = -1;
static TaskHandle_t tcp_task_handle = NULL;

extern float *final_data;
extern uint16_t register_count;
extern mb_parameter_descriptor_t *basic_dict;
extern SemaphoreHandle_t xDataMutex;
extern bool eth_connected;
extern bool wifi_connected;

static bool tcp_config_loaded = false;
static uint32_t current_bind_ip = 0;

static void save_to_nvs(uint16_t port, tcp_mapping_t *reg_mapping, int count)
{
    nvs_handle_t nvs_handle;
    esp_err_t err = nvs_open_from_partition("storage", "storage_app", NVS_READWRITE, &nvs_handle);
    if (err != ESP_OK)
    {
        ESP_LOGW(TAG, "NVS open failed: %s", esp_err_to_name(err));
        return;
    }

    nvs_set_u16(nvs_handle, "tcp_port", port); // ghi dữ liệu vào NVS
    nvs_set_u16(nvs_handle, "tcp_count", (uint16_t)count);
    if (count > 0)
    {
        nvs_set_blob(nvs_handle, "tcp_table", reg_mapping, (size_t)count * sizeof(tcp_mapping_t));
        ESP_LOGI(TAG, "TCP mapping table is saved to NVS: port=%d, count=%d", port, count);
    }
    else
        ESP_LOGW(TAG, "No TCP register to save to NVS: count=%d", count);

    nvs_commit(nvs_handle);
    nvs_close(nvs_handle);
    ESP_LOGI(TAG, "TCP mapping table is saved to NVS port=%d with %d registers", port, count);
}

static int load_from_nvs(uint16_t *out_port, tcp_mapping_t *out_entries)
{
    nvs_handle_t tcp_handle;
    esp_err_t err = nvs_open_from_partition("storage", "storage_app", NVS_READONLY, &tcp_handle);
    if (err != ESP_OK)
    {
        ESP_LOGW(TAG, "NVS open failed: %s", esp_err_to_name(err));
        return 0;
    }

    uint16_t port = 502; // mặc định nếu không có trong NVS
    uint16_t count = 0;
    nvs_get_u16(tcp_handle, "tcp_port", &port); // đọc dữ liệu từ NVS
    nvs_get_u16(tcp_handle, "tcp_count", &count);
    *out_port = port;

    if (count > TCP_MAX_REGISTERS)
    {
        count = TCP_MAX_REGISTERS;
        ESP_LOGW(TAG, "Count of TCP registers > TCP_MAX_REGISTERS");
    }

    if (count > 0)
    {
        size_t blob_size = (size_t)count * sizeof(tcp_mapping_t);
        nvs_get_blob(tcp_handle, "tcp_table", out_entries, &blob_size);
    }
    nvs_close(tcp_handle);
    return count;
}

// Tìm cid trong basic_dict theo tên param và slave ID
static int find_cid(const char *param_name, uint16_t unit_id)
{
    if (basic_dict == NULL || register_count == 0)
        return -1;

    for (int i = 0; i < register_count; i++)
    {
        if (basic_dict[i].mb_slave_addr == unit_id && strcmp(basic_dict[i].param_key, param_name) == 0)
        {
            return i; // cid
        }
    }
    return -1;
}

static void build_lookup(tcp_mapping_t *reg_mapping, int count)
{
    tcp_lookup_count = 0;
    for (int i = 0; i < count && i < TCP_MAX_REGISTERS; i++)
    {
        tcp_lookup[i].tcp_address = reg_mapping[i].tcp_address;
        tcp_lookup[i].cid = find_cid(reg_mapping[i].param, reg_mapping[i].unit_id);

        if (tcp_lookup[i].cid < 0)
            ESP_LOGW(TAG, "Param '%s' uid=%d: not found in basic_dict", reg_mapping[i].param, reg_mapping[i].unit_id);
        else
            ESP_LOGI(TAG, "Map tcp_addr=%d with cid=%d ('%s')", reg_mapping[i].tcp_address, tcp_lookup[i].cid, reg_mapping[i].param);

        tcp_lookup_count++;
    }
}

static int lookup_cid(uint16_t addr)
{
    for (int i = 0; i < tcp_lookup_count; i++)
    {
        if (tcp_lookup[i].tcp_address == addr)
            return tcp_lookup[i].cid;
    }
    return -1;
}

static void send_exception(int client_fd, uint8_t trans_id_h, uint8_t trans_id_l, uint8_t uid, uint8_t fc, uint8_t ex_code)
{
    uint8_t ex_response[9];
    ex_response[0] = trans_id_h;
    ex_response[1] = trans_id_l;
    ex_response[2] = 0;
    ex_response[3] = 0;
    ex_response[4] = 0;
    ex_response[5] = 3;
    ex_response[6] = uid;
    ex_response[7] = fc | 0x80;
    ex_response[8] = ex_code;
    send(client_fd, ex_response, 9, 0);
}

static void process_request(int client_fd, uint8_t *req, int req_len)
{
    if (req_len < 12)
        return;

    uint8_t trans_id_h = req[0];
    uint8_t trans_id_l = req[1];
    uint8_t uid = req[6];
    uint8_t fc = req[7];
    uint16_t addr = ((uint16_t)req[8] << 8) | req[9];
    uint16_t qty = ((uint16_t)req[10] << 8) | req[11];

    if (fc != 3 && fc != 4)
    {
        send_exception(client_fd, trans_id_h, trans_id_l, uid, fc, 0x01);
        return;
    }

    if (qty == 0 || qty > 125)
    {
        send_exception(client_fd, trans_id_h, trans_id_l, uid, fc, 0x03);
        return;
    }
    uint8_t byte_count = (uint8_t)(qty * 2);
    uint8_t data_bytes[250];
    memset(data_bytes, 0, sizeof(data_bytes));

    if (xSemaphoreTake(xDataMutex, pdMS_TO_TICKS(200)) == pdTRUE)
    {
        int i = 0;
        while (i < qty)
        {
            uint16_t reg = addr + (uint16_t)i;
            int cid = lookup_cid(reg);

            if (cid >= 0 && cid < register_count && final_data != NULL)
            {
                union
                {
                    float f;
                    uint8_t b[4];
                } conv;
                conv.f = final_data[cid];

                data_bytes[i * 2 + 0] = conv.b[3]; // byte cao
                data_bytes[i * 2 + 1] = conv.b[2]; // byte thấp

                if (i + 1 < qty)
                {
                    data_bytes[(i + 1) * 2 + 0] = conv.b[1]; // low word, high byte
                    data_bytes[(i + 1) * 2 + 1] = conv.b[0]; // low word, low byte
                }
                i += 2; // 1 float = 2 register
            }
            else
            {
                // Địa chỉ không có trong bảng mapping → trả 0
                data_bytes[i * 2 + 0] = 0;
                data_bytes[i * 2 + 1] = 0;
                i++;
            }
        }
        xSemaphoreGive(xDataMutex);
    }
    uint16_t mbap_len = 1 + 1 + 1 + byte_count;
    int resp_len = 6 + (int)mbap_len; // 6 bytes MBAP header + phần còn lại

    uint8_t resp[266]; // 6 + 1 + 1 + 1 + 250 + dư
    resp[0] = trans_id_h;
    resp[1] = trans_id_l;
    resp[2] = 0;
    resp[3] = 0;
    resp[4] = (uint8_t)(mbap_len >> 8);
    resp[5] = (uint8_t)(mbap_len & 0xFF);
    resp[6] = uid;
    resp[7] = fc;
    resp[8] = byte_count;
    memcpy(resp + 9, data_bytes, byte_count);

    send(client_fd, resp, resp_len, 0);
    tcp_log_values();
}

static uint32_t get_ip_modbus_tcp(void)
{
    esp_netif_ip_info_t ip_info;

    if (eth_connected)
    {
        esp_netif_t *eth_netif = esp_netif_get_handle_from_ifkey("ETH_DEF");
        if (eth_netif != NULL && esp_netif_get_ip_info(eth_netif, &ip_info) == ESP_OK && ip_info.ip.addr != 0)
        {
            ESP_LOGI(TAG, "Modbus TCP bind Ethernet: " IPSTR, IP2STR(&ip_info.ip));
            return ip_info.ip.addr;
        }
    }

    if (wifi_connected)
    {
        esp_netif_t *wifi_netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
        if (wifi_netif != NULL && esp_netif_get_ip_info(wifi_netif, &ip_info) == ESP_OK && ip_info.ip.addr != 0)
        {
            ESP_LOGI(TAG, "Modbus TCP bind WiFi: " IPSTR, IP2STR(&ip_info.ip));
            return ip_info.ip.addr;
        }
    }
    return 0;
}

static void modbus_tcp_server_task(void *arg)
{
    struct sockaddr_in server_addr; // các thông tin IP, Port của Server
    struct sockaddr_in client_addr; // các thông tin IP, Port của Client
    socklen_t client_len = sizeof(client_addr);

    server_socket = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    // AF_INET: IPv4
    // SOCK_STREAM: kiểu truyền dữ liệu là TCP
    // IPPROTO_TCP: giao thức TCP
    if (server_socket < 0)
    {
        ESP_LOGE(TAG, "Failed to create Server socket");
        tcp_task_handle = NULL;
        vTaskDelete(NULL);
        return;
    }

    uint32_t bind_ip = get_ip_modbus_tcp();
    if (bind_ip == 0)
    {
        ESP_LOGW(TAG, "No network available, TCP server not started");
        close(server_socket);
        server_socket = -1;
        tcp_task_handle = NULL;
        vTaskDelete(NULL);
        return;
    }

    int opt = 1; // bật SO_REUSEADDR
    setsockopt(server_socket, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
    memset(&server_addr, 0, sizeof(server_addr));
    server_addr.sin_family = AF_INET;
    server_addr.sin_addr.s_addr = bind_ip;
    server_addr.sin_port = htons(tcp_port);
    if (bind(server_socket, (struct sockaddr *)&server_addr, sizeof(server_addr)) < 0)
    {
        ESP_LOGW(TAG, "Fail to bind server socket on port %d", tcp_port);
        close(server_socket);
        server_socket = -1;
        tcp_task_handle = NULL;
        vTaskDelete(NULL);
        return;
    }
    current_bind_ip = bind_ip;

    if (listen(server_socket, 1) < 0)
    {
        ESP_LOGE(TAG, "Listen failed");
        close(server_socket);
        server_socket = -1;
        tcp_task_handle = NULL;
        vTaskDelete(NULL);
        return;
    }

    ESP_LOGI(TAG, "Modbus TCP server listening on port %d", tcp_port);

    while (1)
    {
        int client_num_pointer = accept(server_socket, (struct sockaddr *)&client_addr, &client_len);
        if (client_num_pointer < 0)
            break;
        ESP_LOGI(TAG, "Client: %s", inet_ntoa(client_addr.sin_addr));
        uint8_t request[256];
        while (1)
        {
            int n = recv(client_num_pointer, request, sizeof(request), 0);
            if (n <= 0)
                break;
            process_request(client_num_pointer, request, n);
        }
        close(client_num_pointer);
        ESP_LOGI(TAG, "Client disconnected");
    }
    current_bind_ip = 0;
    tcp_task_handle = NULL;
    vTaskDelete(NULL);
}
static void stop_tcp_server(void)
{
    if (server_socket >= 0)
    {
        close(server_socket);
        server_socket = -1;
    }
    if (tcp_task_handle != NULL)
    {
        vTaskDelete(tcp_task_handle);
        tcp_task_handle = NULL;
    }
}

static void start_tcp_server(void)
{
    xTaskCreatePinnedToCore(modbus_tcp_server_task, "modbus_tcp", 8072, NULL, 7, &tcp_task_handle, 0);
}

void tcp_config_apply(const char *json)
{
    cJSON *root = cJSON_Parse(json);
    if (root == NULL)
    {
        ESP_LOGE(TAG, "JSON parse failed");
        return;
    }

    uint16_t port = 502;
    cJSON *j_port = cJSON_GetObjectItem(root, "port");
    if (cJSON_IsNumber(j_port))
        port = (uint16_t)j_port->valueint;

    cJSON *mapping = cJSON_GetObjectItem(root, "mapping_table");
    if (!cJSON_IsArray(mapping))
    {
        ESP_LOGW(TAG, "Not found key mapping_table in JSON packet !!!");
        cJSON_Delete(root);
        return;
    }

    int count = cJSON_GetArraySize(mapping);
    if (count > TCP_MAX_REGISTERS)
    {
        ESP_LOGW(TAG, "App just send over tcp mapping register for device !!!");
        ESP_LOGW(TAG, "Set TCP_MAX_MAPPINGS !!!");
        count = TCP_MAX_REGISTERS;
    }

    static tcp_mapping_t reg_mapping[TCP_MAX_REGISTERS];
    memset(reg_mapping, 0, sizeof(reg_mapping));

    for (int i = 0; i < count; i++)
    {
        cJSON *item = cJSON_GetArrayItem(mapping, i);
        cJSON *j_addr = cJSON_GetObjectItem(item, "addr");
        cJSON *j_uid = cJSON_GetObjectItem(item, "uid");
        cJSON *j_param = cJSON_GetObjectItem(item, "param");

        if (!cJSON_IsNumber(j_addr) || !cJSON_IsNumber(j_uid) || !cJSON_IsString(j_param))
            continue;

        reg_mapping[i].tcp_address = (uint16_t)j_addr->valueint;
        reg_mapping[i].unit_id = (uint16_t)j_uid->valueint;
        strncpy(reg_mapping[i].param, j_param->valuestring, sizeof(reg_mapping[i].param) - 1);
    }
    cJSON_Delete(root);

    tcp_port = port;
    stop_tcp_server();
    build_lookup(reg_mapping, count);
    save_to_nvs(port, reg_mapping, count);
    tcp_config_loaded = true;
    start_tcp_server();

    ESP_LOGI(TAG, "TCP config applied: port=%d, %d mappings", port, count);
}

void tcp_config_load_and_start(void)
{
    static tcp_mapping_t mapping_table[TCP_MAX_REGISTERS];
    memset(mapping_table, 0, sizeof(mapping_table));

    int count = load_from_nvs(&tcp_port, mapping_table);
    if (count == 0)
    {
        ESP_LOGI(TAG, "No TCP config in NVS, server not started");
        return;
    }
    build_lookup(mapping_table, count);
    tcp_config_loaded = true;
    start_tcp_server();
    ESP_LOGI(TAG, "TCP server started from NVS: port=%d, %d mappings", tcp_port, count);
}

uint16_t tcp_get_port(void)
{
    return tcp_port;
}

void mb_tcp_change_network(void)
{
    if (!tcp_config_loaded)
        return;

    uint32_t new_ip = get_ip_modbus_tcp();
    if (new_ip == current_bind_ip && server_socket != -1)
    {
        ESP_LOGI(TAG, "Netif changed but TCP server IP unchanged, no restart");
        return;
    }

    ESP_LOGI(TAG, "Netif changed, restarting TCP server (new IP: " IPSTR ")", IP2STR((ip4_addr_t *)&new_ip));
    stop_tcp_server();
    current_bind_ip = 0;
    vTaskDelay(pdMS_TO_TICKS(300));
    start_tcp_server();
}

void tcp_log_values(void)
{
    for (int i = 0; i < tcp_lookup_count; i++)
    {
        int cid = tcp_lookup[i].cid;
        if (cid >= 0 && final_data != NULL)
            ESP_LOGI(TAG, "TCP addr=%d  val=%.2f", tcp_lookup[i].tcp_address, final_data[cid]);
    }
}
