idf_component_register(
    SRCS "lcd_16x4.c"  "lcd_user.c"  
    INCLUDE_DIRS "."        # Đường dẫn tới file .h 
    REQUIRES    freertos
                driver
                esp-modbus
                log 
                Modbus
                User_Interface
                EEPROM_and_RTC
)