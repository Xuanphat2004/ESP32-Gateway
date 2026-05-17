#include "cJSON.h"
#include "esp_log.h"
#include "modbus_rtu.h"
#include "modbus_tcp.h"
#include "freertos/semphr.h"
#include <string.h>
#include "mqtt_client.h"
#include "mqtt_to_web.h"
#include "esp_crt_bundle.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_eth.h"
#include "esp_mac.h"
#include "scan_device.h"

static const char *TAG = "[MQTT]";

static bool is_mqtt_connected = false;

extern float *tcp_virtual_storage;
extern mb_parameter_descriptor_t *basic_dict;
extern uint16_t register_count;
extern SemaphoreHandle_t xDataMutex;
extern bool dual_port_mode;
esp_mqtt_client_handle_t mqtt_client = NULL;

// Mapping tên thanh ghi → field web (volt, curr, freq...)
typedef struct
{
    char *modbus_param_key;
    char *web_field_key;
} name_mapping_t;
const name_mapping_t master_mapping[] = {
    {"Voltage-L1-N", "volt"}, {"Voltage-A-N", "volt"}, {"V_L1-(Phase-A-Voltage)", "volt"}, {"Current-L1", "curr"}, {"Current-A", "curr"}, {"I_L1", "curr"}, {"Current-L1-Demand", "curr_dmd"}, {"Current A-Demand-Present", "curr_dmd"}, {"Frequency-ID-10", "freq"}, {"Frequency-L1", "freq"}, {"Freq_Grid", "freq"}, {"Real-Power-A", "real_pwr"}, {"Active-Power-L1", "real_pwr"}, {"Apparent-Power-L1", "app_pwr"}, {"Apparent-Power-A", "app_pwr"}, {"S_L1-(Apparent-Power-A)", "app_pwr"}};
const int mapping_size = sizeof(master_mapping) / sizeof(name_mapping_t);

