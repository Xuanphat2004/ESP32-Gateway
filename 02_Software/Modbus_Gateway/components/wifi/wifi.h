#include <stdio.h>

#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "freertos/portmacro.h"
#include "freertos/task.h"
#include "freertos/portable.h"
#include "freertos/event_groups.h"

#include <time.h>
#include "esp_sntp.h"

#define ESP_WIFI_SSID "xuanphatwifi"
#define ESP_WIFI_PASS "25112008"

void wifi_Init(void);
void get_wifi_mac_addr(void);
