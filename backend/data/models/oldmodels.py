from django.db import models

# Create your models here.
class SolarSystemData(models.Model):
    id = models.AutoField(primary_key=True)
    timestamp = models.DateTimeField()
    irradiance = models.FloatField()
    active_power = models.FloatField()
    temp = models.FloatField()

    #class Meta thi thuong de dung cho viec ghi de len nhung cai thuoc tinh ma ta muon thay doi voi class do
    class Meta:
        db_table = 'solardb'
        # managed = False

    def __str__(self):
        return f"{self.timestamp} - {self.active_power} kW - {self.irradiance} Wh/m^2 - {self.temp}"


class NameString(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.TextField()

    class Meta:
        db_table = 'string_name'
        # managed = False
    
    def __str__(self):
        return f"{self.name}"
    
class StringSolarData(models.Model):
    id = models.AutoField(primary_key=True)
    yields = models.FloatField()
    production = models.FloatField()
    name= models.ForeignKey(NameString,on_delete=models.CASCADE)  

    class Meta:
        db_table = 'string_data'
        # managed = False

    def __str__(self):
        return f"{self.yields} - {self.production}"