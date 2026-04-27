from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from django.db.models import Max, Sum
from datetime import timedelta
from .models import Inverter, Meter, Weather_station
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
import json

channel_layer = get_channel_layer()

YESTERDAY_CACHE = {}
CACHE_TTL_DAYS = 7  # giữ lại tối đa 7 ngày cache

# Dọn dẹp bộ nhớ tạm — xoá những dữ liệu cache cũ hơn 7 ngày để tránh bộ nhớ bị đầy.
def cleanup_cache(today):
    """Xoá cache cũ hơn CACHE_TTL_DAYS ngày"""
    keys_to_delete = []
    for (site_id, y_date) in YESTERDAY_CACHE.keys():
        if (today - y_date).days > CACHE_TTL_DAYS:
            keys_to_delete.append((site_id, y_date))
    for k in keys_to_delete:
        del YESTERDAY_CACHE[k]

def get_yesterday_last_prod(site_id, today):
    yesterday = today - timedelta(days=1)
    cache_key = (site_id, yesterday)

    # Xoá cache cũ trước khi xử lý
    cleanup_cache(today)

    # Nếu đã có cache thì trả về luôn
    if cache_key in YESTERDAY_CACHE:
        return YESTERDAY_CACHE[cache_key]

    # Query hôm qua
    yesterday_records = (
        Inverter.objects.filter(
            site_id=site_id,
            timestamp__date=yesterday
        )
        .order_by("inverter_name", "-timestamp")
    )

    yesterday_last_prod = {}
    for record in yesterday_records:
        if record.inverter_name not in yesterday_last_prod:
            yesterday_last_prod[record.inverter_name] = record.production

    # Lưu cache
    YESTERDAY_CACHE[cache_key] = yesterday_last_prod
    return yesterday_last_prod

@receiver(post_save, sender=Inverter)
def send_inverter_update(sender, instance, created, **kwargs):
    # Kiểm tra chỉ update khi các field cần thiết thay đổi
    update_fields = kwargs.get("update_fields")
    if update_fields and not any(field in update_fields for field in ["active_power", "input_power", "production", "internal_temp"]):
        return

    site_id = instance.site_id
    group_name = f"inverter_{site_id}"

    # Lấy dữ liệu mới nhất của site_id
    today = timezone.now().date()
    yesterday_last_prod = get_yesterday_last_prod(site_id, today)
    today_records = Inverter.objects.filter(
        site_id=site_id,
        timestamp__date=today
    )

    grouped = today_records.values("inverter_name").annotate(
        latest_time=Max("timestamp"),
    )

    result = []
    for g in grouped:
        latest_record = today_records.filter(
            inverter_name=g["inverter_name"],
            timestamp=g["latest_time"]
        ).first()

        efficiency = (
            round((latest_record.active_power / latest_record.input_power) * 100, 2)
            if latest_record and latest_record.active_power and latest_record.input_power not in (None, 0)
            else None
        )

        production_yesterday = yesterday_last_prod.get(latest_record.inverter_name, 0)
        production_today = latest_record.production - production_yesterday

        if latest_record:
            result.append({
                "site_id": latest_record.site_id_id,
                "inverter_name": latest_record.inverter_name,
                "system_diagram": latest_record.system_diagram,
                "state": latest_record.state,
                "active_power": float(latest_record.active_power) if latest_record.active_power is not None else "--",
                "input_power": float(latest_record.input_power) if latest_record.input_power is not None else "--",
                "efficiency": float(efficiency) if efficiency is not None else "--",
                "production_today": float(production_today),
                "internal_temp": float(latest_record.internal_temp) if latest_record.internal_temp is not None else "--",
            })

    # Gửi qua channel layer
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "inverter_update",  # map với hàm trong consumer
            "message": result
        }
    )


