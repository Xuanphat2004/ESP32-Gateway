#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "freertos/portmacro.h"
#include "freertos/task.h"
#include "freertos/portable.h"
#include "freertos/event_groups.h"
#include "esp_netif.h"
#include "esp_err.h"
#include "esp_log.h"
#include "esp_event.h"
#include "rom/ets_sys.h"
#include "esp_partition.h"
#include "esp_log.h"
#include "esp_heap_caps.h"
#include "esp_flash.h"
#include "esp_psram.h"
#include "nvs_view.h"

static const char *TAG = "FLASH_INFO";
void print_partition_table_info(void);
void check_spi_bus_mode(void);

void print_partition_table_info(void)
{
    ESP_LOGI(TAG, "--------------------------------------------------");
    ESP_LOGI(TAG, "        DANH SACH PHAN VUNG TRÊN CHIP FLASH       ");
    ESP_LOGI(TAG, "--------------------------------------------------");

    // Tìm iterator để duyệt qua toàn bộ phân vùng
    esp_partition_iterator_t it = esp_partition_find(ESP_PARTITION_TYPE_ANY,
                                                     ESP_PARTITION_SUBTYPE_ANY,
                                                     NULL);

    while (it != NULL)
    {
        const esp_partition_t *p = esp_partition_get(it);

        // Tính toán kích thước ra KB cho dễ đọc
        float size_kb = (float)p->size / 1024.0f;

        ESP_LOGI(TAG, "Vung: %-10s | Loai: 0x%02x | Sub: 0x%02x | Size: %7.2f KB | Offset: 0x%08x",
                 p->label, p->type, p->subtype, size_kb, (unsigned int)p->address);

        it = esp_partition_next(it);
    }

    ESP_LOGI(TAG, "--------------------------------------------------");
    esp_partition_iterator_release(it);
}

/**
 * @brief Hàm chẩn đoán đơn giản, không gây lỗi Linker.
 * Kiểm tra Flash và PSRAM để xác định trạng thái của các chân GPIO 33-37.
 */
void check_spi_bus_mode(void)
{
    printf("\n================ SYSTEM PIN & STORAGE DIAGNOSTIC ================\n");

    // 1. KIỂM TRA FLASH (Sử dụng API chuẩn v5.x)
    uint32_t flash_size;
    bool flash_is_octal = false;

    if (esp_flash_get_size(NULL, &flash_size) == ESP_OK)
    {
        printf("Physical Flash Size: %lu MB\n", (unsigned long)(flash_size / (1024 * 1024)));
    }

    esp_flash_t *chip = esp_flash_default_chip;
    if (chip != NULL)
    {
        printf("Flash Read Mode: ");
        // Kiểm tra xem có đang chạy chế độ 8-line (Octal) không
        if (chip->read_mode == SPI_FLASH_OPI_STR || chip->read_mode == SPI_FLASH_OPI_DTR)
        {
            printf("OCTAL SPI (8-line) !!!\n");
            flash_is_octal = true;
        }
        else
        {
            printf("QUAD/DUAL SPI (Standard)\n");
        }
    }

    // 2. KIỂM TRA PSRAM (Sử dụng Heap Caps - Không lo lỗi Linker)
    // Nếu tổng dung lượng RAM có thuộc tính SPIRAM > 0 nghĩa là có PSRAM đang chạy
    size_t psram_total = heap_caps_get_total_size(MALLOC_CAP_SPIRAM);
    bool psram_is_octal = false;

    if (psram_total > 0)
    {
        printf("PSRAM Detected: %lu bytes (~%lu MB)\n",
               (unsigned long)psram_total,
               (unsigned long)(psram_total / (1024 * 1024)));

// Kiểm tra cấu hình Octal PSRAM thông qua Macro cấu hình
#if CONFIG_SPIRAM_MODE_OCTAL
        printf("PSRAM Mode: OCTAL SPI (8-line) !!!\n");
        psram_is_octal = true;
#else
        printf("PSRAM Mode: QUAD SPI (4-line)\n");
#endif
    }
    else
    {
        printf("PSRAM: Not detected or not enabled in menuconfig.\n");
    }

    // 3. KẾT LUẬN CUỐI CÙNG
    if (flash_is_octal || psram_is_octal)
    {
        printf("\n[KET LUAN]: Chip cua em dang dung OCTAL SPI.\n");
        printf("==> TUYET DOI KHONG SU DUNG GPIO 33, 34, 35, 36, 37.\n");
    }
    else
    {
        printf("\n[KET LUAN]: Chip cua em dang chay QUAD/DUAL MODE.\n");
        printf("==> Em CO THE tan dung GPIO 33-37 cho cac muc dich khac.\n");
    }

    printf("=================================================================\n\n");
}