#ifndef _BLE_SERVER_H_
#define _BLE_SERVER_H_

#include "esp_err.h"

/**
 * @brief Khởi tạo module Bluetooth Low Energy (BLE)
 * Hàm này cấu hình NVS, giải phóng bộ nhớ BT Classic và bật Bluedroid Stack.
 */
void ble_server_init(void);

#endif /* _BLE_SERVER_H_ */