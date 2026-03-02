#include <string.h>
#include <sys/param.h>
#include "unity.h"
#include "test_utils.h"  // unity_send_signal
#include "driver/uart.h" // for the uart driver access
#include "esp_log.h"

// user library
#include "modbus_rtu.h"

static const char *TAG = "[MODBUS GATEWAY - RTU]";

void modbus_init(void)
{
    ESP_LOGI(TAG, "RS485 port initialization...");
    uart_config_t uart_config = {
        .baud_rate = BAUD_RATE,
        .data_bits = UART_DATA_8_BITS,
        .parity = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE, // It determines whether the UART uses RTS and CTS for hardware flow control.
        .rx_flow_ctrl_thresh = 1200,           // HW FLOWCTRL is disable so Don't use this parameter
        .source_clk = UART_SCLK_DEFAULT,       // UART clock source
    };

    // ESP_ERROR_CHECK(uart_wait_tx_idle_polling(UART_NUM1));

    // Configure UART1 and UART2 parameters
    ESP_ERROR_CHECK(uart_param_config(UART_1, &uart_config));
    ESP_ERROR_CHECK(uart_param_config(UART_2, &uart_config));

    // Set UART 1 pins
    ESP_ERROR_CHECK(uart_set_pin(UART_1,
                                 UART1_TX_PIN,
                                 UART1_RX_PIN,
                                 UART1_EN_PIN,
                                 UART_PIN_NO_CHANGE)); // if don't use this pin - set UART_PIN_NO_CHANGE
    // Set UART 2 pins
    ESP_ERROR_CHECK(uart_set_pin(UART_2,
                                 UART2_TX_PIN,
                                 UART2_RX_PIN,
                                 UART2_EN_PIN,
                                 UART_PIN_NO_CHANGE)); // if don't use this pin - set UART_PIN_NO_CHANGE

    // Install UART driver (we don't need an event queue here)
    ESP_ERROR_CHECK(uart_driver_install(UART_NUM1, BUF_RX_SIZE, BUF_TX_SIZE, EVENT_QUEUE_SIZE, NULL, 0));

    // Setup rs485 half duplex mode for both
    ESP_ERROR_CHECK(uart_set_mode(UART_1, UART_MODE_RS485_HALF_DUPLEX));
    ESP_ERROR_CHECK(uart_set_mode(UART_2, UART_MODE_RS485_HALF_DUPLEX));
}