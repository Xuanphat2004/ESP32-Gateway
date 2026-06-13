#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "driver/uart.h"
#include "esp_modbus_master.h"
#include "esp_modbus_common.h"
#include "mbc_master.h"

#include "modbus_rtu.h"
#include "lcd_user.h"
#include "scan_device.h"
#include "mqtt_to_web.h"

static const char *TAG = "[SCAN DEVICE]";

id_scan_result_t list_p1;
id_scan_result_t list_p2;
id_scan_result_t active_list;
id_scan_result_t inactive_list;
scan_analysis_t scan_result = {0};
uint8_t original_id[248];
uint8_t original_id_count = 0;

bool wire_p1_ok = false;
bool wire_p2_ok = false;

static TaskHandle_t slave_fake_task_handle = NULL;
static volatile bool slave_fake_running = false;
static uint8_t slave_fake_port = 0;

volatile bool is_scan_device = false;
bool is_manual_scan = false;
extern bool is_scanning;
extern ui_page_t current_page;
extern uint16_t register_count;
extern factor_dict_t *factor_dict;
extern mb_parameter_descriptor_t *basic_dict;
extern SemaphoreHandle_t xDataMutex;
extern SemaphoreHandle_t scan_sem;
extern TaskHandle_t rtu_handle_task;
extern bool is_change_baud;

// để set dual_port_mode sau scan và suspend/resume mqtt task
extern bool dual_port_mode;
extern TaskHandle_t mqtt_handle_task;

static void safe_stop_rtu_and_tcp(void)
{
    is_scan_device = true;

    if (is_change_baud == true)
    {
        ESP_LOGW(TAG, "is_change_baud detected, aborting scan");
        is_scan_device = false;
        return;
    }

    vTaskDelay(pdMS_TO_TICKS(700));

    if (rtu_handle_task != NULL)
    {
        vTaskDelete(rtu_handle_task);
        rtu_handle_task = NULL;
        ESP_LOGW(TAG, "RTU task deleted safely");
    }

    vTaskDelay(pdMS_TO_TICKS(500));
}

