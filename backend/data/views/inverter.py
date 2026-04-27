from django.views.decorators.csrf import csrf_exempt
from ..models.inverter import Inverter
from datetime import timedelta
from django.http import JsonResponse
from django.utils import timezone
from django.db.models import Max, Sum
import json

@csrf_exempt
def get_inverter_name_from_site(request):
    inverters = Inverter.objects.raw(
        """SELECT i.inverter_id, i.inverter_name, s.site_name FROM inverter i 
        JOIN site s ON i.site_id = s.site_id 
        WHERE s.site_name = %s""",
        ["Bach Khoa"]
    )

    data = [
        {"inverter_id": inv.inverter_id, 
         "inverter_name": inv.inverter_name, 
         "site_name": inv.site_name}
        for inv in inverters
    ]

    # for inv in inverters:
    #     print(inv.inverter_name, inv.site_name)
    
    return JsonResponse(data, safe=False)

@csrf_exempt
def add_inverter(request):
    data = json.loads(request.body)
    inv = Inverter.objects.create(
        inverter_id=data["inverter_id"],
        inverter_name=data["inverter_name"],
        site_id=data["site_id"]
    )
    return JsonResponse({"inverter_name": inv.inverter_name})

@csrf_exempt
def update_inverter_name(request):
    data = json.loads(request.body)
    Inverter.objects.filter(inverter_id=data["inverter_id"]).update(
        inverter_name=data["new_name"]
    )
    return JsonResponse({"status": "updated"})

@csrf_exempt
def get_inverters_list(request):
    inverters_list = Inverter.objects.raw(
        """SELECT inverter_id, inverter_name, system_diagram, production, internal_temp FROM inverter WHERE """
    )
    data = [
        {"inverter_id": inv.inverter_id, 
         "inverter_name": inv.inverter_name, 
         "system_diagram": inv.system_diagram,
         "production": inv.production, 
         "internal_temp": inv.internal_temp
        }
        for inv in inverters_list
    ]
    return JsonResponse(data, safe=False)

def get_lastest_record(request):
    site_id = request.GET.get('site_id')
    inverter_name = request.GET.get('inverter_name')

    record = (
        Inverter.objects
        .filter(site_id=site_id, inverter_name=inverter_name)
        .order_by('-timestamp')
        .first()
    )

    if record:
        return JsonResponse({
            "site_id": record.site_id,
            "inverter_name": record.inverter_name,
            "manufacturer": record.manufacturer,
            "model": record.model,
            "serial_number": record.serial_number,
            "system_diagram": record.system_diagram,
            "state": record.state,
            "capacity": record.capacity,
            "string_current": record.string_current,
            "active_power": record.active_power,
            "apparent_power": record.apparent_power,
            "input_power": record.input_power,
            "reactive_power": record.reactive_power,
            "power_factor": record.power_factor,
            "grid_frequency": record.grid_frequency,
            "internal_temp": record.internal_temp,
            "a_phase_current": record.a_phase_current,
            "b_phase_current": record.b_phase_current,
            "c_phase_current": record.c_phase_voltage,
            "a_phase_voltage": record.a_phase_voltage,
            "b_phase_voltage": record.b_phase_voltage,
            "c_phase_voltage": record.c_phase_voltage,
            "line_voltage_L1_L2": record.line_voltage_L1_L2,
            "line_voltage_L2_L3": record.line_voltage_L2_L3,
            "line_voltage_L3_L1": record.line_voltage_L3_L1,
        })
    else:
        return JsonResponse({"error": "No record found"}, status=404)

# Biến cache toàn cục: { (site_id, yesterday): { inverter_name: production } }
YESTERDAY_CACHE = {}
CACHE_TTL_DAYS = 7  # giữ lại tối đa 7 ngày cache

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
    yesterday_records = (Inverter.objects.filter(site_id=site_id, timestamp__date=yesterday).order_by("inverter_name", "-timestamp"))

    yesterday_last_prod = {}
    for record in yesterday_records:
        if record.inverter_name not in yesterday_last_prod:
            yesterday_last_prod[record.inverter_name] = record.production

    # Lưu cache
    YESTERDAY_CACHE[cache_key] = yesterday_last_prod
    return yesterday_last_prod


