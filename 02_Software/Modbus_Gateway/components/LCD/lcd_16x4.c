#include "lcd_16x4.h"
#include <stdio.h>
#include <string.h>
#include "driver/gpio.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "rom/ets_sys.h" // Library for ets_delay_us - hard delay function in microseconds
#include "freertos/queue.h"
#include "freertos/semphr.h"
#include "freertos/portmacro.h"
#include "freertos/task.h"
#include "freertos/portable.h"
#include "freertos/event_groups.h"

extern SemaphoreHandle_t xDataMutex;

// Send 4 bits to LCD
void lcd_send_nibble(uint8_t data)
{
    // esp_err_t gpio_set_level(gpio_num_t gpio_num, uint32_t level);
    gpio_set_level(D4_1604_PIN, (data >> 0) & 0x01);
    gpio_set_level(D5_1604_PIN, (data >> 1) & 0x01);
    gpio_set_level(D6_1604_PIN, (data >> 2) & 0x01);
    gpio_set_level(D7_1604_PIN, (data >> 3) & 0x01);
}

// enable lcd
void lcd_enable(void)
{
    gpio_set_level(EN_1604_PIN, HIGH);
    ets_delay_us(100); // Delay 100us
    gpio_set_level(EN_1604_PIN, LOW);
    ets_delay_us(100); // Delay 100us
}

// Command size is 8-bit, but we send 4-bit one time, so we need to send byte high before send byte low
void lcd_send_cmd(uint8_t command)
{
    gpio_set_level(RS_1604_PIN, LOW);
    lcd_send_nibble(command >> 4); // Send high byte
    lcd_enable();
    lcd_send_nibble(command & 0x0F); // Send low byte
    lcd_enable();
    ets_delay_us(100); // Delay 100us
}

// Data need to present on screen
void lcd_send_data(uint8_t data)
{
    gpio_set_level(RS_1604_PIN, HIGH);
    lcd_send_nibble(data >> 4); // Send high byte
    lcd_enable();
    lcd_send_nibble(data & 0x0F); // Send low byte
    lcd_enable();
    ets_delay_us(100); // Delay 100us
}

void lcd_1604_init(void)
{
    ets_delay_us(30000); // Delay 30ms
    // configure GPIO pins as output
    gpio_config_t io_conf = {
        .pin_bit_mask = LCD_PIN_MASK,
        .mode = GPIO_MODE_OUTPUT,
        .pull_up_en = GPIO_PULLUP_DISABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    gpio_config(&io_conf);

    lcd_send_nibble(0x03);
    lcd_enable();
    ets_delay_us(4500); // Delay 4.5ms

    lcd_send_nibble(0x03);
    lcd_enable();
    ets_delay_us(200);

    lcd_send_nibble(0x03);
    lcd_enable();

    // Convert to 4-bit mode
    lcd_send_nibble(0x02);
    lcd_enable();

    lcd_send_cmd(0x28); // 2 line mode, font 5x8
    lcd_send_cmd(0x0C); // Display ON, Cursor OFF
    lcd_send_cmd(0x06); // Tự tăng con trỏ
    lcd_send_cmd(0x01); // Display clear
    ets_delay_us(2000); // delay 2ms

    // Intro
    lcd_clear();
    LCD_SetCursor(1, 3);
    LCD_Print("Welcome to");
    LCD_SetCursor(2, 1);
    LCD_Print("Modbus Gateway");
    vTaskDelay(pdMS_TO_TICKS(2000));
    lcd_clear();
}

void LCD_SetCursor(uint8_t row, uint8_t col)
{
    uint8_t address;
    switch (row)
    {
    case 0:
        address = 0x00 + col;
        break; // Row 1
    case 1:
        address = 0x40 + col;
        break; // Row 2
    case 2:
        address = 0x10 + col;
        break; // Row 3
    case 3:
        address = 0x50 + col;
        break; // Row 4
    default:
        address = 0x00;
    }
    lcd_send_cmd(0x80 | address);
    ets_delay_us(50); // Delay 50us
}

void LCD_Print(char *str)
{
    while (*str)
    {
        lcd_send_data(*str++);
        ets_delay_us(50); // Delay 50us
    }
}

void lcd_clear(void)
{
    lcd_send_cmd(0x01);
    ets_delay_us(1700); // Delay 1.7ms
}

void LCD_PrintNumber(int32_t number)
{
    char buffer[12];
    sprintf(buffer, "%ld", number);
    LCD_Print(buffer);
}

void LCD_CursorBlink(void)
{
    lcd_send_cmd(0x0F);
    ets_delay_us(50); // Delay 100us
}

void LCD_DisableCursorBlink(void)
{
    lcd_send_cmd(0x0C);
    ets_delay_us(50); // Delay 100us
}
