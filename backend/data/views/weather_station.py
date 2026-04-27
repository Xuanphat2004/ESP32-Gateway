from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.db.models import Max
from ..models.weather_station import Weather_station
from django.http import JsonResponse
import json

@csrf_exempt # decorator, bo qua co che bao ve cua trong frame Django, mac dinh khi tao ham trong du an Django co che bao ve se bat, decorator se giup bo qua co che bao ve do.
def get_latest_record(request):
    site_id = request.GET.get('site_id')
    weather_station_name = request.GET.get('weather_station_name')

    record = (
        Weather_station.objects
        .filter(site_id=site_id, weather_station_name=weather_station_name)
        .order_by('-timestamp')
        .first()
    )

    if record:
        return JsonResponse({
            "site_id": record.site_id,
            "weather_station_name": record.weather_station_name,
            "state": record.state,
            "poa": record.poa,
            "ghi": record.ghi,
            "wind_speed": record.wind_speed,
            "wind_direction": record.wind_direction,
            "humidity": record.humidity,
            "rainfall": record.rainfall,
            "ambient_temp": record.ambient_temp,
            "module_temp": record.module_temp,
        })
    else:
        return JsonResponse({"error": "No record found"}, status=404)
    
def get_latest_records(request):
    site_id = request.GET.get("site_id")
    if not site_id:
        return JsonResponse({"error": "site_id isn't exist !!!"}, status=400)

    # Sử dụng ngày hôm nay để lấy đồng thời tổng production trong ngày và record mới nhất.
    today = timezone.now().date()
    today_records = Weather_station.objects.filter(
        site_id = site_id
        # timestamp__date=today
    )

    # Query để lấy latest timestamp
    grouped = today_records.values("weather_station_name").annotate(
        latest_time=Max("timestamp"),
    )

    result = []
    for g in grouped:
        # Lấy record mới nhất khớp weather_station_name và latest_time
        latest_record = today_records.filter(
            weather_station_name=g["weather_station_name"],
            timestamp=g["latest_time"]
        ).first()

        if latest_record:
            result.append({
                "site_id": latest_record.site_id,
                "weather_station_name": latest_record.weather_station_name,
                "state": latest_record.state,
                "poa": latest_record.poa,
                "ghi": latest_record.ghi,
                "ambient_temp": latest_record.ambient_temp,
                "module_temp": latest_record.module_temp,
                "humidity": latest_record.humidity,
                "wind_direction": latest_record.wind_direction,
                "wind_speed": latest_record.wind_speed,
                "rainfall": latest_record.rainfall,
            })

    return JsonResponse(result, safe=False)