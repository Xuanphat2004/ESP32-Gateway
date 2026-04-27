# from django.contrib.auth.models import User
from ..models.site import Site
from ..models.meter import Meter
import time
from django.utils import timezone
from datetime import datetime

def simulate_meter_updates(site_id, num_updates):
    last_meter = Meter.objects.order_by('-meter_id').first()
    if last_meter:
        id_start = last_meter.meter_id
    else:
        id_start = 0 
   
    print(f"Bắt đầu từ ID: {id_start + 1}")
    for i in range(num_updates):
        new_active_generated = 100.0 + (i + 1) * 10
        new_active_consumed = 120.0 + (i + 1) * 10
        new_reactive_generated = 100.0 + (i + 1) * 10
        new_reactive_consumed = 120.0 + (i + 1) * 10
        new_production = 50.0 + (i + 1) * 10
        id = id_start + i + 1
        Meter.objects.create(
            meter_id = id,
            site_id=site_id,
            meter_name="Meter A",
            type="Energy Meter",
            attribute="Main Meter",
            state="Night State",
            active_generated=new_active_generated,
            active_consumed=new_active_consumed,
            reactive_generated = new_reactive_generated,
            reactive_consumed=new_reactive_consumed,
            production=new_production,
            timestamp=timezone.now()
        )
        print(f"Created active_generated to {new_active_generated}")
        time.sleep(2)  # Đợi 5 giây giữa các cập nhật

    # Xóa bản ghi
    # Meter.objects.filter(site_id=site_id).delete()
    # print("Deleted Meter record")