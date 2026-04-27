from django.contrib import admin
from data.models.oldmodels import SolarSystemData
from data.models.oldmodels import NameString
from data.models.oldmodels import StringSolarData
# Register your models here.

@admin.register(SolarSystemData)
class SolarSystemData(admin.ModelAdmin):
    list_display = ["id", "timestamp", "irradiance", "active_power", "temp"]
    admin.register(SolarSystemData)

@admin.register(NameString)
class NameString(admin.ModelAdmin):
    list_display = ["id", "name"]
    admin.register(NameString)

@admin.register(StringSolarData)
class StringSolarData(admin.ModelAdmin):
    list_display = ["id", "yields", "production", "name"]
    admin.register(StringSolarData)