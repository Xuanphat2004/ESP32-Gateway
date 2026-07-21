#ifndef MODBUS_TCP_H
#define MODBUS_TCP_H

#include <stdint.h>
#include <stdbool.h>

#define TCP_MAX_REGISTERS 100

// 1 dữ liệu dòng mapping - 1 dòng là 68 bytes
typedef struct
{
    uint16_t tcp_address;
    uint16_t unit_id;
    char param[64];
} tcp_mapping_t;

void tcp_config_apply(const char *json);
void tcp_config_load_and_start(void);
uint16_t tcp_get_port(void);
void mb_tcp_change_network(void);
void tcp_log_values(void);

#endif
