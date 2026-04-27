from fastapi import FastAPI, WebSocket

import json
import random
from datetime import datetime
import asyncio
app = FastAPI()

@app.websocket("/ws/dashboard/")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("Client connected to ws://localhost:8000/ws/dashboard/")
    
    try:
        while True:
            data = {
                "message": f"Dữ liệu mẫu lúc {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                "value": random.uniform(0, 100)
            }
            await websocket.send_json(data)
            print(f"Sent data: {data}")
            await asyncio.sleep(3)
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        print("Client disconnected")
        await websocket.close()