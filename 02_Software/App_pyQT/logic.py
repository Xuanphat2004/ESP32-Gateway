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

import json
import re
import database
import pandas as pd
from qasync import asyncSlot
from bleak import BleakScanner, BleakClient
from ui import RegisterEditorWidget

MODBUS_CHAR_UUID = "0000ff11-0000-1000-8000-00805f9b34fb"
WIFI_CHAR_UUID   = "0000ff12-0000-1000-8000-00805f9b34fb"
TCP_CHAR_UUID    = "0000ff13-0000-1000-8000-00805f9b34fb"

FUNCTION_CODE_MAP = {
    "Read Holding Registers (0x03)": 0x00,
    "Read Input Registers (0x04)":   0x01,
}

DATA_TYPE_MAP = {
    "Unsigned 16 bits":  0x01,
    "Unsigned 32 bits":  0x02,
    "Int 16 bits AB":    0x0E,
    "Int 16 bits BA":    0x0F,
    "Uint 16 bits AB":   0x10,
    "Uint 16 bits BA":   0x11,
    "Int 32 bits ABCD":  0x12,
    "Int 32 bits CDAB":  0x13,
    "Int 32 bits DCBA":  0x15,
    "Uint 32 bits ABCD": 0x16,
    "Uint 32 bits CDAB": 0x17,
    "Float ABCD":        0x1A,
    "Float CDAB":        0x1B,
    "Long":              18,
}

MULTIPLIER_MAP = {
    "Data * Scale":                        0,
    "Data * Scale * Factor 1":             1,
    "Data * Scale * Factor 1 * Factor 2":  2,
}

COMBO_COLUMNS = {
    3: ["---", "Read Holding Registers (0x03)", "Read Input Registers (0x04)"],
    6: [
        "---", "Unsigned 16 bits", "Unsigned 32 bits",
        "Int 16 bits AB", "Int 16 bits BA",
        "Uint 16 bits AB", "Uint 16 bits BA",
        "Int 32 bits ABCD", "Int 32 bits CDAB", "Int 32 bits DCBA",
        "Uint 32 bits ABCD", "Uint 32 bits CDAB",
        "Float ABCD", "Float CDAB", "Long",
    ],
    7: ["---", "0.000003125", "0.000015625", "0.0001", "0.001", "0.005", "0.01", "0.1", "1"],
    8: ["---", "Data * Scale", "Data * Scale * Factor 1", "Data * Scale * Factor 1 * Factor 2"],
}

SUGGEST_COLUMNS = {
    1: "parameter",
    2: "unit",
    4: "address",
    9: "factor_1",
    10: "factor_2",
}


class SuggestDelegate(QStyledItemDelegate):
    """Hiển thị QComboBox hoặc QLineEdit khi user double-click vào ô trong bảng."""

    def createEditor(self, parent, option, index):
        col = index.column()
        if col in COMBO_COLUMNS:
            combo = QComboBox(parent)
            combo.addItems(COMBO_COLUMNS[col])
            return combo
        line = QLineEdit(parent)
        if col in SUGGEST_COLUMNS:
            suggestions = database.get_distinct_suggestions(SUGGEST_COLUMNS[col])
            completer = QCompleter(suggestions, line)
            completer.setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
            completer.setFilterMode(Qt.MatchFlag.MatchContains)
            line.setCompleter(completer)
        return line

    def setEditorData(self, editor, index):
        current_value = index.data(Qt.ItemDataRole.EditRole) or ""
        if isinstance(editor, QComboBox):
            pos = editor.findText(current_value)
            editor.setCurrentIndex(pos if pos >= 0 else 0)
        else:
            editor.setText(current_value)

    def setModelData(self, editor, model, index):
        if isinstance(editor, QComboBox):
            model.setData(index, editor.currentText(), Qt.ItemDataRole.EditRole)
        else:
            model.setData(index, editor.text(), Qt.ItemDataRole.EditRole)

    def updateEditorGeometry(self, editor, option, index):
        editor.setGeometry(option.rect)


