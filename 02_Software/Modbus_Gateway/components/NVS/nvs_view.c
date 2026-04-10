#include <stdio.h>
#include "nvs_flash.h"
#include "nvs.h"
#include "esp_log.h"
#include "nvs_view.h"

static const char *TAG = "NVS_VIEWER";

void print_nvs_stats(const char *partition_label)
{
    nvs_stats_t nvs_stats;
    esp_err_t err = nvs_get_stats(partition_label, &nvs_stats);
    if (err == ESP_OK)
    {
        ESP_LOGI(TAG, "===== THỐNG KÊ PHÂN VÙNG: %s =====", partition_label ? partition_label : "nvs");
        ESP_LOGI(TAG, "Tổng số Entries: %d", nvs_stats.total_entries);
        ESP_LOGI(TAG, "Số Entries đã dùng: %d", nvs_stats.used_entries);
        ESP_LOGI(TAG, "Số Entries còn trống: %d", nvs_stats.free_entries);
        ESP_LOGI(TAG, "Số lượng Namespaces: %d", nvs_stats.namespace_count);
    }
    else
    {
        ESP_LOGE(TAG, "Lỗi khi lấy thống kê: %s", esp_err_to_name(err));
    }
}

void list_all_nvs_entries(const char *partition_label)
{
    ESP_LOGI(TAG, "Đang quét phân vùng [%s]...", partition_label ? partition_label : "nvs");

    nvs_iterator_t it = NULL;
    // v5.x yêu cầu 4 tham số: partition, namespace, type, và con trỏ nhận iterator
    esp_err_t res = nvs_entry_find(partition_label, NULL, NVS_TYPE_ANY, &it);

    if (res != ESP_OK)
    {
        if (res == ESP_ERR_NVS_NOT_FOUND)
        {
            ESP_LOGW(TAG, "Không tìm thấy dữ liệu nào trong phân vùng.");
        }
        else
        {
            ESP_LOGE(TAG, "Lỗi nvs_entry_find: %s", esp_err_to_name(res));
        }
        return;
    }

    printf("\n%-15s | %-15s | %-10s\n", "Namespace", "Key", "Type");
    printf("--------------------------------------------------\n");

    while (it != NULL)
    {
        nvs_entry_info_t info;
        nvs_entry_info(it, &info);

        printf("%-15s | %-15s | 0x%02x\n", info.namespace_name, info.key, (int)info.type);

        // v5.x: nvs_entry_next trả về esp_err_t và tự cập nhật biến 'it'
        res = nvs_entry_next(&it);
        if (res != ESP_OK && res != ESP_ERR_NVS_NOT_FOUND)
        {
            ESP_LOGE(TAG, "Lỗi khi chuyển entry: %s", esp_err_to_name(res));
            break;
        }
    }

    // Lưu ý: v5.x tự giải phóng iterator khi nvs_entry_next trả về ESP_ERR_NVS_NOT_FOUND
    // nhưng gọi nvs_release_iterator vẫn an toàn để tránh memory leak nếu ngắt vòng lặp sớm
    nvs_release_iterator(it);
    ESP_LOGI(TAG, "Kết thúc quét.");
}

void run_nvs_diagnostic()
{
    print_nvs_stats(NVS_DEFAULT_PART_NAME);
    list_all_nvs_entries(NVS_DEFAULT_PART_NAME);
}