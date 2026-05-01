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

class MeterRegister(models.Model):
    meter = models.ForeignKey(Meter, on_delete=models.CASCADE, related_name='registers')
    register_address = models.IntegerField(null=True, blank=True)
    register_name = models.CharField(max_length=255, db_index=True)
    value = models.DecimalField(max_digits=15, decimal_places=3, null=True, blank=True)
    unit = models.CharField(max_length=20, null=True, blank=True)

    received_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        db_table = 'meter_register'
        indexes = [models.Index(fields=['meter', 'received_at'])]