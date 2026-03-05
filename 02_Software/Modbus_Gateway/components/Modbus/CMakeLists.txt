idf_component_register(
    SRCS "pm710_dictionary.c" "modbus_rtu.c"           # Tên file mã nguồn C của bạn
    INCLUDE_DIRS "."        # Đường dẫn tới file .h (Dấu "." nghĩa là nằm ngay tại thư mục hiện tại)
    REQUIRES    freertos
                driver
                esp-modbus
                log 
)