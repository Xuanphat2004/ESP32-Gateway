#include <string.h>
#include "esp_log.h"
#include "esp_heap_caps.h"
#include "offline_buffer.h"

static const char *TAG = "[OFFLINE BUF]";

record_t *offline_buf = NULL;
int offline_buf_count = 0;

void offline_buf_init(void)
{
    offline_buf = heap_caps_malloc(OFFLINE_BUF_SIZE * sizeof(record_t), MALLOC_CAP_SPIRAM);
    if (offline_buf == NULL)
    {
        ESP_LOGE(TAG, "Khong cap phat duoc PSRAM!");
        return;
    }
    offline_buf_count = 0;
    ESP_LOGI(TAG, "Offline buffer OK: %d records, %.1f KB PSRAM",
             OFFLINE_BUF_SIZE, (OFFLINE_BUF_SIZE * sizeof(record_t)) / 1024.0f);
}

void offline_buf_push(float *data, uint16_t count, char *timestamp)
{
    if (offline_buf == NULL || data == NULL || timestamp == NULL)
        return;

    if (offline_buf_count >= OFFLINE_BUF_SIZE)
    {
        ESP_LOGW(TAG, "Buffer day, bo qua record moi");
        return;
    }

    record_t *r = &offline_buf[offline_buf_count];
    strncpy(r->timestamp, timestamp, sizeof(r->timestamp) - 1);
    r->timestamp[sizeof(r->timestamp) - 1] = '\0';
    r->reg_count = count;
    r->is_sent = false;
    memcpy(r->values, data, count * sizeof(float));
    offline_buf_count++;
}

void offline_buf_clear(void)
{
    offline_buf_count = 0;
}