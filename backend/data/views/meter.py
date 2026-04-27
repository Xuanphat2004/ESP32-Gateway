# views/meter.py

from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from datetime import timedelta
from django.http import JsonResponse
# Chỉ import 1 lần, lấy cả Meter lẫn MeterRegister từ cùng 1 chỗ
from data.models import Meter, MeterRegister


# Lấy 1 record duy nhất của 1 meter cụ thể theo tên
@csrf_exempt  # ← decorator phải đặt NGAY trên def
def get_latest_record(request):
    site_id    = request.GET.get('site_id')
    meter_name = request.GET.get('meter_name')

    record = (
        Meter.objects
        .filter(site_id=site_id, meter_name=meter_name)
        .order_by('-timestamp')
        .first()
    )

    if record:
        return JsonResponse({
            "site_id":           record.site_id_id,
            "meter_name":        record.meter_name,
            "device_model":      record.device_model,
            "meter_id":          record.meter_id,
            "attribute":         record.attribute,
            "status":            record.status,
            "voltage_l1":        float(record.voltage_l1)        if record.voltage_l1        else 0,
            "current_l1":        float(record.current_l1)        if record.current_l1        else 0,
            "current_l1_dmd":    float(record.current_l1_dmd)    if record.current_l1_dmd    else 0,
            "frequency_l1":      float(record.frequency_l1)      if record.frequency_l1      else 0,
            "apparent_power_l1": float(record.apparent_power_l1) if record.apparent_power_l1 else 0,
            "real_power":        float(record.real_power)         if record.real_power        else 0,
        })
    else:
        return JsonResponse({"error": "No record found"}, status=404)


# Hàm tiện ích tính ngày 30 ngày trước — giữ nguyên, không đụng vào
def get_time_last_month(request):
    today     = timezone.now().date()
    start_day = today - timedelta(days=30)
    return start_day


# Lấy tất cả meter của 1 site — mỗi meter 1 dòng (giá trị mới nhất)
@csrf_exempt
def get_latest_records(request):
    site_id = request.GET.get("site_id")
    if not site_id:
        return JsonResponse({"error": "site_id isn't exist !!!"}, status=400)

    # Query thẳng — không cần annotate Max vì mqtt_worker dùng update_or_create
    # → bảng Meter luôn chỉ có đúng 1 dòng/thiết bị, đã là mới nhất rồi
    meters = Meter.objects.filter(site_id=site_id)

    result = []
    for m in meters:
        result.append({
            "site_id":           m.site_id_id,
            "meter_name":        m.meter_name,
            "device_model":      m.device_model,
            "meter_id":          m.meter_id,
            "attribute":         m.attribute,
            "status":            m.status,
            "voltage_l1":        float(m.voltage_l1)        if m.voltage_l1        else 0,
            "current_l1":        float(m.current_l1)        if m.current_l1        else 0,
            "current_l1_dmd":    float(m.current_l1_dmd)    if m.current_l1_dmd    else 0,
            "frequency_l1":      float(m.frequency_l1)      if m.frequency_l1      else 0,
            "apparent_power_l1": float(m.apparent_power_l1) if m.apparent_power_l1 else 0,
            "real_power":        float(m.real_power)         if m.real_power        else 0,
          
            "timestamp":         m.timestamp.strftime('%Y-%m-%d %H:%M:%S') if m.timestamp else "--",
        })

    return JsonResponse(result, safe=False)


# Lấy toàn bộ thanh ghi của 1 meter cụ thể — dùng khi click vào dòng
@csrf_exempt
def get_meter_registers(request, meter_id):
    # Lọc theo meter_id, mới nhất lên đầu, trong cùng batch thì theo thứ tự địa chỉ Modbus
    registers = (
        MeterRegister.objects
        .filter(meter_id=meter_id)
        .order_by('-received_at', 'register_address')
    )

    result = []
    for reg in registers:
        result.append({
            "timestamp":      reg.received_at.strftime('%Y-%m-%d %H:%M:%S'),
            "parameter_name": reg.register_name,
            "register":       reg.register_address if reg.register_address is not None else "--",
            "value":          float(reg.value) if reg.value is not None else "--",
            "unit":           reg.unit if reg.unit else "--",
        })

    return JsonResponse(result, safe=False)