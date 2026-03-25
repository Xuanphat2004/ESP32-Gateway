#ifndef LCD_16X4_H
#define LCD_16X4_H

#include "driver/gpio.h"

// --- CẤU HÌNH CHÂN GPIO (Thay đổi theo ý bạn) ---
#define RS_1604_PIN GPIO_NUM_6
#define EN_1604_PIN GPIO_NUM_7
#define D4_1604_PIN GPIO_NUM_15
#define D5_1604_PIN GPIO_NUM_16
#define D6_1604_PIN GPIO_NUM_17
#define D7_1604_PIN GPIO_NUM_18

#define HIGH 1
#define LOW 0

// Bit mask
// ULL = Unsigned Long Long (64-bit)
#define LCD_PIN_MASK ((1ULL << RS_1604_PIN) | (1ULL << EN_1604_PIN) | (1ULL << D4_1604_PIN) | \
                      (1ULL << D5_1604_PIN) | (1ULL << D6_1604_PIN) | (1ULL << D7_1604_PIN))

void lcd_1604_init(void);
void lcd_send_command(uint8_t command);
void lcd_send_data(uint8_t data);
void LCD_Print(char *str);
void lcd_clear(void);
void LCD_SetCursor(uint8_t row, uint8_t col);
void LCD_PrintNumber(int32_t number);
void LCD_CursorBlink(void);
void LCD_DisableCursorBlink(void);

#endif