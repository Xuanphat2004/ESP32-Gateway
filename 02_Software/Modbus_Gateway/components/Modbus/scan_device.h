#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "driver/uart.h"
#include "esp_modbus_master.h"
#include "esp_modbus_slave.h" // Cần cho mbc_slave_destroy()
#include "esp_modbus_common.h"
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
    uint8_t id[248]; // lưu các ID có phản hồi
    int count;       // tổng số lượng ID đã phản hồi
} id_scan_result_t;

id_scan_result_t list_p1; // List chứa ID của port 1 scan được
id_scan_result_t list_p2; // List chứa ID của port 2 scan được

extern uint16_t register_count; // Tổng số lượng CID đang có trong NVS
extern factor_dict_t *factor_dict;
extern mb_parameter_descriptor_t *basic_dict;
extern SemaphoreHandle_t xDataMutex;
extern TaskHandle_t tcp_handle_task;
extern bool is_tcp_running;
volatile bool is_scan_device = false;

// Hàm kiểm tra ID đã tồn tại trong list hay chưa
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
// uint16_t temp_dict_size = generate_temp_scan_dict(temp_dict, original_id, &original_id_count);
static uint16_t generate_temp_scan_dict(mb_parameter_descriptor_t *scan_dict, uint8_t *original_id, uint8_t *id_count)
{
    uint16_t scan_reg_count = 0;
    uint8_t id_tracker[248] = {0}; // mảng chứa số lượng thanh ghi của id đang dò, 248 tức là ID từ ID 1 -> ID 247
    *id_count = 0;                 // Đặt lại số lượng ID tìm thấy về 0

    // Quét qua toàn bộ thanh ghi đang có trong bảng B
    // Ứng với mỗi id lấy ra 3 thanh ghi
    for (int i = 0; i < register_count; i++) // Quét qua từng cid có trong bảng B
    {
        uint8_t sid = factor_dict[i].slave_id; // lấy ID của cid đang trỏ tới

        if (id_tracker[sid] == 0) // kiểm tra sid đó có thanh ghi nào chưa
        {
            original_id[*id_count] = sid; // Lưu id vừa phát hiện ra lại
            (*id_count)++;                // tăng biến đếm tổng số lượng cid của
        }

        if (id_tracker[sid] < 3) // số lượng thanh ghi của id đó vẫn nhỏ hơn 3 thì vẫn lấy dữ liệu của thanh ghi tiếp theo
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
            id_tracker[sid]++; // tăng số lượng thanh ghi của id đó lên 1, tối đa là 3 thanh ghi ứng với 0 1 2
        }
    }
    return scan_reg_count; // return về cid lớn nhất của scan_dict
}

// Khởi tạo Modbus Master scan cho UART port mong muốn
// Port còn lại được init dummy (DE=LOW) để không tranh bus
// execute_port_scan(UART_NUM_1, temp_dict, temp_dict_size, &list_p1)
static void execute_port_scan(uint8_t uart_port, mb_parameter_descriptor_t *dict, uint16_t dict_size, id_scan_result_t *results)
{
    results->count = 0;              // vị trí để ghi id trong mảng
    uint8_t online_flags[248] = {0}; // id nào có thì bật nó lên 1 (ID 1-> 247)
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

    for (int i = 0; i < dict_size; i++) // quét qua từng CID trong scan_dict
    {
        uint8_t slave_id = dict[i].mb_slave_addr;
        if (online_flags[slave_id] == 1) // Nếu cờ của id đó đã bật, tức là đã có phản hồi từ id đó ở 1 trong 3 thanh ghi
            continue;

        uint8_t temp_buf[4];
        uint8_t type;
        if (mbc_master_get_parameter(dict[i].cid, dict[i].param_key, temp_buf, &type) == ESP_OK)
        {
            if (results->count < 248)
            {
                results->id[results->count++] = slave_id; // Ghi lại id của cid vừa phản hồi
                online_flags[slave_id] = 1;               // Bật cờ báo có trên đường truyền của id đó
                ESP_LOGI("[SCAN DEVICE]", "Port %d -> Slave %d: [ONLINE]", uart_port, slave_id);
            }
        }
        vTaskDelay(pdMS_TO_TICKS(50));
    }
    vTaskDelay(pdMS_TO_TICKS(200));
}

uint8_t original_id[248];      // Chi tiết id các id gốc từ app gửi xuống
uint8_t original_id_count = 0; // Có bao nhiêu id có trong mảng