//======================================================================
void get_gateway_id(char *buf, size_t buf_size)
{
    uint8_t mac[6] = {0};
    esp_read_mac(mac, ESP_MAC_EFUSE_FACTORY);
    snprintf(buf, buf_size, "%02X:%02X:%02X:%02X:%02X:%02X",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

//======================================================================
static void mqtt_event_handler(void *handler_args, esp_event_base_t base,
                               int32_t event_id, void *event_data)
{
    esp_mqtt_event_handle_t event = event_data;
    switch ((esp_mqtt_event_id_t)event_id)
    {
    case MQTT_EVENT_CONNECTED:
        ESP_LOGI(TAG, "MQTT Connected");
        is_mqtt_connected = true;
        break;
    case MQTT_EVENT_DISCONNECTED:
        ESP_LOGW(TAG, "MQTT Disconnected");
        is_mqtt_connected = false;
        break;
    case MQTT_EVENT_ERROR:
        ESP_LOGE(TAG, "MQTT Error type=%d", event->error_handle->error_type);
        break;
    default:
        break;
    }
}

//======================================================================
void mqtt_app_start(void)
{
    char gateway_id[32] = " ";
    get_gateway_id(gateway_id, sizeof(gateway_id));
    ESP_LOGI(TAG, "Gateway ID: %s", gateway_id);

    if (mqtt_client != NULL)
    {
        esp_mqtt_client_start(mqtt_client);
        return;
    }

    const esp_mqtt_client_config_t mqtt_config = {
        .broker = {.address.uri = URL_BROKER, .address.port = BROKER_PORT, .verification = {.crt_bundle_attach = NULL}},
        .credentials = {.client_id = CLIENT_ID},
        .session = {.protocol_ver = MQTT_PROTOCOL_V_3_1_1},
        .task = {.stack_size = 8192},
        .buffer = {.size = 32768},
    };
    mqtt_client = esp_mqtt_client_init(&mqtt_config);
    esp_mqtt_client_register_event(mqtt_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);
    esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &mqtt_network_event_handler, NULL);
    esp_event_handler_register(IP_EVENT, IP_EVENT_ETH_GOT_IP, &mqtt_network_event_handler, NULL);
    esp_mqtt_client_start(mqtt_client);
}

//======================================================================
void mqtt_network_event_handler(void *arg, esp_event_base_t event_base,
                                int32_t event_id, void *event_data)
{
    if (event_base == IP_EVENT &&
        (event_id == IP_EVENT_STA_GOT_IP || event_id == IP_EVENT_ETH_GOT_IP))
    {
        ESP_LOGI(TAG, "Got IP, restarting MQTT...");
        mqtt_app_start();
    }
}

//======================================================================
// Kiểm tra slave_id có đang online không
// Normal mode → tất cả online
// Dual mode   → chỉ online nếu có trong list_p1 hoặc list_p2
static bool is_id_online(uint8_t slave_id)
{
    if (!dual_port_mode)
        return true;
    for (int i = 0; i < list_p1.count; i++)
        if (list_p1.id[i] == slave_id)
            return true;
    for (int i = 0; i < list_p2.count; i++)
        if (list_p2.id[i] == slave_id)
            return true;
    return false;
}

//======================================================================
// Đóng gói dữ liệu 1 meter thành JSON để gửi lên web
// status = "online"   → gửi đầy đủ registers
// status = "inactive" → gửi JSON rỗng, web hiển thị offline
char *pack_data_to_json(int id, char *name, char *model)
{
    if (tcp_virtual_storage == NULL || basic_dict == NULL)
        return NULL;

    cJSON *root = cJSON_CreateObject();
    if (root == NULL)
        return NULL;

    char gateway_id[32] = " ";
    get_gateway_id(gateway_id, sizeof(gateway_id));
    cJSON_AddStringToObject(root, "gateway_id", gateway_id);
    cJSON_AddNumberToObject(root, "m_id", id);
    cJSON_AddStringToObject(root, "m_name", name);
    cJSON_AddStringToObject(root, "model", model);
    cJSON_AddStringToObject(root, "attr", "Consumption Meter");

    bool online = is_id_online((uint8_t)id);
    cJSON_AddStringToObject(root, "status", online ? "online" : "offline");

    // Inactive → gửi registers rỗng, tránh gửi dữ liệu cũ gây hiểu nhầm
    if (!online)
    {
        cJSON_AddItemToObject(root, "registers", cJSON_CreateArray());
        char *out = cJSON_PrintUnformatted(root);
        cJSON_Delete(root);
        return out;
    }

    cJSON *data_array = cJSON_CreateArray();
    if (data_array == NULL)
    {
        cJSON_Delete(root);
        return NULL;
    }

    if (xSemaphoreTake(xDataMutex, pdMS_TO_TICKS(1000)) == pdTRUE)
    {
        for (int i = 0; i < register_count; i++)
        {
            if (basic_dict[i].mb_slave_addr != id)
                continue;

            cJSON *obj = cJSON_CreateObject();
            if (obj)
            {
                cJSON_AddNumberToObject(obj, "register", basic_dict[i].mb_reg_start);
                cJSON_AddStringToObject(obj, "name", basic_dict[i].param_key);
                cJSON_AddNumberToObject(obj, "value", tcp_virtual_storage[i]);
                cJSON_AddStringToObject(obj, "unit", basic_dict[i].param_units);
                cJSON_AddItemToArray(data_array, obj);
            }

            // Mapping sang volt, curr, freq...
            for (int j = 0; j < mapping_size; j++)
            {
                if (strcmp(basic_dict[i].param_key, master_mapping[j].modbus_param_key) == 0)
                {
                    cJSON *existing = cJSON_GetObjectItem(root, master_mapping[j].web_field_key);
                    if (existing == NULL)
                        cJSON_AddNumberToObject(root, master_mapping[j].web_field_key, tcp_virtual_storage[i]);
                    else
                        cJSON_SetNumberValue(existing, tcp_virtual_storage[i]);
                    break;
                }
            }
        }
        xSemaphoreGive(xDataMutex);
    }
    else
    {
        ESP_LOGW(TAG, "pack_data_to_json: mutex timeout, skip.");
        cJSON_Delete(data_array);
        cJSON_Delete(root);
        return NULL;
    }

    cJSON_AddItemToObject(root, "registers", data_array);
    char *out = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    return out;
}

//======================================================================
// MQTT publish task - gửi dữ liệu lên web mỗi 5 giây
void mqtt_publish_task(void *pvParameters)
{
    vTaskDelay(pdMS_TO_TICKS(5000));

    while (1)
    {
        // Chờ nếu đang scan
        if (is_scan_device)
        {
            vTaskDelay(pdMS_TO_TICKS(5000));
            continue;
        }

        if (is_mqtt_connected && mqtt_client != NULL &&
            tcp_virtual_storage != NULL && basic_dict != NULL)
        {
            int last_id = -1, meter_count = 0;
            for (int i = 0; i < register_count; i++)
            {
                int id = basic_dict[i].mb_slave_addr;
                if (id == last_id)
                    continue;

                meter_count++;
                char name[32];
                snprintf(name, sizeof(name), "Meter %d - ID: %d", meter_count, id);

                char *payload = pack_data_to_json(id, name, "Power Meter");
                if (payload)
                {
                    int msg_id = esp_mqtt_client_publish(mqtt_client, PUBLISH_TOPIC, payload, 0, 1, 0);
                    if (msg_id >= 0)
                        ESP_LOGI(TAG, "Published %s [%s] msg_id=%d",
                                 name, is_id_online(id) ? "online" : "inactive", msg_id);
                    else
                        ESP_LOGW(TAG, "Failed to publish %s", name);
                    free(payload);
                }
                last_id = id;
                vTaskDelay(pdMS_TO_TICKS(500));
            }
        }
        else
        {
            ESP_LOGW(TAG, "MQTT not ready, waiting...");
        }
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

//======================================================================
// Gửi kết quả scan về web
void publish_scan_result(void)
{
    if (!is_mqtt_connected || mqtt_client == NULL)
    {
        ESP_LOGW(TAG, "[SCAN] MQTT not connected");
        return;
    }

    char gateway_id[32] = {0};
    get_gateway_id(gateway_id, sizeof(gateway_id));

    cJSON *root = cJSON_CreateObject();
    if (root == NULL)
        return;

    cJSON_AddStringToObject(root, "gateway_id", gateway_id);
    cJSON_AddStringToObject(root, "event", "scan_result");
    cJSON_AddBoolToObject(root, "wire_p1_ok", wire_p1_ok);
    cJSON_AddBoolToObject(root, "wire_p2_ok", wire_p2_ok);
    cJSON_AddNumberToObject(root, "active_port", scan_result.active_port);
    cJSON_AddBoolToObject(root, "dual_port_mode", dual_port_mode);
    cJSON_AddBoolToObject(root, "line_ok", wire_p1_ok || wire_p2_ok);
    cJSON_AddNumberToObject(root, "final_id_p1", scan_result.final_id_p1);
    cJSON_AddNumberToObject(root, "final_id_p2", scan_result.final_id_p2);

    const char *severity = (scan_result.lose_count > 0) ? "warning" : "normal";
    cJSON_AddStringToObject(root, "severity", severity);

    // Danh sách ID mất hoàn toàn
    cJSON *inactive_arr = cJSON_CreateArray();
    for (int i = 0; i < scan_result.lose_count; i++)
        cJSON_AddItemToArray(inactive_arr, cJSON_CreateNumber(scan_result.lose_list[i]));
    cJSON_AddItemToObject(root, "inactive_ids", inactive_arr);

    // Danh sách ID còn hoạt động
    cJSON *active_arr = cJSON_CreateArray();
    for (int i = 0; i < original_id_count; i++)
    {
        bool lost = false;
        for (int j = 0; j < scan_result.lose_count; j++)
            if (scan_result.lose_list[j] == original_id[i])
            {
                lost = true;
                break;
            }
        if (!lost)
            cJSON_AddItemToArray(active_arr, cJSON_CreateNumber(original_id[i]));
    }
    cJSON_AddItemToObject(root, "active_ids", active_arr);

    char *payload = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    if (payload == NULL)
        return;

    int msg_id = esp_mqtt_client_publish(mqtt_client, SCAN_TOPIC, payload, 0, 1, 1);
    if (msg_id >= 0)
        ESP_LOGI(TAG, "[SCAN] OK msg_id=%d severity=%s dual_port=%s",
                 msg_id, severity, dual_port_mode ? "ON" : "OFF");
    else
        ESP_LOGW(TAG, "[SCAN] Publish failed");

    free(payload);
}