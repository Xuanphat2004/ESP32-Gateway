#include <stdio.h>
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "freertos/portmacro.h"
#include "freertos/task.h"
#include "freertos/portable.h"
#include "freertos/event_groups.h"

// Thư viện tự khởi tạo
#include "wifi.h"
#include "ethernet.h"

void app_main(void)
{
    get_wifi_mac_addr();
    wifi_Init();
    // ESP_ERROR_CHECK(eth_init());

    esp_err_t eth_status = eth_init();

    if (eth_status != ESP_OK)
    {
        // In ra log màu đỏ báo lỗi, nhưng TUYỆT ĐỐI KHÔNG reset mạch
        ESP_LOGE("APP_MAIN", "Khoi tao Ethernet W5500 that bai! Ma loi: %d", eth_status);
        ESP_LOGW("APP_MAIN", "Bo qua Ethernet, he thong van tiep tuc hoat dong...");
    }
    else
    {
        ESP_LOGI("APP_MAIN", "Khoi tao Ethernet W5500 thanh cong ruc ro!");
    }
    vTaskDelay(pdMS_TO_TICKS(5000));
}
