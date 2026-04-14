#include "ble.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_bt.h"
#include "esp_bt_main.h"
#include "esp_gap_ble_api.h"
#include "esp_gatts_api.h"
#include "cJSON.h"
#include "esp_modbus_common.h"

static const char *TAG = "[MODBUS GATEWAY-BLE]";

// --- CẤU HÌNH UUID (Phải khớp với file logic.py trên App) ---
#define GATTS_SERVICE_UUID 0xFF10
#define GATTS_CHAR_UUID 0xFF11
#define GATTS_NUM_HANDLE 4
#define DEVICE_NAME "MODBUS-GATEWAY"

extern bool blu_connected; // Biến global để UI biết trạng thái kết nối BLE hiện tại

// Cấu trúc dữ liệu để lưu trữ thông tin thanh ghi từ JSON
typedef struct
{
    uint16_t cid;        // i: Index
    char name[16];       // n: Name
    char unit[8];        // u: Unit
    uint8_t slave_id;    // s: Slave ID
    uint16_t reg_start;  // a: Address
    uint8_t func_code;   // f: Function Code (0: Holding, 1: Input)
    uint8_t data_type;   // t: Type (Float, U16,...)
    uint16_t quantity;   // q: Quantity
    float scale;         // sc: Scale
    uint8_t mul_type;    // m: Multiplier type
    uint16_t ref_cid[2]; // r: Factor 1 & Factor 2 CIDs
} temp_modbus_reg_t;

// --- BIẾN TOÀN CỤC VÀ QUẢN LÝ BUFFER DỮ LIỆU ---
static uint16_t gatts_handle_table[GATTS_NUM_HANDLE];
static esp_gatt_srvc_id_t service_id;

// Buffer động để chứa chuỗi JSON (Vì chuỗi 100 thanh ghi rất dài)
static char *receive_buffer = NULL;
static int received_len = 0;
#define MAX_JSON_SIZE 8192 // Giới hạn 8KB cho an toàn RAM

// --- PROTOTYPES ---
static void gap_event_handler(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *param);
static void gatts_event_handler(esp_gatts_cb_event_t event, esp_gatt_if_t gatts_if, esp_ble_gatts_cb_param_t *param);

static esp_ble_adv_params_t adv_params = {
    .adv_int_min = 0x20,
    .adv_int_max = 0x40,
    .adv_type = ADV_TYPE_IND,
    .own_addr_type = BLE_ADDR_TYPE_PUBLIC,
    .channel_map = ADV_CHNL_ALL,
    .adv_filter_policy = ADV_FILTER_ALLOW_SCAN_ANY_CON_ANY,
};

// --- HÀM KHỞI TẠO HỆ THỐNG BLE ---
void ble_server_init(void)
{
    esp_err_t ret;

    // Giải phóng bộ nhớ BT Classic để dồn cho BLE
    ESP_ERROR_CHECK(esp_bt_controller_mem_release(ESP_BT_MODE_CLASSIC_BT));

    esp_bt_controller_config_t bt_cfg = BT_CONTROLLER_INIT_CONFIG_DEFAULT();
    ESP_ERROR_CHECK(esp_bt_controller_init(&bt_cfg));
    ESP_ERROR_CHECK(esp_bt_controller_enable(ESP_BT_MODE_BLE));

    ESP_ERROR_CHECK(esp_bluedroid_init());
    ESP_ERROR_CHECK(esp_bluedroid_enable());

    // Đăng ký Callback
    ESP_ERROR_CHECK(esp_ble_gap_register_callback(gap_event_handler));
    ESP_ERROR_CHECK(esp_ble_gatts_register_callback(gatts_event_handler));

    // Cấu hình Service ID
    service_id.is_primary = true;
    service_id.id.inst_id = 0x00;
    service_id.id.uuid.len = ESP_UUID_LEN_16;
    service_id.id.uuid.uuid.uuid16 = GATTS_SERVICE_UUID;

    esp_ble_gap_set_device_name(DEVICE_NAME);

    // Cấu hình nội dung gói tin quảng bá
    esp_ble_adv_data_t adv_data = {
        .set_scan_rsp = false,
        .include_name = true, // Cho phép bao gồm tên trong gói tin
        .include_txpower = true,
        .min_interval = 0x0006,
        .max_interval = 0x0010,
        .appearance = 0x00,
        .manufacturer_len = 0,
        .p_manufacturer_data = NULL,
        .service_data_len = 0,
        .p_service_data = NULL,
        .service_uuid_len = 0,
        .p_service_uuid = NULL,
        .flag = (ESP_BLE_ADV_FLAG_GEN_DISC | ESP_BLE_ADV_FLAG_BREDR_NOT_SPT),
    };

    // Đặt tên thiết bị
    esp_ble_gap_set_device_name(DEVICE_NAME);

    // Gửi cấu hình này xuống Controller
    esp_ble_gap_config_adv_data(&adv_data);
    esp_ble_gatts_app_register(0);

    // Cấp phát buffer ban đầu
    receive_buffer = (char *)malloc(MAX_JSON_SIZE);
    memset(receive_buffer, 0, MAX_JSON_SIZE);

    ESP_LOGI(TAG, "BLE Gateway System Ready. Waiting for App...");
}

