#include <string.h>
#include "esp_wifi.h"
#include "esp_event.h"
#include "nvs_flash.h"
#include "esp_netif.h"
#include "esp_log.h"
#include "wifi.h"
#include "esp_err.h"
#include "esp_mac.h"
#include "rtc_mb.h"
#include "eeprom.h"
#include "esp_http_server.h"

void start_webserver(void);
esp_err_t wifi_config_get_handler(httpd_req_t *req);
esp_err_t get_scan_handler(httpd_req_t *req);
esp_err_t post_save_handler(httpd_req_t *req);