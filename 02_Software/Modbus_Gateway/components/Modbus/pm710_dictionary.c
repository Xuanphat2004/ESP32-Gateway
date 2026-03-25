#include <stdint.h>            // for standard int types definition
#include <stddef.h>            // for NULL and std defines
#include "soc/soc.h"           // for BITN definitions
#include "esp_modbus_common.h" // for common types
#include "esp_modbus_master.h"
#include "pm710_dictionary.h"
#include "mbcontroller.h"

mb_parameter_descriptor_t mbslave_test_dict[] = {
    {0, "Real Energy, Total", "kWh", PM710_ID, MB_PARAM_HOLDING, 1000, 2, offsetof(pm710_data_t, value_1), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {1, "Apparent Energy, Total", "kVAh", PM710_ID, MB_PARAM_HOLDING, 1002, 2, offsetof(pm710_data_t, value_2), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {2, "Reactive Energy, Total", "kVARh", PM710_ID, MB_PARAM_HOLDING, 1004, 2, offsetof(pm710_data_t, value_3), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {3, "Real Power, Total", "kW", PM710_ID, MB_PARAM_HOLDING, 1006, 2, offsetof(pm710_data_t, value_4), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {4, "Apparent Power, Total", "kVA", PM710_ID, MB_PARAM_HOLDING, 1008, 2, offsetof(pm710_data_t, value_5), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {5, "Reactive Power, Total", "KVAR", PM710_ID, MB_PARAM_HOLDING, 1010, 2, offsetof(pm710_data_t, value_6), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {6, "Power Factor, Total", " ", PM710_ID, MB_PARAM_HOLDING, 1012, 2, offsetof(pm710_data_t, value_7), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {7, "Voltage, L-L, 3P Average", "Volt", PM710_ID, MB_PARAM_HOLDING, 1014, 2, offsetof(pm710_data_t, value_8), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {8, "Voltage, L-N, 3P Average", "Volt", PM710_ID, MB_PARAM_HOLDING, 1016, 2, offsetof(pm710_data_t, value_9), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {9, "Current, 3P Average", "Amp", PM710_ID, MB_PARAM_HOLDING, 1018, 2, offsetof(pm710_data_t, value_10), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {10, "Frequency", "Hz", PM710_ID, MB_PARAM_HOLDING, 1020, 2, offsetof(pm710_data_t, value_11), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {11, "Current A", "Amp", PM710_ID, MB_PARAM_HOLDING, 1034, 2, offsetof(pm710_data_t, value_12), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {12, "Current B", "Amp", PM710_ID, MB_PARAM_HOLDING, 1036, 2, offsetof(pm710_data_t, value_13), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {13, "Current C", "Amp", PM710_ID, MB_PARAM_HOLDING, 1038, 2, offsetof(pm710_data_t, value_14), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {14, "Current N", "Amp", PM710_ID, MB_PARAM_HOLDING, 1040, 2, offsetof(pm710_data_t, value_15), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
};

// Size of the dictionary
const uint16_t mbslave_dict_size = sizeof(mbslave_test_dict) / sizeof(mbslave_test_dict[0]);