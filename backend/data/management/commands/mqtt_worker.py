import os
import json
import django
import paho.mqtt.client as mqtt
from pathlib import Path
from datetime import datetime

# ==========================================
# CẤU HÌNH MÔI TRƯỜNG DJANGO
# ==========================================
BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'SolarMonitoring.settings')
django.setup()

from django.utils import timezone
from data.models import Site, Meter, MeterRegister, ScanResult, ScanDevice

# ==========================================
# CẤU HÌNH MQTT
# ==========================================
MQTT_BROKER     = "broker.emqx.io"
MQTT_PORT       = 1883
MQTT_CLIENT     = "DJANGO-WORKER-001"
MQTT_TOPIC_DATA = "xuanphat2004/mbgateway/meter/update/data"
MQTT_TOPIC_SCAN = "xuanphat2004/mbgateway/scan/result"


# ==========================================
# PARSE TIMESTAMP TỪ THIẾT BỊ
# ==========================================
def parse_device_timestamp(ts_str):
    """
    Parse timestamp ISO 8601 từ ESP32 sang Django-aware datetime.
    Format từ thiết bị: "2026-05-23T14:30:00+07:00"
    Fallback về timezone.now() nếu lỗi.
    """
    if not ts_str:
        print("[WARN] Không có timestamp từ thiết bị, dùng giờ server.")
        return timezone.now()

    try:
        dt = datetime.fromisoformat(ts_str)
        if dt.tzinfo is None:
            from datetime import timezone as dt_tz, timedelta
            dt = dt.replace(tzinfo=dt_tz(timedelta(hours=7)))
        return dt
    except (ValueError, TypeError) as e:
        print(f"[WARN] Parse timestamp '{ts_str}' thất bại ({e}), dùng giờ server.")
        return timezone.now()


# ==========================================
# KẾT NỐI MQTT
# ==========================================
def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"Successful to Connected to Broker {MQTT_BROKER}")
        client.subscribe(MQTT_TOPIC_DATA)
        print(f"Listening topic: {MQTT_TOPIC_DATA}")
        client.subscribe(MQTT_TOPIC_SCAN)
        print(f"Listening topic: {MQTT_TOPIC_SCAN}")
    else:
        print(f"Fail to connect, error code: {rc}")


def on_message(client, userdata, msg):
    if msg.topic == MQTT_TOPIC_DATA:
        handle_meter_data(msg)
    elif msg.topic == MQTT_TOPIC_SCAN:
        handle_scan_result(msg)


