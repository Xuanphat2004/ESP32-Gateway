#include <string.h>
#include <stdio.h>
#include "sdkconfig.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/i2c_master.h"
#include "eeprom.h"
#include "i2c_config.h"

static const char *TAG = "[MODBUS GATEWAY - EEPROM]";

// handle for eeprom
static i2c_master_dev_handle_t eeprom_handle = NULL;
esp_err_t eeprom_init(void);
esp_err_t eeprom_write(uint16_t address, const uint8_t *data, size_t size);
esp_err_t eeprom_read(uint16_t address, uint8_t *data, size_t size);

esp_err_t eeprom_init(void)
{
    // Verify I2C bus configuration status
    if (bus_i2c_handle == NULL)
    {
        ESP_LOGE(TAG, "I2C bus handle is NULL !!!");
        return ESP_ERR_INVALID_STATE;
    }

    // Set parameter for EEPROM - AT24C256C
    i2c_device_config_t eeprom_config = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = DEV_ADDR, // Device address, default format: 1010 A2A1A0 (A0,A1,A2 = GND)
        .scl_speed_hz = EEP_SPEED,  // 100kHz
    };

    // Add device into I2C bus
    esp_err_t err = i2c_master_bus_add_device(bus_i2c_handle, &eeprom_config, &eeprom_handle);
    if (err == ESP_OK)
    {
        ESP_LOGI(TAG, "Successful to configure for EEPROM and add device into I2C bus");
    }
    return err;
}

esp_err_t eeprom_write(uint16_t address, const uint8_t *data, size_t size)
{
    if (eeprom_handle == NULL)
    {
        return ESP_ERR_INVALID_STATE;
    }

    // Create buffer = 2 bytes address + N bytes data
    uint8_t buffer[size + 2];
    buffer[0] = (address >> 8) & 0xFF; // High byte address want to write
    buffer[1] = address & 0xFF;        // Low byte address want to write

    // copy data into buffer with size of data, begin at buffer[3]
    memcpy(&buffer[2], data, size);

    // Send to eeprom, -1 is timeout (no timeout)
    esp_err_t err = i2c_master_transmit(eeprom_handle, buffer, sizeof(buffer), -1);
    if (err == ESP_OK)
    {
        ESP_LOGI(TAG, "Successful to transmit I2C packet");
    }
    else
    {
        ESP_LOGE(TAG, "Fail to transmit packet !!!");
    }
    // Delay 7ms (>=5ms) to wait for eeprom write data
    vTaskDelay(pdMS_TO_TICKS(7));
    return err;
}

esp_err_t eeprom_read(uint16_t address, uint8_t *data, size_t size)
{
    if (eeprom_handle == NULL)
        return ESP_ERR_INVALID_STATE;

    uint8_t addr_buf[2];
    addr_buf[0] = (address >> 8) & 0xFF; // High byte address want to read
    addr_buf[1] = address & 0xFF;        // Low byte address want to read
    esp_err_t err = i2c_master_transmit_receive(eeprom_handle, addr_buf, sizeof(addr_buf), data, size, -1);
    if (err == ESP_OK)
    {
        ESP_LOGI(TAG, "Successful to read I2C packet");
    }
    else
    {
        ESP_LOGE(TAG, "Fail to read packet !!!");
    }
    return err;
}