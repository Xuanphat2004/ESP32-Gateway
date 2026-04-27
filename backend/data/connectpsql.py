#THIET LAP KET NOI TOI POSTGRESQL

import psycopg2
import random 
import time
import datetime 
from redis_cache import push_to_cache, delete_cache


#flag for deleting cache
#Idea: get time at first 0h and check flag, if flag = 0, reset cache and set flag =1, when time at 1h, reset flag for next reset cache
flag_delete_cache = 0

#Khai bao cac bien de ket noi database
location = "localhost"
name_db = "duydatabase"
name_user = "duypsql"
mk = "180604"


#Connect to database
try:
    connection = psycopg2.connect(
        host = location,
        database = name_db,
        user = name_user,
        password = mk
    )

    print("KET NOI THANH CONG")
    cursor = connection.cursor()

except psycopg2.Error as e:
    print(f"LOI KE NOI: {e}")
    

#Dinh nghia ham random gui du lieu vao database
def generate_data():
    timestamp = datetime.datetime.now().replace(microsecond=0).isoformat()
    irradiance = round(random.uniform(0.000, 10.000), 3)
    active_power = round(random.uniform(0.000, 999.999), 3)
    temp = round(random.uniform(20.00,41.00),2)
    return (timestamp, irradiance, active_power, temp)

#Dinh nghia random cho strings
def generate_data_string():
    yields = round(random.uniform(2.00,4.00),2)
    production = round(random.uniform(300.00,400.00),2)
    name_id = random.randint(1,6)
    return(yields, production, name_id)

#Gui du lieu vao database moi 10s
try:
    while True:
        data = generate_data()
        strings_data = generate_data_string()

        print("Send: ", data)
        print("Send: ", strings_data)

        cursor.execute("""
            INSERT INTO solardb (timestamp, irradiance, active_power, temp)
            VALUES (%s, %s, %s, %s)
        """, data)

        cursor.execute("""
            INSERT INTO string_data (yields, production, name_id)
            VALUES (%s, %s, %s)
        """, strings_data)

        #Dung de reset cache theo ngay
        now = datetime.datetime.now()
        hour = now.hour
        if hour == 0 and flag_delete_cache == 0:
            delete_cache("day_history")
            delete_cache("day_string")
            flag_delete_cache = 1
        if hour == 1:
            flag_delete_cache =0
        push_to_cache("day_history",data)
        push_to_cache("day_string",strings_data)
        connection.commit()
        time.sleep(10)

except KeyboardInterrupt:
    print("\nDừng gửi dữ liệu.")
finally:
    cursor.close()
    connection.close()  

