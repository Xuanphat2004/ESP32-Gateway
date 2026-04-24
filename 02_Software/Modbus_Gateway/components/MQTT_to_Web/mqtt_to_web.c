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

static const char *TAG = "[MQTT]";

// Khai báo biến flag để kiểm tra trạng thái kết nối
static bool is_mqtt_connected = false;

// Khai báo extern từ các file khác của Phát
extern float *tcp_virtual_storage;
extern mb_parameter_descriptor_t *basic_dict;
extern uint16_t register_count;
extern SemaphoreHandle_t xDataMutex;
esp_mqtt_client_handle_t mqtt_client = NULL; // Khởi tạo NULL để kiểm tra

// Bảng Mapping cũ của Phát
typedef struct
{
    char *modbus_param_key;
    char *web_field_key;
} name_mapping_t;

const name_mapping_t master_mapping[] = {
    {"Volt-L1-N", "volt"},
    {"Volt-L1-N_10", "volt"},
    {"Cur-L1", "curr"},
    {"Cur-L1_10", "curr"},
    {"Cur-L1-Dmd", "curr_dmd"},
    {"Frequency", "freq"},
    {"Frequency_10", "freq"},
    {"AcPower-L1", "real_pwr"},
    {"AcPower-L1_10", "real_pwr"},
    {"AppPower-L1", "app_pwr"},
    {"AppPower-L1_10", "app_pwr"}};
const int mapping_size = sizeof(master_mapping) / sizeof(name_mapping_t);

// Hàm xử lý sự kiện MQTT (Quan trọng để bật/tắt flag kết nối)
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
        ESP_LOGE(TAG, "MQTT_EVENT_ERROR - Disconnected ");
        ESP_LOGE(TAG, "MQTT_EVENT_ERROR");
        ESP_LOGE(TAG, "  error_type     = %d", event->error_handle->error_type);
        ESP_LOGE(TAG, "  connect_rc     = %d", event->error_handle->connect_return_code);
        ESP_LOGE(TAG, "  tls_err        = %d", event->error_handle->esp_tls_last_esp_err);
        ESP_LOGE(TAG, "  tls_stack_err  = %d", event->error_handle->esp_tls_stack_err);
        if (event->error_handle->error_type == MQTT_ERROR_TYPE_TCP_TRANSPORT)
        {
            ESP_LOGE(TAG, "TCP error, esp_tls_last_esp_err=%d",
                     event->error_handle->esp_tls_last_esp_err);
        }
        else if (event->error_handle->connect_return_code == MQTT_CONNECTION_REFUSE_NOT_AUTHORIZED)
        {
            ESP_LOGE(TAG, "Sai username/password hoặc chưa tạo credentials!");
        }
        break;
    default:
        break;
    }
}

void mqtt_app_start(void)
{
    // CHỐNG LẶP: Nếu client đã tồn tại thì không init lại
    if (mqtt_client != NULL)
    {
        esp_mqtt_client_start(mqtt_client);
        return;
    }

    //
    const esp_mqtt_client_config_t mqtt_config = {
        .broker = {
            .address.uri = URL_BROKER,
            .address.port = BROKER_PORT,
            .verification = {
                .crt_bundle_attach = NULL, // Không dùng SSL để mã hóa gói tin
            },
        },
        .credentials = {
            .client_id = CLIENT_ID, // Client ID duy nhất
        },
        .session = {
            .protocol_ver = MQTT_PROTOCOL_V_3_1_1, // Đưa protocol vào đúng mục session
        },
        .task = {
            .stack_size = 6144, // Mosquitto không SSL chỉ cần 6KB là dư dả
        },
        .buffer = {
            .size = 2048,
        } //
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
        ESP_LOGI(TAG, "Received IP address, restart to connect with MQTT ...");
        mqtt_app_start();
    }
}

