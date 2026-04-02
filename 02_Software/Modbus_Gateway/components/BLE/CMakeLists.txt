idf_component_register(SRCS "ble.c" 
                       INCLUDE_DIRS "."
                       REQUIRES 
                                esp_netif 
                                driver 
                                nvs_flash      
                                esp_hw_support 
                                esp_event
                                bt
                                )