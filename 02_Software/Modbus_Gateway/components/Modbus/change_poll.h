#ifndef CHANGE_POLL_H
#define CHANGE_POLL_H

#include <stdint.h>
#include <stdbool.h>
#include "esp_err.h"

extern uint32_t poll_options[];
extern int poll_id;
extern bool is_poll_change;

void change_poll_interval(void);
esp_err_t save_poll_to_nvs(uint32_t ms);
uint32_t load_poll_from_nvs(void);

#endif