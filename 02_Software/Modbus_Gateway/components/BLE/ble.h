#ifndef _BLE_SERVER_H_
#define _BLE_SERVER_H_

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

// --- CẤU HÌNH UUID ---
#define GATTS_SERVICE_UUID 0xFF10
#define GATTS_CHAR_UUID 0xFF11 // ngăn 1: bảng thanh ghi Modbus
#define CHAR_WIFI_UUID 0xFF12  // ngăn 2: cấu hình WiFi (SSID + password)
#define GATTS_NUM_HANDLE 8     // 1 service + 2 char × 3 handle mỗi char = 7, để dư 1
#define BLE_NAME "GW-XP-"
#define MAX_JSON_SIZE 51200 // 51KB

// Cấu trúc dữ liệu thanh ghi Modbus nhận từ App qua BLE
typedef struct
{
    uint16_t cid;        // i: Index
    char name[64];       // n: Name
    char unit[8];        // u: Unit
    uint8_t slave_id;    // s: Slave ID
    uint16_t reg_start;  // a: Address
    uint8_t func_code;   // f: Function Code (0: Holding, 1: Input)
    uint8_t data_type;   // t: Type (Float, U16,...)
    uint16_t quantity;   // q: Quantity
    float scale;         // sc: Scale
    uint8_t mul_type;    // m: Multiplier type
    uint16_t ref_cid[2]; // r: Factor 1 & Factor 2 CIDs
} temp_modbus_reg_t;

extern bool ble_enabled;
extern char ble_device_name[24];

void ble_server_init(void);
void ble_toggle(void);
void print_parsed_registers(temp_modbus_reg_t *reg_array, int count);
temp_modbus_reg_t *parse_json_to_struct_array(const char *json_str, int *out_reg_count);

#endif /* _BLE_SERVER_H_ */