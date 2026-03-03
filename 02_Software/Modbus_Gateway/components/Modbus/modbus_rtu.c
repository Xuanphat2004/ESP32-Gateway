#include <stdio.h>
#include <string.h>
#include <sys/param.h>
#include "unity.h"
#include "test_utils.h"  // unity_send_signal
#include "driver/uart.h" // for the uart driver access
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "freertos/portmacro.h"
#include "freertos/task.h"
#include "freertos/portable.h"
#include "freertos/event_groups.h"

// user library
#include "modbus_rtu.h"

static const char *TAG = "[MODBUS GATEWAY - RTU]";

// declare handle variable for UART queue - it contains all information this queue (Queue Control Block - QTB)
static QueueHandle_t uart_queue;

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

    // Install UART driver and create UART queue
    ESP_ERROR_CHECK(uart_driver_install(UART_1,
                                        BUF_RX_SIZE,
                                        BUF_TX_SIZE,
                                        EVENT_QUEUE_SIZE,
                                        &uart_queue,
                                        0));
    ESP_ERROR_CHECK(uart_driver_install(UART_2,
                                        BUF_RX_SIZE,
                                        BUF_TX_SIZE,
                                        EVENT_QUEUE_SIZE,
                                        &uart_queue,
                                        0));

    // Setup rs485 half duplex mode for both
    ESP_ERROR_CHECK(uart_set_mode(UART_1, UART_MODE_RS485_HALF_DUPLEX));
    ESP_ERROR_CHECK(uart_set_mode(UART_2, UART_MODE_RS485_HALF_DUPLEX));

    ESP_LOGI(TAG, "Successful to configure UART 1 and UART 2");
}

// Wait event in queue
static void rx_queue_event_task(void *pvParameters)
{
    // Contatin packet infomation in queue: type, size
    static uart_event_t uart_event;

    // It will check the length of modbus rtu packet
    static int len_check = 0;

    // allocate temporary memory in heap - 1024 bytes
    // the temp variable contains this address
    static uint8_t *temp = (uint8_t *)malloc(BUF_SIZE);

    for (;;) // for(;;) = while(1)
    {
        // make sure to zero out the buffer before storing new data
        // bzero(temp, 1024) = memset(temp, 0, 1024)
        memset(temp, 0, BUF_SIZE);

        if ((xQueueReceive(uart_queue, (void *)&uart_event, portMAX_DELAY)) == pdTRUE)
        {
            switch (uart_event.type)
            {
            case UART_DATA:
                len_check = uart_read_bytes(UART_1,
                                            temp,
                                            uart_event.size,
                                            portMAX_DELAY);
                if (len_check >=)
                {
                    ESP_LOGI(TAG, "Receive modbus RTU packet from UART 1 with a length of %d bytes", len_check);
                }
                break;

            // LUỒNG 2: PHÁT HIỆN NHIỄU (LỖI PARITY)
            case UART_PARITY_ERR:

                break;

            // LUỒNG 3: BỘ ĐỆM BỊ ĐẦY (CẢNH BÁO HỆ THỐNG CHẬM)
            case UART_BUFFER_FULL:
                // Cần tối ưu lại Task xử lý để đọc dữ liệu nhanh hơn
                uart_flush_input(UART_NUM_1);
                break;

            default:
                break;
            }
        }
    }
    free(dtmp);
    vTaskDelete(NULL);
}