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
esp_mqtt_client_handle_t mqtt_client = NULL;

// Bảng mapping để web hiển thị bảng tổng quát (volt, curr, freq...)
typedef struct
{
    char *modbus_param_key;
    char *web_field_key;
} name_mapping_t;

const name_mapping_t master_mapping[] = {
    {"Voltage-L1-N", "volt"},
    {"Voltage-A-N", "volt"},
    {"Current-L1", "curr"},
    {"Current-A", "curr"},
    {"Current-L1-Demand", "curr_dmd"},
    {"Current A-Demand-Present", "curr_dmd"},
    {"Frequency-ID-10", "freq"},
    {"Frequency-ID-4", "freq"},
    {"Real-Power-A", "real_pwr"},
    {"Active-Power-L1", "real_pwr"},
    {"Apparent-Power-L1", "app_pwr"},
    {"Apparent-Power-A", "app_pwr"}};
const int mapping_size = sizeof(master_mapping) / sizeof(name_mapping_t);

//======================================================================
// GIỮ NGUYÊN: Lấy địa chỉ MAC làm gateway_id
void get_gateway_id(char *buf, size_t buf_size)
{
    uint8_t mac[6] = {0};
    esp_read_mac(mac, ESP_MAC_EFUSE_FACTORY);
    snprintf(buf, buf_size, "%02X:%02X:%02X:%02X:%02X:%02X",
             mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

//======================================================================
// GIỮ NGUYÊN: MQTT Event Handler
static void mqtt_event_handler(void *handler_args, esp_event_base_t base,
                               int32_t event_id, void *event_data)
{
    esp_mqtt_event_handle_t event = event_data;
    switch ((esp_mqtt_event_id_t)event_id)
    {
    case MQTT_EVENT_CONNECTED:
        ESP_LOGI(TAG, "MQTT_EVENT_CONNECTED - Connected to MQTT Broker");
        is_mqtt_connected = true;
        break;
    case MQTT_EVENT_DISCONNECTED:
        ESP_LOGW(TAG, "MQTT_EVENT_DISCONNECTED - Lose Broker connection !!!");
        is_mqtt_connected = false;
        break;
    case MQTT_EVENT_ERROR:
        ESP_LOGE(TAG, "MQTT_EVENT_ERROR");
        ESP_LOGE(TAG, "  error_type    = %d", event->error_handle->error_type);
        ESP_LOGE(TAG, "  connect_rc    = %d", event->error_handle->connect_return_code);
        ESP_LOGE(TAG, "  tls_err       = %d", event->error_handle->esp_tls_last_esp_err);
        ESP_LOGE(TAG, "  tls_stack_err = %d", event->error_handle->esp_tls_stack_err);
        if (event->error_handle->error_type == MQTT_ERROR_TYPE_TCP_TRANSPORT)
            ESP_LOGE(TAG, "TCP error, esp_tls_last_esp_err=%d", event->error_handle->esp_tls_last_esp_err);
        else if (event->error_handle->connect_return_code == MQTT_CONNECTION_REFUSE_NOT_AUTHORIZED)
            // ESP_LOGE(TAG, "Sai username/password hoặc chưa tạo credentials!");
            break;
    default:
        break;
    }
}

//======================================================================
// GIỮ NGUYÊN: Khởi động MQTT client
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
        .broker = {
            .address.uri = URL_BROKER,
            .address.port = BROKER_PORT,
            .verification = {.crt_bundle_attach = NULL},
        },
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
// GIỮ NGUYÊN
void mqtt_network_event_handler(void *arg, esp_event_base_t event_base,
                                int32_t event_id, void *event_data)
{
    if (event_base == IP_EVENT &&
        (event_id == IP_EVENT_STA_GOT_IP || event_id == IP_EVENT_ETH_GOT_IP))
    {
        ESP_LOGI(TAG, "Received IP address, restarting MQTT...");
        mqtt_app_start();
    }
}

//======================================================================
// GIỮ NGUYÊN: Đóng gói dữ liệu meter thành JSON
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

    cJSON *data_array = cJSON_CreateArray();
    if (data_array == NULL)
    {
        cJSON_Delete(root);
        return NULL;
    }

    if (xSemaphoreTake(xDataMutex, pdMS_TO_TICKS(200)) == pdTRUE)
    {
        for (int i = 0; i < register_count; i++)
        {
            if (basic_dict[i].mb_slave_addr != id)
                continue;

            cJSON *data_object = cJSON_CreateObject();
            if (data_object != NULL)
            {
                cJSON_AddNumberToObject(data_object, "register", basic_dict[i].mb_reg_start);
                cJSON_AddStringToObject(data_object, "name", basic_dict[i].param_key);
                cJSON_AddNumberToObject(data_object, "value", tcp_virtual_storage[i]);
                cJSON_AddStringToObject(data_object, "unit", basic_dict[i].param_units);
                cJSON_AddItemToArray(data_array, data_object);
            }

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
        ESP_LOGW(TAG, "pack_data_to_json: cannot take xDataMutex, skip.");
        cJSON_Delete(data_array);
        cJSON_Delete(root);
        return NULL;
    }

    cJSON_AddItemToObject(root, "registers", data_array);
    char *json_out = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    return json_out;
}

//======================================================================
// GIỮ NGUYÊN: TASK GỬI MQTT meter data - 10 giây/lần
void mqtt_publish_task(void *pvParameters)
{
    vTaskDelay(pdMS_TO_TICKS(5000));

    while (1)
    {
        if (is_mqtt_connected && mqtt_client != NULL &&
            tcp_virtual_storage != NULL && basic_dict != NULL)
        {
            int last_id = -1;
            int meter_count = 0;

            for (int i = 0; i < register_count; i++)
            {
                int current_id = basic_dict[i].mb_slave_addr;
                if (current_id == last_id)
                    continue;

                meter_count++;
                char meter_name[32];
                snprintf(meter_name, sizeof(meter_name),
                         "Meter %d - ID: %d", meter_count, current_id);

                char *payload = pack_data_to_json(current_id, meter_name, "Power Meter");
                if (payload != NULL)
                {
                    int msg_id = esp_mqtt_client_publish(mqtt_client, PUBLISH_TOPIC, payload, 0, 1, 0);
                    if (msg_id >= 0)
                        ESP_LOGI(TAG, "Published %s (msg_id=%d)", meter_name, msg_id);
                    else
                        ESP_LOGW(TAG, "Failed to publish %s", meter_name);
                    free(payload);
                }

                last_id = current_id;
                vTaskDelay(pdMS_TO_TICKS(500));
            }
        }
        else
        {
            ESP_LOGW(TAG, "MQTT not connected, waiting...");
        }
        vTaskDelay(pdMS_TO_TICKS(10000));
    }
}

//======================================================================

void publish_scan_result(void)
{
    if (!is_mqtt_connected || mqtt_client == NULL)
    {
        ESP_LOGW(TAG, "[SCAN] MQTT chưa kết nối, bỏ qua publish");
        return;
    }

    char gateway_id[32] = {0};
    get_gateway_id(gateway_id, sizeof(gateway_id));

    cJSON *root = cJSON_CreateObject();
    if (root == NULL)
    {
        // ESP_LOGE(TAG, "[SCAN] Tạo JSON thất bại");
        return;
    }

    // ── Thông tin định danh ────────────────────────────────────────────
    cJSON_AddStringToObject(root, "gateway_id", gateway_id);
    cJSON_AddStringToObject(root, "event", "scan_result");
    cJSON_AddBoolToObject(root, "wire_p1_ok", wire_p1_ok); // wire=true thì là dây bình thường
    cJSON_AddBoolToObject(root, "wire_p2_ok", wire_p2_ok);
    cJSON_AddNumberToObject(root, "active_port", scan_result.active_port);

    // ── Severity ───────────────────────────────────────────────────────
    // "warning" nếu có ít nhất 1 ID không phản hồi, ngược lại "ok"
    const char *severity = (scan_result.lose_count > 0) ? "warning" : "ok";
    cJSON_AddStringToObject(root, "severity", severity);

    // ── inactive_ids: lấy từ scan_result.lose_list ────────────────────
    // Đây là danh sách ID có trong original_id[] nhưng không phản hồi
    // ở cả 2 port trong lần scan này
    cJSON *inactive_arr = cJSON_CreateArray();
    if (inactive_arr != NULL)
    {
        for (int i = 0; i < scan_result.lose_count; i++)
            cJSON_AddItemToArray(inactive_arr, cJSON_CreateNumber(scan_result.lose_list[i]));
        cJSON_AddItemToObject(root, "inactive_ids", inactive_arr);
    }

    // ── active_ids: original_id[] trừ đi lose_list[] ──────────────────
    // Không có sẵn biến này → tính thủ công bằng cách duyệt original_id[]
    // và kiểm tra xem có nằm trong lose_list[] không
    cJSON *active_arr = cJSON_CreateArray();
    if (active_arr != NULL)
    {
        for (int i = 0; i < original_id_count; i++)
        {
            uint8_t id = original_id[i];
            bool is_lost = false;

            for (int j = 0; j < scan_result.lose_count; j++)
            {
                if (scan_result.lose_list[j] == id)
                {
                    is_lost = true;
                    break;
                }
            }

            if (!is_lost)
                cJSON_AddItemToArray(active_arr, cJSON_CreateNumber(id));
        }
        cJSON_AddItemToObject(root, "active_ids", active_arr);
    }

    // ── Thông tin vị trí đứt dây ──────────────────────────────────────
    // final_id_p1: index trong original_id[] của ID cuối cùng Port 1 thấy được
    //              = -1 nếu Port 1 không thấy thiết bị nào
    // final_id_p2: index trong original_id[] của ID cuối cùng Port 2 thấy được
    //              = original_id_count nếu Port 2 không thấy thiết bị nào
    // Web dùng 2 field này để xác định đứt ở đoạn nào trên dây:
    //   final_p1=0, final_p2=1 → đứt giữa original_id[0] và original_id[1]
    //   final_p1=-1, final_p2=0 → đứt trước thiết bị đầu tiên (đoạn A)
    //   final_p1=count-1, final_p2=count → đứt sau thiết bị cuối (đoạn D)
    cJSON_AddNumberToObject(root, "final_id_p1", scan_result.final_id_p1);
    cJSON_AddNumberToObject(root, "final_id_p2", scan_result.final_id_p2);
    bool line_ok = wire_p1_ok || wire_p2_ok;
    cJSON_AddBoolToObject(root, "line_ok", line_ok);

    // ── Serialize và publish ───────────────────────────────────────────
    char *payload = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);

    if (payload == NULL)
    {
        ESP_LOGE(TAG, "[SCAN] Serialize JSON thất bại");
        return;
    }

    int msg_id = esp_mqtt_client_publish(
        mqtt_client,
        SCAN_TOPIC, // định nghĩa trong mqtt_to_web.h
        payload,
        0, // len=0 → tự tính từ null-terminated string
        1, // QoS 1: broker xác nhận nhận được
        1  // retain=1: client mới subscribe vẫn nhận kết quả gần nhất
    );

    if (msg_id >= 0)
        ESP_LOGI(TAG, "[SCAN] Publish OK (msg_id=%d) severity=%s active=%d inactive=%d",
                 msg_id, severity,
                 (int)(original_id_count - scan_result.lose_count),
                 scan_result.lose_count);
    else
        ESP_LOGW(TAG, "[SCAN] Publish THẤT BẠI");

    free(payload);
}