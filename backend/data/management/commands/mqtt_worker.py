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
    # THÊM: đọc status từ ESP32
    # "online"   → thiết bị đang hoạt động, lưu đầy đủ dữ liệu
    # "inactive" → thiết bị offline (đứt dây hoặc hỏng), chỉ update status
    meter_status = data.get('status', 'online')

    print(f"Receive data from Gateway: {gateway_id} | Meter {m_id} | status={meter_status}")

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
                # THAY ĐỔI: dùng status từ ESP32 thay vì hardcode 'Active'
                'status':            'Active' if meter_status == 'online' else 'Inactive',
                'timestamp':         timezone.now(),
            }
        )
        if created:
            print(f"Create new Meter: {m_name} (ID: {m_id})")
        else:
            print(f"Update Meter: {m_name} (ID: {m_id}) status={'Active' if meter_status == 'online' else 'Inactive'}")
    except Exception as e:
        print(f"Fail: Can't save Meter, Detail: {e}")
        return

    # THÊM: nếu inactive → không lưu registers
    # Tránh ghi đè dữ liệu cũ bằng dữ liệu rỗng khi thiết bị offline
    if meter_status == 'inactive':
        print(f"Meter {m_name} (ID: {m_id}) INACTIVE - bo qua registers, giu nguyen du lieu cu")
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
# XỬ LÝ KẾT QUẢ SCAN
# ==========================================
def handle_scan_result(msg):
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    try:
        data = json.loads(msg.payload.decode('utf-8'))
    except Exception as e:
        print(f"[SCAN] Lỗi parse payload: {e}")
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
    # THÊM: đọc dual_port_mode và line_ok từ ESP32
    dual_port_mode  = data.get('dual_port_mode',  False)
    line_ok         = data.get('line_ok',         True)

    if not gateway_id:
        print("[SCAN] Thiếu gateway_id, bỏ qua")
        return

    print(f"[SCAN] Gateway: {gateway_id} | Active: {active_ids} | Inactive: {inactive_ids} | dual_port={dual_port_mode}")

    try:
        site = Site.objects.get(gateway_id=gateway_id)
        print(f"[SCAN] Site: {site.site_name} (ID: {site.site_id})")
    except Site.DoesNotExist:
        print(f"[SCAN] Gateway '{gateway_id}' chưa đăng ký")
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
            # THÊM: lưu dual_port_mode và line_ok vào DB
            dual_port_mode  = dual_port_mode,
            line_ok         = line_ok,
        )
        print(f"[SCAN] Lưu ScanResult ID: {scan_result.id}")
    except Exception as e:
        print(f"[SCAN] Lỗi lưu ScanResult: {e}")
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
        print(f"[SCAN] Save {len(devices_to_insert)} ScanDevice "
              f"({len(active_ids)} active, {len(inactive_ids)} inactive)")
    except Exception as e:
        print(f"[SCAN] Lỗi lưu ScanDevice: {e}")

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
            "message":        f"Phát hiện {len(inactive_ids)} thiết bị mất kết nối!",
            # THÊM: gửi kèm dual_port_mode và line_ok để frontend hiển thị đúng
            "dual_port_mode": dual_port_mode,
            "line_ok":        line_ok,
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