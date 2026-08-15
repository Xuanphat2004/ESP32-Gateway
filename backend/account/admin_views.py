from django.http import JsonResponse
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAdminUser
from rest_framework.authtoken.models import Token
from account.models import LoginHistory

ONLINE_THRESHOLD_SECONDS = 90  # gấp 3 lần chu kỳ cập nhật của middleware, để có biên an toàn


def _serialize_user(u):
    presence = getattr(u, 'presence', None)
    last_seen = presence.last_seen if presence else None
    is_online = bool(last_seen and (timezone.now() - last_seen).total_seconds() < ONLINE_THRESHOLD_SECONDS)
    return {
        'id': u.id, 'username': u.username, 'email': u.email,
        'is_staff': u.is_staff, 'is_active': u.is_active,
        'date_joined': u.date_joined, 'last_login': u.last_login,
        'site_count': getattr(u, 'site_count', None),
        'last_seen': last_seen, 'is_online': is_online,
    }


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminUser])
def list_users(request):
    qs = (User.objects
          .select_related('presence')
          .annotate(site_count=Count('site', distinct=True))
          .order_by('username'))
    q = request.GET.get('q')
    if q:
        qs = qs.filter(Q(username__icontains=q) | Q(email__icontains=q))
    return JsonResponse([_serialize_user(u) for u in qs], safe=False)


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminUser])
def create_user(request):
    username = request.data.get('username')
    password = request.data.get('password')
    email    = request.data.get('email', '')
    is_staff = bool(request.data.get('is_staff', False))

    if not username or not password:
        return JsonResponse({'error': 'Missing fields'}, status=400)
    if User.objects.filter(username=username).exists():
        return JsonResponse({'error': 'Username already taken'}, status=409)
    try:
        validate_password(password)
    except ValidationError as e:
        return JsonResponse({'error': list(e.messages)}, status=400)

    user = User.objects.create_user(username=username, email=email, password=password, is_staff=is_staff)
    return JsonResponse(_serialize_user(user), status=201)


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminUser])
def update_user(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)

    data = request.data
    if 'is_staff' in data and user.id == request.user.id and not data.get('is_staff'):
        return JsonResponse({'error': 'You cannot remove your own admin access'}, status=400)

    if data.get('username'):
        if User.objects.filter(username=data['username']).exclude(id=user.id).exists():
            return JsonResponse({'error': 'Username already taken'}, status=409)
        user.username = data['username']
    if 'email' in data:
        user.email = data.get('email') or ''
    if 'is_staff' in data:
        user.is_staff = bool(data['is_staff'])

    user.save()
    return JsonResponse(_serialize_user(user), status=200)


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminUser])
def set_user_active(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)

    is_active = bool(request.data.get('is_active'))
    if not is_active and user.id == request.user.id:
        return JsonResponse({'error': 'You cannot deactivate your own account'}, status=400)

    user.is_active = is_active
    user.save()
    return JsonResponse(_serialize_user(user), status=200)


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminUser])
def reset_user_password(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)

    new_password = request.data.get('new_password')
    if not new_password:
        return JsonResponse({'error': 'Missing new_password'}, status=400)
    try:
        validate_password(new_password, user=user)
    except ValidationError as e:
        return JsonResponse({'error': list(e.messages)}, status=400)

    user.set_password(new_password)
    user.save()
    return JsonResponse({'message': 'Password reset successfully'}, status=200)


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminUser])
def get_user_login_history(request, user_id):
    if not User.objects.filter(id=user_id).exists():
        return JsonResponse({'error': 'User not found'}, status=404)

    rows = LoginHistory.objects.filter(user_id=user_id).order_by('-timestamp')[:50]
    return JsonResponse([
        {'timestamp': r.timestamp, 'ip_address': r.ip_address} for r in rows
    ], safe=False)


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminUser])
def impersonate_user(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)
    if not user.is_active:
        return JsonResponse({'error': 'Cannot view as a deactivated user'}, status=400)

    # Không dùng login_view / không ghi LoginHistory — đây là admin "xem hộ", không phải user thật đăng nhập
    token, _ = Token.objects.get_or_create(user=user)
    return JsonResponse({'token': token.key, 'username': user.username, 'is_staff': user.is_staff})


@api_view(['DELETE'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAdminUser])
def delete_user(request, user_id):
    try:
        user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)
    if user.id == request.user.id:
        return JsonResponse({'error': 'You cannot delete your own account'}, status=400)

    # Xoá hẳn — CASCADE sẽ xoá luôn Site/Meter/LoginHistory/MeterCardConfig của user này. Không thể khôi phục.
    username = user.username
    user.delete()
    return JsonResponse({'message': f'User "{username}" deleted permanently'}, status=200)