//
char *pack_data_to_json(int id, char *name, char *model)
{
    if (tcp_virtual_storage == NULL || basic_dict == NULL)
        return NULL;

    cJSON *root = cJSON_CreateObject();

    // 1. Thêm Gateway ID (m_id) để định danh con ESP32-S3 của em
    // Em có thể để cứng hoặc lấy từ MAC address. Ở đây thầy tạm để là "GW_XP_01"
    cJSON_AddStringToObject(root, "gateway_id", "mbateway");

    // 2. Các thông tin định danh Meter
    cJSON_AddNumberToObject(root, "m_id", id); // ID của đồng hồ (3, 4...)
    cJSON_AddStringToObject(root, "m_name", name);
    cJSON_AddStringToObject(root, "model", model);
    cJSON_AddStringToObject(root, "attr", "Consumption_Meter");

    // Khởi tạo các giá trị mặc định bằng 0 để tránh lỗi bên Web nếu không tìm thấy thanh ghi
    cJSON_AddNumberToObject(root, "volt", 0);
    cJSON_AddNumberToObject(root, "curr", 0);
    cJSON_AddNumberToObject(root, "curr_dmd", 0);
    cJSON_AddNumberToObject(root, "real_pwr", 0);
    cJSON_AddNumberToObject(root, "app_pwr", 0);
    cJSON_AddNumberToObject(root, "freq", 0);

    if (xSemaphoreTake(xDataMutex, pdMS_TO_TICKS(100)) == pdTRUE)
    {
        for (int i = 0; i < register_count; i++)
        {
            // Lọc đúng dữ liệu của Meter đang xét
            if (basic_dict[i].mb_slave_addr == id)
            {
                for (int j = 0; j < mapping_size; j++)
                {
                    if (strcmp(basic_dict[i].param_key, master_mapping[j].modbus_param_key) == 0)
                    {
                        // cJSON_ReplaceItemInObject(A, B, C) có nghĩa là:
                        // "Trong đối tượng A, hãy tìm mục có tên là B, và thay thế nó bằng giá trị C".
                        cJSON_ReplaceItemInObject(root,                                        // A
                                                  master_mapping[j].web_field_key,             // B
                                                  cJSON_CreateNumber(tcp_virtual_storage[i])); // C
                        break;
                    }
                }
            }
        }
        xSemaphoreGive(xDataMutex);
    }

    char *json_out = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    return json_out;
}

void mqtt_publish_task(void *pvParameters)
{
    // Chờ ban đầu để mạng ổn định
    vTaskDelay(pdMS_TO_TICKS(5000));

    while (1)
    {
        // Kiểm tra điều kiện: Đã kết nối MQTT và có dữ liệu Modbus
        if (is_mqtt_connected && mqtt_client != NULL && tcp_virtual_storage != NULL && basic_dict != NULL)
        {
            // Duyệt qua số lượng thanh ghi/thiết bị thực tế em có
            // Giả sử mỗi thiết bị em quản lý theo id trong basic_dict

            int last_id = -1; // Biến tạm để kiểm tra trùng ID
            int meter_count = 0;

            for (int i = 0; i < register_count; i++)
            {
                int current_id = basic_dict[i].mb_slave_addr; // Lấy ID của thiết bị từ dictionary

                // Nếu gặp ID mới (khác với ID vừa gửi trước đó)
                if (current_id != last_id)
                {
                    meter_count++;
                    char meter_name[32];
                    sprintf(meter_name, "Meter %d (ID %d)", meter_count, current_id);

                    // Đóng gói dữ liệu dựa trên ID thực tế này
                    char *payload = pack_data_to_json(current_id, meter_name, "EM_07K");

                    if (payload != NULL)
                    {
                        // Gửi dữ liệu lên topic đã định nghĩa
                        esp_mqtt_client_publish(mqtt_client, PUBLISH_TOPIC, payload, 0, 1, 0);
                        ESP_LOGI(TAG, "Gửi dữ liệu %s thành công!", meter_name);
                        free(payload);
                    }

                    last_id = current_id; // Cập nhật ID đã xử lý
                    vTaskDelay(pdMS_TO_TICKS(500));
                }
            }
        }
        else
        {
            ESP_LOGW(TAG, "Lose connection to MQTT Broker, Waiting for connect again ...");
        }

        vTaskDelay(pdMS_TO_TICKS(10000)); // Chu kỳ gửi 10 giây
    }
}