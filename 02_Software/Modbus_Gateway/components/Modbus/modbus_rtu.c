#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "esp_log.h"
#include "nvs_flash.h"
#include "esp_partition.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "driver/uart.h"
#include <errno.h>

#include "esp_modbus_master.h"
#include "esp_modbus_common.h"
#include "rtc_mb.h"
#include "modbus_rtu.h"
#include "change_baudrate.h"
#include "scan_device.h"

static const char *TAG = "[RTU]";

mb_parameter_descriptor_t *basic_dict = NULL;
factor_dict_t *factor_dict = NULL;
uint8_t *raw_data = NULL;
float *final_data = NULL;
uint16_t register_count = 0;
uint16_t g_total_raw_bytes = 0;

// dual_port_mode: scan_device.c set sau mỗi lần scan
//   false = Normal mode: poll 1 port toàn bộ dict
//   true  = Dual mode:   poll Port1 theo list_p1, Port2 theo list_p2
bool dual_port_mode = false;

// dual_port_polling: block Data-Copy task khi đang poll 2 port
// Data-Copy chỉ chạy sau khi cả 2 port xong → tcp_virtual_storage đầy đủ
volatile bool dual_port_polling = false;

// Thời gian delay giữa các chu kỳ poll — người dùng chỉnh qua LCD
uint32_t poll_interval_ms = 10000;

extern SemaphoreHandle_t xDataMutex;
extern SemaphoreHandle_t scan_sem;
extern SemaphoreHandle_t data_ready_sem;
extern bool is_change_baud;
extern volatile bool is_scan_device;
extern scan_analysis_t scan_result;
extern id_scan_result_t list_p1;
extern id_scan_result_t list_p2;

//======================================================================
void print_ram_tables(void)
{
    if (register_count == 0 || basic_dict == NULL || factor_dict == NULL)
    {
        ESP_LOGW(TAG, "Table is empty !!!");
        return;
    }
    printf("\n============================================ MODBUS REGISTER TABLE ==============================================\n");
    printf("%-3s | %-15s | %-5s | %-3s | %-5s | %-4s | %-4s | %-4s | %-4s | %-5s | %-4s | %-6s | %-3s | %-5s | %-5s\n",
           "CID", "Name", "Unit", "SID", "Addr", "Func", "Qty", "Offs", "Type", "Byte Size", "Access", "Scale", "Mul", "Ref1", "Ref2");
    printf("-------------------------------------------------------------------------------------------------------------------------\n");
    for (int i = 0; i < register_count; i++)
    {
        printf("%-3d | %-15s | %-5s | %-3d | %-5d | %-4d | %-4d | %-4d | %-4d | %-5d | %-4d | %-6.8f | %-3d | %-5d | %-5d\n",
               basic_dict[i].cid, basic_dict[i].param_key, basic_dict[i].param_units,
               basic_dict[i].mb_slave_addr, basic_dict[i].mb_reg_start, basic_dict[i].mb_param_type,
               basic_dict[i].mb_size, basic_dict[i].param_offset, basic_dict[i].param_type,
               basic_dict[i].param_size, basic_dict[i].access, factor_dict[i].scale,
               factor_dict[i].mul_type, factor_dict[i].ref_cid[0], factor_dict[i].ref_cid[1]);
    }
    printf("=========================================================================================================================\n");
    printf("Total Memory: %d Bytes\n", g_total_raw_bytes);
    printf("=========================================================================================================================\n\n");
}

//======================================================================
static esp_err_t init_storage_partition(void)
{
    static bool storage_initialized = false;
    if (storage_initialized)
        return ESP_OK;

    const esp_partition_t *partition = esp_partition_find_first(
        ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_DATA_NVS, "storage");
    if (partition == NULL)
    {
        ESP_LOGE(TAG, "Not found partition 'storage'");
        return ESP_ERR_NOT_FOUND;
    }

    esp_err_t err = nvs_flash_init_partition("storage");
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        nvs_flash_erase_partition("storage");
        err = nvs_flash_init_partition("storage");
    }
    if (err == ESP_OK)
        storage_initialized = true;
    return err;
}

