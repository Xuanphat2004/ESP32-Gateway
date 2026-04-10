from PyQt6.QtWidgets import QMessageBox, QTableWidgetItem
from PyQt6.QtWidgets import (
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QGridLayout,
    QGroupBox,
    QLabel,
    QLineEdit,
    QComboBox,
    QPushButton,
    QTableWidget,
    QHeaderView,
    QAbstractItemView,
)
from PyQt6.QtCore import Qt, QObject
import database
from qasync import asyncSlot
from bleak import BleakScanner, BleakClient
import re
import asyncio
import json  # Thư viện để đóng gói dữ liệu thành chuỗi JSON

# import paho.mqtt.client as mqtt # Thư viện để gửi dữ liệu qua mạng


# UUID này phải khớp với khai báo trong file ble.c của ESP32
MODBUS_CHAR_UUID = "0000ff11-0000-1000-8000-00805f9b34fb"
# ==============================================================================================================================
# ======== Các bảng Tra cứu (Mapping) để dịch từ chuỗi văn bản sang mã số cho Gateway hiểu được ============================

DATA_TYPE_MAPPING = {
    "Unsigned 16 bits": 0x01,  # EM07K
    "Unsigned 32 bits": 0x02,
    "Float ABCD": 0x1A,  # PM710
    "Float CDAB": 0x1B,
    "Integer": 0x0E,
    "Long": 0x12,
}

# Dịch mã hàm Modbus
FUNCTION_CODE_MAPPING = {
    "Read Holding Registers (0x03)": 0x00,  # Quy ước Gateway: 0 là Holding
    "Read Input Registers (0x04)": 0x01,  # Quy ước Gateway: 1 là Input
}

# Dịch mã công thức tính toán
MUL_MAPPING = {
    "Data * Scale": 0,
    "Data * Scale * Factor 1": 1,
    "Data * Scale * Factor 1 * Factor 2": 2,
}

# Dịch tên thiết bị sang địa chỉ mạng (Topic)
DEVICE_MAPPING = {
    "Device 1": {"host": "broker.emqx.io", "topic": "gateway/config/device_1"},
    "Device 2": {"host": "broker.emqx.io", "topic": "gateway/config/device_2"},
}


