#ifndef ETHERNET_H
#define ETHERNET_H

#include <stdint.h>
#include "esp_log.h"
#include "driver/spi_master.h"
#include "driver/gpio.h"
#include "driver/spi_common.h"

#define SPI_ETH_HOST SPI3_HOST
#define INT_ETH_PIN GPIO_NUM_10
#define MOSI_ETH_PIN GPIO_NUM_11
#define CLK_ETH_PIN GPIO_NUM_12
#define MISO_ETH_PIN GPIO_NUM_13
#define CS_ETH_PIN GPIO_NUM_14

#define CLK_SPEED (20 * 1000 * 1000)
#define POLLING_STATUS_TIME 0

// // ETH MAC của ESP
// #define ETH_MAC_ESP  B4:3A:45:CF:4D:2F
// Cấu hình IP tinh nếu dùng Laptop làm router
#define STATIC_IP_ADDRESS 192, 168, 137, 26
#define STATIC_DEFAULT_GATEWAY 192, 168, 137, 1
#define STATIC_GATEWAY_NETMASK 255, 255, 255, 0

esp_err_t eth_init(void);
// typedef struct
// {
//     int int_gpio_num;                                 /*!< Interrupt GPIO number, set -1 to not use interrupt and to poll rx status periodically */
//     uint32_t poll_period_ms;                          /*!< Period in ms to poll rx status when interrupt mode is not used */
//     spi_host_device_t spi_host_id;                    /*!< SPI peripheral (this field is invalid when custom SPI driver is defined)*/
//     spi_device_interface_config_t *spi_devcfg;        /*!< SPI device configuration (this field is invalid when custom SPI driver is defined)*/
//     eth_spi_custom_driver_config_t custom_spi_driver; /*!< Custom SPI driver definitions */
// } eth_w5500_config_t;

#define ETH_W5500_DEFAULT_CONFIG(spi_host, spi_devcfg_p) \
    {                                                    \
        .int_gpio_num = 4,                               \
        .poll_period_ms = 0,                             \
        .spi_host_id = spi_host,                         \
        .spi_devcfg = spi_devcfg_p,                      \
        .custom_spi_driver = ETH_DEFAULT_SPI,            \
    }

#endif // ETHERNET_H

// Các giá trị trả về khi sử dụng kiểu dữ liệu esp_err_t (int)
// ESP_OK (giá trị là 0): Nghĩa là mọi thứ đều ổn, không có lỗi.
// ESP_FAIL (giá trị là -1): Lỗi chung, không xác định rõ nguyên nhân.
// ESP_ERR_NO_MEM (0x101): Hết bộ nhớ RAM để cấp phát cho driver.
// ESP_ERR_INVALID_ARG (0x102): Tham số truyền vào hàm bị sai (ví dụ sai số chân GPIO).