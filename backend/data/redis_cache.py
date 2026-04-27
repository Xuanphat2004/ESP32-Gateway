import redis
import json

#connect to Redis
r = redis.StrictRedis(host='localhost', port=6379, db=0, decode_responses= True)

def set_data_to_cache(key, data, expire=86400):
    r.set(key, json.dumps(data), ex=expire) 

def get_data_from_cache(key):
    data = r.get(key)
    return json.loads(data) if data else None

def delete_cache(key):
    r.delete(key)

def push_to_cache(list_key,data):
    r.rpush(list_key, json.dumps(data))

def pop_list(list_key):
    return r.lrange(list_key, 0, -1)
        
def get_last_data(key):
    return r.lrange(key,-1,-1)