// XỬ LÝ QUẢNG BÁ (ADVERTISING)
static void gap_event_handler(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *param)
{
    switch (event)
    {
    case ESP_GAP_BLE_ADV_DATA_SET_COMPLETE_EVT:
        esp_ble_gap_start_advertising(&adv_params);
        blu_connected = false; // Cập nhật trạng thái kết nối BLE
        ESP_LOGI(TAG, "Đang phát quảng bá BLE...");
        break;
    case ESP_GAP_BLE_UPDATE_CONN_PARAMS_EVT:
        ESP_LOGI(TAG, "Đã cập nhật tham số kết nối (MTU/Interval)");
        blu_connected = true; // Cập nhật trạng thái kết nối BLE
        break;
    default:
        break;
    }
}

// In các thanh ghi sau khi đã xử lý xong từ gói tin JSON
void print_parsed_registers(temp_modbus_reg_t *reg_array, int count)
{
    if (reg_array == NULL)
        return;

    printf("=============== RECEIVE LIST FROM APP============");
    // Thêm các cột Factor vào tiêu đề
    printf("%-4s | %-4s | %-4s | %-5s | %-7s | %-4s | %-4s | %-6s | %-6s | %-6s\n",
           "CID", "Name", "Unit", "Slave", "Address", "Func", "Type", "Scale", "Ref 1", "Ref 2");
    printf("--------------------------------------------------------------------------\n");

    for (int i = 0; i < count; i++)
    {
        // In thêm dữ liệu từ mảng ref_cid
        printf("%-4d |%-15s | %-6s| %-5d | %-7d | %-4d | %-4d | %-6.3f | %-6d | %-6d\n",
               reg_array[i].cid,
               reg_array[i].name, // In tên
               reg_array[i].unit, // In đơn vị
               reg_array[i].slave_id,
               reg_array[i].reg_start,
               reg_array[i].func_code,
               reg_array[i].data_type,
               reg_array[i].scale,
               reg_array[i].ref_cid[0],  // Factor 1
               reg_array[i].ref_cid[1]); // Factor 2
    }
    ESP_LOGW("DEBUG_DATA", "----------------------------------------------------------");
}

