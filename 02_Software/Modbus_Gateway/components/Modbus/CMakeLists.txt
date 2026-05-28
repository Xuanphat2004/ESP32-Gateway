idf_component_register(
    SRCS   "modbus_rtu.c" "change_baudrate.c" "scan_device.c" "change_poll.c"
    INCLUDE_DIRS "."    "../esp-modbus/freemodbus/common" "../esp-modbus/freemodbus/modbus/include"   "../esp-modbus/freemodbus/port" # Đường dẫn tới file .h 
    REQUIRES    freertos
                driver
                esp-modbus
                log 
                EEPROM_and_RTC
                LCD
                esp_netif
                main
)