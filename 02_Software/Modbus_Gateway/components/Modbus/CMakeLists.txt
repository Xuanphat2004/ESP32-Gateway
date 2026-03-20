idf_component_register(
    SRCS "pm710_dictionary.c" "modbus_rtu.c"           
    INCLUDE_DIRS "."        # Đường dẫn tới file .h 
    REQUIRES    freertos
                driver
                esp-modbus
                log 
)