static mb_parameter_descriptor_t check_dict[3] = {
    {0, "check-1", "-", CHECK_SLAVE_ID, MB_PARAM_HOLDING, 0, 2, offsetof(data_check_t, value_a), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {1, "check-2", "-", CHECK_SLAVE_ID, MB_PARAM_HOLDING, 2, 2, offsetof(data_check_t, value_b), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {2, "check-3", "-", CHECK_SLAVE_ID, MB_PARAM_HOLDING, 4, 2, offsetof(data_check_t, value_c), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
};

static void slave_fake_task(void *arg);
static void execute_wire_check(uint8_t uart_port);
static void start_fake_slave(uint8_t uart_port);
static void stop_slave_fake(void);

static bool is_id_in_result(uint8_t id, id_scan_result_t *list)
{
    for (int i = 0; i < list->count; i++)
    {
        if (list->id[i] == id)
            return true;
    }
    return false;
}

void get_active_list(void)
{
    active_list.count = 0;
    bool is_exist = false;

    for (int i = 0; i < list_p1.count; i++)
    {
        active_list.id[i] = list_p1.id[i];
        active_list.count++;
    }

    if (list_p2.count != 0)
    {
        for (int i = 0; i < list_p2.count; i++)
        {
            is_exist = false;
            for (int j = 0; j < active_list.count; j++)
            {
                if (list_p2.id[i] == active_list.id[j])
                {
                    is_exist = true;
                    break;
                }
            }
            if (is_exist == false)
            {
                active_list.id[active_list.count] = list_p2.id[i];
                active_list.count++;
            }
        }
    }
}

void get_inactive_list(void)
{
    inactive_list.count = 0;
    uint8_t current_id = 0;
    bool found_in_p1 = false;
    bool found_in_p2 = false;

    for (int i = 0; i < original_id_count; i++)
    {
        current_id = original_id[i];

        for (int j = 0; j < list_p1.count; j++)
        {
            if (current_id == list_p1.id[j])
            {
                found_in_p1 = true;
                break;
            }
        }
        if (found_in_p1 == true)
            continue;

        for (int k = 0; k < list_p2.count; k++)
        {
            if (current_id == list_p2.id[k])
            {
                found_in_p2 = true;
                break;
            }
        }
        if (found_in_p2 == true)
            continue;

        inactive_list.id[inactive_list.count] = current_id;
        inactive_list.count++;
    }
}

static uint16_t generate_temp_scan_dict(mb_parameter_descriptor_t *scan_dict, uint8_t *out_original_id, uint8_t *id_count)
{
    uint16_t scan_reg_count = 0;
    uint8_t id_tracker[248] = {0};
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

static void execute_port_scan(uint8_t uart_port, mb_parameter_descriptor_t *dict, uint16_t dict_size, id_scan_result_t *results)
{
    results->count = 0;
    uint8_t online_flags[248] = {0};
    uint32_t current_baud = load_baud_from_nvs();

    uart_driver_delete(UART_NUM_1);
    uart_driver_delete(UART_NUM_2);
    vTaskDelay(pdMS_TO_TICKS(300));

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
        if (online_flags[slave_id] == 1)
            continue;

        uint8_t temp_buf[4];
        uint8_t type;
        if (mbc_master_get_parameter(dict[i].cid, (char *)dict[i].param_key, temp_buf, &type) == ESP_OK)
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

void analyse_scan_result(void)
{
    memset(&scan_result, 0, sizeof(scan_analysis_t));

    for (int i = 0; i < original_id_count; i++)
    {
        uint8_t id = original_id[i];
        bool in_p1 = is_id_in_result(id, &list_p1);
        bool in_p2 = is_id_in_result(id, &list_p2);

        if (in_p1 == false && in_p2 == false)
        {
            scan_result.lose_list[scan_result.lose_count++] = id;
            printf("lose id: %d\n", id);
        }
    }

    if (wire_p1_ok == true)
        scan_result.active_port = 1;
    else if (wire_p2_ok == true)
        scan_result.active_port = 2;
    else if (list_p2.count > list_p1.count)
        scan_result.active_port = 2;
    else
        scan_result.active_port = 1;

    scan_result.final_id_p1 = -1;
    for (int i = 0; i < original_id_count; i++)
    {
        if (is_id_in_result(original_id[i], &list_p1) == true)
            scan_result.final_id_p1 = i;
    }

    scan_result.final_id_p2 = original_id_count;
    for (int i = (original_id_count - 1); i >= 0; i--)
    {
        if (is_id_in_result(original_id[i], &list_p2) == true)
        {
            scan_result.final_id_p2 = i;
        }
    }

    // Set dual_port_mode
    // Bình thường: cả 2 port thấy đều thấy port còn lại → poll 1 port như thường
    // Có lỗi: ít nhất 1 port không thấy đủ → poll cả 2 port theo list của mỗi port
    if (wire_p1_ok)
    {
        // Dây thông từ Port 1 tới Port 2
        // Chỉ cần Port 1 thấy đủ tất cả ID là bình thường
        dual_port_mode = (list_p1.count < original_id_count);
    }
    else if (wire_p2_ok)
    {
        // Dây thông từ Port 2 → Port 1
        // Chỉ cần Port 2 thấy đủ tất cả ID là bình thường
        dual_port_mode = (list_p2.count < original_id_count);
    }
    else
    {
        // Cả 2 wire check đều fail → dây đứt giữa
        // Dual port khi không port nào thấy đủ ID một mình
        dual_port_mode = !((list_p1.count == original_id_count) || (list_p2.count == original_id_count));
    }

    ESP_LOGW(TAG, "dual_port_mode = %s (p1:%d p2:%d total:%d wire_p1:%d wire_p2:%d)",
             dual_port_mode ? "ON" : "OFF",
             list_p1.count, list_p2.count, original_id_count,
             wire_p1_ok, wire_p2_ok);
    // ─────────────────────────────────────────────────────────────────────

    ESP_LOGI(TAG, "Analysis done: lose=%d active_port=%d p1=%d p2=%d",
             scan_result.lose_count, scan_result.active_port,
             scan_result.final_id_p1, scan_result.final_id_p2);
}

// ============================================================
static void restore_after_scan(void)
{
    // Destroy + cleanup
    mbc_master_destroy();
    uart_driver_delete(UART_NUM_1);
    uart_driver_delete(UART_NUM_2);
    vTaskDelay(pdMS_TO_TICKS(200));

    // Khởi động lại RTU theo active_port
    if (scan_result.active_port == 1)
        modbus_rtu_port_1_init();
    else
        modbus_rtu_port_2_init();

    // Khôi phục RTU task
    xTaskCreatePinnedToCore((void *)modbus_test_read, "rtu_server_task", 8192, NULL, 10, &rtu_handle_task, 1);
    vTaskDelay(pdMS_TO_TICKS(300));

    // Suspend được gọi trước scan để tránh gửi dữ liệu sai
    if (mqtt_handle_task != NULL)
        vTaskResume(mqtt_handle_task);

    publish_scan_result();
}

// ============================================================
// Hàm dùng chung để scan cả 2 port
static void run_scan(mb_parameter_descriptor_t *temp_dict, uint16_t temp_dict_size)
{
    // Wire check lần 1: Port 1 Master + Port 2 Slave giả
    ESP_LOGI(TAG, "Wire check: Port 1 Master + Port 2 Slave ...");
    start_fake_slave(UART_NUM_2);
    execute_wire_check(UART_NUM_1);
    stop_slave_fake();

    mbc_master_destroy();
    uart_driver_delete(UART_NUM_1);
    uart_driver_delete(UART_NUM_2);

    // Wire check lần 2 nếu lần 1 phát hiện lỗi
    if (wire_p1_ok == false)
    {
        ESP_LOGI(TAG, "Wire check: Port 2 Master + Port 1 Slave ...");
        start_fake_slave(UART_NUM_1);
        execute_wire_check(UART_NUM_2);
        stop_slave_fake();

        mbc_master_destroy();
        uart_driver_delete(UART_NUM_1);
        uart_driver_delete(UART_NUM_2);
    }

    // Phân nhánh scan theo kết quả wire check
    if (wire_p1_ok == true)
    {
        ESP_LOGI(TAG, "Wire OK, Scan Port 1 only");
        execute_port_scan(UART_NUM_1, temp_dict, temp_dict_size, &list_p1);
        scan_result.active_port = 1;
    }
    else if (wire_p2_ok == true)
    {
        ESP_LOGI(TAG, "Wire OK, Scan Port 2 only");
        execute_port_scan(UART_NUM_2, temp_dict, temp_dict_size, &list_p2);
        scan_result.active_port = 2;
    }
    else
    {
        ESP_LOGI(TAG, "Wire BROKEN, Scan both ports");
        execute_port_scan(UART_NUM_1, temp_dict, temp_dict_size, &list_p1);
        mbc_master_destroy();
        execute_port_scan(UART_NUM_2, temp_dict, temp_dict_size, &list_p2);
    }

    analyse_scan_result(); // Set dual_port_mode ở trong này
}

//====================================================================================================================
// Manual scan task (do người dùng nhấn nút)
static void scan_task(void *pvParameters)
{
    wire_p1_ok = false;
    wire_p2_ok = false;
    memset(&list_p1, 0, sizeof(id_scan_result_t));
    memset(&list_p2, 0, sizeof(id_scan_result_t));

    ESP_LOGI(TAG, "Start scanning ...");

    safe_stop_rtu_and_tcp();

    if (is_change_baud == true)
    {
        ESP_LOGW(TAG, "[MANUAL] baudrate change in progress");
        is_scan_device = false;
        is_scanning = false;
        vTaskDelete(NULL);
        return;
    }

    // Suspend MQTT để tránh gửi dữ liệu sai trong khi scan
    if (mqtt_handle_task != NULL)
        vTaskSuspend(mqtt_handle_task);

    mb_parameter_descriptor_t *temp_dict = malloc(register_count * sizeof(mb_parameter_descriptor_t));
    if (temp_dict == NULL)
    {
        ESP_LOGE(TAG, "[MANUAL] malloc temp_dict failed");
        if (mqtt_handle_task != NULL)
            vTaskResume(mqtt_handle_task);
        is_scan_device = false;
        is_scanning = false;
        vTaskDelete(NULL);
        return;
    }
    uint16_t temp_dict_size = generate_temp_scan_dict(temp_dict, original_id, &original_id_count);

    mbc_master_destroy();
    uart_driver_delete(UART_NUM_1);
    uart_driver_delete(UART_NUM_2);

    run_scan(temp_dict, temp_dict_size);
    free(temp_dict);

    restore_after_scan(); // Destroy → init → tạo task → resume mqtt → publish

    current_page = PAGE_SCAN_RESULT;
    is_manual_scan = false;
    is_scan_device = false;
    is_scanning = false;
    vTaskDelete(NULL);
}

//====================================================================================================================
// Passive scan task (tự động khi phát hiện lỗi)
void passive_scan_task(void *arg)
{
    while (1)
    {
        xSemaphoreTake(scan_sem, portMAX_DELAY);

        if (is_scanning == true)
        {
            ESP_LOGW(TAG, "Manual scan running, skip passive scan");
            continue;
        }

        is_scan_device = true;
        wire_p1_ok = false;
        wire_p2_ok = false;
        memset(&list_p1, 0, sizeof(id_scan_result_t));
        memset(&list_p2, 0, sizeof(id_scan_result_t));

        ESP_LOGI(TAG, "Start passive scanning ...");

        safe_stop_rtu_and_tcp();

        if (is_change_baud == true)
        {
            ESP_LOGW(TAG, "[PASSIVE] baudrate change in progress");
            is_scan_device = false;
            continue;
        }

        // THÊM: Suspend MQTT để tránh gửi dữ liệu sai trong khi scan
        if (mqtt_handle_task != NULL)
            vTaskSuspend(mqtt_handle_task);

        mb_parameter_descriptor_t *temp_dict = malloc(register_count * sizeof(mb_parameter_descriptor_t));
        if (temp_dict == NULL)
        {
            // ESP_LOGE(TAG, "[PASSIVE] malloc temp_dict failed, skip");
            if (mqtt_handle_task != NULL)
                vTaskResume(mqtt_handle_task);
            is_scan_device = false;
            // Khôi phục lại các task
            if (scan_result.active_port == 1)
                modbus_rtu_port_1_init();
            else
                modbus_rtu_port_2_init();
            xTaskCreatePinnedToCore((void *)modbus_test_read, "rtu_server_task", 8192, NULL, 10, &rtu_handle_task, 1);
            continue;
        }
        uint16_t temp_dict_size = generate_temp_scan_dict(temp_dict, original_id, &original_id_count);

        mbc_master_destroy();
        uart_driver_delete(UART_NUM_1);
        uart_driver_delete(UART_NUM_2);

        run_scan(temp_dict, temp_dict_size);
        free(temp_dict);

        restore_after_scan(); // Destroy → init → tạo task → resume mqtt → publish

        is_scan_device = false;
    }
}

// ============================================================
void scan_device(void)
{
    if (is_scan_device == true)
    {
        ESP_LOGW(TAG, "[scan_device] Passive scan dang chay, bo qua manual scan");
        return;
    }
    if (is_scanning == true)
    {
        ESP_LOGW(TAG, "[scan_device] scan_task da ton tai, bo qua");
        return;
    }

    is_scanning = true;
    is_scan_device = true;
    is_manual_scan = true;

    uint32_t dram_free = heap_caps_get_free_size(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT);
    ESP_LOGI(TAG, "[scan_device] Internal DRAM free: %lu bytes", dram_free);

    BaseType_t ret = xTaskCreatePinnedToCore((void *)scan_task, "scan_task", 6144, NULL, 11, NULL, 1);
    if (ret != pdPASS)
    {
        ESP_LOGE(TAG, "[scan_device] xTaskCreate FAILED! DRAM free: %lu bytes", dram_free);
        is_scanning = false;
        is_scan_device = false;
        is_manual_scan = false;
    }
}

// ============================================================================================
// Tạo task giả lập slave để test wire check
static void slave_fake_task(void *arg)
{
    uint8_t uart_port = slave_fake_port;
    uint8_t rx_buf[256] = {0};

    while (slave_fake_running == true)
    {
        int len = uart_read_bytes(uart_port, rx_buf, sizeof(rx_buf), pdMS_TO_TICKS(100));
        if (len >= 4)
        {
            if (rx_buf[0] != CHECK_SLAVE_ID)
                continue;

            if (uart_port == UART_NUM_2)
                wire_p1_ok = true;
            else
                wire_p2_ok = true;

            uint8_t response[5] = {0};
            response[0] = rx_buf[0];
            response[1] = rx_buf[1] | 0x80;
            response[2] = 0x04;

            uint16_t crc = 0xFFFF;
            for (int i = 0; i < 3; i++)
            {
                crc ^= response[i];
                for (int b = 0; b < 8; b++)
                {
                    if ((crc & 0x0001) == 1)
                        crc = (crc >> 1) ^ 0xA001;
                    else
                        crc >>= 1;
                }
            }
            response[3] = crc & 0xFF;
            response[4] = (crc >> 8) & 0xFF;
            uart_write_bytes(uart_port, response, sizeof(response));
            ESP_LOGI(TAG, "Slave fake port %d: wire check OK", uart_port);
        }
    }
    vTaskDelete(NULL);
}

//========================================================================
// Hàm thực hiện wire check bằng cách giả lập slave trên 1 port và master trên port còn lại, sau đó kiểm tra xem master có đọc được dữ liệu từ slave hay không
static void execute_wire_check(uint8_t uart_port)
{
    uint32_t current_baud = load_baud_from_nvs();
    uint8_t temp_buf[4] = {0};
    uint8_t type;

    mbc_master_destroy();
    uart_driver_delete(uart_port);
    vTaskDelay(pdMS_TO_TICKS(300));

    void *master_handler = NULL;
    mbc_master_init(MB_PORT_SERIAL_MASTER, &master_handler);

    mb_communication_info_t comm_info = {
        .port = uart_port,
        .mode = MB_MODE_RTU,
        .baudrate = current_baud,
        .parity = MB_PARITY_NONE,
    };
    mbc_master_setup((void *)&comm_info);
    mbc_master_set_descriptor(check_dict, 3);

    if (uart_port == UART_NUM_1)
        uart_set_pin(UART_NUM_1, UART_1_TX_PIN, UART_1_RX_PIN, UART_1_EN_PIN, UART_PIN_NO_CHANGE);
    else
        uart_set_pin(UART_NUM_2, UART_2_TX_PIN, UART_2_RX_PIN, UART_2_EN_PIN, UART_PIN_NO_CHANGE);

    mbc_master_start();
    uart_set_mode(uart_port, UART_MODE_RS485_HALF_DUPLEX);
    vTaskDelay(pdMS_TO_TICKS(100));

    for (int i = 0; i < 3; i++)
    {
        mbc_master_get_parameter(check_dict[i].cid, (char *)check_dict[i].param_key, temp_buf, &type);

        if (uart_port == UART_NUM_1 && wire_p1_ok == true)
        {
            printf("=======> wire_p1_ok = true\n");
            break;
        }
        if (uart_port == UART_NUM_2 && wire_p2_ok == true)
        {
            printf("=======> wire_p2_ok = true\n");
            break;
        }
    }
    vTaskDelay(pdMS_TO_TICKS(200));
}

static void start_fake_slave(uint8_t uart_port)
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
    if (uart_port == UART_NUM_1)
    {
        uart_param_config(UART_NUM_1, &uart_config);
        uart_set_pin(UART_NUM_1, UART_1_TX_PIN, UART_1_RX_PIN, UART_1_EN_PIN, UART_PIN_NO_CHANGE);
        uart_driver_install(UART_NUM_1, 256, 256, 0, NULL, 0);
        uart_set_mode(UART_NUM_1, UART_MODE_RS485_HALF_DUPLEX);
    }
    else
    {
        uart_param_config(UART_NUM_2, &uart_config);
        uart_set_pin(UART_NUM_2, UART_2_TX_PIN, UART_2_RX_PIN, UART_2_EN_PIN, UART_PIN_NO_CHANGE);
        uart_driver_install(UART_NUM_2, 256, 256, 0, NULL, 0);
        uart_set_mode(UART_NUM_2, UART_MODE_RS485_HALF_DUPLEX);
    }
    slave_fake_port = uart_port;
    slave_fake_running = true;
    xTaskCreatePinnedToCore(slave_fake_task, "slave_fake", 4096, NULL, 5, &slave_fake_task_handle, 1);
}

static void stop_slave_fake(void)
{
    slave_fake_running = false;
    vTaskDelay(pdMS_TO_TICKS(300));
    slave_fake_task_handle = NULL;
}