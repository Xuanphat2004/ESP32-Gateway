idf_component_register(
    SRCS   "modbus_rtu.c" "change_baudrate.c" "scan_device.c" "change_poll.c" "modbus_tcp.c"
    INCLUDE_DIRS "."    "../esp-modbus/freemodbus/common" "../esp-modbus/freemodbus/modbus/include"   "../esp-modbus/freemodbus/port"
    REQUIRES    freertos
                driver
                esp-modbus
                log
                EEPROM_and_RTC
                LCD
                esp_netif
                nvs_flash
                json
                lwip
                main
)