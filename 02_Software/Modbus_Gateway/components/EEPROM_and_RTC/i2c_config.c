#include <string.h>
#include <stdio.h>
#include "sdkconfig.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "driver/i2c_master.h"
#include "i2c_config.h"

i2c_master_bus_handle_t bus_i2c_handle = NULL;
esp_err_t i2c_config(void);
static const char *TAG = "[MODBUS GATEWAY - I2C CONFIG]";
esp_err_t i2c_config(void)
{
    esp_err_t check = ESP_OK;
    i2c_master_bus_config_t i2c_bus_config = {
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .i2c_port = I2C_MASTER_PORT,
        .scl_io_num = SCL_PIN,
        .sda_io_num = SDA_PIN,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,
    };
    check = i2c_new_master_bus(&i2c_bus_config, &bus_i2c_handle);
    if (check == ESP_OK)
    {
        ESP_LOGI(TAG, "Configured I2C bus ...");
    }
    else
    {
        ESP_LOGE(TAG, "Fail to configure for I2C bus !!!");
    }
    return check;
}