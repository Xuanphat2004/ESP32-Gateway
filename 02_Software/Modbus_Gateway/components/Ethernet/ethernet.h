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

esp_err_t eth_init(void);      // Cấu hình và khởi tạo các giá trị cho kết nối Ethernet
void udp_send_task_test(void); // Test kết nối giữa thiết bị với laptop
void tcp_send_task_test(void);
void internet_test_task(void);

#endif // ETHERNET_H
