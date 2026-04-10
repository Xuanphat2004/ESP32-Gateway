#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "esp_log.h"
#include "nvs_flash.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"

// Modbus library
#include "esp_modbus_master.h"
#include "esp_modbus_common.h"
#include "rtc_mb.h"
#include "modbus_rtu.h"

static const char *TAG = "[MODBUS_MASTER_DYNAMIC]";

// --- 1. ĐỊNH NGHĨA CẤU TRÚC DỮ LIỆU ---

typedef struct
{
    uint16_t cid;
    char name[16];
    char unit[8];
    uint8_t slave_id;
    uint16_t reg_start;
    uint8_t func_code;
    uint8_t data_type;
    uint16_t quantity;
    float scale;
    uint8_t mul_type;
    uint16_t ref_cid[2];
} gateway_metadata_t;

// --- 2. QUẢN LÝ BỘ NHỚ ĐỘNG ---
mb_parameter_descriptor_t *g_mbslave_dict = NULL;
gateway_metadata_t *g_meta_table = NULL;

// CẢI TIẾN: Tách biệt 2 loại Buffer
uint8_t *g_raw_data_buffer = NULL; // Chứa dữ liệu thô (Dồn toa, tiết kiệm RAM)
float *g_processed_values = NULL;  // Chứa kết quả float cuối cùng (Để nhân Factor)

uint16_t g_reg_count = 0;
uint16_t g_total_raw_bytes = 0; // Tổng số byte thực tế của tất cả thanh ghi

extern SemaphoreHandle_t xDataMutex;

// --- 3. HÀM TRỢ GIÚP IN BẢNG TRONG RAM ---

void print_ram_tables(void)
{
    if (g_reg_count == 0 || g_mbslave_dict == NULL || g_meta_table == NULL)
    {
        ESP_LOGW(TAG, "RAM Tables dang trong, khong co gi de in.");
        return;
    }

    printf("\n============================================ MODBUS DYNAMIC ARCHITECTURE MAP ============================================\n");
    printf("%-3s | %-15s | %-5s | %-3s | %-5s | %-4s | %-4s | %-4s | %-4s | %-5s | %-4s | %-6s | %-3s | %-5s | %-5s\n",
           "CID", "Name", "Unit", "SID", "Addr", "Func", "Qty", "Offs", "Type", "BSize", "Accs", "Scale", "Mul", "Ref1", "Ref2");
    printf("-------------------------------------------------------------------------------------------------------------------------\n");

    for (int i = 0; i < g_reg_count; i++)
    {
        printf("%-3d | %-15s | %-5s | %-3d | %-5d | %-4d | %-4d | %-4d | %-4d | %-5d | %-4d | %-6.3f | %-3d | %-5d | %-5d\n",
               g_mbslave_dict[i].cid,
               g_mbslave_dict[i].param_key,
               g_mbslave_dict[i].param_units,
               g_mbslave_dict[i].mb_slave_addr,
               g_mbslave_dict[i].mb_reg_start,
               g_mbslave_dict[i].mb_param_type,
               g_mbslave_dict[i].mb_size,
               g_mbslave_dict[i].param_offset, // Sẽ thấy Offset nhảy 2 hoặc 4 tùy Qty
               g_mbslave_dict[i].param_type,
               g_mbslave_dict[i].param_size,
               g_mbslave_dict[i].access,
               g_meta_table[i].scale,
               g_meta_table[i].mul_type,
               g_meta_table[i].ref_cid[0],
               g_meta_table[i].ref_cid[1]);
    }
    printf("=========================================================================================================================\n");
    printf("Tong dung luong RAM thô (Raw Buffer): %d Bytes\n", g_total_raw_bytes);
    printf("=========================================================================================================================\n\n");
}

// --- HÀM NẠP CẤU HÌNH TỪ NVS ---

