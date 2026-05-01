# views/meter.py
# Nhiệm vụ: Tiếp nhận request từ Frontend liên quan đến Meter
# Kiểm tra token → lấy đúng dữ liệu của user → trả về JSON

from django.http import JsonResponse
from django.utils import timezone
from django.utils.timezone import localtime
from datetime import timedelta
from data.models import Meter, MeterRegister, Site
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated


# =======================================================================================================
# HÀM TIỆN ÍCH — Lấy danh sách site_id của user đang đăng nhập
def get_user_site_ids(user):
    return Site.objects.filter(user=user).values_list('site_id', flat=True)


# =======================================================================================================
# API 1: Lấy 1 meter cụ thể theo tên
# Frontend gọi: GET /solardb/get-latest-meter-record/?meter_name=Meter_1
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_latest_record(request):

    # Lấy tên meter từ URL
    meter_name = request.GET.get('meter_name')

    # Lấy danh sách site của user đang đăng nhập
    user_site_ids = get_user_site_ids(request.user)

    # Tìm meter theo tên — chỉ trong site của user
    record = Meter.objects.filter(site_id__in = user_site_ids, meter_name  = meter_name).order_by('-timestamp').first()

    # Không tìm thấy → trả về lỗi
    if not record:
        return JsonResponse({"error": "No record found"}, status=404)

    # Tìm thấy → trả về thông tin
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


# =======================================================================================================
# API 2: Lấy tất cả meter của 1 site cụ thể
# Frontend gọi: GET /solardb/get-latest-meter-records/
# Dùng cho trang SiteList khi bấm vào 1 site cụ thể
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_latest_records(request):

    # Lấy danh sách site của user đang đăng nhập
    user_site_ids = get_user_site_ids(request.user)

    # Lấy tất cả meter thuộc các site đó
    meters = Meter.objects.filter(site_id__in=user_site_ids)

    # Đóng gói thành danh sách để trả về
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
            "timestamp":         localtime(m.timestamp).strftime('%Y-%m-%d %H:%M:%S'),
        })

    return JsonResponse(result, safe=False)


# =======================================================================================================
# API 3: Lấy TẤT CẢ meter của TẤT CẢ site
# Frontend gọi: GET /solardb/get-all-meters/
# Dùng cho trang DeviceList — hiển thị toàn bộ hệ thống
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_all_meters(request):

    # Lấy tất cả site của user đang đăng nhập
    user_sites = Site.objects.filter(user=request.user)

    # Tạo bảng tra cứu: site_id → site_name
    # Mục đích: lấy tên site nhanh mà không cần query DB nhiều lần
    site_name_map = {}
    for site in user_sites:
        site_name_map[site.site_id] = site.site_name

    # Lấy tất cả meter thuộc các site đó
    user_site_ids = list(site_name_map.keys())
    meters = Meter.objects.filter(site_id__in=user_site_ids)

    # Đóng gói thành danh sách — kèm tên site
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
            "timestamp":         localtime(m.timestamp).strftime('%Y-%m-%d %H:%M:%S'),
        })

    return JsonResponse(result, safe=False)


# =======================================================================================================
# API 4: Lấy chi tiết thanh ghi của 1 meter cụ thể
# Frontend gọi: GET /solardb/get-meter-registers/4/
# Dùng khi người dùng bấm vào 1 dòng meter để xem chi tiết
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_meter_registers(request, meter_id):

    # Lấy danh sách site của user đang đăng nhập
    user_site_ids = get_user_site_ids(request.user)

    # Kiểm tra meter này có thuộc về user không
    meter_exists = Meter.objects.filter(
        meter_id    = meter_id,
        site_id__in = user_site_ids
    ).exists()

    # Không thuộc về user → từ chối
    if not meter_exists:
        return JsonResponse({"error": "No permission to access !!!"}, status=403)

    # Tìm thời điểm gửi data mới nhất của meter này
    latest_batch = MeterRegister.objects.filter(
        meter_id=meter_id
    ).order_by('-received_at').values('received_at').first()

    # Meter chưa có thanh ghi nào → trả về rỗng
    if not latest_batch:
        return JsonResponse([], safe=False)

    # Lấy tất cả thanh ghi của lần gửi mới nhất đó
    registers = MeterRegister.objects.filter(
        meter_id    = meter_id,
        received_at = latest_batch['received_at']
    ).order_by('register_address')

    # Đóng gói thành danh sách để trả về
    result = []
    for reg in registers:
        result.append({
            "timestamp":      localtime(reg.received_at).strftime('%Y-%m-%d %H:%M:%S'),
            "parameter_name": reg.register_name,
            "register":       reg.register_address if reg.register_address is not None else "--",
            "value":          float(reg.value) if reg.value is not None else "--",
            "unit":           reg.unit if reg.unit else "--",
        })

    return JsonResponse(result, safe=False)