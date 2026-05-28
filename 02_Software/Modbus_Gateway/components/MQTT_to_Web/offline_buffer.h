#ifndef OFFLINE_BUFFER_H
#define OFFLINE_BUFFER_H

#include <stdint.h>
#include <stdbool.h>

#define OFFLINE_MAX_REGISTERS 350
#define OFFLINE_BUF_SIZE 300
#define OFFLINE_FLUSH_THRESHOLD 280

typedef struct
{
    char timestamp[32];
    float values[OFFLINE_MAX_REGISTERS];
    uint16_t reg_count;
    bool is_sent;
} record_t;

extern record_t *offline_buf;
extern int offline_buf_count;

void offline_buf_init(void);
void offline_buf_push(float *data, uint16_t count, char *timestamp);
void offline_buf_clear(void);

#endif