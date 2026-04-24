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
    QLineEdit,
    QComboBox,
    QCompleter,
    QStyledItemDelegate,
)
from PyQt6.QtCore import Qt, QObject
import database, json, re
from qasync import asyncSlot
from bleak import BleakScanner, BleakClient
from ui import RegisterEditorWidget

MODBUS_CHAR_UUID = "0000ff11-0000-1000-8000-00805f9b34fb"
FUNCTION_CODE_MAPPING = {
    "Read Holding Registers (0x03)": 0x00,
    "Read Input Registers (0x04)": 0x01,
}
DATA_TYPE_MAPPING = {
    "Unsigned 16 bits": 0x01,
    "Unsigned 32 bits": 0x02,
    "Integer 32 bits CDAB": 0x13,
    "Integer 32 bits ABCD": 0x12,
    "Float ABCD": 0x1A,
    "Float CDAB": 0x1B,
    "Long": 18,
}
MUL_MAPPING = {
    "Data * Scale": 0,
    "Data * Scale * Factor 1": 1,
    "Data * Scale * Factor 1 * Factor 2": 2,
}

# -----------------------------------------------------------------------
# Mapping cột → loại widget khi edit
# Các cột dùng QComboBox (index trong table, bắt đầu từ 0):
#   col 3  = Function Code
#   col 6  = Data Type
#   col 7  = Scale
#   col 8  = Multiplier
# Các cột còn lại dùng QLineEdit với QCompleter
# -----------------------------------------------------------------------
COMBO_COLUMNS = {
    3: ["---", "Read Holding Registers (0x03)", "Read Input Registers (0x04)"],
    6: [
        "---",
        "Unsigned 16 bits",
        "Unsigned 32 bits",
        "Integer 32 bits CDAB",
        "Integer 32 bits ABCD",
        "Float ABCD",
        "Float CDAB",
        "Long",
    ],
    7: ["---", "0.001", "0.01", "0.1", "1"],
    8: [
        "---",
        "Data * Scale",
        "Data * Scale * Factor 1",
        "Data * Scale * Factor 1 * Factor 2",
    ],
}

# Cột dùng QLineEdit với gợi ý từ DB
#   col 1  = Parameter   → suggestions từ DB
#   col 2  = Unit        → suggestions từ DB
#   col 4  = Start Address → suggestions từ DB
#   col 9  = Factor 1    → suggestions từ DB (parameter names)
#   col 10 = Factor 2    → suggestions từ DB (parameter names)
SUGGEST_COLUMNS = {
    1: "parameter",
    2: "unit",
    4: "address",
    9: "factor_1",
    10: "factor_2",
}


class SuggestDelegate(QStyledItemDelegate):
    """
    Delegate tùy chỉnh: khi người dùng bắt đầu edit một ô,
    - Cột thuộc COMBO_COLUMNS  → hiển thị QComboBox với các lựa chọn cố định
    - Cột thuộc SUGGEST_COLUMNS → hiển thị QLineEdit kèm QCompleter từ DB
    - Cột khác                 → QLineEdit bình thường
    """

    def createEditor(self, parent, option, index):
        col = index.column()

        if col in COMBO_COLUMNS:
            cb = QComboBox(parent)
            cb.addItems(COMBO_COLUMNS[col])
            return cb

        line = QLineEdit(parent)

        if col in SUGGEST_COLUMNS:
            db_key = SUGGEST_COLUMNS[col]
            suggestions = database.get_distinct_suggestions(db_key)
            completer = QCompleter(suggestions, line)
            completer.setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
            completer.setFilterMode(Qt.MatchFlag.MatchContains)  # gợi ý chứa từ khóa
            line.setCompleter(completer)

        return line

    def setEditorData(self, editor, index):
        value = index.data(Qt.ItemDataRole.EditRole) or ""
        if isinstance(editor, QComboBox):
            i = editor.findText(value)
            if i >= 0:
                editor.setCurrentIndex(i)
            else:
                editor.setCurrentIndex(0)
        else:
            editor.setText(value)

    def setModelData(self, editor, model, index):
        if isinstance(editor, QComboBox):
            model.setData(index, editor.currentText(), Qt.ItemDataRole.EditRole)
        else:
            model.setData(index, editor.text(), Qt.ItemDataRole.EditRole)

    def updateEditorGeometry(self, editor, option, index):
        editor.setGeometry(option.rect)


