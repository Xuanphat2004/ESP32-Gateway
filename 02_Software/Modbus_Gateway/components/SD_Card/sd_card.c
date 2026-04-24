#include <stdio.h>
#include <string.h>
#include <sys/unistd.h>
#include <sys/stat.h>
#include "esp_vfs_fat.h"
#include "sdmmc_cmd.h"
#include "driver/spi_master.h"
#include "driver/sdspi_host.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "esp_log.h"

#include "modbus_tcp.h"
#include "modbus_rtu.h" // Chứa basic_dict
#include "rtc_mb.h"     // Chứa hàm rtc_read_time
#include "sd_card.h"

static const char *TAG = "[SD LOG]";

// Mutex để bảo vệ bus SPI2 và thẻ SD
SemaphoreHandle_t sd_mutex = NULL;
sdmmc_card_t *card; // Cấu trúc lưu thông tin thẻ SD theo lớp giao thức

// Các biến extern từ Modbus RTU Task
// Dùng final_data thay vì tcp_virtual_storage để task ghi log hoạt động
// độc lập với kết nối mạng - mất mạng vẫn ghi log bình thường
extern mb_parameter_descriptor_t *basic_dict;
extern float *final_data;
extern uint16_t register_count;
extern SemaphoreHandle_t xDataMutex;

//======================================================================
// HÀM KHỞI TẠO HOST SDSPI VÀ PROTOCOL LAYER
//======================================================================
void sd_card_init(void)
{
    esp_err_t ret;

    // Tạo Mutex bảo vệ SD Card
    sd_mutex = xSemaphoreCreateMutex();

    // Cấu hình FatFS
    esp_vfs_fat_sdmmc_mount_config_t mount_config = {
        .format_if_mount_failed = true, // Tự format FAT32 nếu thẻ chưa định dạng
        .max_files = 5,
        .allocation_unit_size = 2048 // Tối ưu cho project lưu log
    };

    ESP_LOGI(TAG, "Initializing SD card over SPI 2");

    // Cấu hình phần cứng Bus SPI 2
    spi_bus_config_t bus_cfg = {
        .mosi_io_num = MOSI_SD_PIN,
        .miso_io_num = MISO_SD_PIN,
        .sclk_io_num = CLK_SD_PIN,
        .quadwp_io_num = -1,
        .quadhd_io_num = -1,
        .max_transfer_sz = 4096,
    };
    ret = spi_bus_initialize(SPI2_HOST, &bus_cfg, SPI_DMA_CH_AUTO);
    if (ret != ESP_OK)
    {
        ESP_LOGE(TAG, "Failed to initialize SPI bus.");
        return;
    }

    // Khởi tạo SDSPI host
    sdspi_device_config_t slot_config = SDSPI_DEVICE_CONFIG_DEFAULT();
    slot_config.gpio_cs = CS_SD_PIN;
    slot_config.host_id = SPI2_HOST;

    sdmmc_host_t host = SDSPI_HOST_DEFAULT();

    // Mount thẻ nhớ (Gắn kết FatFS với lớp giao thức SDMMC)
    ret = esp_vfs_fat_sdspi_mount("/sdcard", &host, &slot_config, &mount_config, &card);
    if (ret != ESP_OK)
    {
        ESP_LOGE(TAG, "Failed to mount SD card VFS FAT");
        return;
    }

    // In thông tin thẻ ra terminal
    sdmmc_card_print_info(stdout, card);

    // Kiểm tra và tạo dòng Header cho file CSV nếu file chưa tồn tại
    struct stat st;
    if (stat("/sdcard/data_log.csv", &st) != 0)
    {
        FILE *f = fopen("/sdcard/data_log.csv", "w");
        if (f != NULL)
        {
            fprintf(f, "Timestamp,SlaveID,Parameter,Register,Value,Unit\n");
            fclose(f);
            ESP_LOGI(TAG, "Created new log file with headers.");
        }
    }
}

//======================================================================
// TASK GHI LOG (Chạy 3 phút 1 lần)
//======================================================================
void sd_card_logger_task(void *pvParameters)
{
    rtc_time_t now;

    // Ghi ngay lần đầu sau 10 giây để kiểm tra, sau đó mới 3 phút/lần
    TickType_t delay_ms = pdMS_TO_TICKS(10000);

    while (1)
    {
        vTaskDelay(delay_ms);
        delay_ms = pdMS_TO_TICKS(180000); // Từ lần 2 trở đi mới bắt đầu 3 phút ghi 1 lần

        // Kiểm tra dữ liệu đầu vào hợp lệ
        if (register_count == 0 || basic_dict == NULL || final_data == NULL)
        {
            ESP_LOGW(TAG, "Chưa có dữ liệu, bỏ qua lần ghi này.");
            continue;
        }

        float *temp_data = malloc(register_count * sizeof(float));
        if (temp_data == NULL)
        {
            ESP_LOGE(TAG, "No enough RAM for temp_data !!!");
            continue;
        }

        // Đọc RTC ngoài mutex để tránh giữ mutex lâu khi I2C/SPI bị block
        rtc_read_time(&now);

        // Chép dữ liệu ra buffer tạm có mutex bảo vệ
        if (xSemaphoreTake(xDataMutex, pdMS_TO_TICKS(500)) == pdTRUE)
        {
            // Kiểm tra lại con trỏ bên trong mutex để tránh race condition
            if (final_data == NULL)
            {
                ESP_LOGW(TAG, "final_data bị NULL trong mutex, bỏ qua.");
                xSemaphoreGive(xDataMutex);
                free(temp_data);
                continue;
            }
            memcpy(temp_data, final_data, register_count * sizeof(float));
            xSemaphoreGive(xDataMutex);
        }
        else
        {
            ESP_LOGW(TAG, "Không lấy được xDataMutex, bỏ qua.");
            free(temp_data);
            continue;
        }

        // Ghi xuống thẻ SD
        if (xSemaphoreTake(sd_mutex, pdMS_TO_TICKS(1000)) == pdTRUE)
        {
            FILE *f = fopen("/sdcard/data_log.csv", "a");
            if (f != NULL)
            {
                for (int i = 0; i < register_count; i++)
                {
                    // Copy chuỗi ra stack trước để tránh lỗi khi param_key/units trỏ vào PSRAM
                    char tmp_name[64] = {0};
                    char tmp_unit[16] = {0};
                    strncpy(tmp_name, basic_dict[i].param_key, sizeof(tmp_name) - 1);
                    strncpy(tmp_unit, basic_dict[i].param_units, sizeof(tmp_unit) - 1);

                    fprintf(f, "%02d/%02d/20%02d %02d:%02d:%02d,%d,%s,%d,%.2f,%s\n",
                            now.date, now.month, now.year,
                            now.hour, now.minute, now.second,
                            basic_dict[i].mb_slave_addr,
                            tmp_name,
                            basic_dict[i].mb_reg_start,
                            temp_data[i],
                            tmp_unit);
                }
                fclose(f);
                ESP_LOGI(TAG, "Successful to Write %d lines into SD Card.", register_count);
            }
            else
            {
                ESP_LOGE(TAG, "Can't open file data_log.csv to write !!!");
            }
            xSemaphoreGive(sd_mutex);
        }
        else
        {
            ESP_LOGW(TAG, "Can't take sd_mutex, pass.");
        }

        free(temp_data);
    }
}