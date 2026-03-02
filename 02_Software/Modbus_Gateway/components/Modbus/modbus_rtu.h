#include <string.h>
#include <sys/param.h>
#include "unity.h"
#include "test_utils.h"  // unity_send_signal
#include "driver/uart.h" // for the uart driver access
#include "esp_log.h"
#include "esp_random.h" // for uint32_t esp_random()

#define UART_1 (UART_NUM_1)
#define UART_2 (UART_NUM_2)

#define BAUD_RATE 9600

#define BUF_TX_SIZE 1024
#define BUF_RX_SIZE 1024
#define EVENT_QUEUE_SIZE 10

#define UART1_RX_PIN GPIO_NUM_39
#define UART1_TX_PIN GPIO_NUM_40
#define UART2_RX_PIN GPIO_NUM_42
#define UART2_TX_PIN GPIO_NUM_2

#define UART1_EN_PIN GPIO_NUM_41
#define UART2_EN_PIN GPIO_NUM_1

// Wait timeout for uart driver
#define PACKET_READ_TICS (2000 / portTICK_PERIOD_MS)