# -----------------------------------------------------------------------


class config_logic(QObject):
    def __init__(self, ui_view):
        super().__init__()
        self.ui = ui_view
        database.init_db()
        self.connect_signals()
        self.load_data()
        self.load_history()

    def connect_signals(self):
        self.ui.btn_new.clicked.connect(self.handle_new_device_flow)
        self.ui.btn_sync.clicked.connect(self.sync_data_to_ble)
        self.ui.btn_scan_ble.clicked.connect(self.scan_ble_devices)

    def load_data(self):
        current_tab_index = self.ui.device_tabs.currentIndex()
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

        if current_tab_index >= 0 and current_tab_index < self.ui.device_tabs.count():
            self.ui.device_tabs.setCurrentIndex(current_tab_index)

    def create_tab(self, sid, records):
        tab = QWidget()
        lay = QVBoxLayout(tab)
        editor = RegisterEditorWidget()
        editor.ent_sid.setText(sid)
        editor.ent_sid.setReadOnly(True)
        self.apply_suggestions(editor)
        editor.btn_action.clicked.connect(lambda: self.add_single(editor))
        lay.addWidget(editor)

        table = QTableWidget()
        table.setColumnCount(12)
        table.setHorizontalHeaderLabels(
            [
                "ID",
                "Parameter",
                "Unit",
                "Function",
                "Start Address",
                "Quantity",
                "Data Type",
                "Scale",
                "Multiplier",
                "Factor 1",
                "Factor 2",
                "Action",
            ]
        )
        table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch)

        # ── Gán delegate để có gợi ý khi edit ──
        delegate = SuggestDelegate(table)
        table.setItemDelegate(delegate)
        # ────────────────────────────────────────

        for r in records:
            self.insert_row_ui(table, r)
        lay.addWidget(table)
        self.ui.device_tabs.addTab(tab, f"ID {sid}")

    def apply_suggestions(self, editor):
        editor.set_suggestions(
            "parameter", database.get_distinct_suggestions("parameter")
        )
        editor.set_suggestions("unit", database.get_distinct_suggestions("unit"))
        editor.set_suggestions("address", database.get_distinct_suggestions("address"))
        editor.set_suggestions("factor", database.get_distinct_suggestions("factor_1"))

    def handle_new_device_flow(self):
        sid, ok = QInputDialog.getText(self.ui, "New Device", "Typing new Slave ID:")
        if ok and sid:
            if database.check_slave_id_exists(sid):
                QMessageBox.warning(self.ui, "Fail", "ID is existing !!!")
            else:
                self.create_tab(sid, [])
                self.ui.device_tabs.setCurrentIndex(self.ui.device_tabs.count() - 1)

    def add_single(self, ed):
        fields = list(self.get_fields(ed))
        # index 9 = Factor 1, index 10 = Factor 2
        if not fields[9].strip():
            fields[9] = "NULL"
        if not fields[10].strip():
            fields[10] = "NULL"
        database.insert_register(*fields)
        database.insert_log(
            action="ADD REGISTER",
            detail=f"Slave ID: {fields[0]} | Param: {fields[1]} | Addr: {fields[4]}",
        )
        self.load_data()
        self.load_history()

    def find_cid(self, name, slave_id, all_rows):
        if not name or name in ["1.0", "NULL", ""]:
            return 65535
        for idx, r in enumerate(all_rows):
            if (
                str(r[1]) == str(slave_id)
                and r[2].strip().upper() == name.strip().upper()
            ):
                return idx
        return 65535

    def load_history(self):
        logs = database.get_all_logs()
        t = self.ui.history_table
        t.setRowCount(0)
        for log in logs:
            idx = t.rowCount()
            t.insertRow(idx)
            for col, val in enumerate(log):
                t.setItem(idx, col, QTableWidgetItem(str(val)))

    @asyncSlot()
    async def sync_data_to_ble(self):
        rows = database.get_all_registers()
        if not rows:
            QMessageBox.warning(self.ui, "Announce", "No data in table for sync !!!")
            return

        payload = []
        for i, r in enumerate(rows):
            curr_sid = r[1]
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
                    "r": [
                        self.find_cid(str(r[10]), curr_sid, rows),
                        self.find_cid(str(r[11]), curr_sid, rows),
                    ],
                }
            )

        raw_sel = self.ui.combo_ble_devices.currentText()
        addr_match = re.search(r"\((.*?)\)", raw_sel)
        if not addr_match:
            QMessageBox.warning(
                self.ui, "Fail", "Please Select Device through Bluetooth !!!"
            )
            return

        try:
            self.ui.btn_sync.setEnabled(False)
            self.ui.btn_sync.setText("Syncing...")
            async with BleakClient(addr_match.group(1)) as client:
                data_bytes = json.dumps(payload).encode("utf-8")

                for j in range(0, len(data_bytes), 180):
                    await client.write_gatt_char(
                        MODBUS_CHAR_UUID, data_bytes[j : j + 180], response=True
                    )
                QMessageBox.information(
                    self.ui, "Success", "Successful to send data for device"
                )
                device_name = raw_sel
                database.insert_log(
                    action="SYNC TO DEVICE",
                    detail=f"Gửi {len(rows)} thanh ghi xuống thiết bị: {device_name}",
                )
                self.load_history()

        except Exception as e:
            if "canceled" in str(e).lower():
                QMessageBox.information(
                    self.ui, "Success", "Successful to send data for device"
                )
            else:
                QMessageBox.critical(self.ui, "Fail BLE", str(e))
        finally:
            self.ui.btn_sync.setEnabled(True)
            self.ui.btn_sync.setText("Sync to Device")

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
            ed.ent_f1.text(),
            ed.ent_f2.text(),
        )

    def insert_row_ui(self, t, r):
        idx = t.rowCount()
        t.insertRow(idx)
        for i in range(1, 12):
            item = QTableWidgetItem(str(r[i]))
            if i == 1:
                item.setData(Qt.ItemDataRole.UserRole, r[0])
            item.setFlags(item.flags() & ~Qt.ItemFlag.ItemIsEditable)
            t.setItem(idx, i - 1, item)
        c = QWidget()
        l = QHBoxLayout(c)
        l.setContentsMargins(2, 2, 2, 2)
        b_edit = QPushButton("Edit")
        b_up = QPushButton("Update")
        b_del = QPushButton("Delete")
        b_up.setEnabled(False)
        b_edit.clicked.connect(
            lambda checked, i=idx, e=b_edit, u=b_up: self.enable_edit(t, i, e, u)
        )
        b_up.clicked.connect(lambda checked, i=idx: self.handle_update(t, i))
        b_del.clicked.connect(lambda checked, rid=r[0]: self.handle_delete(rid))
        for b in [b_edit, b_up, b_del]:
            l.addWidget(b)
        t.setCellWidget(idx, 11, c)

    def handle_update(self, t, row):
        db_id = t.item(row, 0).data(Qt.ItemDataRole.UserRole)
        data = [t.item(row, k).text() for k in range(11)]
        # index 9 = Factor 1, index 10 = Factor 2
        if not data[9].strip():
            data[9] = "NULL"
        if not data[10].strip():
            data[10] = "NULL"
        database.update_register(db_id, *data)
        self.load_data()

    def handle_delete(self, db_id):
        database.delete_register_by_id(db_id)
        self.load_data()

    def enable_edit(self, t, r, b1, b2):
        for c in range(11):
            t.item(r, c).setFlags(t.item(r, c).flags() | Qt.ItemFlag.ItemIsEditable)
        b1.setEnabled(False)
        b2.setEnabled(True)

    @asyncSlot()
    async def scan_ble_devices(self):
        self.ui.btn_scan_ble.setText("Scanning...")
        self.ui.btn_scan_ble.setEnabled(False)
        self.ui.combo_ble_devices.clear()
        try:
            devs = await BleakScanner.discover()
            for d in devs:
                if d.name:
                    self.ui.combo_ble_devices.addItem(f"{d.name} ({d.address})")
        finally:
            self.ui.btn_scan_ble.setText("Scan Devices")
            self.ui.btn_scan_ble.setEnabled(True)
