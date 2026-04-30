#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "driver/uart.h"
#include "esp_modbus_master.h"
#include "esp_modbus_slave.h"
#include "esp_modbus_common.h"
#include "mbc_master.h"

#include "modbus_rtu.h"
#include "modbus_tcp.h"
#include "lcd_user.h"
#include "scan_device.h"

static const char *TAG = "[SCAN DEVICE]";

id_scan_result_t list_p1; // Kết quả scan Port 1
id_scan_result_t list_p2; // Kết quả scan Port 2
id_scan_result_t active_list;
id_scan_result_t inactive_list;

uint8_t original_id[248]; // Danh sách toàn bộ id hiện có trong flash
uint8_t original_id_count = 0;
scan_analysis_t scan_result = {0}; // Kết quả phân tích — page detail sẽ đọc cái này

volatile bool is_scan_device = false;
extern bool is_scanning;
extern bool is_tcp_running;
extern ui_page_t current_page;
extern uint16_t register_count;
extern factor_dict_t *factor_dict;
extern mb_parameter_descriptor_t *basic_dict;
extern SemaphoreHandle_t xDataMutex;
extern TaskHandle_t tcp_handle_task;

//===========================================================================================================
// Kiểm tra id đã tồn tại trong list hay chưa
// uint8_t id = original_id[i];
// bool in_p1 = is_id_in_result(id, &list_p1)
static bool is_id_in_result(uint8_t id, id_scan_result_t *list)
{
    for (int i = 0; i < list->count; i++)
    {
        if (list->id[i] == id)
            return true;
    }
    return false;
}

//===========================================================================================================
// Lấy toàn bộ danh sách các node có phản hồi trong list_p1[] và list_p2[]
void get_active_list(void)
{
    active_list.count = 0;
    bool is_exist = false; // Biến đã tồn tại trong active_list[] chưa

    for (int i = 0; i < list_p1.count; i++) // Thêm toàn bộ id đang có trong list_p1[] vào active_list[]
    {
        active_list.id[i] = list_p1.id[i];
        active_list.count++;
    }

    if (list_p2.count != 0) // Nếu list_p2 không trống
    {
        for (int i = 0; i < list_p2.count; i++) // Kiểm tra từng id trong list_p2[]
        {
            is_exist = false;

            // Đối chiếu với active_list[]
            for (int j = 0; j < active_list.count; j++)
            {
                if (list_p2.id[i] == active_list.id[j])
                {
                    is_exist = true; // Đã tồn tại trong active_list
                    break;           // Chuyển qua id tiếp theo trong list_p2
                }
            }
            if (is_exist == false) // Nếu chưa có thì thêm vào active_list
            {
                active_list.id[active_list.count] = list_p2.id[i];
                active_list.count++;
            }
        }
    }
    // debug code ====================================================
    // for (int i = 0; i < active_list.count; i++)
    //     printf("active id at index %d: %d\n", i, active_list.id[i]);
    //================================================================
}

//==================================================================================================
// Lọc ra các id không phản hồi
void get_inactive_list(void)
{
    inactive_list.count = 0;
    uint8_t current_id = 0;
    bool found_in_p1 = false;
    bool found_in_p2 = false;

    for (int i = 0; i < original_id_count; i++) // Kiểm tra từng id trong original_list[]
    {
        current_id = original_id[i];

        // Kiểm tra với list_p1[] trước
        for (int j = 0; j < list_p1.count; j++)
        {
            if (current_id == list_p1.id[j]) // Nếu id đã tồn tại trong list_p1
            {
                found_in_p1 = true;
                break; // nếu tồn tại thì nhảy qua id tiếp theo
            }
        }

        if (found_in_p1 == true)
        {
            continue; // Nếu mà đã tìm thấy trong list_p1 rồi thì nhảy tới kiểm tra id tiếp theo
        }

        // Kiểm tra với list_p2[]
        for (int k = 0; k < list_p2.count; k++)
        {
            if (current_id == list_p2.id[k])
            {
                found_in_p2 = true;
                break;
            }
        }

        if (found_in_p2 == true)
        {
            continue; // Nếu mà đã tìm thấy trong list_p2 rồi thì nhảy tới kiểm tra id tiếp theo
        }

        inactive_list.id[inactive_list.count] = current_id;
        inactive_list.count++;
    }
}

