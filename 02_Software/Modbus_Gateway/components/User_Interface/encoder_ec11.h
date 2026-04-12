#ifndef ENCODER_EC11_H
#define ENCODER_EC11_H

#include "driver/pulse_cnt.h"
#include "esp_log.h"
#include "driver/gpio.h"

// ====== CẤU HÌNH CHÂN GPIO  ======
#define A_PIN GPIO_NUM_38
#define B_PIN GPIO_NUM_37

// Thanh ghi chứa giá trị đếm của bộ PCNT là 1 thanh ghi 16 bits có dấu
#define HIGH_LIMIT 32767
#define LOW_LIMIT -32768
#define MAX_GLITCH_NS 2000

extern pcnt_unit_handle_t pcnt_unit;

void init_pcnt_encoder(void);
void encoder_check_task(void *arg);

#endif