esp_err_t load_modbus_dynamic_config(void)
{
    nvs_handle_t my_handle;
    esp_err_t err;

    err = nvs_open("storage", NVS_READONLY, &my_handle);
    if (err != ESP_OK)
        return err;

    err = nvs_get_u16(my_handle, "reg_count", &g_reg_count);
    if (err != ESP_OK || g_reg_count == 0)
    {
        nvs_close(my_handle);
        return ESP_ERR_NOT_FOUND;
    }

    if (g_mbslave_dict)
        free(g_mbslave_dict);
    if (g_meta_table)
        free(g_meta_table);
    if (g_raw_data_buffer)
        free(g_raw_data_buffer);
    if (g_processed_values)
        free(g_processed_values);

    g_mbslave_dict = malloc(g_reg_count * sizeof(mb_parameter_descriptor_t)); // Vùng nhớ bảng
    g_meta_table = malloc(g_reg_count * sizeof(gateway_metadata_t));
    g_processed_values = calloc(g_reg_count, sizeof(float));

    size_t blob_size = g_reg_count * sizeof(gateway_metadata_t);
    err = nvs_get_blob(my_handle, "reg_table", g_meta_table, &blob_size);
    if (err != ESP_OK)
    {
        nvs_close(my_handle);
        return err;
    }

    // --- CẢI TIẾN: TÍNH TOÁN OFFSET ĐỘNG ---
    uint16_t current_offset = 0;

    for (int i = 0; i < g_reg_count; i++)
    {
        // Làm sạch chuỗi tên
        g_meta_table[i].name[15] = '\0';
        for (int n = 0; n < 15; n++)
        {
            if ((uint8_t)g_meta_table[i].name[n] == 0xFF)
            {
                g_meta_table[i].name[n] = '\0';
                break;
            }
        }

        // Mapping dữ liệu
        g_mbslave_dict[i].cid = i;
        g_mbslave_dict[i].param_key = g_meta_table[i].name;
        g_mbslave_dict[i].param_units = g_meta_table[i].unit;
        g_mbslave_dict[i].mb_slave_addr = g_meta_table[i].slave_id;
        g_mbslave_dict[i].mb_param_type = (g_meta_table[i].func_code == 0) ? MB_PARAM_HOLDING : MB_PARAM_INPUT;
        g_mbslave_dict[i].mb_reg_start = g_meta_table[i].reg_start;
        g_mbslave_dict[i].mb_size = g_meta_table[i].quantity;
        g_mbslave_dict[i].param_type = g_meta_table[i].data_type;
        g_mbslave_dict[i].param_size = g_meta_table[i].quantity * 2;
        g_mbslave_dict[i].access = PAR_PERMS_READ;

        // GÁN OFFSET ĐỘNG: Thanh ghi sau nằm ngay sau thanh ghi trước
        g_mbslave_dict[i].param_offset = current_offset;
        current_offset += g_mbslave_dict[i].param_size; // Tăng offset đúng theo kích thước thực tế
    }

    g_total_raw_bytes = current_offset;
    g_raw_data_buffer = calloc(1, g_total_raw_bytes); // Cấp phát vừa đủ RAM thô

    nvs_close(my_handle);
    ESP_LOGI(TAG, "Da nap thanh cong %d thanh ghi. Raw RAM tiet kiem: %d bytes.", g_reg_count, g_total_raw_bytes);

    print_ram_tables();

    return ESP_OK;
}

// --- 5. KHỞI TẠO VÀ VẬN HÀNH ---

void modbus_rtu_port_2_init(void)
{
    if (load_modbus_dynamic_config() != ESP_OK)
    {
        ESP_LOGE(TAG, "Loi nạp cau hinh NVS!");
        return;
    }

    void *master_handler = NULL;
    ESP_ERROR_CHECK(mbc_master_init(MB_PORT_SERIAL_MASTER, &master_handler));

    mb_communication_info_t comm_info = {
        .port = UART_2,
        .mode = MB_MODE_RTU,
        .baudrate = BAUD_RATE,
        .parity = MB_PARITY_NONE,
    };
    ESP_ERROR_CHECK(mbc_master_setup((void *)&comm_info));
    ESP_ERROR_CHECK(mbc_master_set_descriptor(g_mbslave_dict, g_reg_count));
    ESP_ERROR_CHECK(uart_set_pin(UART_2, UART_2_TX_PIN, UART_2_RX_PIN, UART_2_EN_PIN, UART_PIN_NO_CHANGE));
    ESP_ERROR_CHECK(mbc_master_start());
    ESP_ERROR_CHECK(uart_set_mode(UART_2, UART_MODE_RS485_HALF_DUPLEX));
}

void modbus_test_read(void)
{
    esp_err_t err;
    uint8_t type;
    rtc_time_t now;

    while (1)
    {
        if (g_reg_count == 0)
        {
            vTaskDelay(pdMS_TO_TICKS(5000)); // Nếu bảng danh sách trống
            continue;
        }

        if (xSemaphoreTake(xDataMutex, pdMS_TO_TICKS(500)) == pdTRUE)
        {
            rtc_read_time(&now);
            vTaskDelay(pdMS_TO_TICKS(3000));
            for (int i = 0; i < g_reg_count; i++)
            {
                // Đọc vào vùng nhớ THÔ (Raw Buffer) đã được dồn toa
                uint8_t *target_addr = g_raw_data_buffer + g_mbslave_dict[i].param_offset;

                err = mbc_master_get_parameter(g_mbslave_dict[i].cid, g_mbslave_dict[i].param_key, target_addr, &type);

                if (err == ESP_OK)
                {
                    // Lấy giá trị thô ra dựa trên kiểu dữ liệu
                    float raw_val = 0;
                    if (g_mbslave_dict[i].mb_size == 1)
                    {
                        raw_val = (float)(*(uint16_t *)target_addr);
                    }
                    else
                    {
                        raw_val = *(float *)target_addr;
                    }

                    // Bước 3: Nhân Scale và Factor (Dùng mảng g_processed_values để tham chiếu)
                    float final_result = raw_val * g_meta_table[i].scale;

                    for (int j = 0; j < 2; j++)
                    {
                        uint16_t r_cid = g_meta_table[i].ref_cid[j];
                        if (r_cid < g_reg_count)
                        {
                            final_result *= g_processed_values[r_cid];
                        }
                    }

                    // Lưu vào kho Kết quả (Luôn là float để các CID khác nhân Factor dễ dàng)
                    g_processed_values[i] = final_result;

                    printf("[%02d:%02d:%02d] %s = %.2f %s\n",
                           now.hour, now.minute, now.second,
                           g_mbslave_dict[i].param_key, final_result, g_mbslave_dict[i].param_units);
                }
                else
                {
                    ESP_LOGW(TAG, "Loi doc %s (Err: 0x%x)", g_mbslave_dict[i].param_key, err);
                }
            }
            xSemaphoreGive(xDataMutex);
        }
        vTaskDelay(pdMS_TO_TICKS(10000));
    }
}