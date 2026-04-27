"""
ASGI config for SolarMontoring project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
# from django.core.asgi import get_asgi_application
# application = get_asgi_application()
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
from channels.auth import AuthMiddlewareStack
import data.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'SolarMontoring.settings')
print("WebSocket routes loaded:", data.routing.websocket_urlpatterns)
application = ProtocolTypeRouter(
    {
        "http": get_asgi_application(),
        "websocket": AuthMiddlewareStack(URLRouter(data.routing.websocket_urlpatterns))
    }
)