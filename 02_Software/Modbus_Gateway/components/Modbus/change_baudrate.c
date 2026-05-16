#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "esp_log.h"
#include "nvs_flash.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "driver/uart.h"

// Modbus library
#include "esp_modbus_master.h"
#include "esp_modbus_common.h"
#include "modbus_rtu.h"
#include "modbus_tcp.h"
#include "lcd_user.h"
#include "scan_device.h"

extern bool is_baudrate;
extern float *tcp_virtual_storage;
extern ui_page_t current_page;
extern uint32_t baud_options[];
extern int baudrate_id;
extern TaskHandle_t tcp_handle_task;
extern TaskHandle_t rtu_handle_task;
extern SemaphoreHandle_t xDataMutex;
extern scan_analysis_t scan_result;
extern volatile bool is_scan_device; // Cờ báo passive/manual scan đang chạy
volatile bool is_change_baud = false;
uint32_t baudrate = 0;

void change_baudrate_task(void *arg)
{
    is_change_baud = true;
    uint32_t new_baud = baud_options[baudrate_id];

    // Chờ nếu passive/manual scan đang chạy
    // Không được destroy master trong khi scan đang dùng nó
    uint8_t wait_count = 0;
    while (is_scan_device == true)
    {
        ESP_LOGW("[CHANGE BAUDRATE]", "Waiting for scan to finish... (%d)", wait_count++);
        vTaskDelay(pdMS_TO_TICKS(500));
        if (wait_count > 60) // timeout 30s → tiếp tục luôn
        {
            ESP_LOGE("[CHANGE BAUDRATE]", "Scan timeout, forcing baudrate change");
            break;
        }
    }

    esp_err_t err = save_baud_to_nvs(new_baud);
    if (err == ESP_OK)
    {
        ESP_LOGW("[CHANGE BAUDRATE]", "=====> Saved new baudrate %ld to NVS", new_baud);
    }

    // Báo hiệu RTU task tự thoát (không giữ Modbus lock)
    // is_change_baud đã = true ở trên → RTU task sẽ goto exit_and_wait
    vTaskDelay(pdMS_TO_TICKS(700)); // Chờ RTU task hoàn thành lệnh đang chạy

    // RTU task đang ngủ ở exit_and_wait → safe để delete
    if (rtu_handle_task != NULL)
    {
        vTaskDelete(rtu_handle_task);
        rtu_handle_task = NULL;
        ESP_LOGW("[CHANGE BAUDRATE]", "=====> Deleted RTU task");
    }
    if (tcp_handle_task != NULL)
    {
        vTaskDelete(tcp_handle_task);
        tcp_handle_task = NULL;
        ESP_LOGW("[CHANGE BAUDRATE]", "=====> Deleted TCP task");
    }

    if (tcp_virtual_storage != NULL)
    {
        free(tcp_virtual_storage);
        tcp_virtual_storage = NULL;
    }
    // Bước 3: Chờ scheduler dọn task list trước khi destroy
    vTaskDelay(pdMS_TO_TICKS(500));

    // Bước 4: Destroy master và xóa UART (Destroy → Delete UART)
    mbc_master_destroy();
    uart_driver_delete(UART_NUM_1);
    uart_driver_delete(UART_NUM_2);
    ESP_LOGW("[CHANGE BAUDRATE]", "=====> Master destroyed, UART drivers deleted");

    // Bước 5: Chờ Modbus internal cleanup xong trước khi init lại
    vTaskDelay(pdMS_TO_TICKS(300));

    // Khởi tạo lại
    if (scan_result.active_port == 1)
        modbus_rtu_port_1_init();
    else
        modbus_rtu_port_2_init();

    vTaskDelay(pdMS_TO_TICKS(200));

    xTaskCreatePinnedToCore((void *)modbus_test_read, "rtu_server_task", 8192, NULL, 8, &rtu_handle_task, 1);

    // Data-copy task tự cấp phát lại tcp_virtual_storage nếu cần
    xTaskCreatePinnedToCore(modbus_tcp_server_task, "tcp_server_task", 4096, NULL, 8, &tcp_handle_task, 0);
    vTaskDelay(pdMS_TO_TICKS(200));

    is_baudrate = false;
    is_scanning = false;
    current_page = PAGE_2_SETTINGS;
    lcd_clear();

    is_change_baud = false; // Set cuối cùng để các task khác bắt đầu chạy lại
    ESP_LOGW("CHANGE_BAUD", "=====> Baudrate reconfigured successfully.");
    printf("============================================================================================================\n");
    vTaskDelete(NULL);
}

// Hàm lưu Baudrate vào NVS
esp_err_t save_baud_to_nvs(uint32_t baud)
{
    nvs_handle_t baud_handle;
    esp_err_t err;

    err = nvs_open_from_partition("storage", "baud_app", NVS_READWRITE, &baud_handle);
    if (err != ESP_OK)
        return err;

    err = nvs_set_u32(baud_handle, "baudrate_sto", baud);
    if (err == ESP_OK)
        nvs_commit(baud_handle);

    nvs_close(baud_handle);
    return err;
}

// Hàm đọc Baudrate từ NVS
uint32_t load_baud_from_nvs(void)
{
    nvs_handle_t baud_handle;
    uint32_t baudrate = 9600;
    if (nvs_open_from_partition("storage", "baud_app", NVS_READONLY, &baud_handle) == ESP_OK)
    {
        nvs_get_u32(baud_handle, "baudrate_sto", &baudrate);
        nvs_close(baud_handle);
    }
    return baudrate;
}

void change_baudrate(void)
{
    xTaskCreatePinnedToCore((void *)change_baudrate_task, "change_baudrate_task", 4096, NULL, 8, NULL, 1);
}