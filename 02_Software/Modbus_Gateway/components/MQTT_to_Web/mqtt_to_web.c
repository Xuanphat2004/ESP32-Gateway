#include "cJSON.h"
#include "esp_log.h"
#include "modbus_rtu.h"
#include "freertos/semphr.h"
#include <string.h>
#include "mqtt_client.h"
#include "mqtt_to_web.h"
#include "esp_wifi.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_eth.h"
#include "esp_mac.h"
#include "scan_device.h"
#include "offline_buffer.h"
#include "rtc_mb.h"
#include "sd_card.h"
#include <sys/stat.h>
#include <dirent.h>

static const char *TAG = "[MQTT]";

static bool is_mqtt_connected = false;

extern mb_parameter_descriptor_t *basic_dict;
extern uint16_t register_count;
extern SemaphoreHandle_t xDataMutex;
extern SemaphoreHandle_t data_ready_sem;
extern float *final_data;
extern bool dual_port_mode;
extern bool is_change_baud;
extern volatile bool is_scan_device;
extern SemaphoreHandle_t sd_mutex;
extern uint32_t poll_interval_ms;

esp_mqtt_client_handle_t mqtt_client = NULL;

typedef struct
{
    char *modbus_param_key;
    char *web_field_key;
} name_mapping_t;

const name_mapping_t master_mapping[] = {
    {"Voltage-L1-N", "volt"}, {"Voltage-A-N", "volt"}, {"Phase-A-Voltage-L1-N", "volt"}, //
    {"Current-L1", "curr"},
    {"Current-A", "curr"},
    {"Phase-A-Current", "curr"}, //
    {"Current-L1-Demand", "curr_dmd"},
    {"Current A-Demand-Present", "curr_dmd"},
    {"Phase-A-Current-Dmd", "curr_dmd"}, //
    {"Frequency-ID-10", "freq"},
    {"Frequency-L1", "freq"},
    {"Grid-Frequency", "freq"}, //
    {"Real-Power-A", "real_pwr"},
    {"Active-Power-L1", "real_pwr"},
    {"Active-Power-L1", "real_pwr"}, //
    {"Apparent-Power-L1", "app_pwr"},
    {"Apparent-Power-A", "app_pwr"},
    {
        "S_L1-(Apparent-Power-A)", "app_pwr" //
    }};
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
char *pack_data_to_json(int id, char *name, char *model,
                        float *src_data, char *timestamp)
{
    if (src_data == NULL || basic_dict == NULL)
        return NULL;

    cJSON *root = cJSON_CreateObject();
    if (root == NULL)
        return NULL;

    char gateway_id[32] = " ";
    get_gateway_id(gateway_id, sizeof(gateway_id));
    cJSON_AddStringToObject(root, "gateway_id", gateway_id);
    cJSON_AddStringToObject(root, "timestamp", timestamp);
    cJSON_AddNumberToObject(root, "m_id", id);
    cJSON_AddStringToObject(root, "m_name", name);
    cJSON_AddStringToObject(root, "model", model);
    cJSON_AddStringToObject(root, "attr", "Consumption Meter");

    bool online = is_id_online((uint8_t)id);
    cJSON_AddStringToObject(root, "status", online ? "online" : "offline");

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

    for (int i = 0; i < register_count; i++)
    {
        if (basic_dict[i].mb_slave_addr != id)
            continue;

        cJSON *obj = cJSON_CreateObject();
        if (obj)
        {
            cJSON_AddNumberToObject(obj, "register", basic_dict[i].mb_reg_start);
            cJSON_AddStringToObject(obj, "name", basic_dict[i].param_key);
            cJSON_AddNumberToObject(obj, "value", src_data[i]);
            cJSON_AddStringToObject(obj, "unit", basic_dict[i].param_units);
            cJSON_AddItemToArray(data_array, obj);
        }

        for (int j = 0; j < mapping_size; j++)
        {
            if (strcmp(basic_dict[i].param_key, master_mapping[j].modbus_param_key) == 0)
            {
                cJSON *existing = cJSON_GetObjectItem(root, master_mapping[j].web_field_key);
                if (existing == NULL)
                    cJSON_AddNumberToObject(root, master_mapping[j].web_field_key, src_data[i]);
                else
                    cJSON_SetNumberValue(existing, src_data[i]);
                break;
            }
        }
    }

    cJSON_AddItemToObject(root, "registers", data_array);
    char *out = cJSON_PrintUnformatted(root);
    cJSON_Delete(root);
    return out;
}

