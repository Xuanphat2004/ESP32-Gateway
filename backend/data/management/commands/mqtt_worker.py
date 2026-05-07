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
# THÊM MỚI: import ScanResult, ScanDevice để lưu kết quả scan vào DB
from data.models import Site, Meter, MeterRegister, ScanResult, ScanDevice

# ==========================================
# CẤU HÌNH MQTT
# ==========================================
MQTT_BROKER     = "broker.emqx.io"
MQTT_PORT       = 1883
MQTT_CLIENT     = "DJANGO-WORKER-001"
MQTT_TOPIC_DATA = "xuanphat2004/mbgateway/meter/update/data"
MQTT_TOPIC_SCAN = "xuanphat2004/mbgateway/scan/result"   # THÊM MỚI


# ==========================================
# KẾT NỐI MQTT
# THAY ĐỔI: subscribe thêm MQTT_TOPIC_SCAN
# ==========================================
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"Successful to Connected to Broker {MQTT_BROKER}")
        client.subscribe(MQTT_TOPIC_DATA)
        print(f"Listening topic: {MQTT_TOPIC_DATA}")
        client.subscribe(MQTT_TOPIC_SCAN)           # THÊM MỚI
        print(f"Listening topic: {MQTT_TOPIC_SCAN}")
    else:
        print(f"Fail to connect, error code: {rc}")


# ==========================================
# PHÂN NHÁNH THEO TOPIC
# THAY ĐỔI: thêm elif để gọi đúng handler
# ==========================================
def on_message(client, userdata, msg):
    if msg.topic == MQTT_TOPIC_DATA:
        handle_meter_data(msg)
    elif msg.topic == MQTT_TOPIC_SCAN:
        handle_scan_result(msg)     # THÊM MỚI


