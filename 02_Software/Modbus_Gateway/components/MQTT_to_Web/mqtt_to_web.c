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

// Forward declaration — định nghĩa ở cuối file
static bool send_one_scan_record(void);
static int send_one_sd_record(void);
static bool publish_one_record(record_t *r);

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
    {"Total-Active-Power-Forward", "real_pwr"}, //
    {"Apparent-Power-L1", "app_pwr"},
    {"Apparent-Power-A", "app_pwr"},
    {"Phase-A-Apparent-Power", "app_pwr"}};
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
static void mqtt_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data)
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
// Tạo kết nối tới Broker
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
// Gọi callback khi có kết nối mạng trở lại
void mqtt_network_event_handler(void *arg, esp_event_base_t event_base, int32_t event_id, void *event_data)
{
    if (event_base == IP_EVENT && (event_id == IP_EVENT_STA_GOT_IP || event_id == IP_EVENT_ETH_GOT_IP))
    {
        ESP_LOGI(TAG, "Got IP, restarting MQTT...");
        mqtt_app_start();
    }
}

//======================================================================
// Kiểm tra 1 slave còn online không (chỉ xét khi chạy dual port)
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
// Đóng gói dữ liệu 1 meter thành chuỗi JSON để gửi lên Broker
char *pack_data_to_json(int id, char *name, char *model, float *src_data, char *timestamp)
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

    // Meter offline → gửi mảng registers rỗng
    if (!online)
    {
        cJSON_AddItemToObject(root, "registers", cJSON_CreateArray());
        char *out = cJSON_PrintUnformatted(root);
        cJSON_Delete(root);
        return out;
    }

    cJSON *data_array = cJSON_CreateArray();
    for (int i = 0; i < register_count; i++)
    {
        if (basic_dict[i].mb_slave_addr != id)
            continue;

        cJSON *obj = cJSON_CreateObject();
        cJSON_AddNumberToObject(obj, "register", basic_dict[i].mb_reg_start);
        cJSON_AddStringToObject(obj, "name", basic_dict[i].param_key);
        cJSON_AddNumberToObject(obj, "value", src_data[i]);
        cJSON_AddStringToObject(obj, "unit", basic_dict[i].param_units);
        cJSON_AddItemToArray(data_array, obj);

        // Gắn thêm giá trị vào field tổng (volt/curr/freq...) nếu khớp tên
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
// Publish 1 record lên MQTT — mỗi meter 1 message
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
            continue; // mỗi slave chỉ gửi 1 lần
        last_id = id;

        meter_count++;
        char name[32];
        snprintf(name, sizeof(name), "Meter %d - ID: %d", meter_count, id);

        char *payload = pack_data_to_json(id, name, "Power Meter", r->values, r->timestamp);
        if (payload != NULL)
        {
            if (esp_mqtt_client_publish(mqtt_client, PUBLISH_TOPIC, payload, 0, 1, 0) < 0)
            {
                ESP_LOGW(TAG, "Publish failed: %s", name);
                all_ok = false;
            }
            free(payload);
        }
        vTaskDelay(pdMS_TO_TICKS(100));
    }
    return all_ok;
}

//======================================================================
// Kiểm tra cả buffer RAM đã gửi hết chưa → nếu rồi thì dọn buffer
//======================================================================
// Đếm tổng số record cũ CHƯA gửi trên SD (đếm số DÒNG trong các file *.jsonl,
// bỏ qua file *_sent). Mỗi dòng = 1 record.
static int count_unsent_sd(void)
{
    DIR *dir = opendir("/sdcard/offline");
    if (dir == NULL)
        return 0;

    int total = 0;
    struct dirent *entry;
    while ((entry = readdir(dir)) != NULL)
    {
        if (strstr(entry->d_name, "_sent") != NULL)
            continue;
        if (strstr(entry->d_name, ".jsonl") == NULL)
            continue;

        char path[300];
        snprintf(path, sizeof(path), "/sdcard/offline/%s", entry->d_name);
        FILE *f = fopen(path, "r");
        if (f != NULL)
        {
            int c;
            while ((c = fgetc(f)) != EOF)
                if (c == '\n')
                    total++; // mỗi dòng kết thúc bằng '\n' = 1 record
            fclose(f);
        }
    }
    closedir(dir);
    return total;
}

