#include <stdint.h>            // for standard int types definition
#include <stddef.h>            // for NULL and std defines
#include "soc/soc.h"           // for BITN definitions
#include "esp_modbus_common.h" // for common types
#include "esp_modbus_master.h"
#include "pm710_dictionary.h"
#include "mbcontroller.h"
// address of PM710 need to -1 because in modbus, register address is 0 based, but in PM710, register address is 1 based
mb_parameter_descriptor_t pm710_dict[] = {
    {0, "Real Energy, Total", "kWh", PM710_ID, MB_PARAM_HOLDING, 999, 2, offsetof(pm710_data_t, value_1), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {1, "Apparent Energy, Total", "kVAh", PM710_ID, MB_PARAM_HOLDING, 1001, 2, offsetof(pm710_data_t, value_2), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {2, "Reactive Energy, Total", "kVARh", PM710_ID, MB_PARAM_HOLDING, 1003, 2, offsetof(pm710_data_t, value_3), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {3, "Real Power, Total", "kW", PM710_ID, MB_PARAM_HOLDING, 1005, 2, offsetof(pm710_data_t, value_4), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {4, "Apparent Power, Total", "kVA", PM710_ID, MB_PARAM_HOLDING, 1007, 2, offsetof(pm710_data_t, value_5), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {5, "Reactive Power, Total", "KVAR", PM710_ID, MB_PARAM_HOLDING, 1009, 2, offsetof(pm710_data_t, value_6), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {6, "Power Factor, Total", " ", PM710_ID, MB_PARAM_HOLDING, 1011, 2, offsetof(pm710_data_t, value_7), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {7, "Voltage, L-L, 3P Average", "Volt", PM710_ID, MB_PARAM_HOLDING, 1013, 2, offsetof(pm710_data_t, value_8), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {8, "Voltage, L-N, 3P Average", "Volt", PM710_ID, MB_PARAM_HOLDING, 1015, 2, offsetof(pm710_data_t, value_9), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {9, "Current, 3P Average", "Amp", PM710_ID, MB_PARAM_HOLDING, 1017, 2, offsetof(pm710_data_t, value_10), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {10, "Frequency", "Hz", PM710_ID, MB_PARAM_HOLDING, 1019, 2, offsetof(pm710_data_t, value_11), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {11, "Current A", "Amp", PM710_ID, MB_PARAM_HOLDING, 1033, 2, offsetof(pm710_data_t, value_12), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {12, "Current B", "Amp", PM710_ID, MB_PARAM_HOLDING, 1035, 2, offsetof(pm710_data_t, value_13), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {13, "Current C", "Amp", PM710_ID, MB_PARAM_HOLDING, 1037, 2, offsetof(pm710_data_t, value_14), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {14, "Current N", "Amp", PM710_ID, MB_PARAM_HOLDING, 1039, 2, offsetof(pm710_data_t, value_15), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {15, "Voltage A-N", "Volt", PM710_ID, MB_PARAM_HOLDING, 1059, 2, offsetof(pm710_data_t, value_16), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    {16, "Frequency Maximum", "Hz", PM710_ID, MB_PARAM_HOLDING, 4083, 2, offsetof(pm710_data_t, value_17), PARAM_TYPE_U16, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    //     {17, "Voltage C-N", "Volt", PM710_ID, MB_PARAM_HOLDING, 1046, 2, offsetof(pm710_data_t, value_18), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    //     {18, "Voltage A-B", "Volt", PM710_ID, MB_PARAM_HOLDING, 1048, 2, offsetof(pm710_data_t, value_19), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
    //     {19, "Voltage B-C", "Volt", PM710_ID, MB_PARAM_HOLDING, 1050, 2, offsetof(pm710_data_t, value_20), PARAM_TYPE_FLOAT, 4, {{0, 0, 0}}, PAR_PERMS_READ},
};
mb_parameter_descriptor_t em07k_dict[] = {
    {0, "Voltage Transformer Ratio(VTR)", " ", EM07K_ID, MB_PARAM_HOLDING, 4000, 1, offsetof(pm710_data_t, value_1), PARAM_TYPE_U16, 2, {{0, 0, 0}}, PAR_PERMS_READ},
    {1, "Current Transformer Ratio(CTR)", " ", EM07K_ID, MB_PARAM_HOLDING, 4001, 1, offsetof(pm710_data_t, value_2), PARAM_TYPE_U16, 2, {{0, 0, 0}}, PAR_PERMS_READ},
    {2, "Voltage L1-N", "V", EM07K_ID, MB_PARAM_HOLDING, 4002, 1, offsetof(pm710_data_t, value_3), PARAM_TYPE_U16, 2, {{0, 0, 0}}, PAR_PERMS_READ},
    {3, "Voltage L2-N", "V", EM07K_ID, MB_PARAM_HOLDING, 4003, 1, offsetof(pm710_data_t, value_4), PARAM_TYPE_U16, 2, {{0, 0, 0}}, PAR_PERMS_READ},
    {4, "Voltage L3-N", "V", EM07K_ID, MB_PARAM_HOLDING, 4004, 1, offsetof(pm710_data_t, value_5), PARAM_TYPE_U16, 2, {{0, 0, 0}}, PAR_PERMS_READ},
};

// Size of the dictionary
const uint16_t pm710_dict_size = sizeof(pm710_dict) / sizeof(pm710_dict[0]);
const uint16_t em07k_dict_size = sizeof(em07k_dict) / sizeof(em07k_dict[0]);

// 1. Mảng chứa địa chỉ các bảng
mb_parameter_descriptor_t *all_dicts[] = {
    pm710_dict,
    em07k_dict};

// 2. Mảng chứa kích thước tương ứng
uint16_t all_dict_sizes[] = {
    pm710_dict_size,
    em07k_dict_size};

// 3. Tổng số lượng Dictionary đang có
const uint8_t total_dicts = sizeof(all_dicts) / sizeof(all_dicts[0]);