//==================================================================================================================================
// Tạo Dictionary tạm để quét thiết bị — lấy tối đa 3 thanh ghi mỗi thiết bị
// Trả về số lượng CID trong scan_dict
static uint16_t generate_temp_scan_dict(mb_parameter_descriptor_t *scan_dict, uint8_t *out_original_id, uint8_t *id_count)
{
    uint16_t scan_reg_count = 0;
    uint8_t id_tracker[248] = {0}; // Đếm số thanh ghi đã lấy của từng ID
    *id_count = 0;

    for (int i = 0; i < register_count; i++)
    {
        uint8_t sid = factor_dict[i].slave_id;

        if (id_tracker[sid] == 0)
        {
            out_original_id[*id_count] = sid;
            (*id_count)++;
        }

        if (id_tracker[sid] < 3)
        {
            scan_dict[scan_reg_count] = (mb_parameter_descriptor_t){
                .cid = scan_reg_count,
                .param_key = factor_dict[i].name,
                .mb_slave_addr = sid,
                .mb_reg_start = factor_dict[i].reg_start,
                .mb_size = factor_dict[i].quantity,
                .mb_param_type = (factor_dict[i].func_code == 0) ? MB_PARAM_HOLDING : MB_PARAM_INPUT,
                .param_type = factor_dict[i].data_type,
                .param_size = factor_dict[i].quantity * 2,
                .access = PAR_PERMS_READ};
            scan_reg_count++;
            id_tracker[sid]++;
        }
    }
    return scan_reg_count;
}

//==================================================================================================================================
// Khởi tạo Modbus Master trên uart_port chỉ định
// Port còn lại được init dummy (DE=LOW) - làm 1 slave giả trên bus
static void execute_port_scan(uint8_t uart_port, mb_parameter_descriptor_t *dict, uint16_t dict_size, id_scan_result_t *results)
{
    results->count = 0;
    uint8_t online_flags[248] = {0};
    uint32_t current_baud = load_baud_from_nvs();

    void *master_handler = NULL;
    mbc_master_init(MB_PORT_SERIAL_MASTER, &master_handler);

    mb_communication_info_t comm_info = {
        .port = uart_port,
        .mode = MB_MODE_RTU,
        .baudrate = current_baud,
        .parity = MB_PARITY_NONE};
    mbc_master_setup((void *)&comm_info);
    mbc_master_set_descriptor(dict, dict_size);

    if (uart_port == UART_NUM_1)
    {
        uart_set_pin(UART_NUM_1, UART_1_TX_PIN, UART_1_RX_PIN, UART_1_EN_PIN, UART_PIN_NO_CHANGE);
        ESP_LOGI(TAG, "Port 1 = Master, Port 2 = dummy (DE=LOW)");
        modbus_rtu_port_2_dummy_init();
    }
    else if (uart_port == UART_NUM_2)
    {
        vTaskDelay(pdMS_TO_TICKS(100));
        uart_set_pin(UART_NUM_2, UART_2_TX_PIN, UART_2_RX_PIN, UART_2_EN_PIN, UART_PIN_NO_CHANGE);
        ESP_LOGI(TAG, "Port 2 = Master, Port 1 = dummy (DE=LOW)");
        modbus_rtu_port_1_dummy_init();
    }

    mbc_master_start();
    uart_set_mode(uart_port, UART_MODE_RS485_HALF_DUPLEX);

    for (int i = 0; i < dict_size; i++)
    {
        uint8_t slave_id = dict[i].mb_slave_addr;

        // ID nào đã phản hồi rồi thì bỏ qua
        if (online_flags[slave_id] == 1)
            continue;

        uint8_t temp_buf[4];
        uint8_t type;
        if (mbc_master_get_parameter(dict[i].cid, dict[i].param_key, temp_buf, &type) == ESP_OK)
        {
            if (results->count < 248)
            {
                results->id[results->count++] = slave_id;
                online_flags[slave_id] = 1;
                ESP_LOGI(TAG, "Port %d -> Slave %d: [ONLINE]", uart_port, slave_id);
            }
        }
        vTaskDelay(pdMS_TO_TICKS(50));
    }
    vTaskDelay(pdMS_TO_TICKS(200));
}