//======================================================================
// Gửi record cũ: RAM tới SD Card tới scan cũ
// Mỗi record kiểm tra kết nối — nếu mất mạng hoặc đang scan thì dừng ngay.
static void send_all_backlog(void)
{
    if (!is_mqtt_connected)
        return;

    // Đếm tổng số record cũ cần gửi (RAM chưa gửi + file SD chưa gửi)
    int ram_unsent = 0;
    for (int i = 0; i < offline_buf_count; i++)
        if (!offline_buf[i].is_sent)
            ram_unsent++;

    int total = ram_unsent + count_unsent_sd();
    if (total == 0)
        return; // không có gì để gửi

    int sent = 0;
    ESP_LOGI(TAG, "[BACKLOG] Found %d old record(s) to send (RAM: %d, SD: %d)",
             total, ram_unsent, total - ram_unsent);

    // gửi hết record cũ trong RAM
    for (int i = 0; i < offline_buf_count; i++)
    {
        if (!is_mqtt_connected || is_scan_device || is_change_baud)
        {
            ESP_LOGW(TAG, "[BACKLOG] Interrupted: sent %d/%d, remaining %d", sent, total, total - sent);
            return;
        }
        if (offline_buf[i].is_sent)
            continue;
        if (!publish_one_record(&offline_buf[i]))
        {
            ESP_LOGW(TAG, "[BACKLOG] Send failed: sent %d/%d, remaining %d", sent, total, total - sent);
            return; // mạng lỗi thì dừng, lần sau tiếp tục
        }
        offline_buf[i].is_sent = true;
        sent++;
        ESP_LOGI(TAG, "[BACKLOG] Sent %d/%d, remaining %d", sent, total, total - sent);
    }
    offline_buf_clear();

    // Gửi hết record cũ trên SD Card (mỗi file có thể chứa nhiều record)
    int n;
    while ((n = send_one_sd_record()) > 0)
    {
        sent += n;
        ESP_LOGI(TAG, "[BACKLOG] Sent %d/%d, remaining %d", sent, total, total - sent);
        if (!is_mqtt_connected || is_scan_device || is_change_baud)
        {
            ESP_LOGW(TAG, "[BACKLOG] Interrupted: sent %d/%d, remaining %d", sent, total, total - sent);
            return;
        }
    }

    ESP_LOGI(TAG, "[BACKLOG] Done. All %d old record(s) sent, system clear", total);

    // Gửi lại kết quả scan cũ
    while (send_one_scan_record())
    {
        if (!is_mqtt_connected || is_scan_device || is_change_baud)
            return;
    }
}

//======================================================================
// Flush toàn bộ buffer RAM xuống 1 file SD khi mất mạng và đạt ngưỡng
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
             now.year, now.month, now.date, now.hour, now.minute, now.second);

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
        fprintf(f, "{\"ts\":\"%s\",\"reg_count\":%d,\"values\":[", r->timestamp, r->reg_count);
        for (int j = 0; j < r->reg_count; j++)
            fprintf(f, (j > 0) ? ",%.4f" : "%.4f", r->values[j]);
        fprintf(f, "]}\n");
    }
    fclose(f);
    xSemaphoreGive(sd_mutex);

    offline_buf_clear();
    ESP_LOGI(TAG, "[FLUSH] Ghi %d records xuong %s", count, filepath);
}