//======================================================================
esp_err_t load_modbus_dynamic_config(void)
{
    nvs_handle_t my_handle;
    esp_err_t err = nvs_open_from_partition("storage", "storage_app", NVS_READONLY, &my_handle);
    if (err != ESP_OK)
        return err;

    err = nvs_get_u16(my_handle, "register_count", &register_count);
    if (err != ESP_OK || register_count == 0)
    {
        nvs_close(my_handle);
        return ESP_ERR_NOT_FOUND;
    }

    if (basic_dict)
        free(basic_dict);
    if (factor_dict)
        free(factor_dict);
    if (raw_data)
        free(raw_data);
    if (final_data)
        free(final_data);

    basic_dict = malloc(register_count * sizeof(mb_parameter_descriptor_t));
    factor_dict = malloc(register_count * sizeof(factor_dict_t));
    final_data = calloc(register_count, sizeof(float));

    size_t blob_size = register_count * sizeof(factor_dict_t);
    err = nvs_get_blob(my_handle, "register_table", factor_dict, &blob_size);
    if (err != ESP_OK)
    {
        nvs_close(my_handle);
        return err;
    }

    uint16_t offset = 0;
    for (int i = 0; i < register_count; i++)
    {
        factor_dict[i].name[63] = '\0';
        for (int n = 0; n < 63; n++)
        {
            if ((uint8_t)factor_dict[i].name[n] == 0xFF)
            {
                factor_dict[i].name[n] = '\0';
                break;
            }
        }
        basic_dict[i].cid = i;
        basic_dict[i].param_key = factor_dict[i].name;
        basic_dict[i].param_units = factor_dict[i].unit;
        basic_dict[i].mb_slave_addr = factor_dict[i].slave_id;
        basic_dict[i].mb_param_type = (factor_dict[i].func_code == 0) ? MB_PARAM_HOLDING : MB_PARAM_INPUT;
        basic_dict[i].mb_reg_start = factor_dict[i].reg_start;
        basic_dict[i].mb_size = factor_dict[i].quantity;
        basic_dict[i].param_type = factor_dict[i].data_type;
        basic_dict[i].param_size = factor_dict[i].quantity * 2;
        basic_dict[i].access = PAR_PERMS_READ;
        basic_dict[i].param_offset = offset;
        offset += basic_dict[i].param_size;
    }
    g_total_raw_bytes = offset;
    raw_data = calloc(1, g_total_raw_bytes);
    nvs_close(my_handle);
    return ESP_OK;
}

//======================================================================
void modbus_rtu_port_1_dummy_init(void)
{
    uint32_t baud = load_baud_from_nvs();
    uart_config_t cfg = {.baud_rate = baud, .data_bits = UART_DATA_8_BITS, .parity = UART_PARITY_DISABLE, .stop_bits = UART_STOP_BITS_1, .flow_ctrl = UART_HW_FLOWCTRL_DISABLE, .source_clk = UART_SCLK_DEFAULT};
    uart_param_config(UART_NUM_1, &cfg);
    uart_set_pin(UART_NUM_1, UART_1_TX_PIN, UART_1_RX_PIN, UART_1_EN_PIN, UART_PIN_NO_CHANGE);
    uart_driver_install(UART_NUM_1, 256, 0, 0, NULL, 0);
    uart_set_mode(UART_NUM_1, UART_MODE_RS485_HALF_DUPLEX);
    ESP_LOGI(TAG, "Port 1 dummy: DE=LOW.");
}

void modbus_rtu_port_2_dummy_init(void)
{
    uint32_t baud = load_baud_from_nvs();
    uart_config_t cfg = {.baud_rate = baud, .data_bits = UART_DATA_8_BITS, .parity = UART_PARITY_DISABLE, .stop_bits = UART_STOP_BITS_1, .flow_ctrl = UART_HW_FLOWCTRL_DISABLE, .source_clk = UART_SCLK_DEFAULT};
    uart_param_config(UART_NUM_2, &cfg);
    uart_set_pin(UART_NUM_2, UART_2_TX_PIN, UART_2_RX_PIN, UART_2_EN_PIN, UART_PIN_NO_CHANGE);
    uart_driver_install(UART_NUM_2, 256, 0, 0, NULL, 0);
    uart_set_mode(UART_NUM_2, UART_MODE_RS485_HALF_DUPLEX);
    ESP_LOGI(TAG, "Port 2 dummy: DE=LOW.");
}