#=====================================================================================================================================
#======================================================== METER ======================================================================
#=====================================================================================================================================
# @receiver(post_save, sender=Inverter) có nghĩa là: "Mỗi khi có dữ liệu Inverter được lưu vào DB thì chạy hàm này"
@receiver(post_save, sender=Meter) 
def send_meter_update(sender, instance, created, **kwargs):
    # Kiểm tra chỉ update khi các field cần thiết thay đổi
    update_fields = kwargs.get("update_fields")
    if update_fields and not any(field in update_fields for field in ["voltage_l1", "current_l1", "real_power", "status"]): # trigger khi co su thay doi => cap nhat data len web
        return

    site_id = instance.site_id.pk
    group_name = f"meter_{site_id}"
 
    # Lấy dữ liệu mới nhất của site_id
    today = timezone.now().date()
    today_records = Meter.objects.filter(
        site_id=site_id,
        timestamp__date=today
    )

    grouped = today_records.values("meter_name").annotate(
        latest_time=Max("timestamp"),
    )

    result = []
    for g in grouped:
        latest_record = today_records.filter(
            meter_name=g["meter_name"],
            timestamp=g["latest_time"]
        ).first()

        if latest_record:
            result.append({
                # thanh phan dinh danh thiet bi
                "site_id": latest_record.site_id_id,
                "meter_name": latest_record.meter_name,
                "meter_id": latest_record.meter_id,
                "device_model": latest_record.device_model, # vd: EM-07k
                "attribute": latest_record.attribute,
                "status": latest_record.status,

                # Cac du lieu chinh trong bang
                "voltage_l1": float(latest_record.voltage_l1) if latest_record.voltage_l1 else 0,
                "current_l1": float(latest_record.current_l1) if latest_record.current_l1 else 0,
                "current_l1_dmd": float(latest_record.current_l1_dmd) if latest_record.current_l1_dmd else 0,
                "frequency_l1": float(latest_record.frequency_l1) if latest_record.frequency_l1 else 0,
                "apparent_power_l1": float(latest_record.apparent_power_l1) if latest_record.apparent_power_l1 else 0,
                "real_power": float(latest_record.real_power) if latest_record.real_power else 0,

                # cap nhat thoi gian
                "timestamp": latest_record.timestamp.strftime('%Y-%m-%d %H:%M:%S') if latest_record.timestamp else "--",

            })

    # Gửi qua channel layer
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "meter_update",  # map với hàm trong consumer
            "message": result
        }
    )
#=============================================================================================================================

@receiver(post_save, sender=Weather_station)
def send_weather_station_update(sender, instance, created, **kwargs):
    # Kiểm tra chỉ update khi các field cần thiết thay đổi
    update_fields = kwargs.get("update_fields")
    if update_fields and not any(field in update_fields for field in 
                                ["poa", "ghi", "ambient_temp", "module_temp",
                                "humidity", "wind_direction", "wind_speed", "rainfall"]):
        return

    site_id = instance.site_id
    group_name = f"weather_station_{site_id}"
 
    # Lấy dữ liệu mới nhất của site_id
    today = timezone.now().date()
    today_records = Weather_station.objects.filter(
        site_id=site_id,
        timestamp__date=today
    )

    grouped = today_records.values("weather_station_name").annotate(
        latest_time=Max("timestamp"),
    )

    result = []
    for g in grouped:
        latest_record = today_records.filter(
            weather_station_name=g["weather_station_name"],
            timestamp=g["latest_time"]
        ).first()

        if latest_record:
            result.append({
                "site_id": latest_record.site_id,
                "weather_station_name": latest_record.weather_station_name,
                "state": latest_record.state,
                "poa": float(latest_record.poa),
                "ghi": float(latest_record.ghi),
                "ambient_temp": float(latest_record.ambient_temp),
                "module_temp": float(latest_record.module_temp),
                "humidity": float(latest_record.humidity),
                "wind_direction": float(latest_record.wind_direction),
                "wind_speed": float(latest_record.wind_speed),
                "rainfall": float(latest_record.rainfall) if latest_record.rainfall is not None else "--",
            })

    # Gửi qua channel layer
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            "type": "weather_station_update",  # map với hàm trong consumer
            "message": result
        }
    )