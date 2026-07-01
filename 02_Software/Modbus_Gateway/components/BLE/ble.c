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
#include "esp_mac.h"
#include "eeprom.h"

static const char *TAG = "[MODBUS GATEWAY-BLE]";

extern bool blu_connected;       // Biến global để UI biết trạng thái kết nối BLE hiện tại
static char ble_device_name[24]; // tên thiết bị hiển thị trên app
static esp_gatt_srvc_id_t service_id;

static uint16_t service_handle = 0;   // handle của service, dùng để add char thứ 2
static uint16_t handle_reg_table = 0; // handle của ngăn 1: bảng thanh ghi Modbus
static uint16_t handle_wifi_cfg = 0;  // handle của ngăn 2: WiFi config

static char *receive_buffer = NULL; // buffer lớn 51KB cho bảng thanh ghi (chunked)
static int received_len = 0;
static char wifi_buffer[256]; // buffer nhỏ cho WiFi config (1 packet là đủ)
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

// tạo ra chuỗi tên trên app sử dụng 1 phần địa chỉ MAC
static void build_device_name(void)
{
    uint8_t mac[6] = {0};
    esp_read_mac(mac, ESP_MAC_EFUSE_FACTORY);
    snprintf(ble_device_name, sizeof(ble_device_name), "%s%02X%02X%02X", DEVICE_NAME_PREFIX, mac[3], mac[4], mac[5]);
}

