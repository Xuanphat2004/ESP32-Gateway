import sys
import signal
import database
import asyncio
from qasync import QEventLoop
from logic import config_logic
from ui import ModbusApp
from PyQt6.QtWidgets import QApplication

APP_STYLESHEET = """
/* ── QPushButton: trạng thái bình thường ─────────────────────────────── */
QPushButton {
    border-radius: 4px;
    padding: 4px 12px;
    font-size: 13px;
    transition: background-color 0.15s;
}

/* ── Hover: rê chuột vào ────────────────────────────────────────────── */
QPushButton:hover {
    filter: brightness(1.12);
    opacity: 0.92;
}

/* Nút xanh lá (New Device) */
QPushButton[style*="#34a853"]:hover,
QPushButton:hover[text="+ New Device"] {
    background-color: #2d9147;
}

/* Nút đỏ (Sync / Delete) */
QPushButton:hover[style*="#ea4335"] {
    background-color: #c5392e;
}

/* ── Pressed: đang giữ chuột ────────────────────────────────────────── */
QPushButton:pressed {
    padding-top: 6px;
    padding-bottom: 2px;
}

/* ── Disabled: mờ đi ────────────────────────────────────────────────── */
QPushButton:disabled {
    color: #aaaaaa;
}
"""


def build_stylesheet():
    """
    Trả về QSS stylesheet toàn cục có hiệu ứng hover / pressed cho mọi QPushButton.
    Dùng :hover và :pressed — đây là cách Qt6 hỗ trợ chính thức.
    """
    # Định nghĩa từng nhóm màu theo "base color" để tạo hover (sáng hơn) và press (tối hơn)
    btn_themes = [
        # (selector,           normal_bg,  hover_bg,   press_bg,   color)
        ("QPushButton",        "#e0e0e0",  "#cacaca",  "#b0b0b0",  "#333333"),  # mặc định xám
        # Xanh lá — New Device
        ('[text="+ New Device"]', "#34a853", "#2d9147", "#256e39", "white"),
        # Đỏ — Sync to Device
        ('[text="Sync to Device"]', "#ea4335", "#d33426", "#b82c20", "white"),
        # Đỏ nhạt — Delete (per-row)
        ('[text="Delete"]',    "#ea4335",  "#d33426",  "#b82c20",  "white"),
        # Vàng — Edit Table
        ('[text="✏️  Edit Table"]', "#f9ab00", "#e09a00", "#c78800", "white"),
        # Xanh dương đậm — Update (active)
        ('[text="💾  Update"]', "#1a73e8", "#1765cc", "#1257b0", "white"),
        # Xanh BLE
        ('[text="Scan Devices"]', "#5f6368", "#4e5256", "#3d4144", "white"),
        # Xanh dương nhạt — Add Register
        ('[text="Add Register"]', "#4285f4", "#3367d6", "#2a56c6", "white"),
    ]

    qss_parts = []
    for sel, normal, hover, press, fg in btn_themes:
        base = f"QPushButton{sel}"
        qss_parts.append(f"""
{base} {{
    background-color: {normal};
    color: {fg};
    border-radius: 5px;
    padding: 4px 14px;
    font-size: 13px;
    border: none;
}}
{base}:hover {{
    background-color: {hover};
}}
{base}:pressed {{
    background-color: {press};
    padding-top: 6px;
    padding-bottom: 2px;
}}
{base}:disabled {{
    opacity: 0.45;
}}
""")

    return "\n".join(qss_parts)


async def main():
    # Bước 1: Tạo môi trường Ứng dụng
    app = QApplication(sys.argv)
    app.setStyleSheet(build_stylesheet())   # ← áp dụng hiệu ứng hover/press toàn cục

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