idf_component_register(SRCS "ethernet.c" 
                       INCLUDE_DIRS "."
                       REQUIRES esp_eth 
                                esp_netif 
                                driver 
                                nvs_flash      # Thêm để dùng nvs [cite: 2]
                                esp_hw_support # Thêm để dùng esp_read_mac
                                esp_event
                                EEPROM_and_RTC
                                mqtt
                                main
                                )