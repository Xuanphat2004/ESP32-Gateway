#include <stdint.h>            // for standard int types definition
#include <stddef.h>            // for NULL and std defines
#include "soc/soc.h"           // for BITN definitions
#include "esp_modbus_common.h" // for common types
#include "esp_modbus_master.h"
#include "pm710_dictionary.h"
#include "mbcontroller.h"

mb_parameter_descriptor_t mbslave_test_dict[] = {
    {CID_1, "Value A", "V", MBSLAVE_1_TEST_ID, MB_PARAM_INPUT, 0, 2, offsetof(mbslave_data_t, value_a), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {CID_2, "Value B", "V", MBSLAVE_1_TEST_ID, MB_PARAM_INPUT, 4, 2, offsetof(mbslave_data_t, value_b), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
};
const uint16_t mbslave_dict_size = sizeof(mbslave_test_dict) / sizeof(mbslave_test_dict[0]);
// mb_parameter_descriptor_t pm710_dict[] = {

//     // -------- Voltage L-N --------
//     {CID_V_LN_AVG, "Voltage L-N Avg", "V", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3000, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},
//     {CID_V_L1N, "Voltage L1-N", "V", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3028, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},
//     {CID_V_L2N, "Voltage L2-N", "V", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3030, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},
//     {CID_V_L3N, "Voltage L3-N", "V", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3032, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},

//     // -------- Voltage L-L --------
//     {CID_V_LL_AVG, "Voltage L-L Avg", "V", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3010, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},
//     {CID_V_L12, "Voltage L12", "V", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3020, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},
//     {CID_V_L23, "Voltage L23", "V", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3022, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},
//     {CID_V_L31, "Voltage L31", "V", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3024, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},

//     // -------- Current --------
//     {CID_I_AVG, "Current Avg", "A", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3100, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},
//     {CID_I_L1, "Current L1", "A", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3102, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},
//     {CID_I_L2, "Current L2", "A", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3104, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},
//     {CID_I_L3, "Current L3", "A", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3106, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},

//     // -------- Active Power --------
//     {CID_P_TOTAL, "Active Power Total", "kW", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3200, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},
//     {CID_P_L1, "Active Power L1", "kW", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3202, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},
//     {CID_P_L2, "Active Power L2", "kW", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3204, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},
//     {CID_P_L3, "Active Power L3", "kW", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3206, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},

//     // -------- Reactive Power --------
//     {CID_Q_TOTAL, "Reactive Power Total", "kVAR", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3300, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},
//     {CID_Q_L1, "Reactive Power L1", "kVAR", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3302, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},
//     {CID_Q_L2, "Reactive Power L2", "kVAR", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3304, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},
//     {CID_Q_L3, "Reactive Power L3", "kVAR", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3306, 2, 0, PARAM_TYPE_FLOAT, 4, OPTS(0, 0, 0), PAR_PERMS_READ},

//     // -------- Apparent Power --------
//     {CID_S_TOTAL, "Apparent Power Total", "kVA", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3400, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},

//     // -------- Power Factor --------
//     {CID_PF_TOTAL, "Power Factor Total", "", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3500, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},

//     // -------- Frequency --------
//     {CID_FREQ, "Frequency", "Hz", MB_DEVICE_ADDR, MB_PARAM_INPUT, 3600, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},

//     // -------- Energy --------
//     {CID_ENERGY_IMPORT, "Energy Import", "kWh", MB_DEVICE_ADDR, MB_PARAM_INPUT, 4000, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},

//     {CID_ENERGY_EXPORT, "Energy Export", "kWh", MB_DEVICE_ADDR, MB_PARAM_INPUT, 4002, 2, MB_PARAM_INPUT, PARAM_TYPE_FLOAT, 1.0, 0, PAR_PERMS_READ},
// };
