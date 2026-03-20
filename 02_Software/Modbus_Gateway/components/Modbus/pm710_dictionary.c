#include <stdint.h>            // for standard int types definition
#include <stddef.h>            // for NULL and std defines
#include "soc/soc.h"           // for BITN definitions
#include "esp_modbus_common.h" // for common types
#include "esp_modbus_master.h"
#include "pm710_dictionary.h"
#include "mbcontroller.h"

mb_parameter_descriptor_t mbslave_test_dict[] = {
    {CID_1, "Value A", "V", MBSLAVE_1_TEST_ID, MB_PARAM_HOLDING, 1000, 2, offsetof(mbslave_data_t, value_a), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {CID_2, "Value B", "V", MBSLAVE_1_TEST_ID, MB_PARAM_HOLDING, 1204, 2, offsetof(mbslave_data_t, value_b), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
};
const uint16_t mbslave_dict_size = sizeof(mbslave_test_dict) / sizeof(mbslave_test_dict[0]);

mb_parameter_descriptor_t pm710_dict[] = {
    // Register listing
    // -------- Setup and Status --------
    //{Register name, name of param, unit of param, slave address, type of function, }
    // {CID_USAGE_HOURS_1, "Usage Hours (Float)", "Hrs", PM710_DEVICE_ID, MB_PARAM_INPUT, 1204, 2, offsetof(pm710_data_t, usage_hrs_1), PARAM_TYPE_FLOAT_ABCD, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    // {CID_USAGE_HOURS_2, "Usage Hours (Integer) ", "Hrs", PM710_DEVICE_ID, MB_PARAM_INPUT, 4110, 2, offsetof(pm710_data_t, usage_hrs_2), PARAM_TYPE_FLOAT_ABCD, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    // {CID_FREQUENCY, "FREQUENCY", "Hz", PM710_DEVICE_ID, MB_PARAM_INPUT, 1020, 2, offsetof(pm710_data_t, frequency), PARAM_TYPE_FLOAT_ABCD, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    // {CID_VOLTAGE_A_B, "VOLTAGE A-B", PM710_DEVICE_ID, MB_PARAM_HOLDING, 1054, 2, offsetof(pm710_data_t, voltage_a_b), PARAM_TYPE_FLOAT_ABCD, 4, {{0, 0, 0}}, PAR_PERMS_READ},

};
const uint16_t pm710_dict_size = sizeof(pm710_dict) / sizeof(pm710_dict[0]);
