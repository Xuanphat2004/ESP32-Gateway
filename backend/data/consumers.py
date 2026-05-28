from channels.generic.websocket import AsyncWebsocketConsumer
import json
from datetime import datetime
import asyncio
import random

from urllib.parse import parse_qs
from channels.db import database_sync_to_async


@database_sync_to_async
def get_user_from_token(scope):
    """Lấy user từ token truyền qua query string ?token=xxx"""
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
    """Kiểm tra gateway có thuộc về user không"""
    from data.models import Site
    real_gateway_id = gateway_id.replace('_', ':')
    return Site.objects.filter(user=user, gateway_id=real_gateway_id).exists()


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
        await self.send(text_data=json.dumps(event["message"]))


# ═══════════════════════════════════════════════════════
# METER — Tầng 1: Bảng tổng quát
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
        await self.send(text_data=json.dumps(event["message"]))


# ═══════════════════════════════════════════════════════
# METER REGISTER — Tầng 2: Bảng chi tiết thanh ghi
#
# Group: meter_register_{meter_id}
# mqtt_worker push sau mỗi bulk_create với type "meter_register_update"
# ═══════════════════════════════════════════════════════
class MeterRegisterConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.meter_id   = self.scope['url_route']['kwargs'].get('meter_id')
        self.group_name = f"meter_register_{self.meter_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        print(f"[MeterRegister] Connected: meter_id={self.meter_id}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        print(f"[MeterRegister] Disconnected: meter_id={self.meter_id}")

    async def meter_register_update(self, event):
        # Được gọi khi mqtt_worker gửi type: "meter_register_update"
        await self.send(text_data=json.dumps(event["message"]))


class AllMetersConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.group_name = "all_meters"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def all_meters_update(self, event):
        await self.send(text_data=json.dumps(event["message"]))


class WeatherStationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.site_id    = self.scope['url_route']['kwargs'].get("site_id")
        self.group_name = f"weather_station_{self.site_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def weather_station_update(self, event):
        await self.send(text_data=json.dumps(event["message"]))


class ScanConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = await get_user_from_token(self.scope)
        if not user or not user.is_authenticated:
            await self.close(code=4001)
            return

        self.gateway_id = self.scope['url_route']['kwargs'].get('gateway_id')

        owner = await is_gateway_owner(user, self.gateway_id)
        if not owner:
            await self.close(code=4003)
            return

        self.group_name = f"scan_{self.gateway_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        print(f"[ScanConsumer] {user.username} connected → {self.group_name}")

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def scan_fault(self, event):
        await self.send(text_data=json.dumps(event["message"]))


# ═══════════════════════════════════════════════════════
# REGISTER HISTORY — Tầng 3: Lịch sử + Chart 1 thanh ghi
#
# Group: register_history_{meter_id}_{register_address}
# Dùng register_address (số nguyên) làm key thay vì register_name
# → tránh ký tự đặc biệt, khoảng trắng, dấu tiếng Việt trong tên
#
# mqtt_worker push từng register sau bulk_create với type "register_history_update"
# Frontend kết nối: ws/register_history/{meter_id}/{register_address}/
# ═══════════════════════════════════════════════════════
class RegisterHistoryConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.meter_id         = self.scope['url_route']['kwargs']['meter_id']
        self.register_address = self.scope['url_route']['kwargs']['register_address']
        self.group_name       = f"register_history_{self.meter_id}_{self.register_address}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()
        print(f"[RegisterHistory] Connected: meter={self.meter_id} addr={self.register_address}")

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        print(f"[RegisterHistory] Disconnected: meter={self.meter_id} addr={self.register_address}")

    async def register_history_update(self, event):
        # Được gọi khi mqtt_worker gửi type: "register_history_update"
        await self.send(text_data=json.dumps(event['data']))