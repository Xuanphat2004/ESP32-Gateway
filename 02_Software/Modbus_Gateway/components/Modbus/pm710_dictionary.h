#ifndef _PM710_DICT_H_
#define _PM710_DICT_H_

#include "mbcontroller.h"
#include "esp_modbus_master.h"

#define PM710_SLAVE_ID 10

// Use modbus slave test function
#define MBSLAVE_2_TEST_ID 2
#define MBSLAVE_3_TEST_ID 3
#define MBSLAVE_4_TEST_ID 4

// struct in IDF library
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
typedef enum
{
    CID_V_LN_AVG = 0,
    CID_V_L1N,
    CID_V_L2N,
    CID_V_L3N,

    CID_V_LL_AVG,
    CID_V_L12,
    CID_V_L23,
    CID_V_L31,

    CID_I_AVG,
    CID_I_L1,
    CID_I_L2,
    CID_I_L3,

    CID_P_TOTAL,
    CID_P_L1,
    CID_P_L2,
    CID_P_L3,

    CID_Q_TOTAL,
    CID_Q_L1,
    CID_Q_L2,
    CID_Q_L3,

    CID_S_TOTAL,
    CID_S_L1,
    CID_S_L2,
    CID_S_L3,

    CID_PF_TOTAL,
    CID_PF_L1,
    CID_PF_L2,
    CID_PF_L3,

    CID_FREQ,

    CID_ENERGY_IMPORT,
    CID_ENERGY_EXPORT,
} pm710_cid_t;

extern mb_parameter_descriptor_t pm710_dict[];

#endif