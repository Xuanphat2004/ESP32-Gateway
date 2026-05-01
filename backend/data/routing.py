from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/dashboard/$', consumers.NotificationConsumer.as_asgi()),

    re_path(r"ws/inverter/(?P<site_id>[0-9]+)/$", consumers.InverterConsumer.as_asgi()),

    re_path(r"ws/meter/(?P<site_id>[0-9]+)/$", consumers.MeterConsumer.as_asgi()),
    re_path(r"ws/meter_register/(?P<meter_id>[0-9]+)/$",consumers.MeterRegisterConsumer.as_asgi()), # Consumer riêng cho bảng chi tiết, mỗi meter có group riêng
    re_path(r"ws/all_meters/$", consumers.AllMetersConsumer.as_asgi()),
    
    re_path(r"ws/weather_station/(?P<site_id>[0-9]+)/$", consumers.WeatherStationConsumer.as_asgi()),
]