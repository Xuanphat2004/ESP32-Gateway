from django.shortcuts import render
import jwt
from django.http import JsonResponse
from django.contrib.auth import authenticate
from datetime import datetime, timezone, timedelta
from django.views.decorators.csrf import csrf_exempt
import json
from django.contrib.auth.models import User


SECRET_KEY = 'your-secret-key'  # Hoặc import từ settings

@csrf_exempt
def login_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        user = authenticate(username=data['username'], password=data['password'])

        if user:
            payload = {
                'user_id': user.id,
                'exp': datetime.now(timezone.utc) + timedelta(hours=1),
                'iat': datetime.now(timezone.utc)
            }
            token = jwt.encode(payload, SECRET_KEY, algorithm='HS256')
            return JsonResponse({'token': token})
        else:
            return JsonResponse({'error': 'Invalid credentials'}, status=401)
    return JsonResponse({'error': 'POST only'}, status=405)


@csrf_exempt
def protected_api(request):
    auth_header = request.headers.get('Authorization')
    
    if not auth_header or not auth_header.startswith('Bearer '):
        return JsonResponse({'error': 'Authorization header missing or invalid'}, status=401)
    
    token = auth_header.split(' ')[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        user_id = payload['user_id']
        return JsonResponse({'message': f'Hello user {user_id}! You are authenticated.'})
    except jwt.ExpiredSignatureError:
        return JsonResponse({'error': 'Token expired'}, status=401)
    except jwt.InvalidTokenError:
        return JsonResponse({'error': 'Invalid token'}, status=401)


@csrf_exempt
def signup_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return JsonResponse({'error': 'Missing fields'}, status=400)

        # Kiểm tra nếu đã có người dùng này
        if User.objects.filter(username=username).exists():
            return JsonResponse({'error': 'Username already taken'}, status=409)

        # Tạo user mới
        user = User.objects.create_user(username=username, password=password)
        return JsonResponse({'message': 'User created successfully'}, status=201)

    return JsonResponse({'error': 'POST only'}, status=405)