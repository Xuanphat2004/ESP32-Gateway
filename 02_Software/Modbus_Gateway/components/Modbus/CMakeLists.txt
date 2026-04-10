idf_component_register(
    SRCS  "modbus_tcp.c" "pm710_dictionary.c" "modbus_rtu.c" "modbus_tcp.c"    
    INCLUDE_DIRS "."        # Đường dẫn tới file .h 
    REQUIRES    freertos
                driver
                esp-modbus
                log 
                EEPROM_and_RTC
                esp_netif
                main
)