# ==========================================
# XỬ LÝ DỮ LIỆU METER
# ==========================================
def handle_meter_data(msg):
    # Import ở đây để tránh circular import khi Django chưa setup
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    try:
        payload = msg.payload.decode('utf-8')
        data    = json.loads(payload)
    except Exception as e:
        print(f"Fail: Can't read data from device, detail error code: {e}")
        return

    gateway_id   = data.get('gateway_id')
    m_id         = data.get('m_id')
    m_name       = data.get('m_name', f"Meter {m_id}")
    model        = data.get('model', 'Power Meter')
    attr         = data.get('attr', 'Consumption_Meter')
    meter_status = data.get('status', 'online')

    # Parse timestamp từ thiết bị
    device_ts = parse_device_timestamp(data.get('timestamp'))

    print(f"Receive data | Gateway: {gateway_id} | Meter {m_id} "
          f"| status={meter_status} | ts={device_ts.strftime('%Y-%m-%d %H:%M:%S')}")

    if m_id is None:
        print("ERROR: Missing m_id, skip.")
        return

    if gateway_id is None:
        print("ERROR: Missing gateway_id, skip.")
        return

    try:
        target_site = Site.objects.get(gateway_id=gateway_id)
        print(f"Found Site: {target_site.site_name} (ID: {target_site.site_id})")
    except Site.DoesNotExist:
        print(f"Fail: Gateway '{gateway_id}' hasn't registered on web !!!")
        return

    # ── Tách 2 path: online vs inactive ────────────────────────────────────
    # Inactive: CHỈ cập nhật status, GIỮ NGUYÊN electrical data + timestamp
    #   → tránh ghi đè 0 lên DB khi thiết bị mất kết nối
    # Online:   cập nhật toàn bộ kể cả timestamp

    if meter_status in ('inactive', 'offline'):  # firmware gửi 'offline', guard thêm 'inactive'
        try:
            meter, created = Meter.objects.update_or_create(
                meter_id=m_id,
                defaults={
                    # Chỉ cập nhật các trường nhận dạng + status
                    # KHÔNG cập nhật volt/curr/freq/timestamp
                    # → DB giữ nguyên giá trị đo được lần cuối
                    'site_id':      target_site,
                    'meter_name':   m_name,
                    'device_model': model,
                    'attribute':    attr,
                    'status':       'Offline',
                }
            )
            if created:
                print(f"[NEW-OFFLINE] Meter: {m_name} (ID: {m_id})")
            else:
                print(f"[OFFLINE] Meter {m_name} (ID: {m_id}) — giữ nguyên data cũ")
        except Exception as e:
            print(f"Fail: Can't update Meter status, Detail: {e}")
        return  # Dừng tại đây — không xử lý registers

    # Online path: cập nhật đầy đủ kể cả electrical data và timestamp
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
                'status':            'Online',
                'timestamp':         device_ts,  # chỉ cập nhật khi online
            }
        )
        if created:
            print(f"[NEW] Meter: {m_name} (ID: {m_id})")
        else:
            print(f"[ONLINE] Meter {m_name} (ID: {m_id}) — updated")
    except Exception as e:
        print(f"Fail: Can't save Meter, Detail: {e}")
        return

    registers_list = data.get('registers', [])
    if not registers_list:
        print("Don't have data in packet !!!")
        return

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
            received_at      = device_ts,   # dùng timestamp từ thiết bị
        ))

    try:
        MeterRegister.objects.bulk_create(to_insert)
        print(f"Successful to save {len(to_insert)} Registers "
              f"| timestamp: {device_ts.strftime('%Y-%m-%d %H:%M:%S')}")
        if skipped > 0:
            print(f"Skip {skipped} Registers miss name !!!")
    except Exception as e:
        print(f"Fail to save Registers, Error code: {e}")
        return  # Không push WS nếu lưu DB thất bại

    channel_layer = get_channel_layer()

    # ── PUSH 1: Cập nhật bảng chi tiết (tầng 2) ──────────────────────────────
    # Frontend MeterRegisterConsumer đang lắng nghe group này
    # Payload gửi đúng format mà EFFECT 3 trong devicelist.jsx đang xử lý
    register_payload = [
        {
            "parameter_name": r.register_name,
            "register":       r.register_address,
            "value":          r.value,
            "unit":           r.unit,
            "timestamp":      r.received_at.isoformat(),
        }
        for r in to_insert
    ]

    try:
        async_to_sync(channel_layer.group_send)(
            f"meter_register_{m_id}",
            {
                "type":    "meter_register_update",  # → hàm meter_register_update() trong consumer
                "message": register_payload,
            }
        )
        print(f"[WS] Pushed {len(register_payload)} registers → meter_register_{m_id}")
    except Exception as e:
        print(f"[WS] Lỗi push meter_register: {e}")

    # ── PUSH 2: Cập nhật lịch sử từng thanh ghi (tầng 3) ────────────────────
    # Mỗi thanh ghi có group riêng: register_history_{meter_id}_{register_address}
    # Dùng register_address (số nguyên) làm key → tránh ký tự đặc biệt trong tên
    for r in to_insert:
        if r.register_address is None:
            continue  # bỏ qua nếu không có địa chỉ

        history_group = f"register_history_{m_id}_{r.register_address}"

        history_payload = {
            "received_at":      r.received_at.isoformat(),
            "register_address": r.register_address,
            "register_name":    r.register_name,
            "value":            r.value,
            "unit":             r.unit,
        }

        try:
            async_to_sync(channel_layer.group_send)(
                history_group,
                {
                    "type": "register_history_update",  # → hàm register_history_update() trong consumer
                    "data": history_payload,
                }
            )
        except Exception as e:
            print(f"[WS] Lỗi push register_history addr={r.register_address}: {e}")

    print(f"[WS] Pushed register history → {len(to_insert)} groups")


