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
#include "esp_modbus_slave.h"
#include "esp_modbus_common.h" // Bỏ esp_modbus_slave.h vì không dùng slave nữa
#include "modbus_rtu.h"
#include "modbus_tcp.h"
#include "lcd_user.h"

extern bool is_baudrate;
extern bool is_tcp_running;
extern ui_page_t current_page;
extern uint32_t baud_options[];
extern int baudrate_id;
extern TaskHandle_t tcp_handle_task;
extern TaskHandle_t rtu_handle_task;
extern SemaphoreHandle_t xDataMutex;
volatile bool is_change_baud = false;
uint32_t baudrate = 0;

void change_baudrate_task(void *arg)
{
    is_change_baud = true;

    printf("============================================================================================================\n");
    ESP_LOGI("[CHANGE BAUDRATE]", "Starting baudrate update process...");

    uint32_t new_baud = baud_options[baudrate_id];

    esp_err_t err = save_baud_to_nvs(new_baud);
    if (err == ESP_OK)
    {
        ESP_LOGW("[CHANGE BAUDRATE]", "=====> Saved new baudrate %ld to NVS", new_baud);
    }

    // KHÔNG dùng vTaskDelete trực tiếp vì task có thể đang giữ spinlock của
    // lwIP hoặc Modbus stack → spinlock không được release → crash lần sau init
    //
    // Gọi mbc_slave_destroy() để giải phóng toàn bộ spinlock, semaphore,
    // socket, và internal state của Modbus TCP stack TRƯỚC khi xóa task
    if (is_tcp_running == true)
    {
        mbc_slave_destroy(); // Giải phóng spinlock + đóng socket port 502
        is_tcp_running = false;
        ESP_LOGW("[CHANGE BAUDRATE]", "=====> TCP slave stack destroyed cleanly");
    }

    // Đợi TCP task tự nhận is_change_baud=true và thoát ra vTaskDelay
    // Sau đó mới xóa để chắc chắn task không đang giữ resource nào
    vTaskDelay(pdMS_TO_TICKS(500));

    if (tcp_handle_task != NULL)
    {
        vTaskDelete(tcp_handle_task);
        tcp_handle_task = NULL;
        ESP_LOGW("[CHANGE BAUDRATE]", "=====> Deleted TCP task");
    }

    // RTU task đang ở vTaskDelay(5000) hoặc kiểm tra is_change_baud
    // Đợi thêm để chắc task không đang trong mbc_master_get_parameter
    vTaskDelay(pdMS_TO_TICKS(500));

    if (rtu_handle_task != NULL)
    {
        vTaskDelete(rtu_handle_task);
        rtu_handle_task = NULL;
        ESP_LOGW("[CHANGE BAUDRATE]", "=====> Deleted RTU task");
    }

    // Destroy master và xóa UART driver
    mbc_master_destroy();
    uart_driver_delete(UART_NUM_1);
    uart_driver_delete(UART_NUM_2);
    ESP_LOGW("[CHANGE BAUDRATE]", "=====> Master destroyed, UART drivers deleted");

    vTaskDelay(pdMS_TO_TICKS(500)); // Đợi hệ thống ổn định

    // Khởi tạo lại
    modbus_rtu_port_1_init();
    vTaskDelay(pdMS_TO_TICKS(200));

    xTaskCreatePinnedToCore((void *)modbus_test_read, "rtu_server_task", 4096, NULL, 8, &rtu_handle_task, 1);

    // TCP task sẽ tự gọi mbc_slave_init_tcp bên trong — stack đã sạch
    is_tcp_running = false;
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