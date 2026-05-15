from channels.generic.websocket import AsyncWebsocketConsumer
import json
from datetime import datetime
import asyncio
import random

# ── THÊM MỚI: chỉ import parse_qs và database_sync_to_async ở cấp module
# Token và AnonymousUser được import BÊN TRONG hàm để tránh lỗi:
# ImproperlyConfigured: settings are not configured
# Nguyên nhân: import Token ở cấp module → Django load authtoken model
# trước khi settings configured → crash khi daphne khởi động
from urllib.parse import parse_qs
from channels.db import database_sync_to_async


# ── THÊM MỚI: 2 hàm helper dùng cho ScanConsumer ────────────────────────

@database_sync_to_async
def get_user_from_token(scope):
    """Lấy user từ token truyền qua query string ?token=xxx"""
    # Import trong hàm: lúc này Django đã setup xong, settings OK
    from rest_framework.authtoken.models import Token
    from django.contrib.auth.models import AnonymousUser

    query_string = scope.get("query_string", b"").decode()
    params       = parse_qs(query_string)
    token_key    = params.get("token", [None])[0]
    if not token_key:
        return AnonymousUser()
    try:
        return Token.objects.get(key=token_key).user
    except Token.DoesNotExist:
        return AnonymousUser()


@database_sync_to_async
def is_gateway_owner(user, gateway_id):
    """Kiểm tra gateway có thuộc về user không — tránh user A nghe WS của user B"""
    from data.models import Site
    real_gateway_id = gateway_id.replace('_', ':')  # URL dùng "_", DB lưu ":"
    return Site.objects.filter(user=user, gateway_id=real_gateway_id).exists()


# ═══════════════════════════════════════════════════════════════════════════
# GIỮ NGUYÊN toàn bộ các consumer cũ — không thay đổi 1 dòng nào
# ═══════════════════════════════════════════════════════════════════════════

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()
        print("Client connected")
        while True:
            data = {
                "message": f"Dữ liệu mẫu lúc {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                "value": random.uniform(0, 100)
            }
            await self.send(json.dumps(data))
            print(f"Sent data: {data}")
            await asyncio.sleep(3)

    async def disconnect(self, close_code):
        print("Client disconnected")

    async def websocket_receive(self, text_data):
        pass


class InverterConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.site_id    = self.scope['url_route']['kwargs'].get("site_id")
        self.group_name = f"inverter_{self.site_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def inverter_update(self, event):
        data = event["message"]
        await self.send(text_data=json.dumps(data))


# ═══════════════════════════════════════════════════════
# METER
# ═══════════════════════════════════════════════════════
class MeterConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.site_id    = self.scope['url_route']['kwargs'].get("site_id")
        self.group_name = f"meter_{self.site_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def meter_update(self, event):
        data = event["message"]
        await self.send(text_data=json.dumps(data))


class MeterRegisterConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.meter_id   = self.scope['url_route']['kwargs'].get('meter_id')
        self.group_name = f"meter_register_{self.meter_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def meter_register_update(self, event):
        data = event["message"]
        await self.send(text_data=json.dumps(data))


class AllMetersConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = "all_meters"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def all_meters_update(self, event):
        data = event["message"]
        await self.send(text_data=json.dumps(data))


class WeatherStationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.site_id    = self.scope['url_route']['kwargs'].get("site_id")
        self.group_name = f"weather_station_{self.site_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def weather_station_update(self, event):
        data = event["message"]
        await self.send(text_data=json.dumps(data))


# ═══════════════════════════════════════════════════════════════════════════
# THÊM MỚI: ScanConsumer
#
# Khác với các consumer khác ở 2 điểm:
#   1. Xác thực token — ai cũng có thể đoán URL nếu không check
#   2. Kiểm tra ownership — gateway phải thuộc đúng user kết nối
#
# mqtt_worker gửi type "scan.fault" → Django Channels gọi scan_fault()
# Quy tắc đặt tên: dấu "." trong type → dấu "_" trong tên hàm
# ═══════════════════════════════════════════════════════════════════════════
class ScanConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Bước 1: xác thực token từ ?token=xxx trong URL
        user = await get_user_from_token(self.scope)
        if not user or not user.is_authenticated:
            await self.close(code=4001)  # Unauthorized
            return

        # Bước 2: lấy gateway_id từ URL pattern ws/scan/<gateway_id>/
        self.gateway_id = self.scope['url_route']['kwargs'].get('gateway_id')

        # Bước 3: kiểm tra gateway có thuộc về user không
        owner = await is_gateway_owner(user, self.gateway_id)
        if not owner:
            await self.close(code=4003)  # Forbidden
            return

        # Bước 4: tham gia group và accept kết nối
        self.group_name = f"scan_{self.gateway_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        print(f"[ScanConsumer] {user.username} connected → {self.group_name}")

    async def disconnect(self, close_code):
        # hasattr để tránh lỗi nếu connect() đóng sớm trước khi set group_name
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def scan_fault(self, event):
        # Được gọi khi mqtt_worker gửi type: "scan.fault"
        await self.send(text_data=json.dumps(event["message"]))

class RegisterHistoryConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.meter_id      = self.scope['url_route']['kwargs']['meter_id']
        self.register_name = self.scope['url_route']['kwargs']['register_name']
        self.group_name    = f"register_history_{self.meter_id}_{self.register_name}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def register_history_update(self, event):
        await self.send(text_data=json.dumps(event['data']))