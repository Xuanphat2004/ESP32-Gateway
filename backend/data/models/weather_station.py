from django.db import models
from django.utils import timezone
from .site import Site

class Weather_station(models.Model):
    weather_station_id = models.IntegerField(primary_key=True)
    site = models.ForeignKey(Site, on_delete=models.CASCADE) #định nghĩa rằng cột site trong bảng Weather_station là một Khóa Ngoại (Foreign Key), và nó sẽ liên kết đến Khóa Chính (Primary Key - PK) của bảng Site.
    weather_station_name = models.CharField(max_length=255)
    state = models.CharField(max_length=20)
    irradiation = models.DecimalField(max_digits=15, decimal_places=2, null = True, blank = True)
    poa = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    ghi = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    wind_speed = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    wind_direction = models.CharField(max_length=20, null = True, blank = True)
    humidity = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    rainfall = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    ambient_temp = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    module_temp = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'weather_station'
        # managed = False