// =================================================================================================================================
// Kết quả lưu vào g_scan_result để ui đọc khi xuất lên LCD
void analyse_scan_result(void)
{
    memset(&scan_result, 0, sizeof(scan_analysis_t)); // Reset kết quả cũ

    // Tìm id không có cả ở 2 port
    for (int i = 0; i < original_id_count; i++)
    {
        uint8_t id = original_id[i];
        bool in_p1 = is_id_in_result(id, &list_p1);
        bool in_p2 = is_id_in_result(id, &list_p2);

        if (in_p1 == false && in_p2 == false)
        {
            scan_result.lose_list[scan_result.lose_count++] = id; // Danh sách cái id không phản hồi
            printf("lose id: %d\n", id);
        }
    }
    // debug code ======================================================
    // printf("list_p1.count: %d\n", list_p1.count);
    // printf("list_p2.count: %d\n", list_p2.count);
    // for (int i = 0; i < original_id_count; i++)
    //     printf("id in original at index %d: %d\n", i, original_id[i]);
    // for (int i = 0; i < list_p1.count; i++)
    //     printf("id in list_p1 at index %d: %d\n", i, list_p1.id[i]);
    // for (int i = 0; i < list_p2.count; i++)
    //     printf("id in list_p2 at index %d: %d\n", i, list_p2.id[i]);
    //==================================================================

    // Port nào nhiều id hơn thì làm Master
    if (list_p2.count > list_p1.count)
        scan_result.active_port = 2;
    else
        scan_result.active_port = 1; // Mặc định

    // Tìm biên điểm đứt trên dây trên port 1
    scan_result.final_id_p1 = -1;
    for (int i = 0; i < original_id_count; i++)
    {
        if (is_id_in_result(original_id[i], &list_p1) == true) // Nếu id của port 1 trùng với original_id[]
        {
            scan_result.final_id_p1 = i; // index của id cuối cùng mà port đó có thể quét được trong original_id[]
        }
    }

    // Tìm biên điểm đứt trên dây trên port 2
    scan_result.final_id_p2 = original_id_count;       // Đi ngược lại với port 1
    for (int i = (original_id_count - 1); i >= 0; i--) // (original_id_count - 1) index vị trí của id đó trong original_id
    {
        if (is_id_in_result(original_id[i], &list_p2) == true)
        {
            scan_result.final_id_p2 = i;
        }
    }

    ESP_LOGI(TAG, "Analysis done: lose = %d, active_port = %d, final_id_p1 = %d, final_id_p2 = %d\n",
             scan_result.lose_count, scan_result.active_port, scan_result.final_id_p1, scan_result.final_id_p2);
}