//======================================================================
// Publish 1 record lên MQTT — dùng chung cho realtime và recovery
static bool publish_one_record(record_t *r)
{
    if (!is_mqtt_connected || mqtt_client == NULL)
        return false;

    int last_id = -1, meter_count = 0;
    bool all_ok = true;

    for (int i = 0; i < register_count; i++)
    {
        int id = basic_dict[i].mb_slave_addr;
        if (id == last_id)
            continue;

        meter_count++;
        char name[32];
        snprintf(name, sizeof(name), "Meter %d - ID: %d", meter_count, id);

        char *payload = pack_data_to_json(id, name, "Power Meter", r->values, r->timestamp);

        if (payload)
        {
            int msg_id = esp_mqtt_client_publish(mqtt_client, PUBLISH_TOPIC, payload, 0, 1, 0);

            if (msg_id < 0)
            {
                ESP_LOGW(TAG, "Publish failed: %s", name);
                all_ok = false;
            }
            free(payload);
        }
        last_id = id;
        vTaskDelay(pdMS_TO_TICKS(100));
    }
    return all_ok;
}

//======================================================================
// Flush buffer xuống SD khi mất mạng và đạt ngưỡng
static void flush_buf_to_sd(void)
{
    if (offline_buf_count == 0)
        return;

    mkdir("/sdcard/offline", 0777);

    rtc_time_t now;
    rtc_read_time(&now);
    char filepath[128];
    snprintf(filepath, sizeof(filepath),
             "/sdcard/offline/%02d%02d%02d_%02d%02d%02d.jsonl",
             now.year, now.month, now.date,
             now.hour, now.minute, now.second);

    if (xSemaphoreTake(sd_mutex, pdMS_TO_TICKS(3000)) != pdTRUE)
        return;

    FILE *f = fopen(filepath, "w");
    if (f == NULL)
    {
        ESP_LOGW(TAG, "[FLUSH] Khong mo duoc file %s", filepath);
        xSemaphoreGive(sd_mutex);
        return;
    }

    int count = offline_buf_count;
    for (int i = 0; i < count; i++)
    {
        record_t *r = &offline_buf[i];
        fprintf(f, "{\"ts\":\"%s\",\"reg_count\":%d,\"values\":[",
                r->timestamp, r->reg_count);
        for (int j = 0; j < r->reg_count; j++)
        {
            if (j > 0)
                fprintf(f, ",");
            fprintf(f, "%.4f", r->values[j]);
        }
        fprintf(f, "]}\n");
    }

    fclose(f);
    xSemaphoreGive(sd_mutex);
    offline_buf_clear();
    ESP_LOGI(TAG, "[FLUSH] Ghi %d records xuong %s", count, filepath);
}

