# views/scan.py
from django.http import JsonResponse
from django.utils.timezone import localtime
from data.models import Site, ScanResult, ScanDevice
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated


def get_user_sites(user):
    return Site.objects.filter(user=user)


# GET /solardb/get-latest-scan/
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_latest_scan(request):

    user_sites    = get_user_sites(request.user)
    user_site_ids = user_sites.values_list('site_id', flat=True)

    latest = ScanResult.objects.filter(
        site_id__in=user_site_ids
    ).select_related('site').first()

    if not latest:
        return JsonResponse({"data": None}, status=200)

    devices      = ScanDevice.objects.filter(scan_result=latest)
    active_ids   = [d.modbus_id for d in devices if d.status == 'active']
    inactive_ids = [d.modbus_id for d in devices if d.status == 'inactive']

    return JsonResponse({
        "data": {
            "scan_id":        latest.id,
            "site_id":        latest.site.site_id,
            "site_name":      latest.site.site_name,
            "gateway_id":     latest.site.gateway_id,
            "scanned_at":     localtime(latest.scanned_at).strftime('%Y-%m-%d %H:%M:%S'),
            "severity":       latest.severity,
            "wire_p1_ok":     latest.wire_p1_ok,
            "wire_p2_ok":     latest.wire_p2_ok,
            # THÊM: tổng hợp trạng thái dây — True nếu dây thông (1 trong 2 wire check pass)
            # Lý do: wire_p2_ok luôn False khi wire_p1_ok=True vì wire check lần 2 không chạy
            # → frontend không thể dùng wire_p2_ok trực tiếp, cần field tổng hợp này
            "line_ok":        latest.wire_p1_ok or latest.wire_p2_ok,
            "active_port":    latest.active_port,
            "final_id_p1":    latest.final_id_p1,
            "final_id_p2":    latest.final_id_p2,
            "total_devices":  latest.total_devices,
            "active_count":   latest.active_count,
            "inactive_count": latest.inactive_count,
            "active_ids":     active_ids,
            "inactive_ids":   inactive_ids,
        }
    }, status=200)


# GET /solardb/get-scan-history/
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_scan_history(request):

    user_site_ids = get_user_sites(request.user).values_list('site_id', flat=True)

    limit = int(request.GET.get('limit', 50))
    limit = min(limit, 200)

    scans = ScanResult.objects.filter(
        site_id__in=user_site_ids
    ).select_related('site').order_by('-scanned_at')[:limit]

    result = []
    for scan in scans:
        result.append({
            "scan_id":        scan.id,
            "site_name":      scan.site.site_name,
            "gateway_id":     scan.site.gateway_id,
            "scanned_at":     localtime(scan.scanned_at).strftime('%Y-%m-%d %H:%M:%S'),
            "severity":       scan.severity,
            "wire_p1_ok":     scan.wire_p1_ok,
            "wire_p2_ok":     scan.wire_p2_ok,
            "line_ok":        scan.wire_p1_ok or scan.wire_p2_ok,
            "active_port":    scan.active_port,
            "final_id_p1":    scan.final_id_p1,
            "final_id_p2":    scan.final_id_p2,
            "total_devices":  scan.total_devices,
            "active_count":   scan.active_count,
            "inactive_count": scan.inactive_count,
        })

    return JsonResponse(result, safe=False)


# GET /solardb/get-scan-devices/<scan_id>/
@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_scan_devices(request, scan_id):

    user_site_ids = get_user_sites(request.user).values_list('site_id', flat=True)

    try:
        scan = ScanResult.objects.get(id=scan_id, site_id__in=user_site_ids)
    except ScanResult.DoesNotExist:
        return JsonResponse({"error": "Not found or no permission"}, status=404)

    devices = ScanDevice.objects.filter(scan_result=scan).order_by('modbus_id')

    result = []
    for d in devices:
        result.append({
            "modbus_id": d.modbus_id,
            "status":    d.status,
            "port":      d.port,
        })

    return JsonResponse({
        "scan_id":    scan.id,
        "scanned_at": localtime(scan.scanned_at).strftime('%Y-%m-%d %H:%M:%S'),
        "severity":   scan.severity,
        "devices":    result,
    }, safe=False)