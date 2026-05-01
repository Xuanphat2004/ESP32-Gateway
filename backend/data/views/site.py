# site.py = Quản lý Site của người dùng

from django.http import JsonResponse
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

    
    sites = Site.objects.filter(user=request.user) # Lấy tất cả site thuộc về user đang đăng nhập

    # Đóng gói thành danh sách để trả về
    result = []
    for site in sites:
        result.append({
            "site_id":    site.site_id,
            "site_name":  site.site_name,
            "location":   site.location,
            "gateway_id": site.gateway_id,
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
    )

    return JsonResponse({ # Trả về cho Frontend 
        'message':    'Successful to create new Site',
        'site_id':    site.site_id,
        'site_name':  site.site_name,
        'gateway_id': site.gateway_id,
    }, status=201)


# ================================================
# XÓA SITE
@api_view(['DELETE'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def delete_site(request, site_id):

    # Tìm site theo site_id
    # Kiểm tra site đó có thuộc về user đang đăng nhập không
    try:
        site = Site.objects.get(site_id=site_id, user=request.user)
    except Site.DoesNotExist:
        return JsonResponse({'error': 'Not found this Site !'}, status=404)

    # Xóa site
    site.delete()

    return JsonResponse({'message': 'Successful to delete this site'}, status=200)