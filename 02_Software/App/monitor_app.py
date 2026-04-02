import tkinter as tk
from tkinter import messagebox

def say_hello():
    name = entry.get()
    if name:
        messagebox.showinfo("Thông báo", f"Chào bạn {name}! Chúc bạn làm tốt đồ án Bách Khoa!")
        messagebox.showinfo("Thông báo", "Đồ án này được thực hiện bởi Xuân Phát")
    else:
        messagebox.showwarning("Cảnh báo", "Vui lòng nhập tên của bạn!")

# 1. Khởi tạo cửa sổ chính
root = tk.Tk()
root.title("App của Xuân Phát")
root.geometry("300x200")

# 2. Tạo các thành phần (Widgets)
label = tk.Label(root, text="Nhập tên của bạn:", font=("Times New Rowman", 12))
label.pack(pady=10)

entry = tk.Entry(root, font=("Arial", 12))
entry.pack(pady=5)

button = tk.Button(root, text="Nhấn vào đây", command=say_hello, bg="#1a73e8", fg="white")
button.pack(pady=20)

# 3. Chạy vòng lặp chính (tương tự loop trong ESP32)
root.mainloop()