//======================================================================
void modbus_rtu_port_1_init(void)
{
    scan_result.active_port = 1;
    uint32_t baud = load_baud_from_nvs();
    if (init_storage_partition() != ESP_OK)
    {
        ESP_LOGE(TAG, "Mount storage fail");
        return;
    }
    if (load_modbus_dynamic_config() != ESP_OK)
    {
        ESP_LOGE(TAG, "Load NVS fail");
        return;
    }

    void *h = NULL;
    ESP_ERROR_CHECK(mbc_master_init(MB_PORT_SERIAL_MASTER, &h));
    mb_communication_info_t comm = {.port = UART_1, .mode = MB_MODE_RTU, .baudrate = baud, .parity = MB_PARITY_NONE};
    ESP_ERROR_CHECK(mbc_master_setup((void *)&comm));
    ESP_ERROR_CHECK(mbc_master_set_descriptor(basic_dict, register_count));
    ESP_ERROR_CHECK(uart_set_pin(UART_1, UART_1_TX_PIN, UART_1_RX_PIN, UART_1_EN_PIN, UART_PIN_NO_CHANGE));
    ESP_ERROR_CHECK(mbc_master_start());
    ESP_ERROR_CHECK(uart_set_mode(UART_1, UART_MODE_RS485_HALF_DUPLEX));
    modbus_rtu_port_2_dummy_init();
}

//======================================================================
void modbus_rtu_port_2_init(void)
{
    scan_result.active_port = 2;
    uint32_t baud = load_baud_from_nvs();
    if (init_storage_partition() != ESP_OK)
    {
        ESP_LOGE(TAG, "Mount storage fail");
        return;
    }
    if (load_modbus_dynamic_config() != ESP_OK)
    {
        ESP_LOGE(TAG, "Load NVS fail");
        return;
    }

    void *h = NULL;
    ESP_ERROR_CHECK(mbc_master_init(MB_PORT_SERIAL_MASTER, &h));
    mb_communication_info_t comm = {.port = UART_2, .mode = MB_MODE_RTU, .baudrate = baud, .parity = MB_PARITY_NONE};
    ESP_ERROR_CHECK(mbc_master_setup((void *)&comm));
    ESP_ERROR_CHECK(mbc_master_set_descriptor(basic_dict, register_count));
    ESP_ERROR_CHECK(uart_set_pin(UART_2, UART_2_TX_PIN, UART_2_RX_PIN, UART_2_EN_PIN, UART_PIN_NO_CHANGE));
    ESP_ERROR_CHECK(mbc_master_start());
    ESP_ERROR_CHECK(uart_set_mode(UART_2, UART_MODE_RS485_HALF_DUPLEX));
    modbus_rtu_port_1_dummy_init();
}

