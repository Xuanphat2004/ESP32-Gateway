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
// Hàm lấy địa chỉ MAC của chip ESP32
void get_gateway_id(char *buf, size_t buf_size)
{
    uint8_t mac[6] = {0};
    esp_read_mac(mac, ESP_MAC_EFUSE_FACTORY);
    snprintf(buf, buf_size, "%02X:%02X:%02X:%02X:%02X:%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

//======================================================================
// MQTT Event Handler
static void mqtt_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data)
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
            ESP_LOGE(TAG, "Sai username/password hoặc chưa tạo credentials!");
        break;
    default:
        break;
    }
}

//======================================================================
// Khởi động MQTT client
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
        .buffer = {.size = 32768}, // Tăng buffer lên 32KB dự phòng vì payload lớn hơn
    };

    mqtt_client = esp_mqtt_client_init(&mqtt_config);
    esp_mqtt_client_register_event(mqtt_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);
    esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, &mqtt_network_event_handler, NULL);
    esp_event_handler_register(IP_EVENT, IP_EVENT_ETH_GOT_IP, &mqtt_network_event_handler, NULL);
    esp_mqtt_client_start(mqtt_client);
}

void mqtt_network_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    if (event_base == IP_EVENT && (event_id == IP_EVENT_STA_GOT_IP || event_id == IP_EVENT_ETH_GOT_IP))
    {
        ESP_LOGI(TAG, "Received IP address, restarting MQTT...");
        mqtt_app_start();
    }
}

