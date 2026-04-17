from PyQt6.QtWidgets import (
    QMessageBox,
    QInputDialog,
    QTableWidgetItem,
    QWidget,
    QVBoxLayout,
    QHBoxLayout,
    QPushButton,
    QTableWidget,
    QHeaderView,
)
from PyQt6.QtCore import Qt, QObject
import database, json, re
from qasync import asyncSlot
from bleak import BleakScanner, BleakClient
from ui import NewDeviceDialog, RegisterEditorWidget

MODBUS_CHAR_UUID = "0000ff11-0000-1000-8000-00805f9b34fb"
FUNCTION_CODE_MAPPING = {
    "Read Holding Registers (0x03)": 0x00,
    "Read Input Registers (0x04)": 0x01,
}
DATA_TYPE_MAPPING = {
    "Unsigned 16 bits": 0x01,
    "Unsigned 32 bits": 0x02,
    "Float ABCD": 0x1A,
    "Float CDAB": 0x1B,
    "Integer": 0x0E,
    "Long": 0x12,
}
MUL_MAPPING = {
    "Data * Scale": 0,
    "Data * Scale * Factor 1": 1,
    "Data * Scale * Factor 1 * Factor 2": 2,
}


class config_logic(QObject):
    def __init__(self, ui_view):
        super().__init__()
        self.ui = ui_view
        database.init_db()
        self.connect_signals()
        self.load_data()

    def connect_signals(self):
        self.ui.btn_new.clicked.connect(self.handle_new_device_flow)
        self.ui.btn_sync.clicked.connect(self.sync_data_to_ble)
        self.ui.btn_scan_ble.clicked.connect(self.scan_ble_devices)

    def load_data(self):
        self.ui.device_tabs.clear()
        rows = database.get_all_registers()
        data_map = {}
        for r in rows:
            sid = str(r[1])
            if sid not in data_map:
                data_map[sid] = []
            data_map[sid].append(r)

        for sid, records in data_map.items():
            self.create_tab(sid, records)

    def create_tab(self, sid, records):
        tab = QWidget()
        lay = QVBoxLayout(tab)
        editor = RegisterEditorWidget()
        editor.ent_sid.setText(sid)
        editor.ent_sid.setReadOnly(True)
        editor.btn_action.setText("Add more to this device")
        editor.btn_action.clicked.connect(lambda: self.add_single(editor))
        lay.addWidget(editor)

        table = QTableWidget()
        table.setColumnCount(12)
        table.setHorizontalHeaderLabels(
            [
                "ID",
                "Param",
                "Unit",
                "FC",
                "Addr",
                "Qty",
                "Type",
                "Scale",
                "Mul",
                "F1",
                "F2",
                "Action",
            ]
        )
        table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        for r in records:
            self.insert_row_ui(table, r)
        lay.addWidget(table)
        self.ui.device_tabs.addTab(tab, f"ID {sid}")

    def insert_row_ui(self, table, row):
        idx = table.rowCount()
        table.insertRow(idx)
        for i in range(1, 12):
            item = QTableWidgetItem(str(row[i]))
            if i == 1:
                item.setData(Qt.ItemDataRole.UserRole, row[0])
            item.setFlags(item.flags() & ~Qt.ItemFlag.ItemIsEditable)
            table.setItem(idx, i - 1, item)
        # Nút Edit/Up/Del
        c = QWidget()
        l = QHBoxLayout(c)
        l.setContentsMargins(2, 2, 2, 2)
        b_edit = QPushButton("Edit")
        b_up = QPushButton("Up")
        b_del = QPushButton("Del")
        b_up.setEnabled(False)
        b_edit.clicked.connect(lambda: self.enable_edit(table, idx, b_edit, b_up))
        b_up.clicked.connect(lambda: self.confirm_update(table, idx))
        b_del.clicked.connect(lambda: self.delete_row(row[0]))
        for b in [b_edit, b_up, b_del]:
            l.addWidget(b)
        table.setCellWidget(idx, 11, c)

    def handle_new_device_flow(self):
        models = database.get_all_models()
        m_name, ok1 = QInputDialog.getItem(
            self.ui, "New Device", "Chọn Model:", models, editable=True
        )
        if not (ok1 and m_name):
            return
        sid, ok2 = QInputDialog.getText(self.ui, "ID", "Nhập Slave ID duy nhất:")
        if not (ok2 and sid):
            return
        if database.check_slave_id_exists(sid):
            QMessageBox.critical(self.ui, "Lỗi", "ID đã tồn tại!")
            return

        if m_name in models:
            database.clone_device_from_model(m_name, sid)
            self.load_data()
        else:
            # Model mới: Cho phép nhập liên tục
            dia = NewDeviceDialog(self.ui)
            dia.editor.ent_sid.setText(sid)
            dia.editor.ent_sid.setReadOnly(True)

            def add_temp():
                d = self.get_fields(dia.editor)
                database.insert_register(*d)
                r = dia.temp_table.rowCount()
                dia.temp_table.insertRow(r)
                for i, v in enumerate(d):
                    dia.temp_table.setItem(r, i, QTableWidgetItem(str(v)))

            dia.editor.btn_action.clicked.connect(add_temp)
            dia.btn_finish.clicked.connect(
                lambda: (
                    database.create_model_template(m_name, sid),
                    self.load_data(),
                    dia.accept(),
                )
            )
            dia.exec()

    def get_fields(self, ed):
        return (
            ed.ent_sid.text(),
            ed.ent_name.text(),
            ed.ent_unit.text(),
            ed.cb_fc.currentText(),
            ed.ent_addr.text(),
            ed.cb_qty.currentText(),
            ed.cb_type.currentText(),
            ed.cb_scale.currentText(),
            ed.cb_mul.currentText(),
            "1.0",
            "1.0",
        )

    def add_single(self, ed):
        database.insert_register(*self.get_fields(ed))
        self.load_data()

    @asyncSlot()
    async def sync_data_to_ble(self):
        rows = database.get_all_registers()
        payload = []
        for i, r in enumerate(rows):
            payload.append(
                {
                    "i": i,
                    "s": int(r[1]),
                    "n": r[2],
                    "u": r[3],
                    "f": FUNCTION_CODE_MAPPING.get(r[4], 0),
                    "a": int(r[5]),
                    "q": int(r[6]),
                    "t": DATA_TYPE_MAPPING.get(r[7], 1),
                    "sc": float(r[8]),
                    "m": MUL_MAPPING.get(r[9], 0),
                }
            )

        raw_sel = self.ui.combo_ble_devices.currentText()
        addr_match = re.search(r"\((.*?)\)", raw_sel)
        if not addr_match:
            return

        data_bytes = json.dumps(payload).encode("utf-8")
        try:
            async with BleakClient(addr_match.group(1)) as client:
                for j in range(0, len(data_bytes), 180):
                    await client.write_gatt_char(
                        MODBUS_CHAR_UUID, data_bytes[j : j + 180], response=True
                    )
                QMessageBox.information(self.ui, "Xong", "Đã gửi cấu hình!")
        except Exception as e:
            QMessageBox.critical(self.ui, "Lỗi", str(e))

    @asyncSlot()
    async def scan_ble_devices(self):
        self.ui.btn_scan_ble.setText("Scanning...")
        devs = await BleakScanner.discover()
        self.ui.combo_ble_devices.clear()
        for d in devs:
            if d.name:
                self.ui.combo_ble_devices.addItem(f"{d.name} ({d.address})")
        self.ui.btn_scan_ble.setText("Scan Devices")

    def enable_edit(self, t, r, b1, b2):
        for c in range(11):
            t.item(r, c).setFlags(t.item(r, c).flags() | Qt.ItemFlag.ItemIsEditable)
        b1.setEnabled(False)
        b2.setEnabled(True)

    def confirm_update(self, t, r):
        db_id = t.item(r, 0).data(Qt.ItemDataRole.UserRole)
        v = [t.item(r, i).text() for i in range(11)]
        database.update_register(db_id, *v)
        self.load_data()

    def delete_row(self, db_id):
        database.delete_register_by_id(db_id)
        self.load_data()