//=============================================================================
// Giải phóng tài nguyên của 2 port UART trước khi bắt đầu scan
// Destroy tài nguyên trước sau đó mới delete task để tránh task còn giữ mutex hoặc spinlock của LwIP bị deadlock
void scan_task(void *pvParameters)
{
    is_scan_device = true;
    memset(&list_p1, 0, sizeof(id_scan_result_t)); // Set các bit có trong mảng thành 0
    memset(&list_p2, 0, sizeof(id_scan_result_t));

    ESP_LOGI("[SCAN DEVICE]", "Start to scanning ...");

    // Destroy TCP slave stack TRƯỚC khi xóa task
    // vTaskDelete đột ngột sẽ để spinlock lwIP không được nhả
    if (is_tcp_running == true) // Nếu task tcp đang chạy
    {
        mbc_slave_destroy();
        is_tcp_running = false;
        ESP_LOGW("[SCAN-TASK]", "TCP slave stack destroyed cleanly.");
    }

    // Đợi TCP task nhận is_scan_device=true và thoát khỏi section nguy hiểm
    vTaskDelay(pdMS_TO_TICKS(500));

    if (tcp_handle_task != NULL)
    {
        vTaskDelete(tcp_handle_task);
        tcp_handle_task = NULL;
        ESP_LOGW("[SCAN-TASK]", "Deleted TCP task for scanning.");
    }

    // Destroy master
    mbc_master_destroy();

    // Xóa UART driver để reset hoàn toàn phần cứng
    uart_driver_delete(UART_NUM_1);
    uart_driver_delete(UART_NUM_2);

    // Chuẩn bị dictionary tạm để scan
    mb_parameter_descriptor_t *temp_dict = malloc(register_count * sizeof(mb_parameter_descriptor_t)); // Chuẩn bị vùng nhớ để chứa bảng tạm, trỏ tới vị trí đầu tiên trong bảng tạm đó
    uint16_t temp_dict_size = generate_temp_scan_dict(temp_dict, original_id, &original_id_count);

    // Scan bằng port 1 trước
    ESP_LOGI("[SCAN DEVICE]", "Port 1 is scanning ...");
    execute_port_scan(UART_NUM_1, temp_dict, temp_dict_size, &list_p1);
    mbc_master_destroy();
    uart_driver_delete(UART_NUM_1);
    uart_driver_delete(UART_NUM_2);

    // Tiếp theo Scan port 2
    ESP_LOGI("[SCAN DEVICE]", "Port 2 is scanning ...");
    execute_port_scan(UART_NUM_2, temp_dict, temp_dict_size, &list_p2);

    ESP_LOGI("[SCAN DEVICE]", "Result: Port 1 found %d device, Port 2 found %d device", list_p1.count, list_p2.count);

    bool network_error = false; // Biến báo lỗi trên đường truyền

    for (int i = 0; i < original_id_count; i++) // Quét qua từng ID mà app đã gửi xuống
    {
        uint8_t slave_id = original_id[i]; // lấy ID gốc ra để đối chiếu xem có tồn tại trong 2 list kia hay không
        bool in_p1 = is_id_in_result(slave_id, &list_p1);
        bool in_p2 = is_id_in_result(slave_id, &list_p2);

        if (in_p1 == false && in_p2 == false) // không có cả trong list của port 1 và port 2
        {
            ESP_LOGW("[SCAN DEVICE]", "Not found in both ports, device ID %d !!!", slave_id);
            network_error = true;
        }
        else if (in_p1 == true && in_p2 == false) // Có trong port 1 nhưng không có trong port 2
        {
            ESP_LOGW("[SCAN DEVICE]", "Only appear in List 1, ID device: %d", slave_id);
            network_error = true;
        }
        else if (in_p1 == false && in_p2 == true) // Có trong port 2 nhưng không có trong port 1
        {
            ESP_LOGW("[SCAN DEVICE]", "Only appear in List 2, ID device: %d", slave_id);
            network_error = true;
        }
    }

    if (list_p1.count == 0 && original_id_count > 0) // port 1 không quét được gì cả
        ESP_LOGW("[SCAN DEVICE]", "Have problem at Port 1 !!!");
    if (list_p2.count == 0 && original_id_count > 0) // port 2 không quét được gì cả
        ESP_LOGW("[SCAN DEVICE]", "Have problem at Port 2 !!!");

    if (network_error == false && (list_p1.count == original_id_count))
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

    //===============================================================================================================================
    // Khôi phục các task cũ
    // Port 1 = RTU Master, Port 2 = dummy (DE=LOW)
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
    modbus_rtu_port_2_dummy_init(); // Init dummy cho port 2 - DE=LOW => giả làm slave
    is_scan_device = false;
    vTaskDelay(pdMS_TO_TICKS(2000));
    ESP_LOGI("[SCAN DEVICE]", "Restoring RTU task ...");

    // Khôi phục TCP task (sẽ tự gọi mbc_slave_init_tcp bên trong)
    is_tcp_running = false;
    ESP_LOGI("[SCAN DEVICE]", "Restoring TCP task ...");
    xTaskCreatePinnedToCore(modbus_tcp_server_task, "tcp_server_task", 4096, NULL, 10, &tcp_handle_task, 0);

    vTaskDelete(NULL); // Xóa task scan
}

void scan_device(void)
{
    xTaskCreatePinnedToCore((void *)scan_task, "scan_task", 4096, NULL, 11, NULL, 1);
}