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

#define BUF_SIZE 1024
#define BUF_TX_SIZE 1024
#define BUF_RX_SIZE 1024
#define EVENT_QUEUE_SIZE 10

#define UART1_RX_PIN GPIO_NUM_39
#define UART1_TX_PIN GPIO_NUM_40
#define UART2_RX_PIN GPIO_NUM_42
#define UART2_TX_PIN GPIO_NUM_2

#define UART1_EN_PIN GPIO_NUM_41
#define UART2_EN_PIN GPIO_NUM_1

// IDF library
typedef struct
{
    uart_event_type_t type; /*!< UART event type */
    size_t size;            /*!< UART data size for UART_DATA event*/
    bool timeout_flag;      /*!< UART data read timeout flag for UART_DATA event (no new data received during configured RX TOUT)*/
    /*!< If the event is caused by FIFO-full interrupt, then there will be no event with the timeout flag before the next byte coming.*/
} uart_event_t;

typedef struct
{
    uint8_t slave_id;
    uint8_t function_code;
} header_rtu;
