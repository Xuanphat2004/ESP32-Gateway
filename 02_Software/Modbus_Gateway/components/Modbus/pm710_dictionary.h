#ifndef _PM710_DICT_H_
#define _PM710_DICT_H_

#include "mbcontroller.h"
#include "esp_modbus_master.h"

#define PM710_DEVICE_ID 10

// Use modbus slave test function
#define MBSLAVE_1_TEST_ID 10
#define MBSLAVE_2_TEST_ID 2
#define MBSLAVE_3_TEST_ID 3
#define MBSLAVE_4_TEST_ID 4

// ---------------- Mbslave App ---------------------------
typedef struct
{
    float value_a;
    float value_b;
    float value_c;
    float value_d;
} mbslave_data_t;
typedef enum
{
    CID_1,
    CID_2,
} mbslave_cid_t;

// --------------- PM710 Device ---------------------------
typedef enum
{
    CID_USAGE_HOURS_1 = 0,
    CID_USAGE_MIN_1,
    CID_USAGE_HOURS_2,
    CID_USAGE_MIN_2,
    CID_FREQUENCY,
    CID_VOLTAGE_A_B,
} pm710_cid_t;
typedef struct
{
    float usage_hrs_1;
    int usage_hrs_2;
    float usage_min_1;
    int usage_min_2;
    float frequency;
    float voltage_a_b;
} pm710_data_t;

extern mb_parameter_descriptor_t pm710_dict[];
extern const uint16_t pm710_dict_size;
extern mb_parameter_descriptor_t mbslave_test_dict[];
extern const uint16_t mbslave_dict_size;

#endif