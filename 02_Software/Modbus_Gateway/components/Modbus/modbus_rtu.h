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

#define UART_1_RX_PIN GPIO_NUM_39
#define UART_1_TX_PIN GPIO_NUM_40
#define UART_2_RX_PIN GPIO_NUM_42
#define UART_2_TX_PIN GPIO_NUM_2

#define UART_1_EN_PIN GPIO_NUM_41
#define UART_2_EN_PIN GPIO_NUM_1

extern mb_parameter_descriptor_t mbslave_test_dict[];
extern const uint16_t mbslave_dict_size;
// Size of device dictionary
// #define DICT_SIZE (sizeof(pm710_dict) / sizeof(pm710_dict[0]))

void modbus_rtu_init(void);
void modbus_test_read(void);
