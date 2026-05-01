import os
import json
import django
import paho.mqtt.client as mqtt
from pathlib import Path

# ==========================================
# CẤU HÌNH MÔI TRƯỜNG DJANGO
# ==========================================
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'SolarMonitoring.settings')
django.setup()

from django.utils import timezone
from data.models import Site, Meter, MeterRegister

# ==========================================
# CẤU HÌNH MQTT
# ==========================================
MQTT_BROKER = "broker.emqx.io"
MQTT_PORT   = 1883
MQTT_TOPIC  = "xuanphat2004/mbgateway/meter/update/data"
MQTT_CLIENT = "DJANGO-WORKER-001"


# ==========================================
# KẾT NỐI MQTT
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"Successful to Connected to Broker {MQTT_BROKER}")
        client.subscribe(MQTT_TOPIC)
        print(f"Listening topic: {MQTT_TOPIC}")
    else:
        print(f"Fail to connect, error code: {rc}")


# ==========================================
# XỬ LÝ KHI NHẬN ĐƯỢC TIN NHẮN TỪ THIẾT BỊ
def on_message(client, userdata, msg):

    # GIẢI MÃ DỮ LIỆU TỪ THIẾT BỊ
    try:
        payload = msg.payload.decode('utf-8') # UTF-8: quy định cách chuyển đổi chữ viết thành số nhị phân
        data    = json.loads(payload)
    except Exception as e:
        print(f"Fail: Can't read data from device, detail error code: {e}")
        return

    # LẤY THÔNG TIN CƠ BẢN TỪ DATA
    gateway_id = data.get('gateway_id')
    m_id       = data.get('m_id')
    m_name     = data.get('m_name', f"Meter {m_id}")
    model      = data.get('model', 'Power Meter')
    attr       = data.get('attr', 'Consumption_Meter')

    print(f"Recive data from Gateway: {gateway_id}")

    # Kiểm tra m_id có tồn tại không
    if m_id is None:
        print("LỖI: Thiếu m_id trong dữ liệu, bỏ qua.")
        return

    # Kiểm tra gateway_id có tồn tại không
    if gateway_id is None:
        print("LỖI: Thiếu gateway_id trong dữ liệu, bỏ qua.")
        return

    # TÌM SITE THEO GATEWAY_ID
    # Tìm trong database xem gateway_id này thuộc site nào
    # Nếu không tìm thấy → thiết bị chưa được đăng ký → bỏ qua
    try:
        target_site = Site.objects.get(gateway_id = gateway_id)
        print(f"Found Site: {target_site.site_name} (ID: {target_site.site_id})")
    except Site.DoesNotExist:
        print(f"Fail: Gateway '{gateway_id}' hasn't registered on web !!!")
        print(f"Please check on web or register new gateway.")
        return

    # BƯỚC 4: CẬP NHẬT BẢNG METER (DỮ LIỆU TỔNG QUÁT)
    # update_or_create:
    # → Nếu Meter với m_id đã có → cập nhật giá trị mới
    # → Nếu chưa có → tạo mới
    try:
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

        if created:
            print(f"Create new Meter: {m_name} (ID: {m_id})")
        else:
            print(f"Update Meter: {m_name} (ID: {m_id})")

    except Exception as e:
        print(f"Fail: Can't save Meter, Detail: {e}")
        return

    # ------------------------------------------
    # BƯỚC 5: LƯU THANH GHI VÀO BẢNG METERREGISTER
    # ------------------------------------------
    registers_list = data.get('registers', [])

    if not registers_list:
        print("Không có thanh ghi trong gói tin — bỏ qua bước lưu thanh ghi.")
    else:
        now        = timezone.now()
        to_insert  = []
        skipped    = 0

        # Duyệt qua từng thanh ghi trong danh sách
        for reg in registers_list:
            reg_addr  = reg.get('register')
            reg_name  = reg.get('name')
            reg_value = reg.get('value', '---')
            reg_unit  = reg.get('unit', '')

            # Bỏ qua thanh ghi nếu thiếu tên
            if reg_name is None:
                skipped += 1
                continue

            # Tạo object MeterRegister — chưa lưu vào DB
            new_register = MeterRegister(
                meter            = meter,
                register_address = reg_addr,
                register_name    = reg_name,
                value            = reg_value,
                unit             = reg_unit,
                received_at      = now,
            )
            to_insert.append(new_register)

        # Lưu tất cả thanh ghi vào DB cùng 1 lúc
        try:
            MeterRegister.objects.bulk_create(to_insert)
            print(f"Lưu {len(to_insert)} thanh ghi thành công.")
            if skipped > 0:
                print(f"Bỏ qua {skipped} thanh ghi thiếu tên.")
        except Exception as e:
            print(f"LỖI: Không thể lưu thanh ghi. Chi tiết: {e}")
            return


# ==========================================
# CHẠY WORKER
def main():
    client = mqtt.Client(client_id=MQTT_CLIENT)
    client.on_connect = on_connect
    client.on_message = on_message

    # Tự động kết nối lại khi mất kết nối
    client.reconnect_delay_set(min_delay=1, max_delay=30)

    print(f"[WORKER] Connected to {MQTT_BROKER}:{MQTT_PORT}...")

    try:
        client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        client.loop_forever()
    except KeyboardInterrupt:
        print("\nStoppinggggggggggggggggggggggg...................")
        client.disconnect()
    except Exception as e:
        print(f"Fail to connect with MQTT: {e}")


if __name__ == "__main__":
    main()