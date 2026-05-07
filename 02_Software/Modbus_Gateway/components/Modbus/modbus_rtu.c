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

// Modbus library
#include "esp_modbus_master.h"
#include "esp_modbus_common.h" // Bỏ esp_modbus_slave.h vì không dùng slave nữa
#include "rtc_mb.h"
#include "modbus_rtu.h"
#include "change_baudrate.h"
#include "scan_device.h"

static const char *TAG = "[RTU]";

// Vì chưa biết dict cần dung lượng bao nhiêu nên ta chỉ tạo 1 con trỏ trước
mb_parameter_descriptor_t *basic_dict = NULL; // Tạo vùng nhớ để tạo Dictionary động - bảng A
factor_dict_t *factor_dict = NULL;            // Vùng nhớ để mapping factor và scale - bảng B
uint8_t *raw_data = NULL;                     // Chứa dữ liệu thô
float *final_data = NULL;                     // Chứa kết quả float cuối cùng (Đã nhân Factor)
uint16_t register_count = 0;                  // Tổng số lượng CID đang có trong NVS
uint16_t g_total_raw_bytes = 0;               // Tổng số byte thực tế của tất cả thanh ghi

extern SemaphoreHandle_t xDataMutex; // Mutex dùng cho việc ghi vào vùng nhớ chung
extern bool is_change_baud;
extern volatile bool is_scan_device;
extern scan_analysis_t scan_result;

//==========================================================================================================
//====== Hàm hỗ trợ - In bảng A trong RAM ra terminal =======

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
               basic_dict[i].cid,
               basic_dict[i].param_key,
               basic_dict[i].param_units,
               basic_dict[i].mb_slave_addr,
               basic_dict[i].mb_reg_start,
               basic_dict[i].mb_param_type,
               basic_dict[i].mb_size,
               basic_dict[i].param_offset,
               basic_dict[i].param_type,
               basic_dict[i].param_size,
               basic_dict[i].access,
               factor_dict[i].scale,
               factor_dict[i].mul_type,
               factor_dict[i].ref_cid[0],
               factor_dict[i].ref_cid[1]);
    }
    printf("=========================================================================================================================\n");
    printf("Total Memorry: %d Bytes\n", g_total_raw_bytes);
    printf("=========================================================================================================================\n\n");
}

// --- KHỞI TẠO PARTITION NVS RIÊNG CHO THANH GHI ---
static esp_err_t init_storage_partition(void)
{
    const esp_partition_t *partition = esp_partition_find_first(ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_DATA_NVS, "storage");

    if (partition == NULL)
    {
        ESP_LOGE(TAG, "Not found partition 'storage' !!!");
        return ESP_ERR_NOT_FOUND;
    }

    esp_err_t err = nvs_flash_init_partition("storage");
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_LOGW(TAG, "Storage partition error, erasing ...");
        ESP_ERROR_CHECK(nvs_flash_erase_partition("storage"));
        err = nvs_flash_init_partition("storage");
    }

    if (err == ESP_OK)
    {
        ESP_LOGI(TAG, "Storage partition mounted OK (offset=0x%lx, size=0x%lx)", partition->address, partition->size);
    }
    return err;
}

// --- HÀM NẠP CẤU HÌNH TỪ NVS ---
esp_err_t load_modbus_dynamic_config(void)
{
    nvs_handle_t my_handle;
    esp_err_t err;

    err = nvs_open_from_partition("storage", "storage_app", NVS_READONLY, &my_handle);
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

    uint16_t current_offset = 0;

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
        basic_dict[i].param_offset = current_offset;

        current_offset += basic_dict[i].param_size;
    }

    g_total_raw_bytes = current_offset;
    raw_data = calloc(1, g_total_raw_bytes);

    nvs_close(my_handle);
    // print_ram_tables();

    return ESP_OK;
}

//======================================================================
// DUMMY INIT: Chỉ init UART + RS485 half-duplex để MAX485 giữ DE=LOW
// KHÔNG dùng mbc_slave_init → không đụng singleton → TCP slave an toàn
//======================================================================
void modbus_rtu_port_1_dummy_init(void)
{
    uint32_t current_baud = load_baud_from_nvs();

    uart_config_t uart_config = {
        .baud_rate = current_baud,
        .data_bits = UART_DATA_8_BITS,
        .parity = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };
    uart_param_config(UART_NUM_1, &uart_config);
    uart_set_pin(UART_NUM_1, UART_1_TX_PIN, UART_1_RX_PIN, UART_1_EN_PIN, UART_PIN_NO_CHANGE);
    uart_driver_install(UART_NUM_1, 256, 0, 0, NULL, 0);

    // RS485 half-duplex → ESP32 tự kéo DE=LOW khi không phát
    // → MAX485 port 1 ở chế độ nhận, không tranh bus với master ở port 2
    uart_set_mode(UART_NUM_1, UART_MODE_RS485_HALF_DUPLEX);

    ESP_LOGI(TAG, "Port 1 dummy: MAX485 DE=LOW, bus stable (no Modbus slave stack).");
}

