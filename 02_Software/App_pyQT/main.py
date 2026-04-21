import sys
import signal
import database
import asyncio
from qasync import QEventLoop
from logic import config_logic
from ui import ModbusApp
from PyQt6.QtWidgets import QApplication


async def main():
    # Bước 1: Tạo môi trường Ứng dụng
    app = QApplication(sys.argv)

    signal.signal(signal.SIGINT, signal.SIG_DFL)
    # Bước 2: Tạo đối tượng Giao diện của chúng ta
    window = ModbusApp()
    controller = config_logic(
        window
    )  # Tạo đối tượng Logic và truyền vào Giao diện để Logic có thể thao tác với các thành phần trên Giao diện
    window.show()  # Ra lệnh hiển thị lên màn hình

    # Bước 3: Đóng băng và chờ sự kiện (Giống root.mainloop() của Tkinter)
    loop = QEventLoop(app)
    asyncio.set_event_loop(loop)
    await loop.run_forever()


if __name__ == "__main__":
    asyncio.run(main())
