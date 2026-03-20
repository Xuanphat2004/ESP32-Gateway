#include <stdio.h>
#include <string.h>
#include <sys/param.h>
#include "driver/uart.h" // for the uart driver access
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "freertos/portmacro.h"
#include "freertos/task.h"
#include "freertos/portable.h"
#include "freertos/event_groups.h"

// Modbus library
#include "esp_modbus_master.h"
#include "esp_modbus_common.h"
#include "pm710_dictionary.h"

// user library
#include "modbus_rtu.h"

// static const char *TAG_1 = "[MODBUS GATEWAY - Modbus 1]";
static const char *TAG_2 = "[MODBUS GATEWAY - Modbus 2]";
// static const char *TAG_3 = "[MODBUS GATEWAY - Modbus]";
// declare handle variable for UART queue - it contains all information this queue (Queue Control Block - QTB)

void modbus_rtu_port_1_init(void);
void modbus_rtu_port_2_init(void);
void modbus_test_read(void);

// void modbus_rtu_port_1_init(void)
// {

//     ESP_LOGI(TAG_1, "Modbus RTU port 1 initializing...");

//     void *master_1_handler = NULL;

//     // Init controller
//     ESP_ERROR_CHECK(mbc_master_init(MB_PORT_SERIAL_MASTER, &master_1_handler));

//     // Setup UART communication
//     mb_communication_info_t uart_1_info = {
//         .port = UART_1,
//         .mode = MB_MODE_RTU,
//         .baudrate = BAUD_RATE,
//         .parity = MB_PARITY_NONE,
//     };

//     ESP_ERROR_CHECK(mbc_master_setup((void *)&uart_1_info));

//     // Set UART pins
//     ESP_ERROR_CHECK(uart_set_pin(UART_1,
//                                  UART_1_TX_PIN,
//                                  UART_1_RX_PIN,
//                                  UART_1_EN_PIN,
//                                  UART_PIN_NO_CHANGE));
//     // ESP_ERROR_CHECK(uart_set_mode(UART_1, UART_MODE_RS485_HALF_DUPLEX));

//     esp_err_t mbslave_dict_check = mbc_master_set_descriptor(mbslave_test_dict, mbslave_dict_size);
//     // esp_err_t mbslave_dict_check = mbc_master_set_descriptor(mbslave_test_dict, mbslave_dict_size);
//     if (mbslave_dict_check != ESP_OK)
//     {
//         ESP_LOGW(TAG_1, "Fail to set mbslave Dictionary !!!");
//     }
//     else
//     {
//         ESP_LOGI(TAG_1, "Success to set mbslave Dictionary");
//     }
//     // ESP_ERROR_CHECK(uart_set_mode(UART_1, UART_MODE_RS485_HALF_DUPLEX));
//     // Start controller
//     // uart_set_line_inverse(UART_1, UART_SIGNAL_TXD_INV | UART_SIGNAL_RXD_INV);
//     ESP_ERROR_CHECK(mbc_master_start());
//     ESP_ERROR_CHECK(uart_set_mode(UART_1, UART_MODE_RS485_HALF_DUPLEX));
//     ESP_LOGI(TAG_1, "Modbus RTU 1 Master started");
// }

void modbus_rtu_port_2_init(void)
{
    ESP_LOGI(TAG_2, "Modbus RTU port 2 initializing...");
    void *master_2_handler = NULL;

    // Init controller
    ESP_ERROR_CHECK(mbc_master_init(MB_PORT_SERIAL_MASTER, &master_2_handler));

    // Setup UART communication
    mb_communication_info_t uart_2_info = {
        .port = UART_2,
        .mode = MB_MODE_RTU,
        .baudrate = BAUD_RATE,
        .parity = MB_PARITY_NONE,
    };

    ESP_ERROR_CHECK(mbc_master_setup((void *)&uart_2_info));

    // Set UART pins
    ESP_ERROR_CHECK(uart_set_pin(UART_2,
                                 UART_2_TX_PIN,
                                 UART_2_RX_PIN,
                                 UART_2_EN_PIN,
                                 UART_PIN_NO_CHANGE));

    esp_err_t mbslave_dict_check = mbc_master_set_descriptor(mbslave_test_dict, mbslave_dict_size);

    if (mbslave_dict_check != ESP_OK)
    {
        ESP_LOGW(TAG_2, "Fail to set PM710 Dictionary !!!");
    }
    else
    {
        ESP_LOGI(TAG_2, "Success to set PM710 Dictionary");
    }

    // Start controller
    ESP_ERROR_CHECK(mbc_master_start());
    ESP_ERROR_CHECK(uart_set_mode(UART_2, UART_MODE_RS485_HALF_DUPLEX));
    ESP_LOGI(TAG_2, "Modbus RTU 2 Master started");
}

void modbus_test_read(void)
{
    esp_err_t err_1, err_2;
    float value = 0.0;
    uint8_t type;
    while (1)
    {
        err_1 = mbc_master_get_parameter(CID_1, "Value A", (uint8_t *)&value, &type);

        if (err_1 == ESP_OK)
        {
            printf("Real Energy = %.2f kWh\n", value);
        }
        err_2 = mbc_master_get_parameter(CID_2, "Value B", (uint8_t *)&value, &type);

        if (err_2 == ESP_OK)
        {
            printf("Service Frequency = %.2f Hz\n", value);
        }
        vTaskDelay(pdMS_TO_TICKS(2000));
    }
}
