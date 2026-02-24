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

void app_main(void)
{
    get_wifi_mac_addr();
    wifi_Init();
    vTaskDelay(pdMS_TO_TICKS(5000));
}