// Xử lý dữ liệu ban đầu được từ app
temp_modbus_reg_t *parse_json_to_struct_array(const char *json_str, int *out_reg_count)
{
    if (json_str == NULL)
        return NULL;

    // 1. Phân tích chuỗi JSON thô thành cây đối tượng cJSON
    cJSON *root = cJSON_Parse(json_str);
    if (root == NULL)
    {
        ESP_LOGE("JSON_PARSE", "Lỗi định dạng JSON! Không thể Parse.");
        return NULL;
    }

    // 2. Xác định số lượng thanh ghi (phần tử trong mảng JSON)
    int reg_count = cJSON_GetArraySize(root);
    *out_reg_count = reg_count;
    ESP_LOGI("JSON_PARSE", "Found %d Regiser in packet.", reg_count);

    // 3. Cấp phát bộ nhớ cho mảng Struct tạm thời trong RAM
    temp_modbus_reg_t *reg_array = malloc(reg_count * sizeof(temp_modbus_reg_t));
    if (reg_array == NULL)
    {
        ESP_LOGE("JSON_PARSE", "Không đủ RAM để cấp phát mảng Struct!");
        cJSON_Delete(root);
        return NULL;
    }

    // 4. Duyệt qua từng phần tử JSON và ánh xạ vào Struct
    for (int i = 0; i < reg_count; i++)
    {
        cJSON *item = cJSON_GetArrayItem(root, i);

        // Trích xuất các Key ngắn gọn (Short-key) từ Python
        reg_array[i].cid = cJSON_GetObjectItem(item, "i")->valueint;

        // 2. Trích xuất Tên (n) - Dùng strncpy để copy chuỗi an toàn
        cJSON *name_obj = cJSON_GetObjectItem(item, "n");
        if (cJSON_IsString(name_obj) && (name_obj->valuestring != NULL))
        {
            // Copy tối đa 15 ký tự vào name[16]
            strncpy(reg_array[i].name, name_obj->valuestring, sizeof(reg_array[i].name) - 1);
            reg_array[i].name[sizeof(reg_array[i].name) - 1] = '\0'; // Chốt ký tự kết thúc
        }
        else
        {
            strcpy(reg_array[i].name, "NoName"); // Mặc định nếu thiếu
        }

        // 3. Trích xuất Đơn vị (u)
        cJSON *unit_obj = cJSON_GetObjectItem(item, "u");
        if (cJSON_IsString(unit_obj) && (unit_obj->valuestring != NULL))
        {
            strncpy(reg_array[i].unit, unit_obj->valuestring, sizeof(reg_array[i].unit) - 1);
            reg_array[i].unit[sizeof(reg_array[i].unit) - 1] = '\0';
        }
        else
        {
            strcpy(reg_array[i].unit, "N/A"); // Mặc định nếu thiếu
        }
        reg_array[i].slave_id = (uint8_t)cJSON_GetObjectItem(item, "s")->valueint;
        reg_array[i].reg_start = (uint16_t)cJSON_GetObjectItem(item, "a")->valueint;
        reg_array[i].func_code = (uint8_t)cJSON_GetObjectItem(item, "f")->valueint;
        reg_array[i].data_type = (uint8_t)cJSON_GetObjectItem(item, "t")->valueint;
        reg_array[i].quantity = (uint16_t)cJSON_GetObjectItem(item, "q")->valueint;
        reg_array[i].scale = (float)cJSON_GetObjectItem(item, "sc")->valuedouble;
        reg_array[i].mul_type = (uint8_t)cJSON_GetObjectItem(item, "m")->valueint;

        // Trích xuất mảng tham chiếu Factor 1 & Factor 2 (r)
        cJSON *ref_array = cJSON_GetObjectItem(item, "r");
        if (cJSON_IsArray(ref_array))
        {
            reg_array[i].ref_cid[0] = (uint16_t)cJSON_GetArrayItem(ref_array, 0)->valueint;
            reg_array[i].ref_cid[1] = (uint16_t)cJSON_GetArrayItem(ref_array, 1)->valueint;
        }

        ESP_LOGD("JSON_PARSE", "Đã Parse xong thanh ghi: %d", reg_array[i].cid);
    }

    // 5. Giải phóng cây JSON (Quan trọng để tránh tràn RAM)
    cJSON_Delete(root);

    return reg_array;
}

// Hàm lưu dữ liệu vào vùng nhớ NVS
static void save_regs_to_nvs(temp_modbus_reg_t *reg_array, int count)
{
    if (reg_array == NULL || count <= 0)
        return;

    nvs_handle_t my_handle;
    esp_err_t err;

    // 1. Mở Namespace "storage" (hoặc "modbus_cfg") với quyền Read/Write
    // Namespace giống như một thư mục để phân biệt các loại dữ liệu khác nhau
    err = nvs_open("storage", NVS_READWRITE, &my_handle);
    if (err != ESP_OK)
    {
        ESP_LOGE("NVS_SAVE", "Không thể mở NVS Handle (%s)", esp_err_to_name(err));
        return;
    }

    // 2. Lưu số lượng thanh ghi (để lúc khởi động lại biết đường cấp phát RAM)
    err = nvs_set_u16(my_handle, "reg_count", (uint16_t)count);
    if (err != ESP_OK)
        ESP_LOGE("NVS_SAVE", "Lỗi lưu reg_count!");

    // 3. Lưu toàn bộ mảng Struct dưới dạng một khối Binary (Blob)
    size_t blob_size = count * sizeof(temp_modbus_reg_t);
    err = nvs_set_blob(my_handle, "reg_table", reg_array, blob_size);

    if (err == ESP_OK)
    {
        // 4. QUAN TRỌNG: Phải Commit thì dữ liệu mới thực sự được ghi xuống Flash
        err = nvs_commit(my_handle);
        if (err == ESP_OK)
        {
            ESP_LOGI("NVS_SAVE", "===> THÀNH CÔNG: Đã lưu %d thanh ghi vào Flash!", count);
        }
    }
    else
    {
        ESP_LOGE("NVS_SAVE", "Lỗi ghi Blob vào NVS (%s)", esp_err_to_name(err));
    }

    // 5. Đóng Handle để giải phóng tài nguyên
    nvs_close(my_handle);

    // 6. Thông báo và tự động khởi động lại hệ thống
    ESP_LOGW("SYSTEM", "Hệ thống sẽ khởi động lại sau 3 giây để áp dụng cấu hình mới...");
    vTaskDelay(pdMS_TO_TICKS(5000));
}

