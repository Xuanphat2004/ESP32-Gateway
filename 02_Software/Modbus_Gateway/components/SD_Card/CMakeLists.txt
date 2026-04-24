idf_component_register(
    SRCS  
         "sd_card.c"  
    INCLUDE_DIRS "."
    REQUIRES freertos 
             driver 
             esp_timer 
             nvs_flash
             # --- Các thư viện thêm vào cho SD Card ---
             fatfs               # Thư viện hệ thống file FAT32
             sdmmc               # Lớp giao thức SD (Protocol Layer)
             esp_driver_sdspi    # Lớp máy chủ SPI cho thẻ SD (Host Layer)
             EEPROM_and_RTC
             main
             Modbus
)