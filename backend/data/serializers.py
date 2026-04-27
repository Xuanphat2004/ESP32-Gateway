from rest_framework import serializers
from data.models import SolarSystemData

class SolarSystemDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = SolarSystemData
        fields = '__all__'


