from django.shortcuts import render
from rest_framework import generics
from ..models import SolarSystemData
from ..serializers import SolarSystemDataSerializer
from rest_framework import viewsets, permissions
from rest_framework.response import Response
from ..redis_cache import get_data_from_cache, set_data_to_cache
from django.http import JsonResponse
from django.core.serializers.json import DjangoJSONEncoder
import json
from ..redis_cache import push_to_cache
from ..redis_cache import pop_list, get_last_data
from collections import OrderedDict, defaultdict
from datetime import datetime
from ..models import NameString





class SolarSystemDataViewSet(viewsets.ModelViewSet):
    queryset = SolarSystemData.objects.all()
    serializer_class = SolarSystemDataSerializer


#-----------------------------------LAY DU LIEU TRONG CACHE-------------------------------------------

def chart_data_view(request):
    cache_key ="day_history"
    raw_data = pop_list(cache_key)
    # print(f"{data}")

    if raw_data is None:
        #Neu khong co trong Redis thi lay tu database
        queryset = SolarSystemData.objects.all().values()
        raw_data = json.loads(json.dumps(list(queryset), cls=DjangoJSONEncoder))
        #Luu vao Redis lai
    formatted_data = value_to_dict(raw_data)
    print(formatted_data)
    return JsonResponse(formatted_data, safe=False)

def value_to_dict(raw_data):
    data = []
    keys = ["timestamp","irradiance","active_power",'temp']
    for item in raw_data:
        parsed = json.loads(item)
        data.append(dict(zip(keys,parsed)))
    return data
#----------------------------------------------------------------------------------------------------


#-----------------------LAY DU LIEU DAI DIEN CHO 1 MOC THOI GIAN-------------------------------------

class HourlyDataViewSet(viewsets.ModelViewSet):
    serializer_class = SolarSystemDataSerializer

    def get_queryset(self):
        queryset = SolarSystemData.objects.order_by('timestamp')
        hourly_data =OrderedDict()
        for record in queryset:
            hour = record.timestamp.replace(minute=0, second=0, microsecond=0)
            if hour not in hourly_data:
                hourly_data[hour] = record
        return list(hourly_data.values())
#-----------------------------------------------------------------------------------------------------        


#-------------------------------TINH TRUNG BINH DU LIEU TRONG 1H--------------------------------------

def average_data(request):
    cache_key = "day_history"
    raw_data = value_to_dict(pop_list(cache_key))
    filter_data = defaultdict(list)
    avr_data = []

    for item in raw_data:
        dt = datetime.fromisoformat(item['timestamp'])
        hour = dt.hour
        filter_data[hour].append({
            "active_power": float(item['active_power']),
            "irradiance" : float(item['irradiance'])
        })

    for key, record in filter_data.items():
        total_power = 0
        total_irradiance = 0
        count = len(record)

        for p in record:
            total_power += p['active_power']
            total_irradiance += p['irradiance']
            
        avr_data.append({'time':key, 'avr_power' : round(total_power/count,1), 'avr_irradiance' : round(total_irradiance/count,1)})

    return JsonResponse(avr_data, safe=False)
#------------------------------------------------------------------------------------------------------------



#------------------------------------------GETTING DATA FOR INVERT RANKING-----------------------------------




def inverter_ranking(request):
    data_string = []
    try:
        name_only_list = list(NameString.objects.values_list('name',flat = True))
        for name in name_only_list:
            data_string.append({'name': name , 'yields': 0, 'production': 0})
    except Exception as e:
        data_string = []
        print(f"Error fetching names: {e}")

    cache_key = "day_string"
    raw_data = get_last_data(cache_key)
    if raw_data and len(raw_data) > 0:
        try:
            parsed_array = json.loads(raw_data[0]) 

            data_string[parsed_array[2]-1]['yields'] = parsed_array[0]
            data_string[parsed_array[2]-1]['production'] = parsed_array[1] 
        except (json.JSONDecodeError, IndexError):
            pass

    return JsonResponse(data_string, safe=False)

# tuong la tao ra 1 cai list voi cac name tu bang NameString,
# dung cai list name do de gan cho cai value cua cai key name trong data, voi data la cai mang gom cac dict de lay cho inverter_ranking
# goi du lieu moi nhat tu cache, dua vao cai id trong do de gan value cho cai yields va production tuong ung voi cai id se la cai id cho 
# cai mang data luon, 

#------------------------------------------------------------------------------------------------------------


  