def get_latest_records(request):
    site_id = request.GET.get("site_id")
    if not site_id:
        return JsonResponse({"error": "site_id is required"}, status=400)

    today = timezone.now().date()
    yesterday_last_prod = get_yesterday_last_prod(site_id, today)

    # Lấy record mới nhất hôm nay
    today_records = Inverter.objects.filter(site_id=site_id) #timestamp__date=today)
    # Kết quả của lệnh grouped là một QuerySet mới (một tập hợp giống như danh sách các từ điển trong Python). 
    # Mỗi mục (item) trong QuerySet này sẽ có hai trường:
    # + inverter_name (Tên Inverter).
    # + latest_time (Thời gian mới nhất mà Inverter đó có bản ghi).

    grouped = today_records.values("inverter_name").annotate(latest_time=Max("timestamp"))

    result = []
    for g in grouped:
        latest_record = today_records.filter(inverter_name=g["inverter_name"], timestamp=g["latest_time"]).first()

        if not latest_record:
            continue

        efficiency = (
            round((latest_record.active_power / latest_record.input_power) * 100, 2)
            if latest_record.active_power and latest_record.input_power not in (None, 0)
            else None
        )

        production_yesterday = yesterday_last_prod.get(latest_record.inverter_name, 0)
        production_today = latest_record.production - production_yesterday

        result.append({
            "site_id": latest_record.site_id,
            "inverter_name": latest_record.inverter_name,
            "system_diagram": latest_record.system_diagram,
            "state": latest_record.state,
            "active_power": latest_record.active_power,
            "input_power": latest_record.input_power,
            "efficiency": efficiency,
            "production_today": production_today,
            "internal_temp": latest_record.internal_temp,
        })

    return JsonResponse(result, safe=False)


# Thu nghiem ham moi - lay tat ca du lieu trong database luon.
# @csrf_exempt
def get_all_inverter_records(request):
    
    # 1. Lấy tham số từ yêu cầu GET
    site_id = request.GET.get('site_id')
    # inverter_name = request.GET.get('inverter_name')

    # 2. Kiểm tra tính hợp lệ của tham số
    if not site_id:
        return JsonResponse({"error": "site_id is required"}, status=400)
    # if not inverter_name:
    #     return JsonResponse({"error": "inverter_name is required"}, status=400)
    
    # 3. Truy vấn tất cả các bản ghi khớp với điều kiện
    try:
        all_records = Inverter.objects.filter(
            site_id=site_id
            # inverter_name=inverter_name 
        ).order_by('-timestamp') # Sắp xếp từ mới nhất về cũ nhất
        
    except Exception as e:
        # Xử lý lỗi cơ sở dữ liệu (ví dụ: lỗi kết nối)
        return JsonResponse({"error": f"Database query failed: {str(e)}"}, status=500)

    # 4. Chuẩn hóa dữ liệu để trả về
    if all_records.exists():
        # Ánh xạ (map) QuerySet sang danh sách các từ điển để trả về JSON
        data = []
        for record in all_records:
            data.append({
                "timestamp": record.timestamp.isoformat(),
                "site_id": record.site_id,
                "inverter_name": record.Inverter_name, 
                "active_power": record.active_power if hasattr(record, 'active_power') else None,
                "production_today": record.production_today if hasattr(record, 'production_today') else None,
                # Thêm các trường dữ liệu khác mà bạn muốn trả về
            })
            
        return JsonResponse(data, safe=False) # safe=False cho phép trả về một list (mảng JSON)

    else:
        # 5. Trả về lỗi nếu không tìm thấy bản ghi nào
        return JsonResponse({"error": "No records found for the specified inverter and site."}, status=404)

# Ghi chú: Bạn cần đảm bảo các trường active_power, production_today có tồn tại trong mô hình.