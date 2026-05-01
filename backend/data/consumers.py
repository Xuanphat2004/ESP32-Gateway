from channels.generic.websocket import AsyncWebsocketConsumer
import json
from datetime import datetime
import asyncio
import random

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
        self.site_id = self.scope['url_route']['kwargs'].get("site_id")
        self.group_name = f"inverter_{self.site_id}"
        # print(f"inverter_{self.site_id}")

        # Tham gia group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name,self.channel_name)

    # Handler nhận event từ signal
    async def inverter_update(self, event):
        data = event["message"]
        await self.send(text_data=json.dumps(data))


#=====================================================================================================================================
#======================================================== METER ======================================================================
#=====================================================================================================================================
class MeterConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.site_id = self.scope['url_route']['kwargs'].get("site_id")
        self.group_name = f"meter_{self.site_id}"

        # Tham gia group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # Handler nhận event từ signal
    async def meter_update(self, event):
        data = event["message"]
        await self.send(text_data=json.dumps(data))

class MeterRegisterConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Lấy meter_id từ URL (vd: ws/meter_register/1/ → meter_id = "1")
        self.meter_id = self.scope['url_route']['kwargs'].get('meter_id')

        # Tên group riêng cho từng meter
        # mqtt_worker sẽ gửi vào đúng group này sau khi bulk_create
        self.group_name = f"meter_register_{self.meter_id}"

        # Đăng ký vào group để nhận broadcast
        await self.channel_layer.group_add(self.group_name, self.channel_name)

        # Chấp nhận kết nối WebSocket từ frontend
        await self.accept()

    async def disconnect(self, close_code):
        # Khi người dùng bấm "Quay lại" → frontend đóng WS
        # → Consumer tự rời khỏi group, không nhận data nữa
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def meter_register_update(self, event):
        # Hàm này được gọi khi mqtt_worker gửi group_send tới group này
        # event["message"] = danh sách các dòng thanh ghi mới
        data = event["message"]

        # Đẩy dữ liệu xuống frontend qua WebSocket
        await self.send(text_data=json.dumps(data))

class AllMetersConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Tất cả người xem DeviceList đều vào chung 1 group
        self.group_name = "all_meters"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    # Nhận data từ signals.py và gửi xuống trình duyệt
    async def all_meters_update(self, event):
        data = event["message"]
        await self.send(text_data=json.dumps(data))
#====================================================================================================================================


class WeatherStationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.site_id = self.scope['url_route']['kwargs'].get("site_id")
        self.group_name = f"weather_station_{self.site_id}"

        # Tham gia group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    # Handler nhận event từ signal
    async def weather_station_update(self, event):
        data = event["message"]
        await self.send(text_data=json.dumps(data))