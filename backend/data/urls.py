
from django.contrib import admin
from django.urls import path
from rest_framework.routers import DefaultRouter
from data.views.oldviews import SolarSystemDataViewSet ,chart_data_view, HourlyDataViewSet, average_data, inverter_ranking
from data.views import inverter, meter, weather_station, site

router = DefaultRouter()

router.register('solardb/latest',SolarSystemDataViewSet,basename='solardb_latest')
router.register('solardb/hourly',HourlyDataViewSet, basename='hourlydata')
urlpatterns = router.urls + [
    path('solardb/chart-data/', chart_data_view, name='chart-data'),
    path('solardb/avr-data/', average_data, name='avr-data' ),
    path('solardb/avt-ranking/', inverter_ranking, name='avt-ranking'),
    path('solardb/inverter-name-from-site/', inverter.get_inverter_name_from_site, name='inverter-name-from-site'),
    path('solardb/add-inverter/', inverter.add_inverter, name='add-inverter'),
    path('solardb/update-inverter-name/', inverter.update_inverter_name, name='update-inverter-name'),
    path('solardb/get-latest-inverter-record/', inverter.get_lastest_record, name='get-latest-inverter-record'),

    path('solardb/get-all-inverter-records/', inverter.get_all_inverter_records, name = 'get-all-inverter-records'),
    
    path('solardb/get-latest-meter-record/', meter.get_latest_record, name='get-latest-meter-record'),
    path('solardb/get-latest-meter-records/', meter.get_latest_records, name='get-latest-meter-records'),
    path('solardb/get-meter-registers/<int:meter_id>/', meter.get_meter_registers, name='get-meter-registers'),

    path('solardb/get-latest-weather-station-record/', weather_station.get_latest_record, name='get-latest-weather-station-record'),
    path('solardb/get-latest-weather-station-records/', weather_station.get_latest_records, name='get-latest-weather-station-records'),

    path('solardb/get-my-sites/', site.get_my_sites, name='get-my-sites'),
    path('solardb/add-site/', site.add_site, name='add-site'),
    path('solardb/delete-site/<int:site_id>/', site.delete_site, name='delete-site'),
    path('solardb/get-all-meters/', meter.get_all_meters, name='get-all-meters'),
]