//======================================================================
static float decode_raw_to_float(uint8_t *buf, mb_descr_type_t type)
{
    switch (type)
    {
    case PARAM_TYPE_U8:
    case PARAM_TYPE_U8_A:
    case PARAM_TYPE_U8_B:
        return (float)(*(uint8_t *)buf);
    case PARAM_TYPE_I8_A:
    case PARAM_TYPE_I8_B:
        return (float)(*(int8_t *)buf);
    case PARAM_TYPE_U16:
    case PARAM_TYPE_U16_AB:
    case PARAM_TYPE_U16_BA:
    {
        uint16_t v;
        memcpy(&v, buf, sizeof(v));
        return (float)v;
    }
    case PARAM_TYPE_I16_AB:
    case PARAM_TYPE_I16_BA:
    {
        int16_t v;
        memcpy(&v, buf, sizeof(v));
        return (float)v;
    }
    case PARAM_TYPE_U32:
    case PARAM_TYPE_U32_ABCD:
    case PARAM_TYPE_U32_CDAB:
    case PARAM_TYPE_U32_BADC:
    case PARAM_TYPE_U32_DCBA:
    {
        uint32_t v;
        memcpy(&v, buf, sizeof(v));
        return (float)v;
    }
    case PARAM_TYPE_I32_ABCD:
    case PARAM_TYPE_I32_CDAB:
    case PARAM_TYPE_I32_BADC:
    case PARAM_TYPE_I32_DCBA:
    {
        int32_t v;
        memcpy(&v, buf, sizeof(v));
        return (float)v;
    }
    case PARAM_TYPE_FLOAT:
    case PARAM_TYPE_FLOAT_ABCD:
    case PARAM_TYPE_FLOAT_CDAB:
    case PARAM_TYPE_FLOAT_BADC:
    case PARAM_TYPE_FLOAT_DCBA:
    {
        float v;
        memcpy(&v, buf, sizeof(v));
        return v;
    }
    case PARAM_TYPE_U64_ABCDEFGH:
    case PARAM_TYPE_U64_HGFEDCBA:
    case PARAM_TYPE_U64_GHEFCDAB:
    case PARAM_TYPE_U64_BADCFEHG:
    {
        uint64_t v;
        memcpy(&v, buf, sizeof(v));
        return (float)v;
    }
    case PARAM_TYPE_I64_ABCDEFGH:
    case PARAM_TYPE_I64_HGFEDCBA:
    case PARAM_TYPE_I64_GHEFCDAB:
    case PARAM_TYPE_I64_BADCFEHG:
    {
        int64_t v;
        memcpy(&v, buf, sizeof(v));
        return (float)v;
    }
    case PARAM_TYPE_DOUBLE_ABCDEFGH:
    case PARAM_TYPE_DOUBLE_HGFEDCBA:
    case PARAM_TYPE_DOUBLE_GHEFCDAB:
    case PARAM_TYPE_DOUBLE_BADCFEHG:
    {
        double v;
        memcpy(&v, buf, sizeof(v));
        return (float)v;
    }
    default:
    {
        uint16_t v;
        memcpy(&v, buf, sizeof(v));
        return (float)v;
    }
    }
}

//======================================================================
// Poll những CID có slave_id nằm trong target_list
// CID không trong list → bỏ qua (giữ nguyên read_ok[i] = false)
static void poll_for_list(id_scan_result_t *target_list, float *temp_result, bool *read_ok)
{
    uint8_t type;
    for (int i = 0; i < register_count; i++)
    {
        if (is_change_baud || is_scan_device)
            return;
        if (target_list->count == 0)
            return;

        // Kiểm tra slave_id có trong list không
        bool found = false;
        for (int k = 0; k < target_list->count; k++)
            if (target_list->id[k] == basic_dict[i].mb_slave_addr)
            {
                found = true;
                break;
            }
        if (!found)
            continue;

        uint8_t *addr = raw_data + basic_dict[i].param_offset;
        esp_err_t err = mbc_master_get_parameter(basic_dict[i].cid, (char *)basic_dict[i].param_key, addr, &type);

        if (is_change_baud || is_scan_device)
            return;

        if (err == ESP_OK)
        {
            temp_result[i] = decode_raw_to_float(addr, (mb_descr_type_t)basic_dict[i].param_type) * factor_dict[i].scale;
            read_ok[i] = true;
        }
        else
        {
            ESP_LOGW(TAG, "[DUAL] Fail CID:%d %s (0x%x)", i, basic_dict[i].param_key, err);
        }
    }
}

