# views/meter.py
from django.http import JsonResponse
from django.utils import timezone
from django.utils.timezone import localtime
from datetime import timedelta
from data.models import Meter, MeterRegister, Site

from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated


# ── Helper: format timestamp giữ đúng timezone thiết bị ─────────────────────
# KHÔNG dùng localtime() vì phụ thuộc vào timezone của server
# received_at đã lưu device_ts (+07:00) → trả về ISO string để frontend formatTs xử lý
def fmt_ts(dt):
    """
    Trả về ISO 8601 string với timezone offset gốc từ thiết bị.
    Frontend formatTs() sẽ parse đúng bất kể server chạy ở timezone nào.
    VD: "2026-05-28T15:36:23+07:00"
    """
    if dt is None:
        return "--"
    try:
        # astimezone() giữ nguyên thời điểm tuyệt đối, chuyển về local offset của dt
        # Nếu dt đã có tz info (+07:00) → giữ nguyên
        # Nếu dt là UTC (naive hoặc UTC-aware) → convert đúng
        return dt.isoformat()
    except Exception:
        return str(dt)


# =======================================================================================================
def get_user_site_ids(user):
    return Site.objects.filter(user=user).values_list('site_id', flat=True)


# =======================================================================================================
# API 1: Lấy 1 meter cụ thể theo tên
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_latest_record(request):
    meter_name    = request.GET.get('meter_name')
    user_site_ids = get_user_site_ids(request.user)
    record = Meter.objects.filter(
        site_id__in=user_site_ids, meter_name=meter_name
    ).order_by('-timestamp').first()

    if not record:
        return JsonResponse({"error": "No record found"}, status=404)

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
        "timestamp":         fmt_ts(record.timestamp),
    })


# =======================================================================================================
# API 2: Lấy tất cả meter của 1 site
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_latest_records(request):
    user_site_ids = get_user_site_ids(request.user)
    meters = Meter.objects.filter(site_id__in=user_site_ids)

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
            "timestamp":         fmt_ts(m.timestamp),    # ← device timestamp, không qua localtime()
        })

    return JsonResponse(result, safe=False)


# =======================================================================================================
# API 3: Lấy TẤT CẢ meter
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_all_meters(request):
    user_sites    = Site.objects.filter(user=request.user)
    site_name_map = {site.site_id: site.site_name for site in user_sites}
    user_site_ids = list(site_name_map.keys())
    meters        = Meter.objects.filter(site_id__in=user_site_ids)

    result = []
    for m in meters:
        result.append({
            "site_id":           m.site_id_id,
            "site_name":         site_name_map.get(m.site_id_id, "--"),
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
            "timestamp":         fmt_ts(m.timestamp),    # ← device timestamp
        })

    return JsonResponse(result, safe=False)


# =======================================================================================================
# API 4: Chi tiết thanh ghi của 1 meter
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_meter_registers(request, meter_id):
    user_site_ids = get_user_site_ids(request.user)
    meter_exists  = Meter.objects.filter(
        meter_id=meter_id, site_id__in=user_site_ids
    ).exists()

    if not meter_exists:
        return JsonResponse({"error": "No permission to access !!!"}, status=403)

    latest_batch = MeterRegister.objects.filter(
        meter_id=meter_id
    ).order_by('-received_at').values('received_at').first()

    if not latest_batch:
        return JsonResponse([], safe=False)

    registers = MeterRegister.objects.filter(
        meter_id    = meter_id,
        received_at = latest_batch['received_at']
    ).order_by('register_address')

    result = []
    for reg in registers:
        result.append({
            "timestamp":      fmt_ts(reg.received_at),   # ← device timestamp
            "parameter_name": reg.register_name,
            "register":       reg.register_address if reg.register_address is not None else "--",
            "value":          float(reg.value) if reg.value is not None else "--",
            "unit":           reg.unit if reg.unit else "--",
        })

    return JsonResponse(result, safe=False)


# =======================================================================================================
# API 5: Lịch sử thanh ghi theo ngày
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_register_history(request):
    meter_id      = request.GET.get('meter_id')
    register_name = request.GET.get('register_name')
    date          = request.GET.get('date')

    if not meter_id or not register_name:
        return JsonResponse({"error": "Thiếu meter_id hoặc register_name"}, status=400)

    user_site_ids = get_user_site_ids(request.user)
    meter_exists  = Meter.objects.filter(
        meter_id=meter_id, site_id__in=user_site_ids
    ).exists()

    if not meter_exists:
        return JsonResponse({"error": "No permission"}, status=403)

    base_filter = {
        'meter_id':      meter_id,
        'register_name': register_name,
    }

    if date:
        # Lọc theo ngày cụ thể — so sánh theo date của received_at
        # received_at lưu UTC → dùng __date để Django tự xử lý timezone
        records = MeterRegister.objects.filter(
            **base_filter,
            received_at__date=date
        ).order_by('received_at')
    else:
        # Mặc định: lấy hôm nay theo timezone +07:00 (Vietnam)
        # Dùng localdate() với TIME_ZONE đã cấu hình trong settings
        from django.utils.timezone import localdate
        today   = localdate()
        records = MeterRegister.objects.filter(
            **base_filter,
            received_at__date=today
        ).order_by('received_at')

    result = []
    for reg in records:
        result.append({
            "register_address": reg.register_address,
            "register_name":    reg.register_name,
            "value":            float(reg.value) if reg.value is not None else "--",
            "unit":             reg.unit if reg.unit else "--",
            "received_at":      fmt_ts(reg.received_at),   # ← device timestamp, giữ +07:00
        })

    return JsonResponse(result, safe=False)