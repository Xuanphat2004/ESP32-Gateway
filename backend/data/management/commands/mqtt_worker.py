import os
import json
import django
import paho.mqtt.client as mqtt
from django.utils import timezone
from pathlib import Path


# ==========================================
# CẤU HÌNH MÔI TRƯỜNG DJANGO
# ==========================================
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'SolarMonitoring.settings')
django.setup()

from data.models import Site, Meter, MeterRegister

# ==========================================
# CẤU HÌNH MQTT
# Phải khớp với mqtt_to_web.h của ESP32
# ==========================================
MQTT_BROKER  = "broker.emqx.io"
MQTT_PORT    = 1883
MQTT_TOPIC   = "xuanphat2004/mbgateway/meter/update/data"
MQTT_CLIENT  = "DJANGO-WORKER-001"  # Client ID riêng, khác với ESP32 ("XTXP-251104")

# ==========================================
# LOGIC XỬ LÝ DỮ LIỆU
# ==========================================
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"Đã kết nối Broker {MQTT_BROKER} thành công!")
        client.subscribe(MQTT_TOPIC)
        print(f"Đang lắng nghe topic: {MQTT_TOPIC}")
    else:
        print(f"Kết nối thất bại, mã lỗi: {rc}")


def on_message(client, userdata, msg):
    data = {}
    try:
        payload    = msg.payload.decode('utf-8')
        data       = json.loads(payload)
        gateway_id = data.get('gateway_id', 'unknown')
        m_id       = data.get('m_id')
        m_name     = data.get('m_name', f"Meter {m_id}")
        model      = data.get('model', 'Power Meter')
        attr       = data.get('attr', 'Consumption_Meter')

        if m_id is None:
            print("LỖI: Thiếu m_id, bỏ qua.")
            return

        try:
            target_site = Site.objects.get(site_id=1)
        except Site.DoesNotExist:
            print("LỖI: Không tìm thấy Site ID 1.")
            return

        # -------------------------------------------------------
        # NHIỆM VỤ 1: CẬP NHẬT BẢNG TỔNG QUÁT (METER)
        # Mỗi lần ESP32 gửi lên, ghi đè giá trị mới nhất vào dòng đó
        # -------------------------------------------------------
        meter, created = Meter.objects.update_or_create(
            meter_id = m_id,
            defaults = {
                'site_id':           target_site,
                'meter_name':        m_name,
                'device_model':      model,
                'attribute':         attr,
                'voltage_l1':        data.get('volt',     0),
                'current_l1':        data.get('curr',     0),
                'current_l1_dmd':    data.get('curr_dmd', 0),
                'real_power':        data.get('real_pwr', 0),
                'apparent_power_l1': data.get('app_pwr',  0),
                'frequency_l1':      data.get('freq',     0),
                'status':            'Active',
                'timestamp':         timezone.now(),
            }
        )
        status_msg = "Tạo mới" if created else "Cập nhật"
        print(f"   {status_msg} Meter ID {m_id} ({m_name}) thành công!")

        # -------------------------------------------------------
        # NHIỆM VỤ 2: LƯU TOÀN BỘ THANH GHI — ĐÃ SỬA
        # ĐỔI: update_or_create → bulk_create
        # Lý do: update_or_create ghi đè → mất lịch sử
        #        bulk_create INSERT tất cả 1 lần → lưu đầy đủ lịch sử
        # -------------------------------------------------------
        registers_list = data.get('registers', [])

        if not registers_list:
            print("Không có mảng 'registers' trong gói tin.")
        else:
            # Tạo 1 timestamp chung cho toàn bộ batch này
            # → tất cả thanh ghi trong cùng 1 gói MQTT sẽ có cùng received_at
            # → frontend dùng received_at để nhận biết "đây là cùng 1 lần đo"
            now = timezone.now()

            # Danh sách các object cần INSERT — chưa lưu vào DB
            to_insert = []
            skipped   = 0

            for reg in registers_list:
                reg_addr  = reg.get('register')  # địa chỉ Modbus (số nguyên)
                reg_name  = reg.get('name')       # tên thanh ghi (string)
                reg_value = reg.get('value', '---')   # giá trị đo được
                reg_unit  = reg.get('unit', '')   # đơn vị

                # Bỏ qua thanh ghi nếu thiếu tên (tên là bắt buộc)
                if reg_name is None:
                    skipped += 1
                    continue

                # Tạo object MeterRegister nhưng CHƯA lưu vào DB (chưa gọi .save())
                to_insert.append(MeterRegister(
                    meter            = meter,       # FK tới Meter vừa update ở trên
                    register_address = reg_addr,    # địa chỉ Modbus
                    register_name    = reg_name,    # tên thanh ghi
                    value            = reg_value,   # giá trị
                    unit             = reg_unit,    # đơn vị
                    received_at      = now,         # timestamp chung của cả batch
                ))

            # INSERT tất cả 1 lần vào DB — nhanh hơn nhiều so với loop từng cái
            # bulk_create KHÔNG kích hoạt signal post_save từng dòng
            # → signal sẽ được gọi thủ công trong bước tiếp theo (xem signals.py)
            MeterRegister.objects.bulk_create(to_insert)

            print(f"Lưu {len(to_insert)} thanh ghi thành công" + (f", bỏ qua {skipped} thanh ghi thiếu tên." if skipped else "."))

            # ← THÊM: Sau khi bulk_create xong, gửi WebSocket thủ công
            # Lý do: bulk_create không tự kích hoạt signal post_save
            # → phải tự gửi dữ liệu mới xuống frontend
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer
            channel_layer = get_channel_layer()

            # Chuẩn bị danh sách dòng mới để gửi xuống frontend
            new_rows = []
            for obj in to_insert:
                new_rows.append({
                    "timestamp":      now.strftime('%Y-%m-%d %H:%M:%S'),
                    "parameter_name": obj.register_name,
                    "register":       obj.register_address if obj.register_address is not None else "--",
                    "value":          float(obj.value) if obj.value is not None else "--",
                    "unit":           obj.unit if obj.unit else "--",
                })

            # Gửi tới group của đúng meter_id này
            # Frontend đang mở bảng chi tiết của meter nào thì sẽ nhận được
            async_to_sync(channel_layer.group_send)(
                f"meter_register_{m_id}",   # tên group khớp với MeterRegisterConsumer
                {
                    "type":    "meter_register_update",  # khớp với tên hàm trong Consumer
                    "message": new_rows,                 # danh sách dòng mới
                }
            )

    except json.JSONDecodeError as e:
        print(f"Lỗi JSON: {e}")
    except Exception as e:
        print(f"Lỗi: {e}")


# ==========================================
# KHỞI CHẠY WORKER
# ==========================================
def main():
    client = mqtt.Client(client_id=MQTT_CLIENT)
    client.on_connect = on_connect
    client.on_message = on_message

    # Reconnect tự động khi mất kết nối
    client.reconnect_delay_set(min_delay=1, max_delay=30)

    print(f"[WORKER] Đang kết nối tới {MQTT_BROKER}:{MQTT_PORT}...")
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        client.loop_forever()  # Blocking loop, tự reconnect khi mất mạng
    except KeyboardInterrupt:
        print("\nWorker dừng theo yêu cầu người dùng.")
        client.disconnect()
    except Exception as e:
        print(f"Lỗi kết nối MQTT: {e}")


if __name__ == "__main__":
    main()