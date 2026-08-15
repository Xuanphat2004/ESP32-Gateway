from django.http import JsonResponse
from django.contrib.auth import authenticate
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from account.models import LoginHistory
import json


def _client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


@csrf_exempt
def login_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        user = authenticate(
            username=data['username'],
            password=data['password']
        )
        if user:
            # Dùng Django REST Token thay vì JWT
            token, created = Token.objects.get_or_create(user=user)
            LoginHistory.objects.create(user=user, ip_address=_client_ip(request))
            # authenticate() không tự cập nhật last_login (chỉ django.contrib.auth.login() mới làm việc đó,
            # nhưng ở đây dùng Token thay vì session) — cập nhật thủ công để cột Last Login trong Admin hiển thị đúng
            user.last_login = timezone.now()
            user.save(update_fields=['last_login'])
            return JsonResponse({'token': token.key})
        else:
            return JsonResponse({'error': 'Invalid credentials'}, status=401)

    return JsonResponse({'error': 'POST only'}, status=405)


@csrf_exempt
def signup_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return JsonResponse({'error': 'Missing fields'}, status=400)

        if User.objects.filter(username=username).exists():
            return JsonResponse({'error': 'Username already taken'}, status=409)

        # Tạo user mới
        user = User.objects.create_user(username=username, password=password)

        # Tạo token ngay khi đăng ký
        token = Token.objects.create(user=user)

        return JsonResponse({
            'message': 'User created successfully',
            'token': token.key  # trả về token luôn sau khi đăng ký
        }, status=201)

    return JsonResponse({'error': 'POST only'}, status=405)


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def logout_view(request):
    request.user.auth_token.delete()
    return JsonResponse({'message': 'Logged out successfully'})


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def me_view(request):
    u = request.user
    return JsonResponse({
        'id': u.id,
        'username': u.username,
        'email': u.email,
        'is_staff': u.is_staff,
        'is_active': u.is_active,
    })