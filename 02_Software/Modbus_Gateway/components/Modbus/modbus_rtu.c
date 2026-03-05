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

static const char *TAG_1 = "[MODBUS GATEWAY - Modbus 1]";
static const char *TAG_2 = "[MODBUS GATEWAY - Modbus 2]";
static const char *TAG_3 = "[MODBUS GATEWAY - Modbus]";
// declare handle variable for UART queue - it contains all information this queue (Queue Control Block - QTB)

void modbus_rtu_init(void);
void modbus_test_read(void);

void modbus_master_init(void)
{
    ESP_LOGI(TAG_1, "Modbus RTU port 1 initializing...");
    ESP_LOGI(TAG_2, "Modbus RTU port 2 initializing...");
    void *master_1_handler = NULL;
    void *master_2_handler = NULL;
    esp_err_t err_1, err_2;

    // Init controller
    err_1 = mbc_master_init(MB_PORT_SERIAL_MASTER, &master_1_handler);
    err_2 = mbc_master_init(MB_PORT_SERIAL_MASTER, &master_2_handler);
    ESP_ERROR_CHECK(err_1);
    ESP_ERROR_CHECK(err_2);

    // Setup UART communication
    mb_communication_info_t uart_1_info = {
        .port = UART_1,
        .mode = MB_MODE_RTU,
        .baudrate = BAUD_RATE,
        .parity = MB_PARITY_NONE,
    };

    mb_communication_info_t uart_2_info = {
        .port = UART_2,
        .mode = MB_MODE_RTU,
        .baudrate = BAUD_RATE,
        .parity = MB_PARITY_NONE,
    };

    ESP_ERROR_CHECK(mbc_master_setup((void *)&uart_1_info));
    ESP_ERROR_CHECK(mbc_master_setup((void *)&uart_2_info));

    // Set UART pins
    ESP_ERROR_CHECK(uart_set_pin(UART_1,
                                 UART_1_TX_PIN,
                                 UART_1_RX_PIN,
                                 UART_1_EN_PIN,
                                 UART_PIN_NO_CHANGE));
    ESP_ERROR_CHECK(uart_set_pin(UART_2,
                                 UART_2_TX_PIN,
                                 UART_2_RX_PIN,
                                 UART_2_EN_PIN,
                                 UART_PIN_NO_CHANGE));

    esp_err_t dict_check = mbc_master_set_descriptor(mbslave_test_dict, mbslave_dict_size);
    if (dict_check != ESP_OK)
    {
        ESP_LOGW(TAG_3, "Fail to set PM710 Dictionary !!!");
    }
    else
    {
        ESP_LOGI(TAG_3, "Success to set PM710 Dictionary");
    }

    // Start controller
    ESP_ERROR_CHECK(mbc_master_start());
    ESP_ERROR_CHECK(mbc_master_start());

    ESP_LOGI(TAG_1, "Modbus RTU 1 Master started");
    ESP_LOGI(TAG_2, "Modbus RTU 2 Master started");
}

void modbus_test_read(void)
{
    esp_err_t err;
    float value = 0;
    uint8_t type;

    err = mbc_master_get_parameter(CID_1, "Value A", (uint8_t *)&value, &type);

    if (err == ESP_OK)
    {
        printf("value a = %.2f V\n", value);
    }
    else
    {
        printf("Read failed: %s\n", esp_err_to_name(err));
    }
}