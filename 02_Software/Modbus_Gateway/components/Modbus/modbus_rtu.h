#ifndef MODBUS_RTU_H
#define MODBUS_RTU_H

#include <string.h>
#include <sys/param.h>
#include "driver/uart.h" // for the uart driver access
#include "esp_log.h"
#include "driver/gpio.h"

#include "esp_modbus_master.h"
#include "esp_modbus_common.h"

#define UART_1 (UART_NUM_1)
#define UART_2 (UART_NUM_2)

#define BAUD_RATE 9600

#define BUF_SIZE 1024
#define BUF_TX_SIZE 1024
#define BUF_RX_SIZE 1024
#define EVENT_QUEUE_SIZE 10

// UART 1 - Modbus RTU port 1
// version 1.0.0
// #define UART_1_RX_PIN GPIO_NUM_39
// #define UART_1_TX_PIN GPIO_NUM_40
// #define UART_1_EN_PIN GPIO_NUM_41

// // UART 1 - Modbus RTU port 2
// #define UART_2_RX_PIN GPIO_NUM_42
// #define UART_2_TX_PIN GPIO_NUM_2
// #define UART_2_EN_PIN GPIO_NUM_1

//==================================
// version 2.0.0
// UART 1 - Modbus RTU port 1
#define UART_1_RX_PIN GPIO_NUM_39
#define UART_1_TX_PIN GPIO_NUM_40
#define UART_1_EN_PIN GPIO_NUM_41

// UART 1 - Modbus RTU port 2
#define UART_2_RX_PIN GPIO_NUM_2
#define UART_2_TX_PIN GPIO_NUM_1
#define UART_2_EN_PIN GPIO_NUM_42

typedef struct
{
    uint16_t cid;
    char name[64];
    char unit[8];
    uint8_t slave_id;
    uint16_t reg_start;
    uint8_t func_code;
    uint8_t data_type;
    uint16_t quantity;
    float scale;
    uint8_t mul_type;
    uint16_t ref_cid[2];
} factor_dict_t; // Struct cho bảng B

extern mb_parameter_descriptor_t mbslave_test_dict[];
extern const uint16_t mbslave_dict_size;
extern factor_dict_t *factor_dict;
extern bool dual_port_mode;
extern volatile bool dual_port_polling;
extern uint32_t poll_interval_ms;

esp_err_t save_baud_to_nvs(uint32_t baud);
uint32_t load_baud_from_nvs(void);

void modbus_rtu_port_1_init(void);
void modbus_rtu_port_2_init(void);

void modbus_rtu_port_2_dummy_init(void);
void modbus_rtu_port_1_dummy_init(void);
void modbus_test_read(void);

#endif // MODBUS_RTU_H