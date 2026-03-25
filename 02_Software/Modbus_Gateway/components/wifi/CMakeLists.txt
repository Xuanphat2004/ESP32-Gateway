idf_component_register(
    SRCS "wifi.c"           # Tên file mã nguồn C của bạn
    INCLUDE_DIRS "."        # Đường dẫn tới file .h (Dấu "." nghĩa là nằm ngay tại thư mục hiện tại)
    REQUIRES    esp_wifi 
                esp_event 
                esp_netif 
                nvs_flash 
                freertos  # Các thư viện LÕI mà code wifi.c của bạn cần dùng
                EEPROM_and_RTC
                esp_http_server
)