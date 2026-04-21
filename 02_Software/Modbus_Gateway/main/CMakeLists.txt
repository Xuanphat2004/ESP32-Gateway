idf_component_register(SRCS "main.c" 
                    INCLUDE_DIRS "."
                    REQUIRES    wifi 
                                BLE
                                Ethernet 
                                Modbus
                                EEPROM_and_RTC
                                LCD   
                                   
                                spi_flash
                                esp_psram  
                                User_Interface       
                                MQTT_to_Web          
                    )