void ble_server_init(void)
{
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

    build_device_name();
    esp_ble_gap_set_device_name(ble_device_name);
    ESP_LOGI(TAG, "BLE device name: %s", ble_device_name);

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
        ESP_LOGI(TAG, "Advertising BLE packet ...");
        break;
    case ESP_GAP_BLE_UPDATE_CONN_PARAMS_EVT:
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
        printf("%-4d |%-32s | %-6s| %-5d | %-7d | %-4d | %-4d | %-6.3f | %-6d | %-6d\n",
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
    cJSON *root = cJSON_Parse(json_str);
    if (root == NULL) // Lỗi có thể do không đủ RAM trong vùng heap để phân tích JSON
    {
        ESP_LOGW("JSON_PARSE", "Fail to format JSON ! Can't Parse !!!");
        return NULL;
    }

    int reg_count = cJSON_GetArraySize(root);
    *out_reg_count = reg_count;
    ESP_LOGI("JSON_PARSE", "Found %d Regiser in packet.", reg_count);

    // Sử dụng số lượng thanh ghi để tạo ra 1 vùng nhớ để mapping gói tin vào bảng thanh ghi
    temp_modbus_reg_t *reg_array = malloc(reg_count * sizeof(temp_modbus_reg_t));
    if (reg_array == NULL)
    {
        ESP_LOGW("JSON_PARSE", "No enough RAM !!!");
        cJSON_Delete(root);
        return NULL;
    }

    // Duyệt qua từng phần tử trong gói tin JSON
    for (int i = 0; i < reg_count; i++)
    {
        cJSON *item = cJSON_GetArrayItem(root, i);

        // mã định danh riêng cho từng thanh ghi = cid
        reg_array[i].cid = cJSON_GetObjectItem(item, "i")->valueint;

        // tên = name
        cJSON *name_obj = cJSON_GetObjectItem(item, "n");
        // Kiểm tra xem có phải là chuỗi không và con trỏ vào ô nhớ khác NULL không
        //  KHÔNG tìm thấy field "n" trong gói tin mà app gửi xuống thì con trỏ trả về NULL
        if (cJSON_IsString(name_obj) && (name_obj->valuestring != NULL))
        {
            // strncpy(đích, nguồn, số_byte_tối_đa)
            strncpy(reg_array[i].name, name_obj->valuestring, sizeof(reg_array[i].name) - 1);
            reg_array[i].name[sizeof(reg_array[i].name) - 1] = '\0'; // Chốt ký tự kết thúc
        }
        else
        {
            strcpy(reg_array[i].name, "No-name"); // Mặc định nếu thiếu
        }

        // u = đơn vị
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

    // Giải phóng cây JSON (Quan trọng để tránh tràn RAM)
    cJSON_Delete(root);

    return reg_array;
}

// Hàm lưu dữ liệu vào vùng nhớ NVS
static void save_regs_to_nvs(temp_modbus_reg_t *reg_array, int count)
{
    printf("==========================================Save Config from APP to NVS ====================================================");
    if (reg_array == NULL || count <= 0)
        return;

    nvs_handle_t my_handle;
    esp_err_t err;

    // Mount partition "storage" trước khi mở
    nvs_flash_init_partition("storage");

    // Mở Namespace "storage_app" từ partition "storage" riêng với quyền Read/Write
    err = nvs_open_from_partition("storage", "storage_app", NVS_READWRITE, &my_handle);
    if (err != ESP_OK)
    {
        ESP_LOGW("NVS_SAVE", "Can NOT open NVS Handle (%s)", esp_err_to_name(err));
        return;
    }

    err = nvs_set_u16(my_handle, "register_count", (uint16_t)count);
    if (err != ESP_OK)
        ESP_LOGE("NVS_SAVE", "Fail to save in reg_count !!!");

    // Lưu toàn bộ bảng thanh ghi dưới dạng một khối Binary (Blob)
    size_t blob_size = count * sizeof(temp_modbus_reg_t);
    err = nvs_set_blob(my_handle, "register_table", reg_array, blob_size);

    if (err == ESP_OK)
    {
        // Phải Commit thì dữ liệu mới thực sự được ghi xuống Flash
        err = nvs_commit(my_handle);
        if (err == ESP_OK)
        {
            ESP_LOGI("NVS_SAVE", "===> SUCCESSFUL: Saved %d registers into Flash!", count);
        }
    }
    else
    {
        ESP_LOGE("NVS_SAVE", "Fail to write into Flash memorry (%s)", esp_err_to_name(err)); // Flash memorry ở đây là phân vùng NVS trên flash
    }

    // Giải phóng biến handles
    nvs_close(my_handle);
    // printf("===========================================================================================================================");
}

// Lưu SSID và password vào EEPROM
// Địa chỉ khớp với wifi.c: SSID → 0x0100 (32 bytes), Password → 0x0120 (64 bytes)
static void save_wifi_to_eeprom(const char *ssid, const char *pass)
{
    char ssid_buf[32] = {0};
    char pass_buf[64] = {0};

    strncpy(ssid_buf, ssid, sizeof(ssid_buf) - 1);
    strncpy(pass_buf, pass, sizeof(pass_buf) - 1);

    esp_err_t err1 = eeprom_write(0x0100, (uint8_t *)ssid_buf, sizeof(ssid_buf));
    vTaskDelay(pdMS_TO_TICKS(10)); // delay giữa 2 lần ghi EEPROM
    esp_err_t err2 = eeprom_write(0x0120, (uint8_t *)pass_buf, sizeof(pass_buf));

    if (err1 == ESP_OK && err2 == ESP_OK)
        ESP_LOGI(TAG, "[WIFI] Da luu EEPROM: SSID=%s", ssid_buf);
    else
        ESP_LOGE(TAG, "[WIFI] Loi ghi EEPROM (ssid:%d pass:%d)", err1, err2);
}

// Parse JSON {"ssid":"...","pass":"..."} và lưu xuống EEPROM
static void parse_and_save_wifi(const char *json_str)
{
    cJSON *root = cJSON_Parse(json_str);
    if (root == NULL)
    {
        ESP_LOGW(TAG, "[WIFI] Fail to create JSON root array !!!");
        return;
    }

    cJSON *ssid_obj = cJSON_GetObjectItem(root, "ssid");
    cJSON *pass_obj = cJSON_GetObjectItem(root, "pass");

    if (cJSON_IsString(ssid_obj) && ssid_obj->valuestring != NULL && cJSON_IsString(pass_obj) && pass_obj->valuestring != NULL)

    {
        save_wifi_to_eeprom(ssid_obj->valuestring, pass_obj->valuestring);
    }
    else
    {
        ESP_LOGE(TAG, "[WIFI] JSON thieu field ssid hoac pass");
    }
    cJSON_Delete(root);
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
        service_handle = param->create.service_handle; // lưu lại để add char thứ 2 sau
        esp_ble_gatts_start_service(service_handle);
        // Tạo characteristic đầu tiên: nhận bảng thanh ghi Modbus
        esp_bt_uuid_t char_uuid = {.len = ESP_UUID_LEN_16, .uuid.uuid16 = GATTS_CHAR_UUID};
        esp_ble_gatts_add_char(service_handle, &char_uuid, ESP_GATT_PERM_WRITE, ESP_GATT_CHAR_PROP_BIT_WRITE, NULL, NULL);
        break;

    case ESP_GATTS_ADD_CHAR_EVT:
        if (handle_reg_table == 0)
        {
            // Char 1 (bảng thanh ghi) vừa tạo xong → lưu handle, tạo tiếp char 2
            handle_reg_table = param->add_char.attr_handle;
            ESP_LOGI(TAG, "Char[1] register table handle: %d", handle_reg_table);
            esp_bt_uuid_t wifi_uuid = {.len = ESP_UUID_LEN_16, .uuid.uuid16 = CHAR_WIFI_UUID};
            esp_ble_gatts_add_char(service_handle, &wifi_uuid, ESP_GATT_PERM_WRITE, ESP_GATT_CHAR_PROP_BIT_WRITE, NULL, NULL);
        }
        else if (handle_wifi_cfg == 0)
        {
            // Char 2 (WiFi config) vừa tạo xong → lưu handle, xong
            handle_wifi_cfg = param->add_char.attr_handle;
            ESP_LOGI(TAG, "Char[2] wifi config handle: %d", handle_wifi_cfg);
        }
        break;

    case ESP_GATTS_CONNECT_EVT:
        ESP_LOGI(TAG, "Connected with App, waiting to receive packet ...");
        blu_connected = true;
        received_len = 0;
        memset(receive_buffer, 0, MAX_JSON_SIZE);
        memset(wifi_buffer, 0, sizeof(wifi_buffer));
        break;

    case ESP_GATTS_WRITE_EVT:
    {
        blu_connected = true;

        // Gửi ACK về app ngay nếu cần
        if (param->write.need_rsp)
            esp_ble_gatts_send_response(gatts_if, param->write.conn_id, param->write.trans_id, ESP_GATT_OK, NULL);

        // --- Ngăn 1 (0xFF11): Bảng thanh ghi Modbus — nhận nhiều chunk ---
        if (param->write.handle == handle_reg_table)
        {
            if (received_len + param->write.len < MAX_JSON_SIZE)
            {
                memcpy(receive_buffer + received_len, param->write.value, param->write.len);
                received_len += param->write.len;
                receive_buffer[received_len] = '\0';
                ESP_LOGI(TAG, "[REG] +%d bytes, tong: %d bytes", param->write.len, received_len);

                vTaskDelay(pdMS_TO_TICKS(100));
                if (receive_buffer[received_len - 1] == ']')
                {
                    ESP_LOGW(TAG, "[REG] Nhan du JSON, bat dau xu ly...");
                    int count = 0;
                    temp_modbus_reg_t *final_regs = parse_json_to_struct_array(receive_buffer, &count);
                    if (final_regs != NULL)
                    {
                        print_parsed_registers(final_regs, count);
                        save_regs_to_nvs(final_regs, count);
                        free(final_regs);
                        esp_ble_gatts_close(gatts_if, param->write.conn_id);
                        ESP_LOGW("SYSTEM", "Restart sau 3 giay...");
                        vTaskDelay(pdMS_TO_TICKS(3000));
                        esp_restart();
                    }
                }
            }
        }
        // --- Ngăn 2 (0xFF12): WiFi config — nhận 1 packet JSON nhỏ ---
        else if (param->write.handle == handle_wifi_cfg)
        {
            uint16_t len = param->write.len;
            if (len < sizeof(wifi_buffer) - 1)
            {
                memcpy(wifi_buffer, param->write.value, len);
                wifi_buffer[len] = '\0';
                ESP_LOGI(TAG, "[WIFI] Nhan: %s", wifi_buffer);
                parse_and_save_wifi(wifi_buffer);
                esp_ble_gatts_close(gatts_if, param->write.conn_id);
                ESP_LOGW("SYSTEM", "Restart sau 1 giay...");
                vTaskDelay(pdMS_TO_TICKS(1000));
                esp_restart();
            }
            else
            {
                ESP_LOGE(TAG, "[WIFI] Du lieu qua lon (%d bytes), bo qua", len);
            }
        }
        break;
    }
    case ESP_GATTS_DISCONNECT_EVT:
        ESP_LOGW(TAG, "App Disconnect ...");
        blu_connected = false; // Cập nhật trạng thái kết nối BLE
        esp_ble_gap_start_advertising(&adv_params);
        break;

    default:
        break;
    }
}