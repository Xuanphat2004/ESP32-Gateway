idf_component_register(SRCS "ethernet.c" "eth_w5500.c"
                       INCLUDE_DIRS "."
                       REQUIRES esp_eth 
                                esp_netif 
                                driver 
                                log
                                )