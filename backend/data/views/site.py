# site.py = Quản lý Site của người dùng
from django.http import JsonResponse
from django.db.models import Q
from data.models import Site
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated


# ================================================
# LẤY DANH SÁCH TẤT CẢ SITE CỦA USER ĐANG ĐĂNG NHẬP
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_my_sites(request):

    sites = Site.objects.filter(user=request.user)  # Lấy tất cả site thuộc về user đang đăng nhập
    result = []
    for site in sites:
        result.append({
            "site_id":    site.site_id,
            "site_name":  site.site_name,
            "location":   site.location,
            "gateway_id": site.gateway_id,
            "latitude":   site.latitude,    # THÊM: tọa độ để vẽ marker trên bản đồ
            "longitude":  site.longitude,   # THÊM
        })
    return JsonResponse(result, safe=False)


# ================================================
# THÊM SITE MỚI
@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def add_site(request):
    # Lấy data từ request
    site_name  = request.data.get('site_name')
    location   = request.data.get('location')
    gateway_id = request.data.get('gateway_id')
    latitude   = request.data.get('latitude')    # THÊM: có thể None nếu user không nhập
    longitude  = request.data.get('longitude')   # THÊM

    # Kiểm tra đủ thông tin chưa
    if not site_name:
        return JsonResponse({'error': 'Please enter a site name !'}, status=400)
    if not location:
        return JsonResponse({'error': 'Please enter a position !'}, status=400)
    if not gateway_id:
        return JsonResponse({'error': 'Please enter a gateway ID !'}, status=400)

    # Kiểm tra gateway_id đã được đăng ký chưa
    if Site.objects.filter(gateway_id=gateway_id).exists():
        return JsonResponse({'error': 'Gateway ID already exists !'}, status=409)

    # Tạo site mới — gắn với user đang đăng nhập
    site = Site.objects.create(
        user       = request.user,
        site_name  = site_name,
        location   = location,
        gateway_id = gateway_id,
        latitude   = latitude,     # THÊM
        longitude  = longitude,    # THÊM
    )
    return JsonResponse({  # Trả về cho Frontend
        'message':    'Successful to create new Site',
        'site_id':    site.site_id,
        'site_name':  site.site_name,
        'gateway_id': site.gateway_id,
    }, status=201)


# ================================================
# CẬP NHẬT SITE (sửa thông tin + THAY GATEWAY)
@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def update_site(request, site_id):
    # Chỉ cho sửa site của chính user đang đăng nhập
    try:
        site = Site.objects.get(site_id=site_id, user=request.user)
    except Site.DoesNotExist:
        return JsonResponse({'error': 'Not found this Site !'}, status=404)

    data        = request.data
    new_gateway = data.get('gateway_id')

    # ── THAY GATEWAY: kiểm tra gateway mới chưa bị site KHÁC dùng ──
    if new_gateway and new_gateway != site.gateway_id:
        clash = Site.objects.filter(gateway_id=new_gateway).exclude(site_id=site_id).exists()
        if clash:
            return JsonResponse({'error': 'Gateway ID already in use by another site !'}, status=409)
        site.gateway_id = new_gateway
        # LƯU Ý: Meter cũ link với Site qua site_id (ForeignKey), KHÔNG qua gateway_id
        # → đổi gateway thì dữ liệu mới chảy vào site này, lịch sử Meter cũ giữ nguyên

    # ── Cập nhật các thông tin khác (chỉ cập nhật field nào được gửi lên) ──
    if data.get('site_name') is not None:
        site.site_name = data.get('site_name')
    if data.get('location') is not None:
        site.location = data.get('location')
    if 'latitude' in data:
        site.latitude = data.get('latitude')
    if 'longitude' in data:
        site.longitude = data.get('longitude')

    site.save()
    return JsonResponse({'message': 'Successful to update this site'}, status=200)


# ================================================
# TỔNG HỢP DỮ LIỆU 1 SITE (cho FleetView: Total Energy + Power → Ratio)
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_site_summary(request, site_id):
    from data.models import Meter, MeterRegister, ScanResult, ScanDevice
    from django.utils import timezone

    GATEWAY_STALE_SECS = 300  # 5 phút — nếu scan cũ hơn thì coi gateway offline

    try:
        site = Site.objects.get(site_id=site_id, user=request.user)
    except Site.DoesNotExist:
        return JsonResponse({'error': 'Not found this Site !'}, status=404)

    meters = Meter.objects.filter(site_id=site)
    meter_count   = meters.count()
    meters_online = meters.filter(status__in=['Online', 'Active']).count()

    # ── Trạng thái thực từ ScanResult (chính xác hơn Meter.status) ──
    latest_scan   = ScanResult.objects.filter(site=site).order_by('-scanned_at').first()
    gateway_online = False
    scan_devices   = []
    scan_active    = 0
    scan_total     = 0

    if latest_scan:
        age_secs = (timezone.now() - latest_scan.scanned_at).total_seconds()
        gateway_online = age_secs < GATEWAY_STALE_SECS
        scan_devices   = list(
            ScanDevice.objects.filter(scan_result=latest_scan)
            .order_by('modbus_id')
            .values('modbus_id', 'status')
        )
        scan_active = latest_scan.active_count
        scan_total  = latest_scan.total_devices

    # ── Tổng công suất tức thời (W) — từ field real_power của meter đang chạy ──
    total_power = 0.0
    for m in meters:
        status = getattr(m, 'status', '') or ''
        if status in ('Active', 'Online') and m.real_power is not None:
            try:
                total_power += float(m.real_power)
            except (TypeError, ValueError):
                pass

    # ── Tổng năng lượng (kWh) — lấy giá trị MỚI NHẤT của từng thanh ghi Energy ──
    # Lọc thanh ghi có unit chứa 'kwh' HOẶC tên chứa 'energy'
    # (NẾU register Energy của bạn đặt tên/đơn vị khác → chỉnh bộ lọc Q bên dưới)
    total_energy = 0.0
    for m in meters:
        energy_names = (MeterRegister.objects
                        .filter(meter=m)
                        .filter(Q(unit__icontains='kWh') | Q(register_name__icontains='Energy'))
                        .values_list('register_name', flat=True)
                        .distinct())
        for name in energy_names:
            latest = (MeterRegister.objects
                      .filter(meter=m, register_name=name)
                      .order_by('-received_at')
                      .first())
            if latest and latest.value not in (None, '', '---'):
                try:
                    total_energy += float(latest.value)
                except (TypeError, ValueError):
                    pass

    return JsonResponse({
        'site_id':        site.site_id,
        'site_name':      site.site_name,
        'total_energy':   round(total_energy, 2),
        'total_power':    round(total_power, 2),
        'meter_count':    meter_count,
        'meters_online':  meters_online,
        # Scan-based fields (chính xác hơn)
        'gateway_online': gateway_online,
        'scan_devices':   scan_devices,   # [{modbus_id, status}, ...]
        'scan_active':    scan_active,
        'scan_total':     scan_total,
    }, status=200)


# ================================================
# XÓA SITE
@api_view(['DELETE'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def delete_site(request, site_id):
    # Tìm site theo site_id, kiểm tra thuộc về user đang đăng nhập không
    try:
        site = Site.objects.get(site_id=site_id, user=request.user)
    except Site.DoesNotExist:
        return JsonResponse({'error': 'Not found this Site !'}, status=404)

    site.delete()
    return JsonResponse({'message': 'Successful to delete this site'}, status=200)