# ==========================================
# XỬ LÝ KẾT QUẢ SCAN
# ==========================================
def handle_scan_result(msg):
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    try:
        data = json.loads(msg.payload.decode('utf-8'))
    except Exception as e:
        print(f"[SCAN] Parse payload error: {e}")
        return

    gateway_id      = data.get('gateway_id')
    severity        = data.get('severity',        'ok')
    active_ids      = data.get('active_ids',      [])
    inactive_ids    = data.get('inactive_ids',    [])
    wire_p1         = data.get('wire_p1_ok',      False)
    wire_p2         = data.get('wire_p2_ok',      False)
    active_port     = data.get('active_port',     0)
    final_id_p1     = data.get('final_id_p1',     -1)
    final_id_p2     = data.get('final_id_p2',     len(active_ids) + len(inactive_ids))
    dual_port_mode  = data.get('dual_port_mode',  False)
    line_ok         = data.get('line_ok',         True)

    if not gateway_id:
        print("[SCAN] Missing gateway_id, skip")
        return

    print(f"[SCAN] Gateway: {gateway_id} | Active: {active_ids} "
          f"| Inactive: {inactive_ids} | dual_port={dual_port_mode}")

    try:
        site = Site.objects.get(gateway_id=gateway_id)
        print(f"[SCAN] Site: {site.site_name} (ID: {site.site_id})")
    except Site.DoesNotExist:
        print(f"[SCAN] Gateway '{gateway_id}' not registered")
        return

    try:
        scan_result = ScanResult.objects.create(
            site            = site,
            scanned_at      = timezone.now(),
            severity        = severity,
            wire_p1_ok      = wire_p1,
            wire_p2_ok      = wire_p2,
            active_port     = active_port,
            final_id_p1     = final_id_p1,
            final_id_p2     = final_id_p2,
            total_devices   = len(active_ids) + len(inactive_ids),
            active_count    = len(active_ids),
            inactive_count  = len(inactive_ids),
            dual_port_mode  = dual_port_mode,
            line_ok         = line_ok,
        )
        print(f"[SCAN] Saved ScanResult ID: {scan_result.id}")
    except Exception as e:
        print(f"[SCAN] Error saving ScanResult: {e}")
        return

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
            port        = None,
        ))

    try:
        ScanDevice.objects.bulk_create(devices_to_insert)
        print(f"[SCAN] Saved {len(devices_to_insert)} ScanDevice "
              f"({len(active_ids)} active, {len(inactive_ids)} inactive)")
    except Exception as e:
        print(f"[SCAN] Error saving ScanDevice: {e}")

    if severity != 'ok':
        group_name = f"scan_{gateway_id.replace(':', '_')}"
        message = {
            "scan_id":        scan_result.id,
            "gateway_id":     gateway_id,
            "severity":       severity,
            "active_ids":     active_ids,
            "inactive_ids":   inactive_ids,
            "wire_p1_ok":     wire_p1,
            "wire_p2_ok":     wire_p2,
            "active_port":    active_port,
            "total":          len(active_ids) + len(inactive_ids),
            "timestamp":      timezone.now().isoformat(),
            "message":        f"Detected {len(inactive_ids)} device(s) disconnected!",
            "dual_port_mode": dual_port_mode,
            "line_ok":        line_ok,
        }
        try:
            async_to_sync(get_channel_layer().group_send)(
                group_name,
                {"type": "scan.fault", "message": message}
            )
            print(f"[SCAN] Push WebSocket → group: {group_name}")
        except Exception as e:
            print(f"[SCAN] WebSocket push error: {e}")
    else:
        print(f"[SCAN] OK — no WebSocket push")


# ==========================================
# CHẠY WORKER
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