//====================================================================================================================
// Destroy -> Delete -> Nạp cấu hình mới
static void scan_task(void *pvParameters)
{
    is_scan_device = true;
    memset(&list_p1, 0, sizeof(id_scan_result_t)); // Reset list lưu các id của mỗi port đọc được
    memset(&list_p2, 0, sizeof(id_scan_result_t));

    ESP_LOGI(TAG, "Start scanning ...");

    // Tạm xóa TCP task để tránh đọc bộ nhớ của RTU task khi RTU task đã bị xóa
    if (is_tcp_running == true)
    {
        mbc_slave_destroy();
        is_tcp_running = false;
        ESP_LOGW(TAG, "TCP slave stack destroyed cleanly.");
    }
    vTaskDelay(pdMS_TO_TICKS(500));
    if (tcp_handle_task != NULL)
    {
        vTaskDelete(tcp_handle_task);
        tcp_handle_task = NULL;
        ESP_LOGW(TAG, "Deleted TCP task for scanning.");
    }

    // Chuẩn bị dictionary tạm để scan, nạp 1 lần dùng cho 2 lần
    mb_parameter_descriptor_t *temp_dict = malloc(register_count * sizeof(mb_parameter_descriptor_t));
    uint16_t temp_dict_size = generate_temp_scan_dict(temp_dict, original_id, &original_id_count);

    // --- Scan Port 1 ---
    mbc_master_destroy();
    uart_driver_delete(UART_NUM_1);
    uart_driver_delete(UART_NUM_2);
    ESP_LOGI(TAG, "Port 1 is scanning ...");
    execute_port_scan(UART_NUM_1, temp_dict, temp_dict_size, &list_p1);

    // --- Scan Port 2 ---
    mbc_master_destroy();
    uart_driver_delete(UART_NUM_1);
    uart_driver_delete(UART_NUM_2);
    ESP_LOGI(TAG, "Port 2 is scanning ...");
    execute_port_scan(UART_NUM_2, temp_dict, temp_dict_size, &list_p2);

    ESP_LOGI(TAG, "Result: Port 1 found %d device, Port 2 found %d device", list_p1.count, list_p2.count);

    // --- Log tình trạng từng ID ---
    bool network_error = false;
    for (int i = 0; i < original_id_count; i++) // Quét qua từng id trong list gốc
    {
        uint8_t slave_id = original_id[i];
        bool in_p1 = is_id_in_result(slave_id, &list_p1);
        bool in_p2 = is_id_in_result(slave_id, &list_p2);

        if (!in_p1 && !in_p2)
        {
            ESP_LOGW(TAG, "Not found in both ports, device ID %d !!!", slave_id);
            network_error = true;
        }
        else if (in_p1 && !in_p2)
        {
            ESP_LOGW(TAG, "Only appear in Port 1, ID: %d", slave_id);
            network_error = true;
        }
        else if (!in_p1 && in_p2)
        {
            ESP_LOGW(TAG, "Only appear in Port 2, ID: %d", slave_id);
            network_error = true;
        }
    }
    if (list_p1.count == 0 && original_id_count > 0)
        ESP_LOGW(TAG, "Have problem at Port 1 !!!");
    if (list_p2.count == 0 && original_id_count > 0)
        ESP_LOGW(TAG, "Have problem at Port 2 !!!");
    if (!network_error && list_p1.count == original_id_count)
        ESP_LOGI(TAG, "====> Stable system: Found %d/%d device.", list_p1.count, original_id_count);

    analyse_scan_result(); // Xử lý dữ liệu sau khi scan để in ra LCD

    free(temp_dict);

    // Destroy master scan port 2 + xóa uart driver
    mbc_master_destroy();
    uart_driver_delete(UART_NUM_2);
    uart_driver_delete(UART_NUM_1);

    vTaskDelay(pdMS_TO_TICKS(200));

    if (scan_result.active_port == 1) // Sử dụng kết quả sau khi scan
        modbus_rtu_port_1_init();
    else
        modbus_rtu_port_2_init();
    is_scan_device = false;
    vTaskDelay(pdMS_TO_TICKS(500)); // Ổn định hệ thống
    ESP_LOGI(TAG, "Restoring RTU task ...");

    // Khôi phục TCP task
    is_tcp_running = false;
    ESP_LOGI(TAG, "Restoring TCP task ...");
    xTaskCreatePinnedToCore(modbus_tcp_server_task, "tcp_server_task", 4096, NULL, 10, &tcp_handle_task, 0);

    // Chuyển trang sau khi khôi phục xong
    current_page = PAGE_SCAN_RESULT;
    is_scanning = false;
    ESP_LOGI(TAG, "Scan finished. Switching to Result Page.");

    vTaskDelete(NULL);
}

// ============================================================
// Tạo task scan device
void scan_device(void)
{
    xTaskCreatePinnedToCore((void *)scan_task, "scan_task", 4096, NULL, 11, NULL, 1);
}