from django.db import models
from django.utils import timezone
from .site import Site

class Meter(models.Model):
    # thoi gian
    timestamp  = models.DateTimeField(default=timezone.now)

    # thong tin dinh danh thiet bi
    site_id = models.ForeignKey(Site, on_delete=models.CASCADE)
    meter_name = models.CharField(max_length=255)
    device_model = models.CharField(max_length=255)
    meter_id = models.IntegerField(primary_key=True)
    attribute = models.CharField(max_length=20)
    status = models.CharField(max_length=20)

    # Thong tin ve du lieu chinh
    voltage_l1 = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    current_l1  = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    current_l1_dmd = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    frequency_l1 = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    apparent_power_l1  = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    real_power = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)

    class Meta:
        db_table = 'meter'
        # managed = False

class MeterRegister(models.Model):
    # FK tới Meter — mỗi thanh ghi thuộc về 1 thiết bị cụ thể
    meter = models.ForeignKey(Meter, on_delete=models.CASCADE, related_name='registers')

    # ← THÊM MỚI: lưu địa chỉ Modbus của thanh ghi (ví dụ: 0, 2, 4...)
    # mqtt_worker gửi field "register" trong mỗi phần tử của mảng registers
    register_address = models.IntegerField(null=True, blank=True)

    # Tên tham số đo được (ví dụ: "Volt-L1-N", "Cur-L1", "Real-Pwr")
    register_name = models.CharField(max_length=255, db_index=True)

    # Giá trị đo được tại thời điểm gửi
    value = models.DecimalField(max_digits=15, decimal_places=3, null=True, blank=True)

    # Đơn vị đo (ví dụ: "V", "A", "W")
    unit = models.CharField(max_length=20, null=True, blank=True)

    # ← ĐỔI TỪ auto_now SANG default=timezone.now
    # auto_now: tự cập nhật mỗi lần save → không kiểm soát được
    # default=timezone.now: mqtt_worker tự set cùng 1 giá trị cho cả batch
    # → nhờ vậy có thể nhóm "tất cả thanh ghi cùng received_at = 1 lần gửi MQTT"
    received_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = 'meter_register'

        # ← XÓA unique_together
        # unique_together cũ: ('meter', 'register_name') → chỉ cho phép 1 dòng/tên thanh ghi
        # → bị ghi đè, mất lịch sử
        # Xóa đi để cho phép INSERT nhiều dòng cùng register_name → lưu được lịch sử

        # Thêm index để query nhanh khi lọc theo meter + thời gian
        indexes = [models.Index(fields=['meter', 'received_at'])]