void modbus_rtu_port_2_dummy_init(void)
{
    uint32_t current_baud = load_baud_from_nvs();

    uart_config_t uart_config = {
        .baud_rate = current_baud,
        .data_bits = UART_DATA_8_BITS,
        .parity = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };
    uart_param_config(UART_NUM_2, &uart_config);
    uart_set_pin(UART_NUM_2, UART_2_TX_PIN, UART_2_RX_PIN, UART_2_EN_PIN, UART_PIN_NO_CHANGE);
    uart_driver_install(UART_NUM_2, 256, 0, 0, NULL, 0);

    // RS485 half-duplex → ESP32 tự kéo DE=LOW khi không phát
    // MAX485 port 2 ở chế độ nhận, không tranh bus với master ở port 1
    uart_set_mode(UART_NUM_2, UART_MODE_RS485_HALF_DUPLEX);

    ESP_LOGI(TAG, "Port 2 dummy: MAX485 DE=LOW, bus stable (no Modbus slave stack).");
}

//======================================================================
// Port 1 làm Master + Port 2 làm dummy
void modbus_rtu_port_1_init(void)
{
    scan_result.active_port = 1;
    uint32_t current_baud = load_baud_from_nvs();

    if (init_storage_partition() != ESP_OK)
    {
        ESP_LOGE(TAG, "Không thể mount partition storage !");
        return;
    }
    if (load_modbus_dynamic_config() != ESP_OK)
    {
        ESP_LOGE(TAG, "Fail to read data from NVS memory !!!");
        return;
    }

    void *master_handler = NULL;
    ESP_ERROR_CHECK(mbc_master_init(MB_PORT_SERIAL_MASTER, &master_handler));

    mb_communication_info_t comm_info = {
        .port = UART_1,
        .mode = MB_MODE_RTU,
        .baudrate = current_baud,
        .parity = MB_PARITY_NONE,
    };
    ESP_ERROR_CHECK(mbc_master_setup((void *)&comm_info));
    ESP_ERROR_CHECK(mbc_master_set_descriptor(basic_dict, register_count));
    ESP_ERROR_CHECK(uart_set_pin(UART_1, UART_1_TX_PIN, UART_1_RX_PIN, UART_1_EN_PIN, UART_PIN_NO_CHANGE));
    ESP_ERROR_CHECK(mbc_master_start());
    ESP_ERROR_CHECK(uart_set_mode(UART_1, UART_MODE_RS485_HALF_DUPLEX));

    modbus_rtu_port_2_dummy_init();
}

//======================================================================
// Port 1 làm Master + Port 2 làm dummy
void modbus_rtu_port_2_init(void)
{
    scan_result.active_port = 2;
    uint32_t current_baud = load_baud_from_nvs();

    if (init_storage_partition() != ESP_OK)
    {
        ESP_LOGE(TAG, "Không thể mount partition storage !");
        return;
    }
    if (load_modbus_dynamic_config() != ESP_OK)
    {
        ESP_LOGE(TAG, "Fail to read data from NVS memory !!!");
        return;
    }

    void *master_handler = NULL;
    ESP_ERROR_CHECK(mbc_master_init(MB_PORT_SERIAL_MASTER, &master_handler));

    mb_communication_info_t comm_info = {
        .port = UART_2,
        .mode = MB_MODE_RTU,
        .baudrate = current_baud,
        .parity = MB_PARITY_NONE,
    };
    ESP_ERROR_CHECK(mbc_master_setup((void *)&comm_info));
    ESP_ERROR_CHECK(mbc_master_set_descriptor(basic_dict, register_count));
    ESP_ERROR_CHECK(uart_set_pin(UART_2, UART_2_TX_PIN, UART_2_RX_PIN, UART_2_EN_PIN, UART_PIN_NO_CHANGE));
    ESP_ERROR_CHECK(mbc_master_start());
    ESP_ERROR_CHECK(uart_set_mode(UART_2, UART_MODE_RS485_HALF_DUPLEX));

    modbus_rtu_port_1_dummy_init();
}

