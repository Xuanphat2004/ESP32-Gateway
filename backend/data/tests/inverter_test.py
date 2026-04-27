from django.test import TestCase, Client
# from django.contrib.auth.models import User
from ..models.site import Site
from ..models.inverter import Inverter
import time
from django.utils import timezone
from datetime import datetime

class InverterAPITest(TestCase):
    def setUp(self):
        self.client = Client()
        # Tạo 1 inverter mẫu để test update
        Inverter.objects.create(inverter_id=1, inverter_name="Old Name", site_id=1)

    def test_add_inverter(self):
        response = self.client.post(
            '/solardb/add-inverter/',
            data={
                "inverter_id": 2,
                "inverter_name": "Inverter X",
                "site_id": 5
            },
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["inverter_name"], "Inverter X")

    def test_update_inverter_name(self):
        response = self.client.put(
            '/solardb/update-inverter-name/',
            data={
                "inverter_id": 1,
                "new_name": "Updated Name"
            },
            content_type="application/json"
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "updated")
        inv = Inverter.objects.get(inverter_id=1)
        self.assertEqual(inv.inverter_name, "Updated Name")

def simulate_inverter_updates(site_id, num_updates):
    # # Thêm record nhiều lần
    last_inverter = Inverter.objects.order_by('-inverter_id').first()
    if last_inverter:
        id_start = last_inverter.inverter_id
    else:
        id_start = 0 # Bắt đầu từ 0 nếu bảng trống
   
    print(f"Bắt đầu từ ID: {id_start + 1}")

    for i in range(num_updates):
        new_active_power = 100.0 + (i + 1) * 10
        new_input_power = 120.0 + (i + 1) * 10
        new_production = 50.0 + (i + 1) * 10
        id = id_start + i + 1

        Inverter.objects.create(
            inverter_id = id, 
            site_id=site_id,
            inverter_name="Inverter A",
            system_diagram="String Normal",
            state="Full Capability",
            active_power=new_active_power,
            input_power=new_input_power,
            production=new_production,
            internal_temp=30.0,
            timestamp=timezone.now(),
            manufacturer="TestManuf",
            model="VX-3000",       
            serial_number=f"SN{id}", 
            capacity=10.0,         
            string_current=0.0,
            apparent_power=0.0,
            reactive_power=0.0,
            power_factor=0.0,
            grid_frequency=0.0,
            a_phase_current=0.0,
            b_phase_current=0.0,
            c_phase_current=0.0,
            a_phase_voltage=0.0,
            b_phase_voltage=0.0,
            c_phase_voltage=0.0,
            line_voltage_L1_L2=0.0,
            line_voltage_L2_L3=0.0,
            line_voltage_L3_L1=0.0,
            irradiance=0.0,
            irradiation=0.0,
        )
        print(f"Created active_power to {new_active_power}")
        time.sleep(3)  # Đợi 3 giây giữa các cập nhật

    # Xóa bản ghi
    # Inverter.objects.filter(site_id=site_id).delete()
    # print("Deleted Inverter record")