//======================================================================
// Tìm file cũ nhất CHƯA gửi trong thư mục (bỏ qua file *_sent)
// Trả về true + đường dẫn đầy đủ trong out_path nếu tìm thấy
static bool find_oldest_unsent_file(const char *folder, const char *ext, char *out_path, size_t out_size)
{
    DIR *dir = opendir(folder);
    if (dir == NULL)
        return false;

    char name[256] = {0};
    struct dirent *entry;
    while ((entry = readdir(dir)) != NULL)
    {
        if (strstr(entry->d_name, "_sent") != NULL)
            continue;
        if (strstr(entry->d_name, ext) == NULL)
            continue;
        strncpy(name, entry->d_name, sizeof(name) - 1);
        break;
    }
    closedir(dir);

    if (name[0] == 0)
        return false;

    snprintf(out_path, out_size, "%s/%s", folder, name);
    return true;
}

//======================================================================
// Đổi tên file thành *_sent.<ext> để không gửi lại lần sau
static void rename_to_sent(const char *filepath, const char *ext)
{
    char sent_path[300];
    snprintf(sent_path, sizeof(sent_path), "%s", filepath);

    char *dot = strstr(sent_path, ext);
    if (dot == NULL)
        return;

    char new_ext[16];
    snprintf(new_ext, sizeof(new_ext), "_sent%s", ext);
    strcpy(dot, new_ext);
    rename(filepath, sent_path);
}

//======================================================================
// Phân tích 1 dòng JSON {"ts":..,"reg_count":..,"values":[..]} thành record_t
// Trả về true nếu hợp lệ
static bool parse_record_line(char *line, record_t *rec)
{
    cJSON *root = cJSON_Parse(line);
    if (root == NULL)
        return false;

    cJSON *ts = cJSON_GetObjectItem(root, "ts");
    cJSON *cnt = cJSON_GetObjectItem(root, "reg_count");
    cJSON *vals = cJSON_GetObjectItem(root, "values");

    bool ok = false;
    if (ts != NULL && cnt != NULL && vals != NULL)
    {
        int n = cnt->valueint;
        if (n == cJSON_GetArraySize(vals) && n <= OFFLINE_MAX_REGISTERS)
        {
            memset(rec, 0, sizeof(record_t));
            strncpy(rec->timestamp, ts->valuestring, sizeof(rec->timestamp) - 1);
            rec->reg_count = n;
            for (int i = 0; i < n; i++)
            {
                cJSON *v = cJSON_GetArrayItem(vals, i);
                rec->values[i] = v ? (float)v->valuedouble : 0.0f;
            }
            ok = true;
        }
    }
    cJSON_Delete(root);
    return ok;
}

//======================================================================
// Gửi TẤT CẢ record trong file SD cũ nhất chưa gửi (mỗi dòng = 1 record).
// Trả về số record đã gửi (0 nếu hết file hoặc lỗi).
// Giữ mutex SD suốt quá trình đọc-gửi file (lúc recovery không có tác vụ SD khác).
static int send_one_sd_record(void)
{
    char filepath[300];
    if (!find_oldest_unsent_file("/sdcard/offline", ".jsonl", filepath, sizeof(filepath)))
        return 0;

    char *line = malloc(4096);
    record_t *rec = malloc(sizeof(record_t));
    if (line == NULL || rec == NULL)
    {
        free(line);
        free(rec);
        return 0;
    }

    if (xSemaphoreTake(sd_mutex, pdMS_TO_TICKS(3000)) != pdTRUE)
    {
        free(line);
        free(rec);
        return 0;
    }

    FILE *f = fopen(filepath, "r");
    if (f == NULL)
    {
        xSemaphoreGive(sd_mutex);
        free(line);
        free(rec);
        return 0;
    }

    // Đọc và gửi TỪNG DÒNG trong file
    int sent = 0;
    bool all_sent = true;
    while (fgets(line, 4096, f) != NULL)
    {
        if (!is_mqtt_connected || is_scan_device || is_change_baud)
        {
            all_sent = false; // chưa gửi hết → KHÔNG đánh dấu _sent
            break;
        }
        if (!parse_record_line(line, rec))
            continue; // dòng lỗi → bỏ qua, gửi dòng tiếp theo
        if (!publish_one_record(rec))
        {
            all_sent = false; // gửi lỗi → dừng, giữ file để lần sau gửi lại
            break;
        }
        sent++;
    }
    fclose(f);

    // Chỉ đổi tên _sent khi đã gửi HẾT các dòng trong file
    if (all_sent)
    {
        rename_to_sent(filepath, ".jsonl");
        ESP_LOGI(TAG, "[SD] Sent all %d record(s) from file", sent);
    }
    xSemaphoreGive(sd_mutex);

    free(line);
    free(rec);
    return sent;
}