// Hàm xử lý sự kiện GATT Server - Nhận dữ liệu từ App qua BLE
static void gatts_event_handler(esp_gatts_cb_event_t event, esp_gatt_if_t gatts_if, esp_ble_gatts_cb_param_t *param)
{
    switch (event)
    {
    case ESP_GATTS_REG_EVT:
        esp_ble_gatts_create_service(gatts_if, &service_id, GATTS_NUM_HANDLE);
        break;

    case ESP_GATTS_CREATE_EVT:
        esp_ble_gatts_start_service(param->create.service_handle);
        // Tạo đặc tính (Characteristic) để App ghi dữ liệu vào
        esp_bt_uuid_t char_uuid = {.len = ESP_UUID_LEN_16, .uuid.uuid16 = GATTS_CHAR_UUID};
        esp_ble_gatts_add_char(param->create.service_handle, &char_uuid,
                               ESP_GATT_PERM_WRITE, ESP_GATT_CHAR_PROP_BIT_WRITE, NULL, NULL);
        break;

    case ESP_GATTS_CONNECT_EVT:
        ESP_LOGI(TAG, "App đã kết nối. Chờ nhận cấu hình...");
        blu_connected = true; // Cập nhật trạng thái kết nối BLE
        received_len = 0;     // Reset buffer cho lượt nhận mới
        memset(receive_buffer, 0, MAX_JSON_SIZE);
        break;

    case ESP_GATTS_WRITE_EVT:
    {
        // Kiểm tra tránh tràn buffer
        if (received_len + param->write.len < MAX_JSON_SIZE)
        {
            memcpy(receive_buffer + received_len, param->write.value, param->write.len);
            received_len += param->write.len;
            receive_buffer[received_len] = '\0'; // Kết thúc chuỗi để Log

            ESP_LOGI(TAG, "Đã nhận mảnh: %d bytes. Tổng: %d bytes", param->write.len, received_len);

            // Gửi xác nhận (ACK) về cho Python App (Cơ chế response=True)
            if (param->write.need_rsp)
            {
                esp_ble_gatts_send_response(gatts_if, param->write.conn_id, param->write.trans_id, ESP_GATT_OK, NULL);
            }

            // Kiểm tra nếu là mảnh cuối cùng (thường kết thúc bằng dấu đóng ngoặc JSON ']')
            if (receive_buffer[received_len - 1] == ']')
            {
                ESP_LOGW(TAG, "ĐÃ NHẬN ĐỦ JSON! Bắt đầu xử lý...");
                // Trong gatts_event_handler, khi nhận đủ JSON:
                int count = 0;
                temp_modbus_reg_t *final_regs = parse_json_to_struct_array(receive_buffer, &count);

                if (final_regs != NULL)
                {
                    print_parsed_registers(final_regs, count);
                    ESP_LOGI(TAG, "Giai đoạn 1 hoàn tất. Đang chuyển sang lưu NVS...");
                    save_regs_to_nvs(final_regs, count);
                    free(final_regs); // Giải phóng mảng tạm sau khi đã lưu NVS thành công
                    esp_restart();
                }
                ESP_LOGD(TAG, "Nội dung: %s", receive_buffer);
                // Ở đây Phát gọi hàm Parse_JSON_And_Save_To_NVS(receive_buffer);
            }
        }
        break;
    }

    case ESP_GATTS_DISCONNECT_EVT:
        ESP_LOGW(TAG, "App đã ngắt kết nối. Tiếp tục phát Advertising...");
        blu_connected = false; // Cập nhật trạng thái kết nối BLE
        esp_ble_gap_start_advertising(&adv_params);
        break;

    default:
        break;
    }
}