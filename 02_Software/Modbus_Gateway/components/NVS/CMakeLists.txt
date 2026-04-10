idf_component_register(
    SRCS "nvs_view.c"           # Tên file mã nguồn C của bạn
    INCLUDE_DIRS "."        # Đường dẫn tới file .h (Dấu "." nghĩa là nằm ngay tại thư mục hiện tại)
    REQUIRES    esp_wifi 
                esp_event 
                esp_netif 
                nvs_flash 
                freertos  
                EEPROM_and_RTC
                Modbus
                main
)