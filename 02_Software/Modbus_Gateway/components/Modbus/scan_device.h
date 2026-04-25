#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "driver/uart.h"
#include "esp_modbus_master.h"
#include "esp_modbus_common.h" // Bỏ esp_modbus_slave.h vì không dùng slave nữa
#include "mbc_master.h"
#include "modbus_rtu.h"
#include "modbus_tcp.h"
#include "lcd_user.h"

extern ui_page_t current_page;
extern bool is_scanning;

void scan_device(void);

// Cấu trúc để lưu danh sách ID online
typedef struct
{
    uint8_t id[248];
    int count;
} id_scan_result_t;

id_scan_result_t list_p1;
id_scan_result_t list_p2;

extern uint16_t register_count;
extern factor_dict_t *factor_dict;
extern mb_parameter_descriptor_t *basic_dict;
extern SemaphoreHandle_t xDataMutex;
extern TaskHandle_t tcp_handle_task;
extern bool is_tcp_running;
volatile bool is_scan_device = false;

// Hàm kiểm tra ID đã tồn tại trong danh sách hay chưa
static bool is_id_in_result(uint8_t id, id_scan_result_t *list)
{
    for (int i = 0; i < list->count; i++)
    {
        if (list->id[i] == id)
            return true;
    }
    return false;
}

// Tạo Dictionary tạm để quét thiết bị - lấy tối đa 3 thanh ghi mỗi thiết bị
static uint16_t generate_temp_scan_dict(mb_parameter_descriptor_t *scan_dict, uint8_t *original_ids, uint8_t *unique_id_count)
{
    uint16_t scan_reg_count = 0;
    uint8_t id_tracker[248] = {0};
    *unique_id_count = 0;

    for (int i = 0; i < register_count; i++)
    {
        uint8_t sid = factor_dict[i].slave_id;

        if (id_tracker[sid] == 0)
        {
            original_ids[*unique_id_count] = sid;
            (*unique_id_count)++;
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

// Khởi tạo Modbus Master scan cho UART port mong muốn
// Port còn lại được init dummy (DE=LOW) để không tranh bus
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
        ESP_LOGI("SCAN", "Port 1 = Master, Port 2 = dummy (DE=LOW)");
        // Dùng dummy init thay vì mbc_slave_init → không đụng singleton
        modbus_rtu_port_2_dummy_init();
    }
    else if (uart_port == UART_NUM_2)
    {
        vTaskDelay(pdMS_TO_TICKS(100));
        uart_set_pin(UART_NUM_2, UART_2_TX_PIN, UART_2_RX_PIN, UART_2_EN_PIN, UART_PIN_NO_CHANGE);
        ESP_LOGI("SCAN", "Port 2 = Master, Port 1 = dummy (DE=LOW)");
        // Dùng dummy init thay vì mbc_slave_init → không đụng singleton
        modbus_rtu_port_1_dummy_init();
    }

    mbc_master_start();
    uart_set_mode(uart_port, UART_MODE_RS485_HALF_DUPLEX);

    for (int i = 0; i < dict_size; i++)
    {
        uint8_t slave_id = dict[i].mb_slave_addr;
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
                ESP_LOGI("[SCAN DEVICE]", "Port %d -> Slave %d: [ONLINE]", uart_port, slave_id);
            }
        }
        vTaskDelay(pdMS_TO_TICKS(50));
    }

    vTaskDelay(pdMS_TO_TICKS(200));
}

uint8_t original_id[248];
uint8_t original_id_count = 0;

