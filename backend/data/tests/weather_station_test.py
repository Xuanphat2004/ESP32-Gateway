from ..models.site import Site
from ..models.weather_station import Weather_station
import time
from django.utils import timezone
from datetime import datetime

def simulate_weather_station_updates(site_id, num_updates):
    last_weather = Weather_station.objects.order_by('-weather_station_id').first()
    if last_weather:
        id_start = last_weather.weather_station_id
    else:
        id_start = 0 
    for i in range(num_updates):
        new_poa = 100.0 + (i + 1) * 10
        new_ghi = 120.0 + (i + 1) * 10
        new_ambient_temp = 100.0 + (i + 1) * 10
        new_module_temp = 120.0 + (i + 1) * 10
        new_humidity = 50.0 + (i + 1) * 10
        id = id_start + i + 1
        Weather_station.objects.create(
            weather_station_id = id,
            site_id=site_id,
            weather_station_name="Weather Station A",
            state="Full Capability",
            poa=new_poa,
            ghi=new_ghi,
            ambient_temp=new_ambient_temp,
            module_temp=new_module_temp,
            humidity=new_humidity,
            wind_direction=202.22,
            wind_speed=0,
            rainfall=20.34,
            timestamp=timezone.now()
        )
        print(f"Created poa to {new_poa}")
        time.sleep(5)  # Đợi 5 giây giữa các cập nhật

    # Xóa bản ghi
    # Weather_station.objects.filter(site_id=site_id).delete()
    # print("Deleted weather station record")