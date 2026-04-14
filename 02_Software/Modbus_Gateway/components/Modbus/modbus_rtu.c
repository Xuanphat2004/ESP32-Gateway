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
#include "esp_modbus_slave.h" // Thêm thư viện Slave
#include "esp_modbus_common.h"
#include "rtc_mb.h"
#include "modbus_rtu.h"

static const char *TAG = "[GATEWAY - RTU]";

// Vì chưa biết dict cần dung lượng bao nhiêu nên ta chỉ tạo 1 con trỏ trước
mb_parameter_descriptor_t *basic_dict = NULL; // Tạo vùng nhớ để tạo Dictionary động - bảng A
factor_dict_t *factor_dict = NULL;            // Vùng nhớ để mapping factor và scale - bảng B
uint8_t *raw_data = NULL;                     // Chứa dữ liệu thô
float *final_data = NULL;                     // Chứa kết quả float cuối cùng (Để nhân Factor)
uint16_t register_count = 0;                  // Tổng số lượng CID đang có trong NVS
uint16_t g_total_raw_bytes = 0;               // Tổng số byte thực tế của tất cả thanh ghi

extern SemaphoreHandle_t xDataMutex; // Mutex dùng cho việc ghi vào vùng nhớ chung

void *slave_handler = NULL;
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
        printf("%-3d | %-15s | %-5s | %-3d | %-5d | %-4d | %-4d | %-4d | %-4d | %-5d | %-4d | %-6.3f | %-3d | %-5d | %-5d\n",
               basic_dict[i].cid,
               basic_dict[i].param_key,
               basic_dict[i].param_units,
               basic_dict[i].mb_slave_addr,
               basic_dict[i].mb_reg_start,
               basic_dict[i].mb_param_type,
               basic_dict[i].mb_size,
               basic_dict[i].param_offset, // Sẽ thấy Offset nhảy 2 hoặc 4 tùy Quantity người dùng nhập
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

// --- HÀM NẠP CẤU HÌNH TỪ NVS ---

esp_err_t load_modbus_dynamic_config(void)
{
    nvs_handle_t my_handle;
    esp_err_t err;

    err = nvs_open("storage", NVS_READONLY, &my_handle); // Mở namespace "storage" và cấp quyền cho handle - READ ONLY
    if (err != ESP_OK)
        return err;

    err = nvs_get_u16(my_handle, "reg_count", &register_count); // Đọc số lượng thanh ghi hiện có trong NVS
    if (err != ESP_OK || register_count == 0)
    {
        nvs_close(my_handle);
        return ESP_ERR_NOT_FOUND;
    }

    // Giải phóng toàn bộ vùng RAM cũ nếu cập nhật config mới từ app
    // Mặc dù đã có lệnh reset nhưng vẫn dùng free để đảm bảo vùng nhớ này sẽ được xóa :))))
    if (basic_dict)
        free(basic_dict);
    if (factor_dict)
        free(factor_dict);
    if (raw_data)
        free(raw_data);
    if (final_data)
        free(final_data);

    basic_dict = malloc(register_count * sizeof(mb_parameter_descriptor_t)); // Vùng nhớ bảng A - tạo ra số hàng tương ứng với số hàng của dictionary
    factor_dict = malloc(register_count * sizeof(factor_dict_t));            // Vùng nhớ bảng B - dữ liệu ban đầu đọc ra từ NVS
    final_data = calloc(register_count, sizeof(float));                      // Vùng nhớ chứa data người dùng có thể hiểu được
    size_t blob_size = register_count * sizeof(factor_dict_t);

    err = nvs_get_blob(my_handle, "reg_table", factor_dict, &blob_size); // Đọc toàn bộ bảng factor từ NVS vào RAM - bảng B
    if (err != ESP_OK)
    {
        nvs_close(my_handle);
        return err;
    }

    uint16_t current_offset = 0;

    for (int i = 0; i < register_count; i++)
    {
        // Làm sạch chuỗi tên
        factor_dict[i].name[15] = '\0';
        for (int n = 0; n < 15; n++)
        {
            if ((uint8_t)factor_dict[i].name[n] == 0xFF) // thay ký tự 0xFF thành ký tự \0
            {
                factor_dict[i].name[n] = '\0';
                break;
            }
        }

        // Mapping dữ liệu từ bảng B sang bảng A
        basic_dict[i].cid = i;
        basic_dict[i].param_key = factor_dict[i].name;
        basic_dict[i].param_units = factor_dict[i].unit;
        basic_dict[i].mb_slave_addr = factor_dict[i].slave_id;
        basic_dict[i].mb_param_type = (factor_dict[i].func_code == 0) ? MB_PARAM_HOLDING : MB_PARAM_INPUT;
        basic_dict[i].mb_reg_start = factor_dict[i].reg_start;
        basic_dict[i].mb_size = factor_dict[i].quantity; // Số lượng thanh ghi cần đọc (1 hoặc 2)
        basic_dict[i].param_type = factor_dict[i].data_type;
        basic_dict[i].param_size = factor_dict[i].quantity * 2; // Tùy vào quantity mà ta cấp 2 (1 thanh ghi) hoặc 4 bytes (2 thanh ghi)
        basic_dict[i].access = PAR_PERMS_READ;                  // Version hiện tại chỉ hỗ trợ đọc
        basic_dict[i].param_offset = current_offset;

        current_offset += basic_dict[i].param_size; // Tăng offset đúng theo kích thước thực tế
    }

    g_total_raw_bytes = current_offset;
    raw_data = calloc(1, g_total_raw_bytes); // Cấp phát vừa đủ RAM thô

    nvs_close(my_handle);
    // ESP_LOGI(TAG, "Da nap thanh cong %d thanh ghi. Raw RAM tiet kiem: %d bytes.",register_count, g_total_raw_bytes);

    print_ram_tables();

    return ESP_OK;
}

// Cấu hình UART cho Modbus RTU - Port 2
void modbus_rtu_port_1_init(void)
{
    if (load_modbus_dynamic_config() != ESP_OK)
    {
        ESP_LOGE(TAG, "Fail to read data from NVS memorry !!!");
        return;
    }

    void *master_handler = NULL;
    ESP_ERROR_CHECK(mbc_master_init(MB_PORT_SERIAL_MASTER, &master_handler));

    mb_communication_info_t comm_info = {
        .port = UART_1,
        .mode = MB_MODE_RTU,
        .baudrate = BAUD_RATE,
        .parity = MB_PARITY_NONE,
    };
    ESP_ERROR_CHECK(mbc_master_setup((void *)&comm_info));
    ESP_ERROR_CHECK(mbc_master_set_descriptor(basic_dict, register_count));
    ESP_ERROR_CHECK(uart_set_pin(UART_1, UART_1_TX_PIN, UART_1_RX_PIN, UART_1_EN_PIN, UART_PIN_NO_CHANGE));
    ESP_ERROR_CHECK(mbc_master_start());
    ESP_ERROR_CHECK(uart_set_mode(UART_1, UART_MODE_RS485_HALF_DUPLEX));
    modbus_rtu_port_2_slave_init();
}

void modbus_test_read(void)
{
    esp_err_t err;
    uint8_t type;
    rtc_time_t now; // Lấy thời gian từ RTC
    int count = 0;

    while (1)
    {
        count++;
        if (register_count == 0)
        {
            vTaskDelay(pdMS_TO_TICKS(5000)); // Nếu bảng danh sách trống
            continue;
        }
        if (xSemaphoreTake(xDataMutex, pdMS_TO_TICKS(500)) == pdTRUE)
        {
            // uart_flush_input(UART_2);       // Xóa rác buffer trước mỗi ID
            vTaskDelay(pdMS_TO_TICKS(150)); // Guard time (Khoảng nghỉ t3.5)
            rtc_read_time(&now);            // Lấy thời gian từ RTC
            for (int i = 0; i < register_count; i++)
            {
                // Đọc vào vùng nhớ thô dựa trên offset đã tính toán
                uint8_t *target_address = raw_data + basic_dict[i].param_offset;
                err = mbc_master_get_parameter(basic_dict[i].cid, basic_dict[i].param_key, target_address, &type);
                if (err == ESP_OK)
                {
                    // Lấy giá trị thô ra dựa trên kiểu dữ liệu
                    float raw_value = 0;
                    if (basic_dict[i].mb_size == 1)
                        raw_value = (float)(*(uint16_t *)target_address);
                    else
                        raw_value = *(float *)target_address;

                    // Nhân Scale và Factor - Dùng mảng final_data để tham chiếu
                    float final_result = raw_value * factor_dict[i].scale;
                    for (int j = 0; j < 2; j++)
                    {
                        uint16_t r_cid = factor_dict[i].ref_cid[j];
                        if (r_cid < register_count)
                            final_result *= final_data[r_cid];
                    }

                    final_data[i] = final_result;
                    printf("[CID: %d] - [%02d:%02d:%02d] %s = %.2f %s\n",
                           i, now.hour, now.minute, now.second,
                           basic_dict[i].param_key, final_result, basic_dict[i].param_units);
                }
                else
                    ESP_LOGW(TAG, "Fail to read data at [CID: %d] %s (Err: 0x%x)", i, basic_dict[i].param_key, err);
            }
            xSemaphoreGive(xDataMutex);
            printf("Data: %d =====================================================\n", count);
            printf("\n");
        }
        vTaskDelay(pdMS_TO_TICKS(10000)); // Cứ 5s polling data 1 lần
    }
}
void modbus_rtu_port_1_slave_init(void)
{
    void *slave_handler = NULL;
    // 2. INIT SLAVE: Khởi tạo thực thể Slave
    esp_err_t err = mbc_slave_init(MB_PORT_SERIAL_SLAVE, &slave_handler);

    // 3. SETUP: Cấu hình thông số truyền thông
    mb_communication_info_t comm_info = {
        .port = UART_NUM_1,
        .mode = MB_MODE_RTU,
        .baudrate = 9600,
        .parity = MB_PARITY_NONE,
        .slave_addr = 1};
    err = mbc_slave_setup((void *)&comm_info);

    // 4. DESCRIPTOR: Slave BẮT BUỘC phải có vùng nhớ để hoạt động (Dù là rỗng)
    // Nếu thiếu bước này, mbc_slave_start sẽ trả về 0x103 ngay lập tức
    mb_register_area_descriptor_t reg_area = {
        .type = MB_PARAM_HOLDING,
        .start_offset = 0,
        .address = (void *)raw_data, // Tận dụng vùng nhớ raw_data bạn đã malloc
        .size = 100                  // Khai báo kích thước vùng nhớ
    };
    mbc_slave_set_descriptor(reg_area);

    // 5. PIN CONFIG: Gán chân theo Define của Phát
    uart_set_pin(UART_NUM_1, UART_1_TX_PIN, UART_1_RX_PIN, UART_1_EN_PIN, UART_PIN_NO_CHANGE);

    // 6. START: Bắt đầu chạy Slave
    err = mbc_slave_start();

    if (err == ESP_OK)
    {
        uart_set_mode(UART_NUM_1, UART_MODE_RS485_HALF_DUPLEX);
        ESP_LOGI("SLAVE", "Port 1 started as Slave successfully.");
    }
    else
    {
        ESP_LOGE("SLAVE", "Failed to start Slave, error: 0x%x", err);
    }
}

void modbus_rtu_port_2_slave_init(void)
{
    void *slave_handler = NULL;
    // 2. INIT SLAVE: Khởi tạo thực thể Slave
    esp_err_t err = mbc_slave_init(MB_PORT_SERIAL_SLAVE, &slave_handler);

    // 3. SETUP: Cấu hình thông số truyền thông
    mb_communication_info_t comm_info = {
        .port = UART_NUM_2,
        .mode = MB_MODE_RTU,
        .baudrate = 9600,
        .parity = MB_PARITY_NONE,
        .slave_addr = 1};
    err = mbc_slave_setup((void *)&comm_info);

    // 4. DESCRIPTOR: Slave BẮT BUỘC phải có vùng nhớ để hoạt động (Dù là rỗng)
    // Nếu thiếu bước này, mbc_slave_start sẽ trả về 0x103 ngay lập tức
    mb_register_area_descriptor_t reg_area = {
        .type = MB_PARAM_HOLDING,
        .start_offset = 0,
        .address = (void *)raw_data, // Tận dụng vùng nhớ raw_data bạn đã malloc
        .size = 100                  // Khai báo kích thước vùng nhớ
    };
    mbc_slave_set_descriptor(reg_area);

    // 5. PIN CONFIG: Gán chân theo Define của Phát
    uart_set_pin(UART_NUM_2, UART_2_TX_PIN, UART_2_RX_PIN, UART_2_EN_PIN, UART_PIN_NO_CHANGE);

    // 6. START: Bắt đầu chạy Slave
    err = mbc_slave_start();

    if (err == ESP_OK)
    {
        // 7. RS485 MODE: Chế độ Half-Duplex để tự điều khiển chân EN (DE/RE)
        uart_set_mode(UART_NUM_2, UART_MODE_RS485_HALF_DUPLEX);
        ESP_LOGI("SLAVE", "Port 2 started as Slave successfully.");
    }
    else
    {
        ESP_LOGE("SLAVE", "Failed to start Slave, error: 0x%x", err);
    }
}