//=============================================================================
// TASK CHẨN ĐOÁN LỖI HỆ THỐNG
void scan_task(void *pvParameters)
{
    is_scan_device = true;
    memset(&list_p1, 0, sizeof(id_scan_result_t));
    memset(&list_p2, 0, sizeof(id_scan_result_t));

    ESP_LOGI("[SCAN DEVICE]", "Start to scanning ...");

    // Xóa TCP task trước khi scan
    if (tcp_handle_task != NULL)
    {
        vTaskDelete(tcp_handle_task);
        tcp_handle_task = NULL;
        ESP_LOGW("[SCAN-TASK]", "Deleted TCP task for scanning.");
    }

    // Chỉ destroy master, KHÔNG destroy slave singleton
    // (nếu TCP slave đang chạy, destroy sẽ gây crash RTU stack)
    mbc_master_destroy();

    // Xóa UART driver để reset hoàn toàn phần cứng
    uart_driver_delete(UART_NUM_1);
    uart_driver_delete(UART_NUM_2);

    // Chuẩn bị dictionary tạm để scan
    mb_parameter_descriptor_t *temp_dict = malloc(register_count * sizeof(mb_parameter_descriptor_t));
    uint16_t temp_dict_size = generate_temp_scan_dict(temp_dict, original_id, &original_id_count);

    // --- SCAN PORT 1: Port 1 = Master, Port 2 = dummy ---
    ESP_LOGI("[SCAN DEVICE]", "Port 1 is scanning ...");
    execute_port_scan(UART_NUM_1, temp_dict, temp_dict_size, &list_p1);

    // Destroy master sau khi scan port 1 xong, xóa uart driver của dummy
    mbc_master_destroy();
    uart_driver_delete(UART_NUM_1); // master cũ
    uart_driver_delete(UART_NUM_2); // dummy cũ

    // --- SCAN PORT 2: Port 2 = Master, Port 1 = dummy ---
    ESP_LOGI("[SCAN DEVICE]", "Port 2 is scanning ...");
    execute_port_scan(UART_NUM_2, temp_dict, temp_dict_size, &list_p2);

    ESP_LOGI("[SCAN DEVICE]", "Result: Port 1 found %d device, Port 2 found %d device",
             list_p1.count, list_p2.count);

    bool network_error = false;

    for (int i = 0; i < original_id_count; i++)
    {
        uint8_t slave_id = original_id[i];
        bool in_p1 = is_id_in_result(slave_id, &list_p1);
        bool in_p2 = is_id_in_result(slave_id, &list_p2);

        if (!in_p1 && !in_p2)
        {
            ESP_LOGW("[SCAN DEVICE]", "Not found in both ports, device ID %d !!!", slave_id);
            network_error = true;
        }
        else if (in_p1 && !in_p2)
        {
            ESP_LOGW("[SCAN DEVICE]", "Only appear in List 1, ID device: %d", slave_id);
            network_error = true;
        }
        else if (!in_p1 && in_p2)
        {
            ESP_LOGW("[SCAN DEVICE]", "Only appear in List 2, ID device: %d", slave_id);
            network_error = true;
        }
    }

    if (list_p1.count == 0 && original_id_count > 0)
        ESP_LOGW("[SCAN DEVICE]", "Have problem at Port 1 !!!");
    if (list_p2.count == 0 && original_id_count > 0)
        ESP_LOGW("[SCAN DEVICE]", "Have problem at Port 2 !!!");

    if (!network_error && (list_p1.count == original_id_count))
        ESP_LOGI("[SCAN DEVICE]", "====> Stable system: Found %d/%d device.", list_p1.count, original_id_count);

    current_page = PAGE_SCAN_RESULT;
    is_scanning = false;
    ESP_LOGI("[SCAN DEVICE]", "Scan finished. Switching to Result Page.");

    free(temp_dict);

    // Destroy master scan port 2 + xóa uart driver
    mbc_master_destroy();
    uart_driver_delete(UART_NUM_2); // master cũ
    uart_driver_delete(UART_NUM_1); // dummy cũ

    vTaskDelay(pdMS_TO_TICKS(200));

    // Khôi phục hoạt động bình thường:
    // Port 1 = RTU Master, Port 2 = dummy (DE=LOW)
    // KHÔNG gọi mbc_slave_init → singleton dành cho TCP slave
    uint32_t current_baud = load_baud_from_nvs();
    void *master_handler = NULL;
    mbc_master_init(MB_PORT_SERIAL_MASTER, &master_handler);

    mb_communication_info_t main_comm = {
        .port = UART_NUM_1,
        .mode = MB_MODE_RTU,
        .baudrate = current_baud,
        .parity = MB_PARITY_NONE,
    };
    mbc_master_setup((void *)&main_comm);
    mbc_master_set_descriptor(basic_dict, register_count);
    ESP_ERROR_CHECK(uart_set_pin(UART_1, UART_1_TX_PIN, UART_1_RX_PIN, UART_1_EN_PIN, UART_PIN_NO_CHANGE));
    mbc_master_start();
    uart_set_mode(UART_NUM_1, UART_MODE_RS485_HALF_DUPLEX);

    // Init dummy cho port 2 (DE=LOW, không dùng mbc_slave_init)
    modbus_rtu_port_2_dummy_init();

    is_scan_device = false;
    vTaskDelay(pdMS_TO_TICKS(2000));

    ESP_LOGI("[SCAN DEVICE]", "Restoring RTU task polling ...");

    // Khôi phục TCP task (sẽ tự gọi mbc_slave_init_tcp bên trong)
    is_tcp_running = false;
    xTaskCreatePinnedToCore(modbus_tcp_server_task, "tcp_server_task", 4096, NULL, 10, &tcp_handle_task, 0);

    vTaskDelete(NULL);
}

void scan_device(void)
{
    xTaskCreatePinnedToCore((void *)scan_task, "scan_task", 4096, NULL, 11, NULL, 1);
}