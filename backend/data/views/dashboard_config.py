from django.http import JsonResponse
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated
from data.models import DashboardConfig


@api_view(['GET'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def get_dashboard_config(request):
    site_id = request.GET.get('site_id', None)
    if site_id is None:
        return JsonResponse({'widgets': []})
    try:
        site_id = int(site_id)
    except (ValueError, TypeError):
        return JsonResponse({'error': 'Invalid site_id'}, status=400)

    try:
        cfg = DashboardConfig.objects.get(user=request.user, site_id=site_id)
        return JsonResponse({'widgets': cfg.widgets})
    except DashboardConfig.DoesNotExist:
        # Auto-migrate legacy widgets (site_id=0, created before per-site feature)
        # to the first site the user opens — so old configs are not lost.
        try:
            legacy = DashboardConfig.objects.get(user=request.user, site_id=0)
            if legacy.widgets:
                legacy.site_id = site_id
                legacy.save()
                return JsonResponse({'widgets': legacy.widgets})
        except DashboardConfig.DoesNotExist:
            pass
        return JsonResponse({'widgets': []})


@api_view(['POST'])
@authentication_classes([TokenAuthentication])
@permission_classes([IsAuthenticated])
def save_dashboard_config(request):
    site_id = request.data.get('site_id', None)
    widgets = request.data.get('widgets', [])

    if site_id is None:
        return JsonResponse({'error': 'site_id is required'}, status=400)
    try:
        site_id = int(site_id)
    except (ValueError, TypeError):
        return JsonResponse({'error': 'Invalid site_id'}, status=400)

    cfg, _ = DashboardConfig.objects.update_or_create(
        user=request.user,
        site_id=site_id,
        defaults={'widgets': widgets},
    )
    return JsonResponse({'widgets': cfg.widgets}, status=200)