//======================================================================
// RTU Task - Vòng lặp poll dữ liệu
void modbus_test_read(void)
{
    esp_err_t err;
    uint8_t type;
    rtc_time_t now;
    // consecutive_fail: đếm số lần timeout liên tiếp của từng slave
    // Reset về 0 khi slave phản hồi OK
    // Trigger scan khi đạt 5 lần → không cần đợi hết toàn bộ CID
    uint8_t consecutive_fail[248] = {0};

    while (1)
    {
        if (register_count == 0)
        {
            vTaskDelay(pdMS_TO_TICKS(5000));
            continue;
        }
        if (is_change_baud || is_scan_device)
        {
            vTaskDelay(pdMS_TO_TICKS(200));
            continue;
        }

        vTaskDelay(pdMS_TO_TICKS(150));
        rtc_read_time(&now);

        float temp_result[register_count];
        bool read_ok[register_count];
        memset(read_ok, 0, sizeof(bool) * register_count);      // reset trạng thái đọc
        memset(temp_result, 0, sizeof(float) * register_count); // tránh giá trị rác trên stack

        if (dual_port_mode)
        {
            uint32_t baud = load_baud_from_nvs();
            void *h = NULL;
            dual_port_polling = true; // Block Data-Copy task

            // --- Poll Port 1 ---
            if (list_p1.count > 0)
            {
                ESP_LOGI(TAG, "[DUAL] Port 1 poll %d ID", list_p1.count);
                mbc_master_destroy();
                uart_driver_delete(UART_NUM_1);
                uart_driver_delete(UART_NUM_2);
                vTaskDelay(pdMS_TO_TICKS(300));

                mbc_master_init(MB_PORT_SERIAL_MASTER, &h);
                mb_communication_info_t c1 = {.port = UART_1, .mode = MB_MODE_RTU, .baudrate = baud, .parity = MB_PARITY_NONE};
                mbc_master_setup(&c1);
                mbc_master_set_descriptor(basic_dict, register_count);
                uart_set_pin(UART_1, UART_1_TX_PIN, UART_1_RX_PIN, UART_1_EN_PIN, UART_PIN_NO_CHANGE);
                mbc_master_start();
                uart_set_mode(UART_1, UART_MODE_RS485_HALF_DUPLEX);
                modbus_rtu_port_2_dummy_init();
                poll_for_list(&list_p1, temp_result, read_ok);
            }

            if (is_change_baud || is_scan_device)
            {
                dual_port_polling = false;
                goto exit_and_wait;
            }

            // --- Poll Port 2 ---
            if (list_p2.count > 0)
            {
                ESP_LOGI(TAG, "[DUAL] Port 2 poll %d ID", list_p2.count);
                mbc_master_destroy();
                uart_driver_delete(UART_NUM_1);
                uart_driver_delete(UART_NUM_2);
                vTaskDelay(pdMS_TO_TICKS(300));

                mbc_master_init(MB_PORT_SERIAL_MASTER, &h);
                mb_communication_info_t c2 = {.port = UART_2, .mode = MB_MODE_RTU, .baudrate = baud, .parity = MB_PARITY_NONE};
                mbc_master_setup(&c2);
                mbc_master_set_descriptor(basic_dict, register_count);
                uart_set_pin(UART_2, UART_2_TX_PIN, UART_2_RX_PIN, UART_2_EN_PIN, UART_PIN_NO_CHANGE);
                mbc_master_start();
                uart_set_mode(UART_2, UART_MODE_RS485_HALF_DUPLEX);
                modbus_rtu_port_1_dummy_init();
                poll_for_list(&list_p2, temp_result, read_ok);
            }

            if (is_change_baud || is_scan_device)
            {
                dual_port_polling = false;
                goto exit_and_wait;
            }

            // Xử lý factor (nhân CTR, VTR của phiên polling hiện tại)
            // Dùng temp_result[r] thay vì final_data[r] → dùng giá trị phiên này
            // Thêm read_ok[r] → chỉ nhân khi CID tham chiếu đọc thành công
            for (int i = 0; i < register_count; i++)
            {
                if (!read_ok[i])
                    continue;
                for (int j = 0; j < 2; j++)
                {
                    uint16_t r = factor_dict[i].ref_cid[j];
                    if (r < register_count && read_ok[r])
                        temp_result[i] *= temp_result[r];
                }
            }

            // --- Ghi vào final_data (chỉ CID đọc được) ---
            if (xSemaphoreTake(xDataMutex, pdMS_TO_TICKS(500)) == pdTRUE)
            {
                for (int i = 0; i < register_count; i++)
                {
                    if (read_ok[i])
                    {
                        final_data[i] = temp_result[i];
                        printf("[DUAL][CID:%d] - [%02d:%02d:%02d] %s = %.4f %s\n",
                               i, now.hour, now.minute, now.second,
                               basic_dict[i].param_key, final_data[i], basic_dict[i].param_units);
                    }
                }
                xSemaphoreGive(xDataMutex);
            }

            xSemaphoreGive(data_ready_sem);

            // Mở khóa Data-Copy task
            dual_port_polling = false;

            // consecutive_fail đã được xử lý trong poll_for_list
            // Không cần tổng hợp thêm ở đây

            printf("\n");
            vTaskDelay(pdMS_TO_TICKS(poll_interval_ms));
            continue;
        }

        // NORMAL MODE: Poll 1 port, đọc tất cả CID
        // Nếu 1 slave timeout 5 lần liên tiếp → trigger scan ngay
        // Không cần đợi hết toàn bộ CID: 100 CID × 300ms timeout = 30s quá lâu
        for (int i = 0; i < register_count; i++)
        {
            if (is_change_baud || is_scan_device)
                goto exit_and_wait;

            uint8_t *addr = raw_data + basic_dict[i].param_offset;
            err = mbc_master_get_parameter(basic_dict[i].cid, (char *)basic_dict[i].param_key, addr, &type);

            if (is_change_baud || is_scan_device)
                goto exit_and_wait;

            uint8_t sid = basic_dict[i].mb_slave_addr;

            if (err == ESP_OK)
            {
                temp_result[i] = decode_raw_to_float(addr, (mb_descr_type_t)basic_dict[i].param_type) * factor_dict[i].scale;
                read_ok[i] = true;
                consecutive_fail[sid] = 0; // Slave phản hồi → reset bộ đếm
            }
            else
            {
                temp_result[i] = 0;
                read_ok[i] = false;
                consecutive_fail[sid]++;
                ESP_LOGW(TAG, "Fail [CID:%d] %s (0x%x) | slave %d: %d/5",
                         i, basic_dict[i].param_key, err, sid, consecutive_fail[sid]);

                // Đủ 5 timeout liên tiếp → trigger scan ngay, không đợi hết vòng lặp
                if (consecutive_fail[sid] >= 5)
                {
                    consecutive_fail[sid] = 0;
                    xSemaphoreGive(scan_sem);
                    ESP_LOGW(TAG, ">>> Slave %d timeout 5 lan, trigger scan ngay!", sid);
                }
            }
        }

        // Xử lý factor (nhân CTR, VTR của phiên polling hiện tại)
        // Dùng temp_result[r] thay vì final_data[r] → dùng giá trị phiên này
        // Thêm read_ok[r] → chỉ nhân khi CID tham chiếu đọc thành công
        for (int i = 0; i < register_count; i++)
        {
            if (!read_ok[i])
                continue;
            for (int j = 0; j < 2; j++)
            {
                uint16_t r = factor_dict[i].ref_cid[j];
                if (r < register_count && read_ok[r])
                    temp_result[i] *= temp_result[r];
            }
        }

        // Ghi vào final_data
        if (xSemaphoreTake(xDataMutex, pdMS_TO_TICKS(500)) == pdTRUE)
        {
            for (int i = 0; i < register_count; i++)
            {
                if (read_ok[i])
                {
                    final_data[i] = temp_result[i];
                    printf("[CID:%d] - [%02d:%02d:%02d] %s = %.4f %s\n",
                           i, now.hour, now.minute, now.second,
                           basic_dict[i].param_key, final_data[i], basic_dict[i].param_units);
                }
            }
            xSemaphoreGive(xDataMutex);
        }

        xSemaphoreGive(data_ready_sem);

        // Trigger scan đã xử lý trực tiếp trong vòng lặp poll ở trên

    exit_and_wait:
        if (is_change_baud || is_scan_device)
        {
            dual_port_polling = false;
            memset(consecutive_fail, 0, sizeof(consecutive_fail));
            vTaskDelay(pdMS_TO_TICKS(200));
            continue;
        }
        printf("\n");
        vTaskDelay(pdMS_TO_TICKS(poll_interval_ms));
    }
}