//======================================================================
// Gửi 1 record cũ từ SD Card
// Trả về true nếu gửi thành công, false nếu thất bại hoặc không có file
static bool send_one_sd_record(void)
{
    DIR *dir = opendir("/sdcard/offline");
    if (dir == NULL)
        return false;

    // PATH_MAX = 272: "/sdcard/offline/" (16) + d_name tối đa (255) + null (1)
    char filepath[272] = {0};
    char found_name[256] = {0};
    struct dirent *entry;
    while ((entry = readdir(dir)) != NULL)
    {
        if (strstr(entry->d_name, "_sent") != NULL)
            continue;
        if (strstr(entry->d_name, ".jsonl") == NULL)
            continue;
        strncpy(found_name, entry->d_name, sizeof(found_name) - 1);
        break;
    }
    closedir(dir);

    if (found_name[0] == 0)
        return false;

    strcpy(filepath, "/sdcard/offline/");
    strncat(filepath, found_name, sizeof(filepath) - strlen(filepath) - 1);

    if (xSemaphoreTake(sd_mutex, pdMS_TO_TICKS(3000)) != pdTRUE)
        return false;

    FILE *f = fopen(filepath, "r");
    if (f == NULL)
    {
        xSemaphoreGive(sd_mutex);
        return false;
    }

    // FIX 1: alloc line buffer trên heap thay vì stack
    char *line = malloc(4096);
    if (line == NULL)
    {
        fclose(f);
        xSemaphoreGive(sd_mutex);
        ESP_LOGE(TAG, "[SD] OOM: khong alloc duoc line buffer");
        return false;
    }

    bool sent_ok = false;

    if (fgets(line, 4096, f) != NULL)
    {
        int len = strlen(line);
        if (len > 0 && line[len - 1] == '\n')
            line[len - 1] = '\0';

        cJSON *root = cJSON_Parse(line);

        // Free line ngay sau khi parse — không cần giữ nữa
        free(line);
        line = NULL;

        if (root != NULL)
        {
            cJSON *ts_item = cJSON_GetObjectItem(root, "ts");
            cJSON *reg_item = cJSON_GetObjectItem(root, "reg_count");
            cJSON *val_item = cJSON_GetObjectItem(root, "values");

            if (ts_item && reg_item && val_item)
            {
                int reg_count_ = reg_item->valueint;
                int val_size = cJSON_GetArraySize(val_item);

                if (val_size == reg_count_ && reg_count_ <= OFFLINE_MAX_REGISTERS)
                {
                    // FIX 2: record_t (~1.4KB) cũng alloc trên heap
                    record_t *tmp = malloc(sizeof(record_t));
                    if (tmp == NULL)
                    {
                        cJSON_Delete(root);
                        fclose(f);
                        xSemaphoreGive(sd_mutex);
                        ESP_LOGE(TAG, "[SD] OOM: khong alloc duoc record_t");
                        return false;
                    }
                    memset(tmp, 0, sizeof(record_t));

                    strncpy(tmp->timestamp, ts_item->valuestring,
                            sizeof(tmp->timestamp) - 1);
                    tmp->reg_count = reg_count_;
                    for (int i = 0; i < reg_count_; i++)
                    {
                        cJSON *v = cJSON_GetArrayItem(val_item, i);
                        tmp->values[i] = v ? (float)v->valuedouble : 0.0f;
                    }

                    fclose(f);
                    xSemaphoreGive(sd_mutex);

                    sent_ok = publish_one_record(tmp);
                    free(tmp); // free sau khi publish xong
                    cJSON_Delete(root);

                    if (sent_ok)
                    {
                        char sent_path[272];
                        snprintf(sent_path, sizeof(sent_path), "%s", filepath);
                        char *dot = strstr(sent_path, ".jsonl");
                        if (dot)
                            strcpy(dot, "_sent.jsonl");
                        rename(filepath, sent_path);
                        ESP_LOGI(TAG, "[SD] Xong: %s", sent_path);
                    }
                    return sent_ok;
                }
            }
            cJSON_Delete(root);
        }
    }
    else
    {
        // fgets trả về NULL → free trước khi thoát
        free(line);
        line = NULL;
    }

    fclose(f);
    xSemaphoreGive(sd_mutex);
    return false;
}