class AppController(QObject):

    def __init__(self, ui):
        super().__init__()
        self.ui = ui

        database.init_db()
        database.init_tcp_tables()
        self._connect_signals()
        self.refresh_table()
        self.refresh_history()
        self.load_tcp_config()
        self.load_tcp_mapping()

    def _connect_signals(self):
        self.ui.btn_new.clicked.connect(self.on_new_device_clicked)
        self.ui.btn_sync.clicked.connect(self.on_sync_clicked)
        self.ui.btn_scan_ble.clicked.connect(self.on_scan_ble_clicked)
        self.ui.btn_delete_device.clicked.connect(self.on_delete_device_clicked)
        self.ui.btn_send_wifi.clicked.connect(self.on_send_wifi_clicked)
        self.ui.btn_show_pass.clicked.connect(self.on_toggle_password_visibility)
        self.ui.btn_scan_wifi_net.clicked.connect(self.on_scan_wifi_networks_clicked)
        self.ui.tbl_wifi_networks.itemSelectionChanged.connect(self.on_wifi_network_selected)
        self.ui.btn_tcp_add_row.clicked.connect(self.on_tcp_add_row_clicked)
        self.ui.btn_tcp_del_row.clicked.connect(self.on_tcp_del_row_clicked)
        self.ui.btn_tcp_save.clicked.connect(self.on_save_tcp)
        self.ui.btn_tcp_send.clicked.connect(self.on_send_tcp_clicked)

    @staticmethod
    def _auto_multiplier(f1: str, f2: str) -> str:
        f1_empty = (f1 or "").strip() in ("", "NULL", "---", "nan")
        f2_empty = (f2 or "").strip() in ("", "NULL", "---", "nan")
        if not f1_empty and not f2_empty:
            return "Data * Scale * Factor 1 * Factor 2"
        elif not f1_empty:
            return "Data * Scale * Factor 1"
        return "Data * Scale"

    @staticmethod
    def _clean_factor(val) -> str:
        import math
        if val is None:
            return "NULL"
        if isinstance(val, float) and math.isnan(val):
            return "NULL"
        s = str(val).strip()
        if s in ("", "NULL", "---", "nan", "NaN", "None"):
            return "NULL"
        return s

    def refresh_table(self):
        saved_tab    = self.ui.device_tabs.currentIndex()
        saved_scroll = self._get_current_scroll()

        self.ui.device_tabs.clear()
        rows    = database.get_all_registers()
        grouped = self._group_rows_by_slave(rows)

        for slave_id, records in grouped.items():
            self._create_tab(slave_id, records)

        if 0 <= saved_tab < self.ui.device_tabs.count():
            self.ui.device_tabs.setCurrentIndex(saved_tab)
            self._restore_scroll(saved_scroll)

    def _group_rows_by_slave(self, rows):
        grouped = {}
        for row in rows:
            sid = str(row[1])
            if sid not in grouped:
                grouped[sid] = []
            grouped[sid].append(row)
        return grouped

    def _create_tab(self, slave_id, records):
        tab_widget = QWidget()
        layout     = QVBoxLayout(tab_widget)

        editor = RegisterEditorWidget()
        editor.ent_sid.setText(slave_id)
        editor.ent_sid.setReadOnly(True)
        self._apply_autocomplete(editor)
        editor.btn_action.clicked.connect(lambda: self.on_add_register(editor))
        layout.addWidget(editor)

        table_ctrl_lay = QHBoxLayout()
        btn_edit   = QPushButton("✏️  Edit Table")
        btn_edit.setFixedHeight(34)
        btn_update = QPushButton("💾  Update")
        btn_update.setFixedHeight(34)
        self._set_update_btn_style(btn_update, active=False)
        btn_update.setEnabled(False)
        table_ctrl_lay.addStretch()
        table_ctrl_lay.addWidget(btn_edit)
        table_ctrl_lay.addWidget(btn_update)
        layout.addLayout(table_ctrl_lay)

        table = self._build_table()
        for record in records:
            self._add_row_to_table(table, record)
        layout.addWidget(table)

        btn_edit.clicked.connect(lambda: self._enable_table_edit(table, btn_edit, btn_update))
        btn_update.clicked.connect(lambda: self.on_update_table(table, btn_edit, btn_update))

        self.ui.device_tabs.addTab(tab_widget, f"ID {slave_id}")

    def _build_table(self):
        table = QTableWidget()
        table.setColumnCount(12)
        table.setHorizontalHeaderLabels([
            "ID", "Parameter", "Unit", "Function", "Start Address",
            "Quantity", "Data Type", "Scale", "Multiplier",
            "Factor 1", "Factor 2", "Action",
        ])

        header = table.horizontalHeader()
        fixed_cols = {0: 45, 2: 65, 5: 72, 7: 82, 11: 88}
        for col, width in fixed_cols.items():
            header.setSectionResizeMode(col, QHeaderView.ResizeMode.Fixed)
            table.setColumnWidth(col, width)

        for col in [1, 3, 4, 6, 8, 9, 10]:
            header.setSectionResizeMode(col, QHeaderView.ResizeMode.Stretch)

        header.setStretchLastSection(False)

        for i in range(table.columnCount()):
            item = table.horizontalHeaderItem(i)
            if item:
                item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)

        table.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        table.setItemDelegate(SuggestDelegate(table))
        return table

    def _add_row_to_table(self, table, record):
        row_index = table.rowCount()
        table.insertRow(row_index)

        for col in range(1, 12):
            item = QTableWidgetItem(str(record[col]))
            if col == 1:
                item.setData(Qt.ItemDataRole.UserRole, record[0])
            item.setFlags(item.flags() & ~Qt.ItemFlag.ItemIsEditable)
            item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            table.setItem(row_index, col - 1, item)

        table.setCellWidget(row_index, 11, self._build_action_buttons(table, row_index, record[0]))

    def _build_action_buttons(self, table, row_index, db_id):
        container = QWidget()
        layout    = QHBoxLayout(container)
        layout.setContentsMargins(2, 2, 2, 2)
        btn_delete = QPushButton("Delete")
        btn_delete.clicked.connect(lambda _, rid=db_id: self.on_delete_row(rid))
        layout.addWidget(btn_delete)
        return container

    def _apply_autocomplete(self, editor):
        editor.set_suggestions("parameter", database.get_distinct_suggestions("parameter"))
        editor.set_suggestions("unit",      database.get_distinct_suggestions("unit"))
        editor.set_suggestions("address",   database.get_distinct_suggestions("address"))
        editor.set_suggestions("factor",    database.get_distinct_suggestions("factor_1"))

    def refresh_history(self):
        history_table = self.ui.history_table
        history_table.setRowCount(0)
        for log in database.get_all_logs():
            row = history_table.rowCount()
            history_table.insertRow(row)
            for col, value in enumerate(log):
                item = QTableWidgetItem(str(value))
                item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                history_table.setItem(row, col, item)

    def _get_current_scroll(self):
        table = self._get_current_table()
        return table.verticalScrollBar().value() if table else 0

    def _restore_scroll(self, scroll_value):
        table = self._get_current_table()
        if table:
            table.verticalScrollBar().setValue(scroll_value)

    def _get_current_table(self):
        current_tab = self.ui.device_tabs.currentWidget()
        return current_tab.findChild(QTableWidget) if current_tab else None

    def on_new_device_clicked(self):
        slave_id, confirmed = QInputDialog.getText(self.ui, "New Device", "Enter Slave ID (1-247):")
        if not confirmed or not slave_id.strip():
            return
        slave_id = slave_id.strip()

        if not slave_id.isdigit() or not (1 <= int(slave_id) <= 247):
            QMessageBox.warning(self.ui, "Invalid Input", "Slave ID must be an integer between 1 and 247!")
            return

        if database.check_slave_id_exists(slave_id):
            QMessageBox.warning(self.ui, "Duplicate", f"Slave ID {slave_id} already exists!")
            return

        from ui import ImportChoiceDialog
        dlg = ImportChoiceDialog(parent=self.ui)
        if dlg.exec() == 0:
            return

        if dlg.choice == "manual":
            self._create_tab(slave_id, [])
            self.ui.device_tabs.setCurrentIndex(self.ui.device_tabs.count() - 1)
        elif dlg.choice == "import":
            self._import_from_excel(slave_id)

    def _import_from_excel(self, slave_id):
        from PyQt6.QtWidgets import QFileDialog

        file_path, _ = QFileDialog.getOpenFileName(
            self.ui, "Select Excel file to import", "", "Excel Files (*.xlsx *.xls)"
        )
        if not file_path:
            return

        try:
            df = pd.read_excel(file_path, skiprows=1, usecols="B:J", dtype=str, engine="openpyxl")
            df.columns = ["parameter", "unit", "function_code", "address", "quantity", "type", "scale", "factor_1", "factor_2"]
            df = df.dropna(subset=["parameter", "address"])
            df = df[df["parameter"].str.strip() != ""]
            df["slave_id"] = slave_id
        except Exception as e:
            QMessageBox.critical(self.ui, "File Error", f"Cannot read Excel file:\n{e}")
            return

        if df.empty:
            QMessageBox.warning(self.ui, "No Data", "The Excel file contains no valid data!")
            return

        errors = self._validate_import_df(df)
        if errors:
            msg = "\n".join(errors[:10])
            if len(errors) > 10:
                msg += f"\n... and {len(errors)-10} more errors"
            QMessageBox.critical(self.ui, "Validation Error", f"The following errors were found:\n\n{msg}")
            return

        reply = QMessageBox.question(
            self.ui, "Confirm Import",
            f"Import {len(df)} registers for Slave ID {slave_id}. Continue?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if reply != QMessageBox.StandardButton.Yes:
            return

        for _, row in df.iterrows():
            f1  = self._clean_factor(row.get("factor_1"))
            f2  = self._clean_factor(row.get("factor_2"))
            mul = self._auto_multiplier(f1, f2)
            database.insert_register(
                slave_id, str(row["parameter"]).strip(), str(row["unit"]).strip(),
                str(row["function_code"]).strip(), str(row["address"]).strip(),
                str(row["quantity"]).strip(), str(row["type"]).strip(),
                str(row["scale"]).strip(), mul, f1, f2,
            )

        database.insert_log("Import from Excel", f"Slave ID: {slave_id} | {len(df)} registers | {file_path.split('/')[-1]}")
        self.refresh_table()
        self.refresh_history()
        QMessageBox.information(self.ui, "Import Successful", f"Successfully imported {len(df)} registers for Slave ID {slave_id}!")

    def _validate_import_df(self, df):
        errors = []
        valid_fc    = {"Read Holding Registers (0x03)", "Read Input Registers (0x04)"}
        valid_qty   = {"1", "2"}
        valid_types = {
            "Unsigned 16 bits", "Unsigned 32 bits",
            "Int 16 bits AB", "Int 16 bits BA",
            "Uint 16 bits AB", "Uint 16 bits BA",
            "Int 32 bits ABCD", "Int 32 bits CDAB", "Int 32 bits DCBA",
            "Uint 32 bits ABCD", "Uint 32 bits CDAB",
            "Float ABCD", "Float CDAB", "Long",
        }
        valid_scale = {"0.000003125", "0.000015625", "0.0001", "0.001", "0.005", "0.01", "0.1", "1"}

        for i, row in df.iterrows():
            line = i + 4
            if not str(row.get("parameter", "")).strip():
                errors.append(f"Row {line}: Parameter is required")
            if str(row.get("function_code", "")).strip() not in valid_fc:
                errors.append(f"Row {line}: Invalid function code '{row.get('function_code', '')}'")
            if not str(row.get("address", "")).strip().isdigit():
                errors.append(f"Row {line}: Address must be an integer")
            if str(row.get("quantity", "")).strip() not in valid_qty:
                errors.append(f"Row {line}: Quantity must be 1 or 2")
            if str(row.get("type", "")).strip() not in valid_types:
                errors.append(f"Row {line}: Invalid data type '{row.get('type', '')}'")
            if str(row.get("scale", "")).strip() not in valid_scale:
                errors.append(f"Row {line}: Invalid scale value '{row.get('scale', '')}'")
        return errors

    def on_delete_device_clicked(self):
        slave_ids = database.get_all_slave_ids()
        if not slave_ids:
            QMessageBox.information(self.ui, "No Devices", "There are no devices to delete.")
            return

        from ui import DeleteDeviceDialog
        dlg = DeleteDeviceDialog(slave_ids, parent=self.ui)
        if dlg.exec() != dlg.DialogCode.Accepted:
            return

        selected = dlg.get_selected_ids()
        if not selected:
            QMessageBox.warning(self.ui, "No Selection", "Please select at least one Slave ID!")
            return

        ids_str = ", ".join(selected)
        reply = QMessageBox.question(
            self.ui, "Confirm Delete",
            f"Are you sure you want to delete Slave ID: {ids_str}?\n\nThis action cannot be undone!",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if reply != QMessageBox.StandardButton.Yes:
            return

        total = 0
        for sid in selected:
            count = database.delete_device_by_slave_id(sid)
            total += count
            database.insert_log("Delete Device", f"Deleted Slave ID: {sid} ({count} registers)")

        self.refresh_table()
        self.refresh_history()
        QMessageBox.information(
            self.ui, "Delete Successful",
            f"Successfully deleted {len(selected)} device(s) ({total} registers). Slave ID: {ids_str}",
        )

    def on_add_register(self, editor):
        fields = list(self._read_editor_fields(editor))

        required = [
            (1, "Parameter", "text"),
            (2, "Unit",      "text"),
            (3, "Function",  "combo"),
            (4, "Address",   "text"),
            (5, "Quantity",  "combo"),
            (6, "Type",      "combo"),
            (7, "Scale",     "combo"),
        ]
        missing = []
        for idx, label, kind in required:
            val = str(fields[idx]).strip()
            if kind == "text" and not val:
                missing.append(label)
            elif kind == "combo" and val in ("", "---"):
                missing.append(label)

        if missing:
            fields_str = "\n".join(f"  • {m}" for m in missing)
            QMessageBox.warning(self.ui, "Missing Required Fields",
                                f"Please fill in the following required fields before adding:\n\n{fields_str}")
            return

        if not fields[4].isdigit():
            QMessageBox.warning(self.ui, "Invalid Address", "Address must be a positive integer (e.g. 4002).")
            return

        fields[9]  = self._clean_factor(fields[9])
        fields[10] = self._clean_factor(fields[10])
        fields[8]  = self._auto_multiplier(fields[9], fields[10])

        database.insert_register(*fields)
        database.insert_log("Add New Register", f"Slave ID: {fields[0]} | Param: {fields[1]} | Addr: {fields[4]}")
        self.refresh_table()
        self.refresh_history()

    def on_update_table(self, table, btn_edit, btn_update):
        reply = QMessageBox.question(
            self.ui, "Confirm Update",
            "Do you want to save all changes to the database?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No | QMessageBox.StandardButton.Cancel,
        )
        if reply == QMessageBox.StandardButton.Cancel:
            return
        if reply == QMessageBox.StandardButton.No:
            self._disable_table_edit(table, btn_edit, btn_update)
            self.refresh_table()
            return

        for row in range(table.rowCount()):
            db_id = table.item(row, 0).data(Qt.ItemDataRole.UserRole)
            if db_id is None:
                continue
            data     = [table.item(row, col).text() for col in range(11)]
            data[9]  = self._clean_factor(data[9])
            data[10] = self._clean_factor(data[10])
            data[8]  = self._auto_multiplier(data[9], data[10])
            database.update_register(db_id, *data)

        database.insert_log("Bulk Update", f"Updated {table.rowCount()} registers")
        self._disable_table_edit(table, btn_edit, btn_update)
        self.refresh_table()
        self.refresh_history()

    def on_update_row(self, table, row):
        db_id    = table.item(row, 0).data(Qt.ItemDataRole.UserRole)
        data     = [table.item(row, col).text() for col in range(11)]
        data[9]  = self._clean_factor(data[9])
        data[10] = self._clean_factor(data[10])
        data[8]  = self._auto_multiplier(data[9], data[10])
        database.update_register(db_id, *data)
        self.refresh_table()

    def on_delete_row(self, db_id):
        database.delete_register_by_id(db_id)
        self.refresh_table()

    def _set_update_btn_style(self, btn, active: bool):
        if active:
            btn.setStyleSheet(
                "QPushButton{background-color:#1a73e8;color:white;border-radius:5px;padding:4px 16px;border:none;}"
                "QPushButton:hover{background-color:#1765cc;}"
                "QPushButton:pressed{background-color:#1257b0;padding-top:6px;padding-bottom:2px;}"
            )
        else:
            btn.setStyleSheet(
                "QPushButton{background-color:#a8c7f5;color:#e8f0fe;border-radius:5px;padding:4px 16px;border:none;}"
                "QPushButton:hover{background-color:#a8c7f5;}"
                "QPushButton:pressed{background-color:#a8c7f5;}"
            )

    def _enable_table_edit(self, table, btn_edit, btn_update):
        for row in range(table.rowCount()):
            for col in range(11):
                item = table.item(row, col)
                if item:
                    item.setFlags(item.flags() | Qt.ItemFlag.ItemIsEditable)
        btn_edit.setEnabled(False)
        self._set_update_btn_style(btn_update, active=True)
        btn_update.setEnabled(True)

    def _disable_table_edit(self, table, btn_edit, btn_update):
        for row in range(table.rowCount()):
            for col in range(11):
                item = table.item(row, col)
                if item:
                    item.setFlags(item.flags() & ~Qt.ItemFlag.ItemIsEditable)
        btn_edit.setEnabled(True)
        self._set_update_btn_style(btn_update, active=False)
        btn_update.setEnabled(False)

    def _enable_row_edit(self, table, row, btn_edit, btn_update):
        scroll_value = table.verticalScrollBar().value()
        for col in range(11):
            item = table.item(row, col)
            item.setFlags(item.flags() | Qt.ItemFlag.ItemIsEditable)
        btn_edit.setEnabled(False)
        btn_update.setEnabled(True)
        table.verticalScrollBar().setValue(scroll_value)

    def _read_editor_fields(self, editor):
        f1 = self._clean_factor(editor.ent_f1.text())
        f2 = self._clean_factor(editor.ent_f2.text())
        return (
            editor.ent_sid.text(),
            editor.ent_name.text(),
            editor.ent_unit.text(),
            editor.cb_fc.currentText(),
            editor.ent_addr.text(),
            editor.cb_qty.currentText(),
            editor.cb_type.currentText(),
            editor.cb_scale.currentText(),
            self._auto_multiplier(f1, f2),
            f1,
            f2,
        )

    @asyncSlot()
    async def on_scan_ble_clicked(self):
        self.ui.btn_scan_ble.setText("Scanning...")
        self.ui.btn_scan_ble.setEnabled(False)
        self.ui.combo_ble_devices.clear()
        try:
            devices = await BleakScanner.discover()
            for device in devices:
                if device.name:
                    self.ui.combo_ble_devices.addItem(f"{device.name} ({device.address})")
        finally:
            self.ui.btn_scan_ble.setText("Scan Devices")
            self.ui.btn_scan_ble.setEnabled(True)

    @asyncSlot()
    async def on_sync_clicked(self):
        all_rows = database.get_all_registers()
        if not all_rows:
            QMessageBox.warning(self.ui, "Announce", "No data in table for sync !!!")
            return

        slave_ids = sorted({str(row[1]) for row in all_rows}, key=lambda x: int(x) if x.isdigit() else x)

        from ui import SyncDialog
        dialog = SyncDialog(slave_ids, parent=self.ui)
        if dialog.exec() != dialog.DialogCode.Accepted:
            return

        selected_ids = dialog.get_selected_ids()
        if not selected_ids:
            QMessageBox.warning(self.ui, "Announce", "Please select at least one Slave ID !!!")
            return

        rows = [row for row in all_rows if str(row[1]) in selected_ids]

        selected_text = self.ui.combo_ble_devices.currentText()
        address_match = re.search(r"\((.*?)\)", selected_text)
        if not address_match:
            QMessageBox.warning(self.ui, "Fail", "Please select a Bluetooth device !!!")
            return

        ble_address = address_match.group(1)
        payload     = json.dumps(self._build_ble_payload(rows)).encode("utf-8")

        try:
            self.ui.btn_sync.setEnabled(False)
            self.ui.btn_sync.setText("Syncing...")
            async with BleakClient(ble_address) as client:
                for i in range(0, len(payload), 180):
                    await client.write_gatt_char(MODBUS_CHAR_UUID, payload[i:i+180], response=True)

            QMessageBox.information(self.ui, "Success", "Data sent successfully!")
            ids_str = ", ".join(selected_ids)
            database.insert_log("Update data to device", f"Sent {len(rows)} registers (IDs: {ids_str}) to: {selected_text}")
            self.refresh_history()

        except Exception as error:
            # ESP32 có thể drop connection ngay khi nhận xong → "canceled" vẫn là thành công
            if "canceled" in str(error).lower():
                QMessageBox.information(self.ui, "Success", "Data sent successfully!")
            else:
                QMessageBox.critical(self.ui, "BLE Error", str(error))
        finally:
            self.ui.btn_sync.setEnabled(True)
            self.ui.btn_sync.setText("Sync to Device")

    def _build_ble_payload(self, rows):
        payload = []
        for index, row in enumerate(rows):
            slave_id = row[1]
            payload.append({
                "i":  index,
                "s":  int(slave_id),
                "n":  row[2],
                "u":  row[3],
                "f":  FUNCTION_CODE_MAP.get(row[4], 0),
                "a":  int(row[5]),
                "q":  int(row[6]),
                "t":  DATA_TYPE_MAP.get(row[7], 1),
                "sc": float(row[8]),
                "m":  MULTIPLIER_MAP.get(row[9], 0),
                "r":  [
                    self._find_register_index(str(row[10]), slave_id, rows),
                    self._find_register_index(str(row[11]), slave_id, rows),
                ],
            })
        return payload

    def _find_register_index(self, param_name, slave_id, all_rows):
        if not param_name or param_name in ("1.0", "NULL", ""):
            return 65535
        for index, row in enumerate(all_rows):
            if str(row[1]) == str(slave_id) and row[2].strip().upper() == param_name.strip().upper():
                return index
        return 65535

    @asyncSlot()
    async def on_scan_wifi_networks_clicked(self):
        import asyncio
        import subprocess

        self.ui.btn_scan_wifi_net.setText("Scanning...")
        self.ui.btn_scan_wifi_net.setEnabled(False)
        self.ui.tbl_wifi_networks.setRowCount(0)

        try:
            loop   = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None,
                lambda: subprocess.run(
                    ["netsh", "wlan", "show", "networks", "mode=bssid"],
                    capture_output=True, text=True, encoding="utf-8", errors="replace",
                ),
            )
            networks = self._parse_netsh_wifi(result.stdout)
            table    = self.ui.tbl_wifi_networks
            for ssid, signal, auth in networks:
                row = table.rowCount()
                table.insertRow(row)
                for col, val in enumerate([ssid, signal, auth]):
                    item = QTableWidgetItem(val)
                    item.setFlags(item.flags() & ~Qt.ItemFlag.ItemIsEditable)
                    item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                    table.setItem(row, col, item)
            if not networks:
                QMessageBox.information(self.ui, "No Networks Found",
                                        "No WiFi networks found.\nMake sure your WiFi adapter is enabled.")
        except Exception as e:
            QMessageBox.critical(self.ui, "Scan Error", str(e))
        finally:
            self.ui.btn_scan_wifi_net.setText("Scan WiFi")
            self.ui.btn_scan_wifi_net.setEnabled(True)

    @staticmethod
    def _parse_netsh_wifi(output: str):
        networks = []
        ssid = signal = auth = None
        for line in output.splitlines():
            line = line.strip()
            m = re.match(r"SSID \d+ *: (.+)", line)
            if m and "BSSID" not in line:
                if ssid is not None:
                    networks.append((ssid, signal or "N/A", auth or "N/A"))
                ssid, signal, auth = m.group(1).strip(), None, None
                continue
            m = re.match(r"Signal\s*:\s*(\d+%)", line)
            if m:
                signal = m.group(1)
                continue
            m = re.match(r"Authentication\s*:\s*(.+)", line)
            if m:
                auth = m.group(1).strip()
        if ssid is not None:
            networks.append((ssid, signal or "N/A", auth or "N/A"))
        networks.sort(key=lambda x: int(x[1].replace("%", "")) if x[1].endswith("%") else 0, reverse=True)
        return networks

    def on_wifi_network_selected(self):
        table = self.ui.tbl_wifi_networks
        row   = table.currentRow()
        if row >= 0:
            ssid_item = table.item(row, 0)
            if ssid_item:
                self.ui.ent_ssid.setText(ssid_item.text())
                self.ui.ent_wifi_pass.setFocus()

    def on_toggle_password_visibility(self):
        if self.ui.ent_wifi_pass.echoMode() == QLineEdit.EchoMode.Password:
            self.ui.ent_wifi_pass.setEchoMode(QLineEdit.EchoMode.Normal)
            self.ui.btn_show_pass.setText("Hide")
        else:
            self.ui.ent_wifi_pass.setEchoMode(QLineEdit.EchoMode.Password)
            self.ui.btn_show_pass.setText("Show")

    @asyncSlot()
    async def on_send_wifi_clicked(self):
        ssid     = self.ui.ent_ssid.text().strip()
        password = self.ui.ent_wifi_pass.text()

        if not ssid:
            QMessageBox.warning(self.ui, "Missing Input", "Please enter WiFi SSID!")
            return
        if len(ssid.encode("utf-8")) > 31:
            QMessageBox.warning(self.ui, "SSID Too Long",
                                f"SSID must be at most 31 characters.\nCurrent: {len(ssid.encode('utf-8'))} bytes.")
            return
        if len(password.encode("utf-8")) > 63:
            QMessageBox.warning(self.ui, "Password Too Long",
                                f"Password must be at most 63 characters.\nCurrent: {len(password.encode('utf-8'))} bytes.")
            return

        selected_text = self.ui.combo_ble_devices.currentText()
        address_match = re.search(r"\((.*?)\)", selected_text)
        if not address_match:
            QMessageBox.warning(self.ui, "No Device",
                                "No Bluetooth device selected.\nPlease go to the Setup tab and scan for devices first.")
            return

        ble_address = address_match.group(1)
        payload     = json.dumps({"ssid": ssid, "pass": password}).encode("utf-8")

        try:
            self.ui.btn_send_wifi.setEnabled(False)
            self.ui.btn_send_wifi.setText("Sending...")
            self.ui.lbl_wifi_status.setText("Connecting to device...")

            async with BleakClient(ble_address) as client:
                await client.write_gatt_char(WIFI_CHAR_UUID, payload, response=True)

            self.ui.lbl_wifi_status.setText("")
            QMessageBox.information(self.ui, "Success",
                                    f"WiFi config sent successfully!\n\nSSID: {ssid}\n\nThe device will restart and connect to the new WiFi.")
            database.insert_log("WiFi Config Sent", f"SSID: {ssid} → {selected_text}")
            self.refresh_history()

        except Exception as error:
            # ESP32 tự restart ngay sau khi nhận → BLE drop → "canceled" là bình thường
            if "canceled" in str(error).lower():
                self.ui.lbl_wifi_status.setText("")
                QMessageBox.information(self.ui, "Success",
                                        f"WiFi config sent successfully!\n\nSSID: {ssid}\n\nThe device will restart and connect to the new WiFi.")
                database.insert_log("WiFi Config Sent", f"SSID: {ssid} → {selected_text}")
                self.refresh_history()
            else:
                self.ui.lbl_wifi_status.setText(f"Error: {error}")
                QMessageBox.critical(self.ui, "BLE Error", str(error))
        finally:
            self.ui.btn_send_wifi.setEnabled(True)
            self.ui.btn_send_wifi.setText("Send WiFi Config to Device")

    # =========================================================================
    # MODBUS TCP TAB
    # =========================================================================
    def load_tcp_config(self):
        cfg = database.get_tcp_config()
        try:
            self.ui.spn_tcp_port.setValue(int(cfg["port"]))
        except ValueError:
            self.ui.spn_tcp_port.setValue(502)

    def load_tcp_mapping(self):
        self.ui.tbl_tcp_mapping.setRowCount(0)
        for _, tcp_addr, unit_id, function_code, parameter, description in database.get_tcp_mappings():
            self._tcp_insert_row(tcp_addr, unit_id, function_code, parameter, description or "")

    def _tcp_insert_row(self, tcp_addr=None, unit_id="", function_code="", parameter="", description=""):
        table = self.ui.tbl_tcp_mapping
        row   = table.rowCount()
        table.insertRow(row)

        addr_item = QTableWidgetItem(str(tcp_addr) if tcp_addr is not None else str(row))
        addr_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        table.setItem(row, 0, addr_item)

        uid_item = QTableWidgetItem(str(unit_id))
        uid_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        uid_item.setFlags(uid_item.flags() & ~Qt.ItemFlag.ItemIsEditable)
        table.setItem(row, 1, uid_item)

        fc_item = QTableWidgetItem(function_code)
        fc_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        fc_item.setFlags(fc_item.flags() & ~Qt.ItemFlag.ItemIsEditable)
        table.setItem(row, 2, fc_item)

        param_combo = QComboBox()
        param_combo.addItem("--- Select parameter ---", ("", "", ""))
        for s_id, param_name, fc in database.get_registers_for_dropdown():
            param_combo.addItem(f"{param_name}  (Slave {s_id})", (str(s_id), param_name, fc))
        if parameter:
            for i in range(param_combo.count()):
                data = param_combo.itemData(i)
                if data and data[0] == str(unit_id) and data[1] == parameter:
                    param_combo.setCurrentIndex(i)
                    break
        param_combo.currentIndexChanged.connect(self._on_tcp_param_changed)
        table.setCellWidget(row, 3, param_combo)

        desc_item = QTableWidgetItem(description)
        table.setItem(row, 4, desc_item)

    def _on_tcp_param_changed(self):
        sender_combo = self.sender()
        table = self.ui.tbl_tcp_mapping
        for row in range(table.rowCount()):
            if table.cellWidget(row, 3) is sender_combo:
                data = sender_combo.currentData()
                if data and data[0]:
                    table.item(row, 1).setText(data[0])
                    table.item(row, 2).setText(data[2])  # FC tự điền từ register
                break

    def on_tcp_add_row_clicked(self):
        table    = self.ui.tbl_tcp_mapping
        max_addr = -1
        for row in range(table.rowCount()):
            item = table.item(row, 0)
            if item and item.text().isdigit():
                max_addr = max(max_addr, int(item.text()))
        self._tcp_insert_row(tcp_addr=max_addr + 1)

    def on_tcp_del_row_clicked(self):
        table = self.ui.tbl_tcp_mapping
        row   = table.currentRow()
        if row < 0:
            QMessageBox.warning(self.ui, "No Selection", "Please select a row to delete.")
            return
        table.removeRow(row)

    def on_save_tcp(self):
        port = str(self.ui.spn_tcp_port.value())
        database.save_tcp_config(port)

        table    = self.ui.tbl_tcp_mapping
        mappings = []
        for row in range(table.rowCount()):
            addr_item  = table.item(row, 0)
            desc_item  = table.item(row, 4)
            fc_item     = table.item(row, 2)
            param_combo = table.cellWidget(row, 3)
            if not param_combo:
                continue
            data = param_combo.currentData()
            if not data or not data[0]:
                continue
            tcp_addr    = addr_item.text().strip() if addr_item else str(row)
            fc          = fc_item.text().strip() if fc_item else ""
            description = desc_item.text().strip() if desc_item else ""
            mappings.append((tcp_addr, data[0], fc, data[1], description))

        database.save_tcp_mappings(mappings)
        database.insert_log("Save Modbus TCP Config", f"Port={port}, Mappings={len(mappings)}")
        self.refresh_history()
        QMessageBox.information(self.ui, "Saved",
                                f"Modbus TCP configuration saved!\n\nPort: {port}  |  {len(mappings)} mapping(s)")

    @asyncSlot()
    async def on_send_tcp_clicked(self):
        selected_text = self.ui.combo_ble_devices.currentText()
        address_match = re.search(r"\((.*?)\)", selected_text)
        if not address_match:
            QMessageBox.warning(self.ui, "No Device",
                                "No Bluetooth device selected.\nPlease go to the Setup tab and scan for devices first.")
            return

        ble_address = address_match.group(1)
        port        = self.ui.spn_tcp_port.value()

        table    = self.ui.tbl_tcp_mapping
        map_list = []
        for row in range(table.rowCount()):
            addr_item   = table.item(row, 0)
            fc_item     = table.item(row, 2)
            param_combo = table.cellWidget(row, 3)
            if not param_combo:
                continue
            data = param_combo.currentData()
            if not data or not data[0]:
                continue
            tcp_addr_str = addr_item.text().strip() if addr_item else ""
            if not tcp_addr_str.isdigit():
                continue
            map_list.append({
                "addr":  int(tcp_addr_str),
                "uid":   int(data[0]),
                "fc":    fc_item.text().strip() if fc_item else "",
                "param": data[1],
            })

        payload = json.dumps({"port": port, "map": map_list}).encode("utf-8")

        try:
            self.ui.btn_tcp_send.setEnabled(False)
            self.ui.btn_tcp_send.setText("Sending...")
            async with BleakClient(ble_address) as client:
                for i in range(0, len(payload), 180):
                    await client.write_gatt_char(TCP_CHAR_UUID, payload[i:i+180], response=True)

            QMessageBox.information(self.ui, "Success", "Modbus TCP config sent successfully!")
            database.insert_log("Send Modbus TCP Config", f"Port={port}, {len(map_list)} mapping(s) → {selected_text}")
            self.refresh_history()

        except Exception as error:
            if "canceled" in str(error).lower():
                QMessageBox.information(self.ui, "Success", "Modbus TCP config sent successfully!")
                database.insert_log("Send Modbus TCP Config", f"Port={port}, {len(map_list)} mapping(s) → {selected_text}")
                self.refresh_history()
            else:
                QMessageBox.critical(self.ui, "BLE Error", str(error))
        finally:
            self.ui.btn_tcp_send.setEnabled(True)
            self.ui.btn_tcp_send.setText("Send to Device")


config_logic = AppController