# ==========================================
# HANDLER CŨ — đổi tên từ on_message thành handle_meter_data
# Toàn bộ logic GIỮ NGUYÊN, không thay đổi 1 dòng
# ==========================================
def handle_meter_data(msg):
    try:
        payload = msg.payload.decode('utf-8')
        data    = json.loads(payload)
    except Exception as e:
        print(f"Fail: Can't read data from device, detail error code: {e}")
        return

    gateway_id = data.get('gateway_id')
    m_id       = data.get('m_id')
    m_name     = data.get('m_name', f"Meter {m_id}")
    model      = data.get('model', 'Power Meter')
    attr       = data.get('attr', 'Consumption_Meter')

    print(f"Recive data from Gateway: {gateway_id}")

    if m_id is None:
        print("LỖI: Thiếu m_id trong dữ liệu, bỏ qua.")
        return

    if gateway_id is None:
        print("LỖI: Thiếu gateway_id trong dữ liệu, bỏ qua.")
        return

    try:
        target_site = Site.objects.get(gateway_id=gateway_id)
        print(f"Found Site: {target_site.site_name} (ID: {target_site.site_id})")
    except Site.DoesNotExist:
        print(f"Fail: Gateway '{gateway_id}' hasn't registered on web !!!")
        return

    try:
        meter, created = Meter.objects.update_or_create(
            meter_id=m_id,
            defaults={
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

    registers_list = data.get('registers', [])
    if not registers_list:
        print("Don't have data in packet !!!")
    else:
        now       = timezone.now()
        to_insert = []
        skipped   = 0

        for reg in registers_list:
            reg_addr  = reg.get('register')
            reg_name  = reg.get('name')
            reg_value = reg.get('value', '---')
            reg_unit  = reg.get('unit', '')

            if reg_name is None:
                skipped += 1
                continue

            to_insert.append(MeterRegister(
                meter            = meter,
                register_address = reg_addr,
                register_name    = reg_name,
                value            = reg_value,
                unit             = reg_unit,
                received_at      = now,
            ))

        try:
            MeterRegister.objects.bulk_create(to_insert)
            print(f"Successful to save {len(to_insert)} Registers.")
            if skipped > 0:
                print(f"Skip {skipped} Registers miss name !!!")
        except Exception as e:
            print(f"Fail to save Registers, Error code: {e}")


# ==========================================
# THÊM MỚI HOÀN TOÀN: handle_scan_result()
#
# Flow xử lý:
#   1. Parse JSON từ MQTT payload
#   2. Tìm Site theo gateway_id — giống handle_meter_data
#   3. Tạo ScanResult  — lưu kết quả tổng quan của lần scan
#   4. Tạo ScanDevice  — lưu chi tiết từng thiết bị (active + inactive)
#      dùng bulk_create như MeterRegister để tránh N query
#   5. Push WebSocket  — chỉ khi severity = "warning"
#      Push SAU khi lưu DB: đảm bảo data có sẵn nếu frontend gọi API
# ==========================================
def handle_scan_result(msg):
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    # ── Bước 1: Parse payload ────────────────────────────────
    try:
        data = json.loads(msg.payload.decode('utf-8'))
    except Exception as e:
        print(f"[SCAN] Lỗi parse payload: {e}")
        return

    gateway_id   = data.get('gateway_id')
    severity     = data.get('severity',     'ok')
    active_ids   = data.get('active_ids',   [])
    inactive_ids = data.get('inactive_ids', [])
    wire_p1      = data.get('wire_p1_ok',   False)
    wire_p2      = data.get('wire_p2_ok',   False)
    active_port  = data.get('active_port',  0)
    # THÊM MỚI: lấy vị trí điểm đứt dây từ payload ESP32
    # final_id_p1 mặc định -1 (P1 không thấy gì)
    # final_id_p2 mặc định 0  (P2 thấy từ đầu — sẽ bị ghi đè bởi total_devices nếu không có)
    final_id_p1  = data.get('final_id_p1',  -1)
    final_id_p2  = data.get('final_id_p2',  len(active_ids) + len(inactive_ids))

    if not gateway_id:
        print("[SCAN] Thiếu gateway_id, bỏ qua")
        return

    print(f"[SCAN] Gateway: {gateway_id} | Active: {active_ids} | Inactive: {inactive_ids}")

    # ── Bước 2: Tìm Site theo gateway_id ────────────────────
    try:
        site = Site.objects.get(gateway_id=gateway_id)
        print(f"[SCAN] Site: {site.site_name} (ID: {site.site_id})")
    except Site.DoesNotExist:
        print(f"[SCAN] Gateway '{gateway_id}' chưa đăng ký")
        return

    # ── Bước 3: Lưu ScanResult ───────────────────────────────
    # Luôn CREATE MỚI — không update — vì mỗi lần scan là 1 sự kiện
    # độc lập, cần giữ toàn bộ lịch sử để user xem lại
    try:
        scan_result = ScanResult.objects.create(
            site           = site,
            scanned_at     = timezone.now(),
            severity       = severity,
            wire_p1_ok     = wire_p1,
            wire_p2_ok     = wire_p2,
            active_port    = active_port,
            # THÊM MỚI: lưu vị trí điểm đứt để web và API có thể truy vấn sau
            final_id_p1    = final_id_p1,
            final_id_p2    = final_id_p2,
            total_devices  = len(active_ids) + len(inactive_ids),
            active_count   = len(active_ids),
            inactive_count = len(inactive_ids),
        )
        print(f"[SCAN] Lưu ScanResult ID: {scan_result.id}")
    except Exception as e:
        print(f"[SCAN] Lỗi lưu ScanResult: {e}")
        return  # dừng hẳn — không push WS nếu DB lỗi

    # ── Bước 4: Lưu ScanDevice cho từng thiết bị ─────────────
    # Tách active và inactive thành từng dòng riêng
    # Dùng bulk_create — 1 lần query duy nhất dù có 100 thiết bị
    devices_to_insert = []

    for modbus_id in active_ids:
        devices_to_insert.append(ScanDevice(
            scan_result = scan_result,
            modbus_id   = modbus_id,
            status      = 'active',
            port        = active_port,
        ))

    for modbus_id in inactive_ids:
        devices_to_insert.append(ScanDevice(
            scan_result = scan_result,
            modbus_id   = modbus_id,
            status      = 'inactive',
            port        = None,         # không biết port vì không phản hồi
        ))

    try:
        ScanDevice.objects.bulk_create(devices_to_insert)
        print(f"[SCAN] Lưu {len(devices_to_insert)} ScanDevice "
              f"({len(active_ids)} active, {len(inactive_ids)} inactive)")
    except Exception as e:
        print(f"[SCAN] Lỗi lưu ScanDevice: {e}")
        # Không return — ScanResult đã lưu OK, WS vẫn push

    # ── Bước 5: Push WebSocket ────────────────────────────────
    # Chỉ push khi severity = warning — không spam khi mọi thứ OK
    # Gửi kèm scan_id để frontend có thể gọi API lấy chi tiết
    if severity != 'ok':
        group_name = f"scan_{gateway_id.replace(':', '_')}"

        message = {
            "scan_id":      scan_result.id,
            "gateway_id":   gateway_id,
            "severity":     severity,
            "active_ids":   active_ids,
            "inactive_ids": inactive_ids,
            "wire_p1_ok":   wire_p1,
            "wire_p2_ok":   wire_p2,
            "active_port":  active_port,
            "total":        len(active_ids) + len(inactive_ids),
            "timestamp":    timezone.now().isoformat(),
            "message":      f"Phát hiện {len(inactive_ids)} thiết bị mất kết nối!",
        }

        try:
            async_to_sync(get_channel_layer().group_send)(
                group_name,
                {
                    "type":    "scan.fault",
                    "message": message,
                }
            )
            print(f"[SCAN] Push WebSocket → group: {group_name}")
        except Exception as e:
            print(f"[SCAN] Lỗi push WebSocket: {e}")
    else:
        print(f"[SCAN] OK — không push WebSocket")


# ==========================================
# CHẠY WORKER — GIỮ NGUYÊN
# ==========================================
def main():
    client = mqtt.Client(client_id=MQTT_CLIENT)
    client.on_connect = on_connect
    client.on_message = on_message
    client.reconnect_delay_set(min_delay=1, max_delay=30)

    print(f"[WORKER] Connecting to {MQTT_BROKER}:{MQTT_PORT}...")

    try:
        client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        client.loop_forever()
    except KeyboardInterrupt:
        print("\nStopping...")
        client.disconnect()
    except Exception as e:
        print(f"Fail to connect with MQTT: {e}")


if __name__ == "__main__":
    main()