#include "ble.h"

// Thư viện hệ thống
#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "nvs_flash.h"

// Thư viện Bluetooth của ESP-IDF
#include "esp_bt.h"
#include "esp_bt_main.h"
#include "esp_bt_device.h"

#define BLE_TAG "BLE_GATEWAY"

void ble_server_init(void)
{
    esp_err_t ret;

    // 1. Khởi tạo NVS (Non-Volatile Storage)
    ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND)
    {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);
    ESP_LOGI(BLE_TAG, "NVS Init thành công.");

    // 2. Giải phóng bộ nhớ của Bluetooth Classic để tiết kiệm RAM
    ESP_ERROR_CHECK(esp_bt_controller_mem_release(ESP_BT_MODE_CLASSIC_BT));

    // 3. Khởi tạo BT Controller
    esp_bt_controller_config_t bt_cfg = BT_CONTROLLER_INIT_CONFIG_DEFAULT();
    ret = esp_bt_controller_init(&bt_cfg);
    if (ret)
    {
        ESP_LOGE(BLE_TAG, "Khởi tạo BT controller thất bại: %s", esp_err_to_name(ret));
        return;
    }

    // 4. Bật BT Controller ở chế độ BLE
    ret = esp_bt_controller_enable(ESP_BT_MODE_BLE);
    if (ret)
    {
        ESP_LOGE(BLE_TAG, "Bật BT controller thất bại: %s", esp_err_to_name(ret));
        return;
    }

    // 5. Khởi tạo Bluedroid Stack
    ret = esp_bluedroid_init();
    if (ret)
    {
        ESP_LOGE(BLE_TAG, "Khởi tạo bluedroid thất bại: %s", esp_err_to_name(ret));
        return;
    }

    // 6. Bật Bluedroid Stack
    ret = esp_bluedroid_enable();
    if (ret)
    {
        ESP_LOGE(BLE_TAG, "Bật bluedroid thất bại: %s", esp_err_to_name(ret));
        return;
    }

    ESP_LOGI(BLE_TAG, "Khởi tạo BLE thành công! Thiết bị đã sẵn sàng.");
}