class config_logic(QObject):
    # =============================================================================================================================
    # ======== Hàm khởi tạo, hàm này sẽ chạy ngay khi Logic được tạo ra ============================
    def __init__(self, ui_view):  # Truyền địa chỉ của toàn bộ cửa sổ UI vào cho lớp UI
        super().__init__()
        self.ui = ui_view  # self.ui lúc này chính là con trỏ, nó trỏ thẳng tới các linh kiện bên trong UI

        # Logic sẽ lo việc kích hoạt Database và chạy Data lần đầu
        database.init_db()
        self.connect_signals()
        self.load_data()

    # =============================================================================================================================
    # ======== Hàm kết nối các tín hiệu từ UI vào các hàm xử lý của Logic ============================
    def connect_signals(self):
        # Nối nút từ UI vào hàm của Logic
        self.ui.btn_add.clicked.connect(
            self.add_new_register
        )  # Gán logic xử lý cho sự kiện click cho nút bấm Add.
        # self.ui.btn_delete.clicked.connect(self.delete_register) #Gán logic xử lý cho sự kiện click cho nút bấm Delete
        self.ui.btn_clear.clicked.connect(
            self.clear_inputs
        )  # Gán logic xử lý cho sự kiện click cho nút bấm Clear Form
        self.ui.combo_mul.currentTextChanged.connect(self.toggle_multiplier_fields)
        self.ui.btn_scan_ble.clicked.connect(
            self.scan_ble_devices
        )  # Gán chức năng cho nút scan BLE
        # self.ui.btn_update.clicked.connect(self.sync_data_to_mqtt) # Gán chức năng cho nút update để gửi dữ liệu lên MQTT
        self.ui.btn_update.clicked.connect(self.sync_data_to_ble)

    # =============================================================================================================================
    # ======== Các hàm tương tác với database ============================
    # Tải lại dữ liệu của nguyên bảng
    def load_data(self):
        self.ui.table.setRowCount(0)  # Phải có self.ui
        rows = database.get_all_registers()
        for row_idx, row_data in enumerate(rows):
            self.ui.table.insertRow(row_idx)  # Phải có self.ui

            for col_idx in range(1, 12):
                item = QTableWidgetItem(str(row_data[col_idx]))
                item.setFlags(item.flags() & ~Qt.ItemFlag.ItemIsEditable)
                if col_idx == 1:
                    item.setData(Qt.ItemDataRole.UserRole, row_data[0])
                if col_idx != 2:
                    item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)

                self.ui.table.setItem(row_idx, col_idx - 1, item)  # Phải có self.ui

            # Tạo hộp trống để tạo ra 2 nút Edit và Delete ở cột cuối cùng
            action_widget = QWidget()
            layout = QHBoxLayout(action_widget)
            layout.setContentsMargins(
                5, 2, 5, 2
            )  # Căn lề cho đẹp (trái, trên, phải, dưới)
            layout.setSpacing(5)

            btn_edit = QPushButton("Edit")  # Tạo nút Edit
            btn_edit.setStyleSheet(
                "background-color: #34a853; color: white; padding: 2px; border-radius: 3px;"
            )

            btn_delete = QPushButton("Delete")  # Tạo nút Delete
            btn_delete.setStyleSheet(
                "background-color: #34a853; color: white; padding: 2px; border-radius: 3px;"
            )

            btn_update = QPushButton("Update")  # Tạo nút Update
            btn_update.setEnabled(
                False
            )  # Ban đầu nút Update bị vô hiệu hóa, chỉ Enable khi người dùng bấm Edit
            btn_update.setStyleSheet(
                "background-color: #34a853; color: white; padding: 2px; border-radius: 3px;"
            )

            btn_edit.clicked.connect(
                lambda ch, r=row_idx, bu=btn_update, be=btn_edit: self.enable_row_edit(
                    r, bu, be
                )
            )
            btn_update.clicked.connect(lambda ch, r=row_idx: self.confirm_update(r))
            db_id = row_data[0]  # Lấy ID từ cột 0 của Database
            btn_delete.clicked.connect(
                lambda ch, id=db_id: self.delete_register_by_id(id)
            )

            layout.addWidget(
                btn_edit
            )  # đưa cấu hình của nút Edit vào hộp trống ban đầu tạo
            layout.addWidget(
                btn_update
            )  # đưa cấu hình của nút Update vào hộp trống ban đầu tạo
            layout.addWidget(
                btn_delete
            )  # đưa cấu hình của nút Delete vào hộp trống ban đầu tạo

            self.ui.table.setCellWidget(
                row_idx, 11, action_widget
            )  # Đặt 2 nút nhấn vào cột cuối

    # Thực hiện chức năng thêm mới thanh ghi - nút Add
    def add_new_register(self):
        name = self.ui.entry_name.text().strip()
        slave_id = self.ui.entry_slave_id.text().strip()
        address = self.ui.entry_address.text().strip()
        unit = self.ui.entry_unit.text().strip()
        data_type = self.ui.combo_type.currentText()
        scale = self.ui.combo_scale.currentText()
        quantity = self.ui.combo_quantity.currentText()
        function = self.ui.combo_function.currentText()
        multiplier = self.ui.combo_mul.currentText()

        if (
            not name
            or not slave_id
            or not address
            or data_type == "---"
            or scale == "---"
            or quantity == "---"
            or function == "---"
            or multiplier == "---"
        ):
            QMessageBox.warning(
                self.ui, "Warning", "Please Fill all information of a register !!!"
            )
            return

        f1 = self.ui.entry_f1.text().strip() if self.ui.entry_f1.isVisible() else "NULL"
        f2 = self.ui.entry_f2.text().strip() if self.ui.entry_f2.isVisible() else "NULL"
        database.insert_register(
            slave_id,
            name,
            unit,
            function,
            address,
            quantity,
            data_type,
            scale,
            multiplier,
            f1,
            f2,
        )
        self.load_data()
        self.clear_inputs()

    # Thực hiện xóa 1 hàng bất kì - nút Delete
    def delete_register(self):
        current_row = self.ui.table.currentRow()  # Phải có self.ui
        if current_row < 0:
            QMessageBox.warning(self.ui, "Warning", "Please select a row to delete !!!")
            return

        reply = QMessageBox.question(
            self.ui,
            "Confirm",
            "Are you sure you want to delete this register ?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )

        if reply == QMessageBox.StandardButton.Yes:
            item = self.ui.table.item(current_row, 0)  # Phải có self.ui
            db_id = item.data(Qt.ItemDataRole.UserRole)

            database.delete_register_by_id(db_id)
            self.load_data()

    def delete_register_by_id(self, db_id):
        # 1. Hỏi xác nhận cho chắc chắn
        reply = QMessageBox.question(
            self.ui,
            "Confirm",
            "Are you sure you want to delete this register?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )

        if reply == QMessageBox.StandardButton.Yes:
            # 2. Gọi thẳng Database xóa theo ID đã nhận được từ lambda
            database.delete_register_by_id(db_id)

            # 3. Load lại bảng để cập nhật giao diện
            self.load_data()

    # =============================================================================================================================
    # ======== Hàm xóa trắng các ô nhập liệu sau khi đã thêm dữ liệu thành công hoặc khi người dùng bấm nút Clear Form ===========
    def clear_inputs(self):
        # Phải có self.ui ở mọi ngóc ngách!
        self.ui.entry_name.clear()
        self.ui.entry_slave_id.clear()
        self.ui.entry_address.clear()
        self.ui.entry_unit.clear()
        self.ui.combo_quantity.setCurrentIndex(0)
        self.ui.combo_function.setCurrentIndex(0)
        self.ui.combo_scale.setCurrentIndex(0)
        self.ui.combo_type.setCurrentIndex(0)
        self.ui.combo_mul.setCurrentIndex(0)
        self.ui.entry_f1.clear()

    def confirm_update(self, row_idx):
        # Hỏi người dùng
        reply = QMessageBox.question(
            self.ui,
            "Confirm",
            "Are you want to update this register ?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )

        if reply == QMessageBox.StandardButton.Yes:
            # Lấy ID Database đã giấu ở cột 0
            db_id = self.ui.table.item(row_idx, 0).data(Qt.ItemDataRole.UserRole)

            # Đọc dữ liệu mới từ các ô trên bảng
            # Thứ tự phải khớp với hàm update_register trong database.py
            slave_id = self.ui.table.item(row_idx, 0).text()
            name = self.ui.table.item(row_idx, 1).text()
            unit = self.ui.table.item(row_idx, 2).text()
            function = self.ui.table.item(row_idx, 3).text()
            address = self.ui.table.item(row_idx, 4).text()
            quantity = self.ui.table.item(row_idx, 5).text()
            data_type = self.ui.table.item(row_idx, 6).text()
            scale = self.ui.table.item(row_idx, 7).text()
            multiplier = self.ui.table.item(row_idx, 8).text()
            factor_1 = self.ui.table.item(row_idx, 9).text()
            factor_2 = self.ui.table.item(row_idx, 10).text()

            # Gọi Database để cập nhật
            # Cẩn thận thứ tự tham số truyền vào hàm update_register nhé Phát!
            database.update_register(
                db_id,
                slave_id,
                name,
                unit,
                function,
                address,
                quantity,
                data_type,
                scale,
                multiplier,
                factor_1,
                factor_2,
            )

            # Tải lại dữ liệu để khóa các ô lại
            self.load_data()
            QMessageBox.information(self.ui, "Successful", "Data updated successfully")

    def enable_row_edit(self, row_idx, btn_update, btn_edit):
        # Duyệt qua các cột từ 0 đến 11 để cho phép sửa
        for col_idx in range(11):
            item = self.ui.table.item(row_idx, col_idx)
            if item:
                # Bật cờ cho phép chỉnh sửa (ItemIsEditable)
                item.setFlags(item.flags() | Qt.ItemFlag.ItemIsEditable)

        # Kích hoạt nút Update và đổi sang màu đậm
        btn_update.setEnabled(True)
        btn_update.setStyleSheet(
            "background-color: #34a853; color: white; padding: 2px; border-radius: 3px;"
        )

        # Vô hiệu hóa nút Edit và cho nó nhạt đi
        btn_edit.setEnabled(False)
        btn_edit.setStyleSheet(
            "background-color: #cccccc; color: #666666; padding: 2px; border-radius: 3px;"
        )

        # Tự động đưa con trỏ vào ô đầu tiên của dòng đó cho tiện
        self.ui.table.editItem(self.ui.table.item(row_idx, 0))

    # Điều khiển việc ẩn hiện của các ô factor 1 và factor 2
    def toggle_multiplier_fields(self, text):
        if text == "Data * Scale":
            self.ui.label_f1.hide()
            self.ui.entry_f1.hide()
            self.ui.label_f2.hide()
            self.ui.entry_f2.hide()
        elif text == "Data * Scale * Factor 1":
            self.ui.label_f1.show()
            self.ui.entry_f1.show()
            self.ui.label_f2.hide()
            self.ui.entry_f2.hide()
        elif text == "Data * Scale * Factor 1 * Factor 2":
            self.ui.label_f1.show()
            self.ui.entry_f1.show()
            self.ui.label_f2.show()
            self.ui.entry_f2.show()

    # =============================================================================================================================
    # ======== Các hàm xử lý gói tin update thanh ghi ============================
    def find_cid_by_name(self, param_name, all_rows):
        if not param_name or param_name == "NULL" or param_name == "":
            return 65535  # 0xFFFF

        for index, row in enumerate(all_rows):
            if (
                row[2] == param_name
            ):  # row[2] là cột 'parameter' (tên thanh ghi) trong DB
                return index  # CID của dòng tương ứng với parameter đó
        return 65535

    # @asyncSlot()
    # async def sync_data_to_mqtt(self):

    #     # Lấy thông tin thiết bị mục tiêu từ ô chọn trên UI
    #     device_name = self.ui.combo_device_target.currentText()
    #     config = DEVICE_MAPPING.get(device_name) # Mapping với topic gửi tới thiết bị thật

    #     if not config:
    #         QMessageBox.warning(self.ui, "Fail", "Please select available device !!!")
    #         return

    #     try:
    #         rows = database.get_all_registers() # Lấy toàn bộ hàng dữ liệu hiện có từ Database
    #         if not rows:
    #             QMessageBox.warning(self.ui, "Empty", "Not found data in the table !!!")
    #             return

    #         json_payload = []
    #         for row in rows:
    #             # Mapping dữ liệu
    #             type_code = DATA_TYPE_MAPPING.get(row[7], 0x01) # Mặc định là U16
    #             func_code = FUNCTION_CODE_MAPPING.get(row[4], 0x00) # Mặc định là Holding
    #             mul_code  = MUL_MAPPING.get(row[9], 0) # Mặc định chỉ nhân với hệ số scale

    #             # Ép kiểu giúp giảm bớt gánh nặng cho thiết bị bên dưới phải chuyển đổi từ character sang number
    #             item = {
    #                 "i": rows.index(row),      # CID
    #                 "n": row[2],              # name - Tên thanh ghi
    #                 "u": row[3],              # unit - Đơn vị
    #                 "s": int(row[1]),          # Slave ID
    #                 "a": int(row[5]),         # address
    #                 "f": func_code,           # function code
    #                 "t": type_code,           # data type
    #                 "q": int(row[6]),          # quantity
    #                 "sc": float(row[8]),      # Scale
    #                 "m": mul_code,             # Mul
    #                 "r": [self.find_cid_by_name(row[10], rows), self.find_cid_by_name(row[11], rows)] # Gửi kèm Factor1 và Factor2
    #             }
    #             json_payload.append(item)

    #         # Chuyển danh sách thành chuỗi JSON
    #         final_json = json.dumps(json_payload, indent=2)

    #         # Khởi tạo MQTT và Gửi đi
    #         client = mqtt.Client()
    #         client.connect(config["host"], 1883, 60)

    #         # Gửi tin nhắn lên Topic quy định
    #         result = client.publish(config["topic"], final_json, qos=1)

    #         if result.rc == mqtt.MQTT_ERR_SUCCESS:
    #             QMessageBox.information(self.ui, "Successful", f"Successful to sent data for {device_name}")
    #             # In ra màn hình đen (Console) để em kiểm tra cấu trúc
    #             print(f"--- Send to {device_name} ---\n{final_json}")
    #         client.disconnect()

    #     except Exception as e:
    #         QMessageBox.critical(self.ui, "Connect Fail", f"Can't send data: {str(e)}")

    @asyncSlot()  # Báo cho Qt biết đây là hàm đặc biệt
    async def scan_ble_devices(self):
        # Chuẩn bị giao diện trước khi quét
        self.ui.btn_scan_ble.setEnabled(False)  # Khóa nút lại để tránh bấm liên tục
        self.ui.btn_scan_ble.setText("Scanning...")
        self.ui.combo_ble_devices.clear()  # Xóa danh sách cũ

        try:
            # discover() sẽ mất khoảng 5 giây.
            devices = await BleakScanner.discover()

            # Sau khi đợi xong (5s), CPU quay lại đây chạy tiếp
            if not devices:
                self.ui.combo_ble_devices.addItem("Not Found Any Device !!!")
            else:
                for d in devices:
                    name = d.name if d.name else "No Name"
                    self.ui.combo_ble_devices.addItem(f"{name} [{d.address}]")

        except Exception as e:
            # Nếu có lỗi có thể do chưa bật Bluetooth
            QMessageBox.critical(self.ui, "Error BLE", f"Fail code: {str(e)}")

        finally:
            # Quét xong, mở lại nút bấm cho người dùng
            self.ui.btn_scan_ble.setEnabled(True)
            self.ui.btn_scan_ble.setText("Scan Devices")

    @asyncSlot()
    async def sync_data_to_ble(self):
        """
        Hàm xử lý đồng bộ dữ liệu qua BLE :
        1. Lấy MAC Address từ UI - Scan Devices
        2. Đóng gói JSON nén (Compact)
        3. Chia nhỏ dữ liệu (Chunking) để tránh tràn bộ đệm
        4. Gửi tuần tự và đợi xác nhận (ACK) từ Gateway
        5. Connect -> Transfer -> Disconnect
        """

        # ==================================================================================
        # --- BƯỚC 1: LẤY ĐỊA CHỈ MAC TỪ UI ---
        raw_selection = self.ui.combo_ble_devices.currentText()
        if not raw_selection or "[" not in raw_selection:
            QMessageBox.warning(
                self.ui, "Info", "Please scan and select device want to update !!!"
            )
            return

        # Bóc tách chuỗi trong ngoặc vuông [XX:XX:XX:XX:XX:XX]
        match = re.search(r"\[(.*?)\]", raw_selection)
        if not match:
            return
        address = match.group(1)

        # ==================================================================================
        # --- BƯỚC 2: CHUẨN BỊ DỮ LIỆU JSON ---
        rows = database.get_all_registers()
        if not rows:
            QMessageBox.warning(self.ui, "Thông báo", "Danh sách thanh ghi trống!")
            return

        json_payload = []
        for idx, row in enumerate(rows):
            item = {
                "i": idx,  # CID
                "n": row[2],  # Name
                "u": row[3],  # Unit
                "s": int(row[1]),  # Slave ID
                "a": int(row[5]),  # Address
                "f": FUNCTION_CODE_MAPPING.get(row[4], 0),  # Function Code
                "t": DATA_TYPE_MAPPING.get(row[7], 1),  # Data Type
                "q": int(row[6]),  # Quantity
                "sc": float(row[8]),  # Scale
                "m": MUL_MAPPING.get(row[9], 0),  # Multiplier
                "r": [
                    self.find_cid_by_name(row[10], rows),  # Factor 1
                    self.find_cid_by_name(row[11], rows),  # Factor 2
                ],  # References
            }
            json_payload.append(item)

        # Chuyển sang JSON nén (không khoảng trắng) để tối ưu băng thông BLE
        final_json = json.dumps(json_payload, separators=(",", ":"))
        data_bytes = final_json.encode("utf-8")

        # ===================================================================================
        # --- BƯỚC 3: TRUYỀN TẢI BLE (CHIA MẢNH & XÁC NHẬN) ---
        total_len = len(data_bytes)
        chunk_size = 200  # Kích thước mỗi mảnh (nên <= 200 bytes để an toàn)

        try:
            # Vô hiệu hóa nút bấm để tránh người dùng nhấn liên tục khi đang gửi
            self.ui.btn_update.setEnabled(False)
            self.ui.btn_update.setText("Connecting......")

            async with BleakClient(address) as client:
                self.ui.btn_update.setText("Syncing 0%.....")

                for i in range(0, total_len, chunk_size):
                    chunk = data_bytes[i : i + chunk_size]

                    # GỬI VÀ ĐỢI PHẢN HỒI (Write Request)
                    # response=True cực kỳ quan trọng: Ép App phải đợi ESP32 nhận xong
                    # mảnh này rồi mới gửi mảnh tiếp theo, tránh làm tràn Buffer của ESP32.
                    await client.write_gatt_char(MODBUS_CHAR_UUID, chunk, response=True)

                    # Cập nhật tiến độ lên UI
                    progress = int(((i + len(chunk)) / total_len) * 100)
                    self.ui.btn_update.setText(f"Syncing {progress}%...")
                    print(f"Total progress: {progress}%")

                QMessageBox.information(
                    self.ui,
                    "Successful",
                    f"Đã gửi cấu hình ({len(rows)} thanh ghi) thành công!",
                )

        except Exception as e:
            print(f"BLE Error: {str(e)}")
            QMessageBox.critical(
                self.ui, "Lỗi kết nối", f"Không thể gửi dữ liệu: {str(e)}"
            )

        finally:
            # Trả lại trạng thái ban đầu cho nút bấm
            self.ui.btn_update.setEnabled(True)
            self.ui.btn_update.setText("Sync to Device")
