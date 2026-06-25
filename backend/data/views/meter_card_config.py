from django.http import JsonResponse
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from data.models import MeterCardConfig


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_card_config(request, meter_id):
    try:
        cfg = MeterCardConfig.objects.get(user=request.user, meter_id=meter_id)
        return JsonResponse({'params': cfg.params})
    except MeterCardConfig.DoesNotExist:
        return JsonResponse({'params': []})


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def save_card_config(request, meter_id):
    params = request.data.get('params', [])
    cfg, _ = MeterCardConfig.objects.update_or_create(
        user=request.user,
        meter_id=meter_id,
        defaults={'params': params},
    )
    return JsonResponse({'params': cfg.params}, status=200)
