#ifndef _PM710_DICT_H_
#define _PM710_DICT_H_

#include "mbcontroller.h"
#include "esp_modbus_master.h"

#define PM710_ID 10
#define EM07K_ID 4

// Use modbus slave test function
#define MBSLAVE_1_TEST_ID 1
#define MBSLAVE_2_TEST_ID 2
#define MBSLAVE_3_TEST_ID 3
#define MBSLAVE_4_TEST_ID 4

// ---------------- Mbslave App ---------------------------
typedef struct
{
    float value_1;
    float value_2;
    float value_3;
    float value_4;
    float value_5;
    float value_6;
    float value_7;
    float value_8;
    float value_9;
    float value_10;
    float value_11;
    float value_12;
    float value_13;
    float value_14;
    float value_15;
    float value_16;
    float value_17;
    float value_18;
    float value_19;
    float value_20;
    float value_21;
    float value_22;
    float value_23;
} pm710_data_t;

extern mb_parameter_descriptor_t mbslave_test_dict[];
extern const uint16_t mbslave_dict_size;

#endif