static float decode_raw_to_float(uint8_t *buf, mb_descr_type_t type)
{
    switch (type)
    {
    // 8-bit
    case PARAM_TYPE_U8:
    case PARAM_TYPE_U8_A:
    case PARAM_TYPE_U8_B:
        return (float)(*(uint8_t *)buf); // Chép đúng 8bit dữ liệu và ép kiểu thành float

    case PARAM_TYPE_I8_A:
    case PARAM_TYPE_I8_B:
        return (float)(*(int8_t *)buf);

    // ── 16-bit unsigned ─
    case PARAM_TYPE_U16:
    case PARAM_TYPE_U16_AB:
    case PARAM_TYPE_U16_BA:
    {
        uint16_t v;
        memcpy(&v, buf, sizeof(v));
        return (float)v;
    }

    // ── 16-bit signed ──────────────────────────────────────
    case PARAM_TYPE_I16_AB:
    case PARAM_TYPE_I16_BA:
    {
        int16_t v;
        memcpy(&v, buf, sizeof(v));
        return (float)v;
    }

    // ── 32-bit unsigned ────────────────────────────────────
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

    // ── 32-bit signed ──────────────────────────────────────
    case PARAM_TYPE_I32_ABCD:
    case PARAM_TYPE_I32_CDAB:
    case PARAM_TYPE_I32_BADC:
    case PARAM_TYPE_I32_DCBA:
    {
        int32_t v;
        memcpy(&v, buf, sizeof(v));
        return (float)v;
    }

    // ── 32-bit float ───────────────────────────────────────
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

    // ── 64-bit unsigned ────────────────────────────────────
    case PARAM_TYPE_U64_ABCDEFGH:
    case PARAM_TYPE_U64_HGFEDCBA:
    case PARAM_TYPE_U64_GHEFCDAB:
    case PARAM_TYPE_U64_BADCFEHG:
    {
        uint64_t v;
        memcpy(&v, buf, sizeof(v));
        return (float)v;
    }

    // ── 64-bit signed ──────────────────────────────────────
    case PARAM_TYPE_I64_ABCDEFGH:
    case PARAM_TYPE_I64_HGFEDCBA:
    case PARAM_TYPE_I64_GHEFCDAB:
    case PARAM_TYPE_I64_BADCFEHG:
    {
        int64_t v;
        memcpy(&v, buf, sizeof(v));
        return (float)v;
    }

    // ── 64-bit double ──────────────────────────────────────
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
// RTU Task
void modbus_test_read(void)
{
    esp_err_t err;
    uint8_t type;
    rtc_time_t now;
    int count = 0;

    while (1)
    {
        count++;
        if (register_count == 0)
        {
            vTaskDelay(pdMS_TO_TICKS(5000));
            continue;
        }
        if (is_change_baud == true || is_scan_device == true)
        {
            vTaskDelay(pdMS_TO_TICKS(200));
            continue;
        }
        vTaskDelay(pdMS_TO_TICKS(150)); // Guard time t3.5
        rtc_read_time(&now);

        // Dùng buffer tạm để tính toán trước, chưa ghi vào final_data
        float temp_result[register_count];
        bool read_ok[register_count];

        for (int i = 0; i < register_count; i++)
        {
            if (is_change_baud == true || is_scan_device == true)
                goto exit_and_wait;

            uint8_t *target_address = raw_data + basic_dict[i].param_offset; // ghi bytes nhận được từ modbus target_address
            err = mbc_master_get_parameter(basic_dict[i].cid, basic_dict[i].param_key, target_address, &type);

            if (err == ESP_OK)
            {
                uint8_t *target_address = raw_data + basic_dict[i].param_offset;

                float raw_value = decode_raw_to_float(target_address, (mb_descr_type_t)basic_dict[i].param_type);

                // printf("CID %d raw data: %f\n", basic_dict[i].cid, raw_value);
                temp_result[i] = raw_value * factor_dict[i].scale;
                read_ok[i] = true;
            }
            else
            {
                temp_result[i] = 0;
                read_ok[i] = false;
                ESP_LOGW(TAG, "Fail [CID: %d] %s (Err: 0x%x)", i, basic_dict[i].param_key, err);
            }
        }

        // Xử lý Factor (cần final_data của các CID trước) — vẫn ngoài mutex
        // vì chỉ đọc final_data, chưa ghi
        for (int i = 0; i < register_count; i++)
        {
            if (!read_ok[i])
                continue;
            for (int j = 0; j < 2; j++)
            {
                uint16_t r_cid = factor_dict[i].ref_cid[j];
                if (r_cid < register_count)
                    temp_result[i] *= final_data[r_cid];
            }
        }

        // Lấy mutex chỉ để ghi — rất nhanh, không block lâu
        if (xSemaphoreTake(xDataMutex, pdMS_TO_TICKS(500)) == pdTRUE)
        {
            for (int i = 0; i < register_count; i++)
            {
                if (read_ok[i] == true)
                {
                    final_data[i] = temp_result[i];
                    printf("[CID: %d] - [%02d:%02d:%02d] %s = %.4f %s\n",
                           i, now.hour, now.minute, now.second,
                           basic_dict[i].param_key, final_data[i], basic_dict[i].param_units);
                }
            }
            xSemaphoreGive(xDataMutex);
        }

    exit_and_wait:
        if (is_change_baud == true || is_scan_device == true)
        {
            vTaskDelay(pdMS_TO_TICKS(200));
            continue;
        }
        // printf("Data: %d =====================================================\n", count);
        printf("\n");
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}