from django.db import models
from django.utils import timezone
from .site import Site

class Inverter(models.Model):
    # all information of device in system
    inverter_id = models.IntegerField(primary_key=True)
    site = models.ForeignKey(Site, on_delete=models.CASCADE)
    inverter_name = models.CharField(max_length=255)
    manufacturer = models.CharField(max_length=255)
    model = models.CharField(max_length=255)
    serial_number = models.CharField(max_length=50)
    system_diagram = models.CharField(max_length=20)
    state = models.CharField(max_length=20)

    # all parameter value columm 
    capacity       = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    string_current = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    active_power   = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    input_power    = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    apparent_power = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    reactive_power = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    power_factor   = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    grid_frequency  = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    internal_temp   = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    a_phase_current = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    b_phase_current = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    c_phase_current = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    a_phase_voltage = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    b_phase_voltage = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    c_phase_voltage = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    line_voltage_L1_L2 = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    line_voltage_L2_L3 = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)
    line_voltage_L3_L1 = models.DecimalField(max_digits=10, decimal_places=2, null = True, blank = True)

    production = models.DecimalField(max_digits=10, decimal_places=2) # total electrical energy generated
    irradiance = models.DecimalField(max_digits=10, decimal_places=2) # luu cuong do buc xa nang luong mat troi
    irradiation = models.DecimalField(max_digits=10, decimal_places=2) # tong cuong do buc xa
    timestamp = models.DateTimeField(default=timezone.now) 

    class Meta:
        db_table = 'inverter'
        # managed = False