//======================================================================
// MQTT publish task — 1 task duy nhất xử lý cả realtime và recovery
//
// Luồng:
//   Có tín hiệu data mới   → push vào buffer → publish record mới nhất
//   Timeout (không có mới) → gửi 1 record cũ từ buffer RAM hoặc SD Card
//
// Timeout = poll_interval_ms / 5
// → Trong 1 chu kỳ poll có thể gửi ~5 record cũ
void mqtt_publish_task(void *pvParameters)
{
    vTaskDelay(pdMS_TO_TICKS(3000));

    while (1)
    {
        // Tính timeout = 1/5 poll interval, tối thiểu 1s
        uint32_t timeout_ms = poll_interval_ms / 5;
        if (timeout_ms < 1000)
            timeout_ms = 1000;

        BaseType_t got_data = xSemaphoreTake(data_ready_sem,
                                             pdMS_TO_TICKS(timeout_ms));

        if (is_scan_device || is_change_baud)
            continue;
        if (offline_buf == NULL || basic_dict == NULL)
            continue;

        if (got_data == pdTRUE)
        {
            // ── Có dữ liệu mới vừa poll về ──────────────────────────
            char ts[32];
            rtc_get_iso_timestamp(ts, sizeof(ts));

            if (xSemaphoreTake(xDataMutex, pdMS_TO_TICKS(1000)) == pdTRUE)
            {
                offline_buf_push(final_data, register_count, ts);
                xSemaphoreGive(xDataMutex);
            }
            else
            {
                ESP_LOGW(TAG, "xDataMutex timeout");
                continue;
            }

            if (is_mqtt_connected)
            {
                // Publish record mới nhất (index cuối buffer)
                int idx = offline_buf_count - 1;
                if (idx >= 0)
                {
                    bool ok = publish_one_record(&offline_buf[idx]);
                    if (ok)
                        offline_buf[idx].is_sent = true;
                }
            }
            else
            {
                // Mất mạng → kiểm tra ngưỡng flush SD
                if (offline_buf_count >= OFFLINE_FLUSH_THRESHOLD)
                    flush_buf_to_sd();
            }
        }
        else
        {
            // ── Timeout: không có dữ liệu mới → gửi dữ liệu cũ ─────
            if (!is_mqtt_connected)
                continue;

            // Bước 1: tìm record cũ nhất chưa sent trong RAM buffer
            bool found_unsent = false;
            for (int i = 0; i < offline_buf_count; i++)
            {
                if (!offline_buf[i].is_sent)
                {
                    bool ok = publish_one_record(&offline_buf[i]);
                    if (ok)
                        offline_buf[i].is_sent = true;
                    found_unsent = true;
                    break; // Chỉ gửi 1 record mỗi lần timeout
                }
            }

            // Kiểm tra nếu tất cả đã sent → clear buffer
            if (offline_buf_count > 0)
            {
                bool all_sent = true;
                for (int i = 0; i < offline_buf_count; i++)
                {
                    if (!offline_buf[i].is_sent)
                    {
                        all_sent = false;
                        break;
                    }
                }
                if (all_sent)
                    offline_buf_clear();
            }

            // Bước 2: nếu RAM buffer trống → gửi từ SD Card
            if (!found_unsent)
            {
                send_one_sd_record();
            }
        }

        // WATERMARK MONITOR — xóa sau khi xác nhận stack ổn định
        // Log mỗi ~60 lần lặp để không spam
        static uint32_t wm_counter = 0;
        if (++wm_counter % 60 == 0)
        {
            UBaseType_t wm = uxTaskGetStackHighWaterMark(NULL);
            ESP_LOGW(TAG, "[STACK] mqtt_task watermark: %u words (%u bytes)",
                     wm, wm * sizeof(StackType_t));
        }
    }
}

//======================================================================
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

    cJSON *inactive_arr = cJSON_CreateArray();
    for (int i = 0; i < scan_result.lose_count; i++)
        cJSON_AddItemToArray(inactive_arr, cJSON_CreateNumber(scan_result.lose_list[i]));
    cJSON_AddItemToObject(root, "inactive_ids", inactive_arr);

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