//======================================================================
// Xử lý khi CÓ dữ liệu mới poll về: lọc rác → push buffer → gửi + xả backlog
static void process_new_data(void)
{
    char ts[32];
    rtc_get_iso_timestamp(ts, sizeof(ts));

    // Kiểm tra dữ liệu: nếu TẤT CẢ thanh ghi = 0 thì là rác (lúc trước/sau scan)
    bool has_valid = false;
    if (xSemaphoreTake(xDataMutex, pdMS_TO_TICKS(1000)) != pdTRUE)
    {
        ESP_LOGW(TAG, "xDataMutex timeout");
        return;
    }
    for (int i = 0; i < register_count; i++)
    {
        if (final_data[i] != 0.0f)
        {
            has_valid = true;
            break;
        }
    }
    if (has_valid)
        offline_buf_push(final_data, register_count, ts);
    xSemaphoreGive(xDataMutex);

    if (!has_valid)
    {
        ESP_LOGW(TAG, "Du lieu toan 0, bo qua khong gui");
        return;
    }

    // Mất mạng → đầy ngưỡng thì ghi xuống SD, xong thôi
    if (!is_mqtt_connected)
    {
        if (offline_buf_count >= OFFLINE_FLUSH_THRESHOLD)
            flush_buf_to_sd();
        return;
    }

    // 1. Ưu tiên: gửi record MỚI NHẤT ngay lập tức → web thấy trạng thái hiện tại
    int idx = offline_buf_count - 1;
    if (idx >= 0 && publish_one_record(&offline_buf[idx]))
        offline_buf[idx].is_sent = true;

    // 2. Dump toàn bộ record cũ còn lại (~vài phút nếu mất mạng lâu)
    send_all_backlog();
}

//======================================================================
// MQTT publish task — 1 task duy nhất xử lý cả realtime và recovery
void mqtt_publish_task(void *pvParameters)
{
    vTaskDelay(pdMS_TO_TICKS(3000));

    while (1)
    {
        uint32_t timeout_ms = poll_interval_ms / 5;
        if (timeout_ms < 1000)
            timeout_ms = 1000;

        BaseType_t got_data = xSemaphoreTake(data_ready_sem, pdMS_TO_TICKS(timeout_ms));

        // Đang scan/đổi baud → bỏ qua, xóa tín hiệu sem thừa
        if (is_scan_device || is_change_baud)
        {
            xSemaphoreTake(data_ready_sem, 0);
            continue;
        }
        if (offline_buf == NULL || basic_dict == NULL)
            continue;

        // Có data mới → gửi mới nhất trước, sau đó dump hết backlog cũ
        if (got_data == pdTRUE)
            process_new_data();
        else if (is_mqtt_connected)
            send_all_backlog(); // rảnh → tranh thủ dump hết record cũ
    }
}

