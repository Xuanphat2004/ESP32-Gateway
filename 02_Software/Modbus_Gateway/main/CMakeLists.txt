idf_component_register(SRCS "main.c" 
                    INCLUDE_DIRS "."
                    REQUIRES    wifi 
                                BLE
                                Ethernet 
                                Modbus
                                EEPROM_and_RTC
                                LCD   
                                NVS   
                                spi_flash
                                esp_psram  
                                User_Interface                 
                    )
