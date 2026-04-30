# views/meter.py

from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from datetime import timedelta
from django.http import JsonResponse
from data.models import Meter, MeterRegister
from data.models import Site
from django.utils.timezone import localtime  
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, authentication_classes, permission_classes


#=======================================================================================================
@api_view(['GET']) # Chỉ cho vào bằng cửa GET
@authentication_classes([TokenAuthentication]) # Kiểm tra thẻ token
@permission_classes([IsAuthenticated]) # Chỉ cho vào nếu đã đăng nhập
def get_latest_record(request):
    meter_name = request.GET.get('meter_name')

    # Lấy site của user đang đăng nhập
    user_site_ids = Site.objects.filter(user = request.user).values_list('site_id', flat = True)

    # Tìm record của meter đó nhưng chỉ trong site của user
    record = (Meter.objects.filter(site_id__in = user_site_ids, meter_name = meter_name).order_by('-timestamp').first())

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
        return JsonResponse({"error": "No record found"}, status = 404)


#=======================================================================================================
# Hàm tiện ích tính ngày 30 ngày trước — giữ nguyên, không đụng vào
def get_time_last_month(request):
    today     = timezone.now().date()
    start_day = today - timedelta(days=30)
    return start_day


#=======================================================================================================
# Lấy tất cả meter của 1 site — mỗi meter 1 dòng (giá trị mới nhất)
# Decorator @csrf_exempt: cửa mở toang
# Decorator:  bảo vệ đứng trước cửa phòng
@api_view(['GET']) # Chỉ cho vào bằng cửa GET
@authentication_classes([TokenAuthentication]) # Kiểm tra thẻ token
@permission_classes([IsAuthenticated]) # Chỉ cho vào nếu đã đăng nhập
def get_latest_records(request):

    # Tự động lấy tất cả site thuộc về user đang đăng nhập
    user_site_ids = Site.objects.filter(user = request.user).values_list('site_id', flat = True)

    # Chỉ lấy meter thuộc site của user đó
    meters = Meter.objects.filter(site_id__in = user_site_ids)

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
          
            "timestamp": localtime(m.timestamp).strftime('%Y-%m-%d %H:%M:%S'),
        })

    return JsonResponse(result, safe = False)


#=======================================================================================================
# Lấy toàn bộ thanh ghi của 1 meter cụ thể — dùng khi click vào dòng
@api_view(['GET']) # Chỉ cho vào bằng cửa GET
@authentication_classes([TokenAuthentication]) # Kiểm tra thẻ token
@permission_classes([IsAuthenticated]) # Chỉ cho vào nếu đã đăng nhập
def get_meter_registers(request, meter_id):

    # Kiểm tra meter_id này có thuộc site của user không
    user_site_ids = Site.objects.filter(user = request.user).values_list('site_id', flat = True)

    # Xác nhận meter này thuộc về user — nếu không thì từ chối
    meter_exists = Meter.objects.filter(meter_id = meter_id, site_id__in = user_site_ids).exists()
    if not meter_exists:
        return JsonResponse({"error": "No permission to access !!!"}, status = 403)

    # Vào bảng này với id này, sắp xếp theo thời gian mới nhất, sau đó lưu lại thời gian mới nhất đó, sau đó lọc các dữ liệu với mốc thời gian mới nhất đó
    latest_batch = (MeterRegister.objects.filter(meter_id = meter_id).order_by('-received_at').values('received_at').first())
    if not latest_batch:
        return JsonResponse([], safe = False)

    # lấy tất cả thanh ghi của đúng batch mới nhất đó
    registers = (MeterRegister.objects.filter(meter_id = meter_id, received_at = latest_batch['received_at']).order_by('register_address'))
    result = [{
        "timestamp":      localtime(reg.received_at).strftime('%Y-%m-%d %H:%M:%S'),
        "parameter_name": reg.register_name,
        "register":       reg.register_address if reg.register_address is not None else "--",
        "value":          float(reg.value) if reg.value is not None else "--",
        "unit":           reg.unit if reg.unit else "--",
    } for reg in registers]

    return JsonResponse(result, safe = False)