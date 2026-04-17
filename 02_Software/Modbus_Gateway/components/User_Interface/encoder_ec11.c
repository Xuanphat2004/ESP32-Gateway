#include "encoder_ec11.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "[MODBUS GATEWAY - ENCODER]";

pcnt_unit_handle_t pcnt_unit = NULL;

void init_pcnt_encoder(void)
{
    // Bật pull-up nội để đảm bảo tín hiệu dứt khoát ở trạng thái nghỉ (High)
    gpio_pullup_en(A_PIN);
    gpio_pullup_en(B_PIN);

    // 1. Cấu hình Unit
    pcnt_unit_config_t unit_config = {
        .high_limit = HIGH_LIMIT,
        .low_limit = LOW_LIMIT,
    };
    ESP_ERROR_CHECK(pcnt_new_unit(&unit_config, &pcnt_unit));

    // 2. Cấu hình Filter (Chống rung phần cứng)
    pcnt_glitch_filter_config_t filter_config = {
        .max_glitch_ns = MAX_GLITCH_NS,
    };
    ESP_ERROR_CHECK(pcnt_unit_set_glitch_filter(pcnt_unit, &filter_config));

    // 3. Khởi tạo Kênh 0 (Chế độ x1)
    // Chân A làm nguồn xung (Signal), chân B làm điều hướng (Control)
    pcnt_chan_config_t chan_config = {
        .edge_gpio_num = A_PIN,
        .level_gpio_num = B_PIN,
    };
    pcnt_channel_handle_t pcnt_chan = NULL;
    ESP_ERROR_CHECK(pcnt_new_channel(pcnt_unit, &chan_config, &pcnt_chan));

    /**
     * @brief CHẾ ĐỘ x1: "Vặn 1 nấc tăng 1 đơn vị"
     * Lệnh gốc: Chỉ cạnh lên (Pos) thì INCREASE, cạnh xuống (Neg) thì HOLD.
     */
    ESP_ERROR_CHECK(pcnt_channel_set_edge_action(pcnt_chan,
                                                 PCNT_CHANNEL_EDGE_ACTION_INCREASE,
                                                 PCNT_CHANNEL_EDGE_ACTION_HOLD));

    /**
     * @brief ĐIỀU HƯỚNG:
     * Nếu xoay thuận: A lên khi B thấp (Low) -> Luật KEEP (Cộng 1)
     * Nếu xoay nghịch: A lên khi B cao (High) -> Luật INVERSE (Đảo cộng thành trừ -> Trừ 1)
     */
    ESP_ERROR_CHECK(pcnt_channel_set_level_action(pcnt_chan,
                                                  PCNT_CHANNEL_LEVEL_ACTION_INVERSE,
                                                  PCNT_CHANNEL_LEVEL_ACTION_KEEP));

    // 4. Kích hoạt và chạy
    ESP_ERROR_CHECK(pcnt_unit_enable(pcnt_unit));
    ESP_ERROR_CHECK(pcnt_unit_clear_count(pcnt_unit));
    ESP_ERROR_CHECK(pcnt_unit_start(pcnt_unit));

    // ESP_LOGI(TAG, "Khoi tao PCNT che do x1 (1 click = 1 unit) thanh cong");
}

void encoder_check_task(void *arg)
{
    int current_pulse = 0;
    int last_pulse = 0;

    vTaskDelay(pdMS_TO_TICKS(500));
    ESP_LOGI(TAG, "Bat dau kiem tra Encoder...");

    while (1)
    {
        // Đọc giá trị thanh ghi
        ESP_ERROR_CHECK(pcnt_unit_get_count(pcnt_unit, &current_pulse));

        // Chỉ in khi có sự thay đổi
        if (current_pulse != last_pulse)
        {
            ESP_LOGI(TAG, "Gia tri moi: %d", current_pulse);
            last_pulse = current_pulse;
        }

        vTaskDelay(pdMS_TO_TICKS(50)); // Tần suất quét 20Hz là đủ cho Menu LCD
    }
}