//======================================================================
// Build JSON payload cho scan result
static char *build_scan_payload(void)
{
    char gateway_id[32] = {0};
    get_gateway_id(gateway_id, sizeof(gateway_id));

    cJSON *root = cJSON_CreateObject();
    if (root == NULL)
        return NULL;

    cJSON_AddStringToObject(root, "gateway_id", gateway_id);
    cJSON_AddStringToObject(root, "event", "scan_result");
    cJSON_AddBoolToObject(root, "wire_p1_ok", wire_p1_ok);
    cJSON_AddBoolToObject(root, "wire_p2_ok", wire_p2_ok);
    cJSON_AddNumberToObject(root, "active_port", scan_result.active_port);
    cJSON_AddBoolToObject(root, "dual_port_mode", dual_port_mode);
    cJSON_AddBoolToObject(root, "line_ok", wire_p1_ok || wire_p2_ok);
    cJSON_AddNumberToObject(root, "final_id_p1", scan_result.final_id_p1);
    cJSON_AddNumberToObject(root, "final_id_p2", scan_result.final_id_p2);
    cJSON_AddStringToObject(root, "severity", (scan_result.lose_count > 0) ? "warning" : "normal");

    // Danh sách ID mất kết nối
    cJSON *inactive_arr = cJSON_CreateArray();
    for (int i = 0; i < scan_result.lose_count; i++)
        cJSON_AddItemToArray(inactive_arr, cJSON_CreateNumber(scan_result.lose_list[i]));
    cJSON_AddItemToObject(root, "inactive_ids", inactive_arr);

    // Danh sách ID còn hoạt động = original_id trừ đi các ID mất
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
    return payload;
}

//======================================================================
// Lưu scan payload xuống SD để gửi lại khi có mạng
static void save_scan_to_sd(const char *payload)
{
    mkdir("/sdcard/scan", 0777);

    rtc_time_t now;
    rtc_read_time(&now);
    char filepath[128];
    snprintf(filepath, sizeof(filepath),
             "/sdcard/scan/%02d%02d%02d_%02d%02d%02d.json",
             now.year, now.month, now.date, now.hour, now.minute, now.second);

    if (xSemaphoreTake(sd_mutex, pdMS_TO_TICKS(3000)) != pdTRUE)
        return;

    FILE *f = fopen(filepath, "w");
    if (f != NULL)
    {
        fprintf(f, "%s\n", payload);
        fclose(f);
        ESP_LOGI(TAG, "[SCAN] Mat mang - luu scan ket qua vao %s", filepath);
    }
    else
    {
        ESP_LOGW(TAG, "[SCAN] Khong mo duoc file luu scan");
    }
    xSemaphoreGive(sd_mutex);
}

//======================================================================
// Gửi lại 1 scan result cũ từ SD. Trả về true nếu gửi thành công.
static bool send_one_scan_record(void)
{
    char filepath[300];
    if (!find_oldest_unsent_file("/sdcard/scan", ".json", filepath, sizeof(filepath)))
        return false;

    // Đọc dòng đầu file
    char line[2048] = {0};
    if (xSemaphoreTake(sd_mutex, pdMS_TO_TICKS(3000)) != pdTRUE)
        return false;

    FILE *f = fopen(filepath, "r");
    if (f != NULL)
    {
        if (fgets(line, sizeof(line), f) != NULL)
        {
            int len = strlen(line);
            if (len > 0 && line[len - 1] == '\n')
                line[len - 1] = '\0';
        }
        fclose(f);
    }
    xSemaphoreGive(sd_mutex);

    // Gửi sau khi nhả mutex
    if (strlen(line) == 0 || !is_mqtt_connected || mqtt_client == NULL)
        return false;

    if (esp_mqtt_client_publish(mqtt_client, SCAN_TOPIC, line, 0, 1, 1) < 0)
        return false;

    rename_to_sent(filepath, ".json");
    ESP_LOGI(TAG, "[SCAN] Gui lai scan cu xong: %s", filepath);
    return true;
}

//======================================================================
// Gửi kết quả scan: có mạng gửi ngay, mất mạng lưu SD để gửi lại sau
void publish_scan_result(void)
{
    char *payload = build_scan_payload();
    if (payload == NULL)
        return;

    // Mất mạng hoặc gửi thất bại → lưu SD
    if (!is_mqtt_connected || mqtt_client == NULL ||
        esp_mqtt_client_publish(mqtt_client, SCAN_TOPIC, payload, 0, 1, 1) < 0)
    {
        ESP_LOGW(TAG, "[SCAN] Khong gui duoc - luu de gui lai sau");
        save_scan_to_sd(payload);
    }
    else
    {
        ESP_LOGI(TAG, "[SCAN] Gui scan ket qua OK");
    }
    free(payload);
}