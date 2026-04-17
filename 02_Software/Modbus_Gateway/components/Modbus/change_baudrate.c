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
#include "modbus_rtu.h"
#include "modbus_tcp.h"
#include "lcd_user.h"

extern bool is_baudrate;
extern bool is_tcp_running;
extern ui_page_t current_page;
extern uint32_t baud_options[];
extern int baudrate_id;
extern TaskHandle_t tcp_handle_task; // biến handle cho task tcp
extern TaskHandle_t rtu_handle_task;
extern SemaphoreHandle_t xDataMutex;
volatile bool is_change_baud = false;

void change_baudrate_task(void *arg)
{
    is_change_baud = true;
    vTaskDelay(pdMS_TO_TICKS(500));
    printf("============================================================================================================\n");
    ESP_LOGI("[CHANGE BAUDRATE]", "Starting baudrate update process...");

    // Lấy giá trị baudrate người dùng đã chọn từ mảng options
    uint32_t new_baud = baud_options[baudrate_id];

    // Lưu vào NVS - Để lần sau khởi động vẫn nhận tốc độ này
    esp_err_t err = save_baud_to_nvs(new_baud);
    if (err == ESP_OK)
    {
        ESP_LOGW("[CHANGE BAUDRATE]", "=====> Saved new baudrate %ld to NVS", new_baud);
    }

    // Khỏi động lại toàn bộ slave vì các slave dùng chung 1 bộ thư viện esp-modbus
    if (tcp_handle_task != NULL)
    {
        vTaskDelete(tcp_handle_task);
        tcp_handle_task = NULL; // Xóa xong phải gán NULL để tránh xóa nhầm lần sau
        ESP_LOGW("[CHANGE BAUDRATE]", "=====> Deleted TCP task for change baudrate");
    }
    if (rtu_handle_task != NULL)
    {
        vTaskDelete(rtu_handle_task);
        rtu_handle_task = NULL; // Xóa xong phải gán NULL để tránh xóa nhầm lần sau
        ESP_LOGW("[CHANGE BAUDRATE]", "=====> Deleted RTU task for change baudrate");
    }
    mbc_master_destroy();
    mbc_slave_destroy();

    // Xóa driver để reset hoàn toàn phần cứng UART
    uart_driver_delete(UART_NUM_1);
    uart_driver_delete(UART_NUM_2);

    vTaskDelay(pdMS_TO_TICKS(1000)); // Delay ngắn để hệ thống ổn định

    // Khởi tạo lại cấu hình Modbus
    modbus_rtu_port_1_init();
    vTaskDelay(pdMS_TO_TICKS(200));
    xTaskCreatePinnedToCore((void *)modbus_test_read, "rtu_server_task", 4096, NULL, 8, &rtu_handle_task, 1);
    is_tcp_running = false;
    xTaskCreatePinnedToCore(modbus_tcp_server_task, "tcp_server_task", 4096, NULL, 8, &tcp_handle_task, 0); // Khôi phục lại task TCP
    vTaskDelay(pdMS_TO_TICKS(200));

    // Cập nhật trạng thái UI
    is_baudrate = false;
    is_scanning = false;
    current_page = PAGE_2_SETTINGS; // Tự động quay về trang chủ sau khi đổi xong
    lcd_clear();
    ESP_LOGW("CHANGE_BAUD", "=====> Baudrate reconfigured successfully.");
    is_change_baud = false; // Cập nhật cho các task khác là đã xong

    printf("============================================================================================================\n");
    vTaskDelete(NULL); // Xóa task sau khi hoàn thành
}

// Hàm lưu Baudrate vào NVS
esp_err_t save_baud_to_nvs(uint32_t baud)
{
    nvs_handle_t baud_handle;
    esp_err_t err = nvs_open("baudrate", NVS_READWRITE, &baud_handle);
    if (err != ESP_OK)
        return err;

    err = nvs_set_u32(baud_handle, "modbus_baudrate", baud);
    if (err == ESP_OK)
        nvs_commit(baud_handle);

    nvs_close(baud_handle);
    return err;
}

// Hàm đọc Baudrate từ NVS - Sẽ được gọi trong hàm khởi tạo lại Modbus RTU
uint32_t load_baud_from_nvs(void)
{
    nvs_handle_t baud_handle;
    uint32_t baudrate = 9600; // Giá trị mặc định nếu NVS trống
    if (nvs_open("baudrate", NVS_READONLY, &baud_handle) == ESP_OK)
    {
        nvs_get_u32(baud_handle, "modbus_baudrate", &baudrate);
        nvs_close(baud_handle);
    }
    return baudrate;
}
void change_baudrate(void)
{
    xTaskCreatePinnedToCore((void *)change_baudrate_task, "change_buadrate_task", 4096, NULL, 8, NULL, 1);
}