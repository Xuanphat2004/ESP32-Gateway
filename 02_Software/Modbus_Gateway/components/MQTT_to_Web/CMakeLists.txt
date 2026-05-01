idf_component_register(SRCS "mqtt_to_web.c" "mqtt_to_web" 
                    INCLUDE_DIRS "."
                    REQUIRES    
                                Modbus
                                esp-modbus
                                mqtt               # BẮT BUỘC để dùng được esp_mqtt_client
                                json               # BẮT BUỘC để dùng được cJSON
                                esp_event          # Để xử lý các sự kiện hệ thống
                                esp_netif          # Để quản lý giao diện mạng (WiFi/Ethernet)
                                nvs_flash
                                efuse                        
                    )
