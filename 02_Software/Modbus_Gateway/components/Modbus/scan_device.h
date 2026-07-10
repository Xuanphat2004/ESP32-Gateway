#ifndef SCAN_DEVICE_H
#define SCAN_DEVICE_H

#include <stdint.h>
#include <stdbool.h>

#define CHECK_SLAVE_ID 245

// ============================================================
// Vùng nhớ để lưu phản hồi từ slave giả
typedef struct
{
    float value_a;
    float value_b;
    float value_c;
} data_check_t;
// ============================================================
// Lưu danh sách ID online sau khi scan từng port
typedef struct
{
    uint8_t id[248]; // Lưu các ID có phản hồi (Modbus ID từ 1 đến 247)
    int count;       // Tổng số lượng ID đã phản hồi
} id_scan_result_t;

// ============================================================
// Lưu kết quả phân tích sau khi scan xong cả 2 port
typedef struct
{
    uint8_t lose_list[248]; // Danh sách ID không có phản hồi ở cả 2 port
    int lose_count;         // Số lượng ID bị mất hoàn toàn
    int final_id_p1;        // Index vị trí của id đó trong original_id[] , nếu không thấy gì thì là -1
    int final_id_p2;        // Nếu không thấy gì thì là index cuối cùng của original_id[]
    uint8_t active_port;    // Kết quả Port được chọn làm Master
} scan_analysis_t;

extern id_scan_result_t list_p1;     // Kết quả scan Port 1
extern id_scan_result_t list_p2;     // Kết quả scan Port 2
extern uint8_t original_id[248];     // Danh sách ID gốc từ NVS
extern uint8_t original_id_count;    // Số lượng ID gốc
extern scan_analysis_t scan_result;  // Kết quả sau khi scan
extern volatile bool is_scan_device; // Cờ báo đang scan
extern bool wire_p1_ok;
extern bool wire_p2_ok;
extern bool scan_done;
extern bool needs_rescan;

void scan_device(void);
void get_active_list(void);
void get_inactive_list(void);
void analyse_scan_result(void);
void passive_scan_task(void *arg);
void auto_rescan_task(void *arg);

#endif // SCAN_DEVICE_H