//======================================================================
// Dùng con trỏ để trỏ vào địa chỉ bắt đầu lưu dữ liệu gói tin, vì không biết trước dung lượng của gói tin là bao nhiêu
// char *payload = pack_data_to_json(current_id, meter_name, "Power Meter")
char *pack_data_to_json(int id, char *name, char *model)
{
    if (tcp_virtual_storage == NULL || basic_dict == NULL)
        return NULL;

    cJSON *root = cJSON_CreateObject(); // Tạo ra JSON object mới {}
    if (root == NULL)
        return NULL;
    char gateway_id[32] = " ";
    get_gateway_id(gateway_id, sizeof(gateway_id));
    // Phần thông tin định danh gateway và thiết bị
    cJSON_AddStringToObject(root, "gateway_id", gateway_id); // Thêm cặp Key-Value kiểu chuỗi string
    cJSON_AddNumberToObject(root, "m_id", id);               // Thêm cặp Key-Value kiểu số
    cJSON_AddStringToObject(root, "m_name", name);
    cJSON_AddStringToObject(root, "model", model);
    cJSON_AddStringToObject(root, "attr", "Consumption Meter");

    // Phần dữ liệu chính của toàn bộ thanh ghi
    cJSON *data_array = cJSON_CreateArray(); // Tạo ra mảng JSON [] để chứa danh sách thanh ghi.
    if (data_array == NULL)
    {
        cJSON_Delete(root);
        return NULL;
    }

    if (xSemaphoreTake(xDataMutex, pdMS_TO_TICKS(200)) == pdTRUE)
    {
        // đóng gói dữ liệu từng thanh ghi theo dạng {key: value, key: value, key: value, key: value}
        // Các thành phần sẽ có trong 1 object bao gồm: thanh ghi, param, value, unit
        for (int i = 0; i < register_count; i++) // Quét qua toàn bộ cid của dictionary
        {
            // Chỉ lấy thanh ghi của thiết bị đang xét
            // Đóng gói các thanh ghi có cùng id trước
            if (basic_dict[i].mb_slave_addr != id) // nếu cid hiện tại có id khác với id đang đóng gói
                continue;

            // Thêm vào mảng registers (toàn bộ data)
            cJSON *data_object = cJSON_CreateObject(); // dạng {thông tin thanh ghi thứ n}
            if (data_object != NULL)
            {
                cJSON_AddNumberToObject(data_object, "register", basic_dict[i].mb_reg_start);
                cJSON_AddStringToObject(data_object, "name", basic_dict[i].param_key);
                cJSON_AddNumberToObject(data_object, "value", tcp_virtual_storage[i]);
                cJSON_AddStringToObject(data_object, "unit", basic_dict[i].param_units);

                cJSON_AddItemToArray(data_array, data_object); // Đưa object vừa đóng gói vào mảng registers.
            }

            // Mapping sang các trường cố định cho bảng tổng quát của web
            for (int j = 0; j < mapping_size; j++)
            {
                if (strcmp(basic_dict[i].param_key, master_mapping[j].modbus_param_key) == 0)
                {
                    // Dùng ReplaceItemInObject để không bị trùng key nếu có 2 thanh ghi cùng map
                    cJSON *existing = cJSON_GetObjectItem(root, master_mapping[j].web_field_key);
                    if (existing == NULL)
                        cJSON_AddNumberToObject(root, master_mapping[j].web_field_key, tcp_virtual_storage[i]);
                    else
                        cJSON_SetNumberValue(existing, tcp_virtual_storage[i]); // Cập nhật giá trị số cho một Key đã tồn tại.
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

    // Gắn mảng registers vào gói tin JSON chính
    cJSON_AddItemToObject(root, "registers", data_array);

    char *json_out = cJSON_PrintUnformatted(root); // Chuyển Object JSON thành chuỗi char* để gửi đi.
    cJSON_Delete(root);
    return json_out;
}

//======================================================================
// TASK GỬI MQTT - 10 giây/lần
void mqtt_publish_task(void *pvParameters)
{
    vTaskDelay(pdMS_TO_TICKS(5000)); // Đợi mạng ổn định

    while (1)
    {
        if (is_mqtt_connected && mqtt_client != NULL && tcp_virtual_storage != NULL && basic_dict != NULL)
        {
            int last_id = -1;
            int meter_count = 0;

            for (int i = 0; i < register_count; i++)
            {
                int current_id = basic_dict[i].mb_slave_addr;

                // Mỗi ID chỉ gửi 1 lần (gửi toàn bộ thanh ghi của ID đó trong 1 gói)
                if (current_id == last_id)
                    continue;

                meter_count++;
                char meter_name[32];
                snprintf(meter_name, sizeof(meter_name), "Meter %d - ID: %d", meter_count, current_id);

                char *payload = pack_data_to_json(current_id, meter_name, "Power Meter");
                if (payload != NULL)
                {
                    int msg_id = esp_mqtt_client_publish(mqtt_client, PUBLISH_TOPIC, payload, 0, 1, 0);
                    if (msg_id >= 0)
                        ESP_LOGI(TAG, "Published %s successfully (msg_id=%d)", meter_name, msg_id);
                    else
                        ESP_LOGW(TAG, "Failed to publish %s", meter_name);
                    free(payload);
                }

                last_id = current_id;
                vTaskDelay(pdMS_TO_TICKS(500)); // Delay giữa các thiết bị
            }
        }
        else
        {
            ESP_LOGW(TAG, "MQTT not connected, waiting...");
        }

        vTaskDelay(pdMS_TO_TICKS(10000)); // Chu kỳ gửi 10 giây
    }
}

//======================================================================
// Đóng gói TOÀN BỘ thanh ghi của 1 thiết bị thành JSON
//
// JSON output format:
// {
//   "gateway_id": "mbateway",     thông tin định danh cho mỗi id
//   "m_id": 3,
//   "m_name": "Meter 1 (ID 3)",
//   "model": "Power Meter",
//   "attr": "Consumption Meter",
//
//   "volt": 220.5,        ← các trường sẽ hiển thị mặc định
//   "curr": 1.23,
//   ...
//
//   "registers": [        ← TOÀN BỘ thanh ghi của thiết bị này, các trường chỉ khi nhấp vào dòng thiết bị đó mới hiện ra
//     {"name": "Volt-L1-N", "value": 220.5, "unit": "V"},
//     {"name": "Cur-L1",    "value": 1.23,  "unit": "A"},
//     ...
//   ]
// }
//======================================================================