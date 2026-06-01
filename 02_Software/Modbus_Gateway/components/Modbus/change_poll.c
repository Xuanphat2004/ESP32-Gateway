#include <stdio.h>
#include <string.h>
#include "esp_log.h"
#include "nvs_flash.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "change_poll.h"
#include "lcd_user.h"
#include "lcd_16x4.h"

static const char *TAG = "[CHANGE POLL]";

uint32_t poll_options[] = {10, 20, 30, 40, 50, 60, 120};
int poll_id = 2; // mặc định
bool is_poll_change = false;

// poll_interval_ms được định nghĩa trong modbus_rtu.c
extern uint32_t poll_interval_ms;

extern ui_page_t current_page;
extern bool is_scanning;

//======================================================================
esp_err_t save_poll_to_nvs(uint32_t ms)
{
    nvs_handle_t handle;
    esp_err_t err = nvs_open_from_partition("storage", "baud_app", NVS_READWRITE, &handle);

    if (err != ESP_OK)
        return err;
    err = nvs_set_u32(handle, "poll_interval", ms);
    if (err == ESP_OK)
        nvs_commit(handle);
    nvs_close(handle);
    return err;
}

//======================================================================
uint32_t load_poll_from_nvs(void)
{
    nvs_handle_t handle;
    uint32_t ms = 10000;
    if (nvs_open_from_partition("storage", "baud_app", NVS_READONLY, &handle) == ESP_OK)
    {
        nvs_get_u32(handle, "poll_interval", &ms);
        nvs_close(handle);
    }
    return ms;
}

//======================================================================
static void change_poll_task(void *arg)
{
    vTaskDelay(pdMS_TO_TICKS(500));
    is_poll_change = true;
    uint32_t new_ms = poll_options[poll_id] * 1000;

    esp_err_t err = save_poll_to_nvs(new_ms);
    if (err == ESP_OK)
        ESP_LOGI(TAG, "Saved poll interval %lu ms", new_ms);
    else
        ESP_LOGW(TAG, "NVS save failed, apply RAM only");

    poll_interval_ms = new_ms;
    ESP_LOGI(TAG, "Poll interval changed to %lu ms", poll_interval_ms);

    is_poll_change = false;
    is_scanning = false;
    current_page = PAGE_2_SETTINGS;
    lcd_clear();

    vTaskDelete(NULL);
}

//======================================================================
void change_poll_interval(void)
{
    xTaskCreatePinnedToCore(change_poll_task, "change_poll_task", 4096, NULL, 8, NULL, 1);
}