idf_component_register(
    SRCS "rtc.c" "i2c_config.c" "eeprom.c"           
    INCLUDE_DIRS "."        # Đường dẫn tới file .h 
    REQUIRES    freertos
                driver
)