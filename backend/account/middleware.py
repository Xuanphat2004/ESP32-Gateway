from django.utils import timezone
from .models import UserPresence

PRESENCE_UPDATE_INTERVAL = 30  # giây — chỉ ghi DB nếu đã lâu hơn khoảng này, tránh ghi mỗi request


class TrackLastSeenMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            user = getattr(request, 'user', None)
            if user is not None and user.is_authenticated:
                now = timezone.now()
                presence, _ = UserPresence.objects.get_or_create(user=user)
                if not presence.last_seen or (now - presence.last_seen).total_seconds() > PRESENCE_UPDATE_INTERVAL:
                    presence.last_seen = now
                    presence.save(update_fields=['last_seen'])
        except Exception:
            pass  # theo dõi online tuyệt đối không được làm hỏng request thật
        return response
