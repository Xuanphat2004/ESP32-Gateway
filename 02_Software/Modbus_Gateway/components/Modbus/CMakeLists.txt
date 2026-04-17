idf_component_register(
    SRCS  "modbus_tcp.c" "modbus_rtu.c" "modbus_tcp.c" "change_baudrate.c"
    INCLUDE_DIRS "."    "../esp-modbus/freemodbus/common" "../esp-modbus/freemodbus/modbus/include"   "../esp-modbus/freemodbus/port" # Đường dẫn tới file .h 
    REQUIRES    freertos
                driver
                esp-modbus
                log 
                EEPROM_and_RTC
                esp_netif
                main
)