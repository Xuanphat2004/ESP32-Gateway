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

FUNCTION_CODE_MAP = {
    "Read Holding Registers (0x03)": 0x00,
    "Read Input Registers (0x04)": 0x01,
}

DATA_TYPE_MAP = {
    "Unsigned 16 bits": 0x01,
    "Unsigned 32 bits": 0x02,
    "Int 16 bits AB": 0x0E,
    "Int 16 bits BA": 0x0F,
    "Uint 16 bits AB": 0x10,
    "Uint 16 bits BA": 0x11,
    "Int 32 bits ABCD": 0x12,
    "Int 32 bits CDAB": 0x13,
    "Int 32 bits DCBA": 0x15,
    "Uint 32 bits ABCD": 0x16,
    "Uint 32 bits CDAB": 0x17,
    "Float ABCD": 0x1A,
    "Float CDAB": 0x1B,
    "Long": 18,
}

MULTIPLIER_MAP = {
    "Data * Scale": 0,
    "Data * Scale * Factor 1": 1,
    "Data * Scale * Factor 1 * Factor 2": 2,
}

COMBO_COLUMNS = {  # khi user click vào để sửa, Qt hiện ra dropdown chọn.
    3: ["---", "Read Holding Registers (0x03)", "Read Input Registers (0x04)"],
    6: [
        "---",
        "Unsigned 16 bits",
        "Unsigned 32 bits",
        "Int 16 bits AB",
        "Int 16 bits BA",
        "Uint 16 bits AB",
        "Uint 16 bits BA",
        "Int 32 bits ABCD",
        "Int 32 bits CDAB",
        "Int 32 bits DCBA",
        "Uint 32 bits ABCD",
        "Uint 32 bits CDAB",
        "Float ABCD",
        "Float CDAB",
        "Long",
    ],
    7: ["---", "0.000003125", "0.001", "0.01", "0.1", "1"],
    8: [
        "---",
        "Data * Scale",
        "Data * Scale * Factor 1",
        "Data * Scale * Factor 1 * Factor 2",
    ],
}

SUGGEST_COLUMNS = {
    1: "parameter",
    2: "unit",
    4: "address",
    9: "factor_1",
    10: "factor_2",
}


# =============================================================================
# CLASS: SuggestDelegate
# khi user double-click vào ô trong bảng để sửa,
# Qt sẽ hỏi Delegate "tạo widget gì để nhập liệu?"
# Delegate trả về QComboBox hoặc QLineEdit tuỳ cột
# QComboBox: Là ô dropdown — user click vào thì xổ ra danh sách, chỉ được chọn 1 trong các lựa chọn có sẵn, không gõ tự do.
# QLineEdit: Là ô nhập text — user gõ tay vào
class SuggestDelegate(QStyledItemDelegate): #  xử lý việc edit 1 ô trong bảng.
    # Qt sẽ gọi hàm này khi User double-click vào ô nhập liệu trong bảng
    def createEditor(self, parent, option, index): 
        #  cột "Unit" → col = 2
        #  cột "Function" → col = 3
        col = index.column() # đại diện cho ô đang được click, chứa vị trí ô đó trong bảng
        if col in COMBO_COLUMNS:
            combo = QComboBox(parent) #  Tạo 1 cái ô dropdown, đặt tên là combo
            combo.addItems(COMBO_COLUMNS[col]) # Nhét danh sách lựa chọn vào cái khung dropdown đó
            return combo

        # Cột thuộc SUGGEST_COLUMNS → QLineEdit + gợi ý từ DB
        line = QLineEdit(parent) # Tạo 1 ô nhập text, user gõ vào
        if col in SUGGEST_COLUMNS: # Kiểm tra cột user đang click có nằm trong danh sách cột cần gợi ý từ những lần nhập trước hay không
            field_name = SUGGEST_COLUMNS[col]
            suggestions = database.get_distinct_suggestions(field_name) # Lấy ra danh sách giá trị đã từng nhập trước đó trong cột đó
            completer = QCompleter(suggestions, line) # Tạo bộ gợi ý autocomplete từ danh sách vừa lấy, gắn vào ô line.
            completer.setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive) # Gợi ý không phân biệt hoa thường
            completer.setFilterMode(Qt.MatchFlag.MatchContains) # Gợi ý hiện ra dựa trên ký tự đang gõ
            line.setCompleter(completer) # gắn bộ gợi ý và ô text
        return line

    def setEditorData(self, editor, index):
        """Qt gọi hàm này để điền sẵn giá trị hiện tại vào editor vừa tạo."""
        current_value = index.data(Qt.ItemDataRole.EditRole) or ""
        if isinstance(editor, QComboBox):
            pos = editor.findText(current_value) 
            editor.setCurrentIndex(pos if pos >= 0 else 0) # Tìm text trong danh sách, nếu không có thì chọn item đầu (---)
        else:
            editor.setText(current_value) # Nếu widget là QLineEdit — điền thẳng text vào ô

    def setModelData(self, editor, model, index):
        """Qt gọi hàm này khi user xong việc edit — lưu giá trị mới vào model."""
        if isinstance(editor, QComboBox):
            model.setData(index, editor.currentText(), Qt.ItemDataRole.EditRole)
        else:
            model.setData(index, editor.text(), Qt.ItemDataRole.EditRole)

    def updateEditorGeometry(self, editor, option, index):
        """Đặt kích thước editor khớp với kích thước ô trong bảng."""
        editor.setGeometry(option.rect)


# =============================================================================
# CLASS: AppController
# Mục đích: điều phối toàn bộ nghiệp vụ của app
#           - Nhận sự kiện từ UI (signal)
#           - Xử lý dữ liệu
#           - Cập nhật lại UI
class AppController(QObject):

    def __init__(self, ui):
        super().__init__()
        self.ui = ui  # giữ tham chiếu đến cửa sổ chính

        database.init_db()  # tạo file DB nếu chưa có
        self._connect_signals()  # nối nút bấm với hàm xử lý
        self.refresh_table()  # load dữ liệu từ DB lên bảng
        self.refresh_history()  # load lịch sử hoạt động

    # =========================================================================
    # KẾT NỐI SIGNAL / SLOT
    def _connect_signals(self):
        self.ui.btn_new.clicked.connect(self.on_new_device_clicked)
        self.ui.btn_sync.clicked.connect(self.on_sync_clicked)
        self.ui.btn_scan_ble.clicked.connect(self.on_scan_ble_clicked)
        self.ui.btn_delete_device.clicked.connect(self.on_delete_device_clicked)

    # =========================================================================
    # TỰ ĐỘNG TÍNH MULTIPLIER DỰA TRÊN FACTOR
    @staticmethod
    def _auto_multiplier(f1: str, f2: str) -> str:
        """Suy ra multiplier từ factor_1 và factor_2.
        
        - Cả 2 có giá trị → Data * Scale * Factor 1 * Factor 2
        - Chỉ factor_1     → Data * Scale * Factor 1
        - Không có factor  → Data * Scale
        """
        f1 = (f1 or "").strip()
        f2 = (f2 or "").strip()
        f1_empty = f1 in ("", "NULL", "---", "nan")
        f2_empty = f2 in ("", "NULL", "---", "nan")

        if not f1_empty and not f2_empty:
            return "Data * Scale * Factor 1 * Factor 2"
        elif not f1_empty:
            return "Data * Scale * Factor 1"
        else:
            return "Data * Scale"

    @staticmethod
    def _clean_factor(val) -> str:
        """Chuẩn hóa factor từ mọi nguồn: Excel (NaN), form (rỗng), DB (NULL).

        Pandas returns float nan for empty cells → str(nan) = "nan" → not caught
        by the usual `or "NULL"` pattern because "nan" is a truthy string.
        Hàm này xử lý đúng tất cả các trường hợp.
        """
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
        # ── Lưu vị trí hiện tại trước khi xoá ───────────────────────────────
        saved_tab = self.ui.device_tabs.currentIndex()
        saved_scroll = self._get_current_scroll()  # vị trí scroll của table

        # ── Xoá tab cũ và vẽ lại ─────────────────────────────────────────────
        self.ui.device_tabs.clear()

        rows = database.get_all_registers()
        grouped = self._group_rows_by_slave(rows)  # { "1": [...], "2": [...] }

        for slave_id, records in grouped.items():
            self._create_tab(slave_id, records)

        # ── Phục hồi vị trí ──────────────────────────────────────────────────
        if 0 <= saved_tab < self.ui.device_tabs.count():
            self.ui.device_tabs.setCurrentIndex(saved_tab)
            self._restore_scroll(saved_scroll)  # ← FIX BUG SCROLL

    def _group_rows_by_slave(self, rows):
        grouped = {}
        for row in rows:
            sid = str(row[1])
            if sid not in grouped:
                grouped[sid] = []
            grouped[sid].append(row)
        return grouped

    def _create_tab(self, slave_id, records):
        """Tạo 1 tab hoàn chỉnh cho 1 Slave ID: form nhập + bảng dữ liệu."""

        # Tạo widget bọc ngoài
        tab_widget = QWidget()
        layout = QVBoxLayout(tab_widget)

        # ── Form nhập register mới ────────────────────────────────────────────
        editor = RegisterEditorWidget()
        editor.ent_sid.setText(slave_id)
        editor.ent_sid.setReadOnly(True)  # không cho sửa Slave ID
        self._apply_autocomplete(editor)  # gán gợi ý autocomplete
        # Khi bấm "Add Register" → gọi on_add_register, truyền editor vào
        editor.btn_action.clicked.connect(lambda: self.on_add_register(editor))
        layout.addWidget(editor)

        # ── Nút Edit / Update chung cho toàn bảng (căn phải) ─────────────────
        table_ctrl_lay = QHBoxLayout()
        btn_edit = QPushButton("✏️  Edit Table")
        btn_edit.setFixedHeight(34)
        btn_update = QPushButton("💾  Update")
        btn_update.setFixedHeight(34)
        self._set_update_btn_style(btn_update, active=False)
        btn_update.setEnabled(False)
        table_ctrl_lay.addStretch()  # đẩy 2 nút sang phải
        table_ctrl_lay.addWidget(btn_edit)
        table_ctrl_lay.addWidget(btn_update)
        layout.addLayout(table_ctrl_lay)

        # ── Bảng danh sách register ───────────────────────────────────────────
        table = self._build_table()
        for record in records:
            self._add_row_to_table(table, record)
        layout.addWidget(table)

        # Nối signal cho 2 nút chung (truyền table vào)
        btn_edit.clicked.connect(lambda: self._enable_table_edit(table, btn_edit, btn_update))
        btn_update.clicked.connect(lambda: self.on_update_table(table, btn_edit, btn_update))

        self.ui.device_tabs.addTab(tab_widget, f"ID {slave_id}")

    def _build_table(self):
        """Tạo QTableWidget đã được cấu hình sẵn header và delegate."""
        table = QTableWidget()
        table.setColumnCount(12)
        table.setHorizontalHeaderLabels([
            "ID", "Parameter", "Unit", "Function", "Start Address",
            "Quantity", "Data Type", "Scale", "Multiplier",
            "Factor 1", "Factor 2", "Action",
        ])

        # Cho phép kéo dãn cột tự do như Excel
        header = table.horizontalHeader()
        header.setSectionResizeMode(QHeaderView.ResizeMode.Interactive)
        header.setStretchLastSection(False)

        # Độ rộng mặc định hợp lý cho từng cột
        col_widths = [40, 180, 60, 220, 100, 70, 140, 70, 240, 100, 100, 80]
        for i, w in enumerate(col_widths):
            table.setColumnWidth(i, w)

        # Căn giữa text trong header
        for i in range(table.columnCount()):
            item = table.horizontalHeaderItem(i)
            if item:
                item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)

        # Cho phép cuộn ngang khi cột quá nhiều
        table.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)

        # Gán delegate để ô edit hiện QComboBox hoặc QLineEdit tuỳ cột
        table.setItemDelegate(SuggestDelegate(table))
        return table

    def _add_row_to_table(self, table, record):
        """
        Thêm 1 hàng vào bảng từ 1 record DB.
        record = (id, slave_id, parameter, unit, function, address, quantity, type, scale, multiplier, factor_1, factor_2)
        """
        row_index = table.rowCount()
        table.insertRow(row_index)

        for col in range(1, 12):
            item = QTableWidgetItem(str(record[col]))
            if col == 1:
                item.setData(Qt.ItemDataRole.UserRole, record[0])
            item.setFlags(item.flags() & ~Qt.ItemFlag.ItemIsEditable)
            # Căn giữa nội dung trong ô
            item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
            table.setItem(row_index, col - 1, item)

        table.setCellWidget(row_index, 11, self._build_action_buttons(table, row_index, record[0]))

    def _build_action_buttons(self, table, row_index, db_id):
        container = QWidget()
        layout = QHBoxLayout(container)
        layout.setContentsMargins(2, 2, 2, 2)

        btn_delete = QPushButton("Delete")
        btn_delete.clicked.connect(lambda _, rid=db_id: self.on_delete_row(rid))
        layout.addWidget(btn_delete)

        return container

    def _apply_autocomplete(self, editor):
        """Gán danh sách gợi ý autocomplete từ DB vào form nhập liệu."""
        editor.set_suggestions("parameter", database.get_distinct_suggestions("parameter"))
        editor.set_suggestions("unit", database.get_distinct_suggestions("unit"))
        editor.set_suggestions("address", database.get_distinct_suggestions("address"))
        editor.set_suggestions("factor", database.get_distinct_suggestions("factor_1"))

    def refresh_history(self):
        """Đọc lịch sử hoạt động từ DB và hiển thị vào bảng History."""
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
        """Lấy vị trí scroll hiện tại của table đang được hiển thị."""
        table = self._get_current_table()
        if table:
            return table.verticalScrollBar().value()
        return 0

    def _restore_scroll(self, scroll_value):
        """Đặt lại vị trí scroll cho table sau khi rebuild xong."""
        table = self._get_current_table()
        if table:
            table.verticalScrollBar().setValue(scroll_value)

    def _get_current_table(self):
        """Tìm QTableWidget trong tab đang được chọn."""
        current_tab = self.ui.device_tabs.currentWidget()
        if current_tab:
            return current_tab.findChild(QTableWidget)
        return None

    # =========================================================================
    # XỬ LÝ SỰ KIỆN (EVENT HANDLERS) - Các nút nhấn 
    # Quy tắc đặt tên: on_<tên_sự_kiện>
    def on_new_device_clicked(self):
        """Nhập Slave ID → hỏi nhập tay hay import Excel."""
        # Bước 1: nhập Slave ID
        slave_id, confirmed = QInputDialog.getText(
            self.ui, "New Device", "Enter Slave ID (1-247):"
        )
        if not confirmed or not slave_id.strip():
            return
        slave_id = slave_id.strip()

        if not slave_id.isdigit() or not (1 <= int(slave_id) <= 247):
            QMessageBox.warning(self.ui, "Invalid Input", "Slave ID must be an integer between 1 and 247!")
            return

        if database.check_slave_id_exists(slave_id):
            QMessageBox.warning(self.ui, "Duplicate", f"Slave ID {slave_id} already exists!")
            return

        # Bước 2: hỏi nhập tay hay import
        from ui import ImportChoiceDialog
        dlg = ImportChoiceDialog(parent=self.ui)
        if dlg.exec() == 0:
            return

        if dlg.choice == "manual":
            # Tạo tab rỗng để nhập tay như bình thường
            self._create_tab(slave_id, [])
            self.ui.device_tabs.setCurrentIndex(self.ui.device_tabs.count() - 1)

        elif dlg.choice == "import":
            self._import_from_excel(slave_id)

    def _import_from_excel(self, slave_id):
        """Mở file dialog → đọc Excel → validate → insert DB."""
        from PyQt6.QtWidgets import QFileDialog
        import pandas as pd

        file_path, _ = QFileDialog.getOpenFileName(
            self.ui,
            "Select Excel file to import",
            "",
            "Excel Files (*.xlsx *.xls)",
        )
        if not file_path:
            return

        try:
            # Header ở row 2, dữ liệu từ row 3
            # usecols B:J (bỏ cột Multiplier — tự tính từ factor)
            df = pd.read_excel(
                file_path,
                skiprows=1,
                usecols="B:J",
                dtype=str,
                engine="openpyxl"
            )
            # Đổi tên cột — không có multiplier
            df.columns = [
                "parameter", "unit", "function_code",
                "address", "quantity", "type",
                "scale", "factor_1", "factor_2",
            ]
            df = df.dropna(subset=["parameter", "address"])
            df = df[df["parameter"].str.strip() != ""]
            df["slave_id"] = slave_id

        except Exception as e:
            QMessageBox.critical(
                self.ui, "File Error",
                f"Cannot read Excel file:\n{e}"
            )
            return

        if df.empty:
            QMessageBox.warning(self.ui, "No Data", "The Excel file contains no valid data!")
            return

        # Validate
        errors = self._validate_import_df(df)
        if errors:
            msg = "\n".join(errors[:10])
            if len(errors) > 10:
                msg += f"\n... and {len(errors)-10} more errors"
            QMessageBox.critical(self.ui, "Validation Error", f"The following errors were found:\n\n{msg}")
            return

        # Xác nhận
        reply = QMessageBox.question(
            self.ui, "Confirm Import",
            f"Import {len(df)} registers for Slave ID {slave_id}. Continue?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if reply != QMessageBox.StandardButton.Yes:
            return

        # Insert DB — tự tính multiplier từ factor
        for _, row in df.iterrows():
            f1  = self._clean_factor(row.get("factor_1"))
            f2  = self._clean_factor(row.get("factor_2"))
            mul = self._auto_multiplier(f1, f2)
            database.insert_register(
                slave_id,
                str(row["parameter"]).strip(),
                str(row["unit"]).strip(),
                str(row["function_code"]).strip(),
                str(row["address"]).strip(),
                str(row["quantity"]).strip(),
                str(row["type"]).strip(),
                str(row["scale"]).strip(),
                mul,
                f1, f2,
            )

        database.insert_log(
            action="Import from Excel",
            detail=f"Slave ID: {slave_id} | {len(df)} registers | {file_path.split('/')[-1]}",
        )
        self.refresh_table()
        self.refresh_history()
        QMessageBox.information(
            self.ui, "Import Successful",
            f"Successfully imported {len(df)} registers for Slave ID {slave_id}!"
        )

    def _validate_import_df(self, df):
        """Kiểm tra dữ liệu từ file Excel trước khi import."""
        errors = []
        valid_fc  = {"Read Holding Registers (0x03)", "Read Input Registers (0x04)"}
        valid_qty = {"1", "2"}
        valid_types = {
            "Unsigned 16 bits","Unsigned 32 bits",
            "Int 16 bits AB","Int 16 bits BA",
            "Uint 16 bits AB","Uint 16 bits BA",
            "Int 32 bits ABCD","Int 32 bits CDAB","Int 32 bits DCBA",
            "Uint 32 bits ABCD","Uint 32 bits CDAB",
            "Float ABCD","Float CDAB","Long",
        }
        valid_scale = {"0.000003125","0.001","0.01","0.1","1"}

        for i, row in df.iterrows():
            line = i + 4
            if not str(row.get("parameter","")).strip():
                errors.append(f"Row {line}: Parameter is required")
            fc = str(row.get("function_code","")).strip()
            if fc not in valid_fc:
                errors.append(f"Row {line}: Invalid function code '{fc}'")
            if not str(row.get("address","")).strip().isdigit():
                errors.append(f"Row {line}: Address must be an integer")
            if str(row.get("quantity","")).strip() not in valid_qty:
                errors.append(f"Row {line}: Quantity must be 1 or 2")
            if str(row.get("type","")).strip() not in valid_types:
                errors.append(f"Row {line}: Invalid data type '{row.get('type','')}'")
            if str(row.get("scale","")).strip() not in valid_scale:
                errors.append(f"Row {line}: Invalid scale value '{row.get('scale','')}'")
            # multiplier không validate vì được tính tự động từ factor
        return errors

    def on_delete_device_clicked(self):
        """Hiện dialog chọn Slave ID → xác nhận → xóa khỏi DB."""
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

        # Xác nhận lần 2
        ids_str = ", ".join(selected)
        reply = QMessageBox.question(
            self.ui,
            "Confirm Delete",
            f"Are you sure you want to delete Slave ID: {ids_str}?\n\nThis action cannot be undone!",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
        )
        if reply != QMessageBox.StandardButton.Yes:
            return

        total = 0
        for sid in selected:
            count = database.delete_device_by_slave_id(sid)
            total += count
            database.insert_log(
                action="Delete Device",
                detail=f"Deleted Slave ID: {sid} ({count} registers)",
            )

        self.refresh_table()
        self.refresh_history()
        QMessageBox.information(
            self.ui, "Delete Successful",
            f"Successfully deleted {len(selected)} device(s) ({total} registers). Slave ID: {ids_str}",
        )

    def on_add_register(self, editor):
        fields = list(self._read_editor_fields(editor))

        # ── Validate bắt buộc ────────────────────────────────────────────────
        # Mapping: (field_index, tên hiển thị, loại kiểm tra)
        # "text" → phải có chữ
        # "combo" → không được là "---" hoặc rỗng
        required = [
            (1,  "Parameter",     "text"),
            (2,  "Unit",          "text"),
            (3,  "Function",      "combo"),
            (4,  "Address",       "text"),
            (5,  "Quantity",      "combo"),
            (6,  "Type",          "combo"),
            (7,  "Scale",         "combo"),
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
            QMessageBox.warning(
                self.ui,
                "Missing Required Fields",
                f"Please fill in the following required fields before adding:\n\n{fields_str}",
            )
            return

        # Address phải là số nguyên
        if not fields[4].isdigit():
            QMessageBox.warning(
                self.ui,
                "Invalid Address",
                "Address must be a positive integer (e.g. 4002).",
            )
            return

        # ── Lưu DB ───────────────────────────────────────────────────────────
        fields[9]  = self._clean_factor(fields[9])
        fields[10] = self._clean_factor(fields[10])
        fields[8]  = self._auto_multiplier(fields[9], fields[10])

        database.insert_register(*fields)
        database.insert_log(
            action="Add New Register",
            detail=f"Slave ID: {fields[0]} | Param: {fields[1]} | Addr: {fields[4]}",
        )

        self.refresh_table()
        self.refresh_history()

    def on_update_table(self, table, btn_edit, btn_update):
        """Hỏi xác nhận rồi lưu toàn bộ thay đổi trong bảng xuống DB."""
        reply = QMessageBox.question(
            self.ui,
            "Confirm Update",
            "Do you want to save all changes to the database?",
            QMessageBox.StandardButton.Yes
            | QMessageBox.StandardButton.No
            | QMessageBox.StandardButton.Cancel,
        )

        if reply == QMessageBox.StandardButton.Cancel:
            # Không làm gì — user tiếp tục edit
            return

        if reply == QMessageBox.StandardButton.No:
            # Huỷ thay đổi: reload lại bảng từ DB (discard edits)
            self._disable_table_edit(table, btn_edit, btn_update)
            self.refresh_table()
            return

        # Yes → lưu tất cả hàng xuống DB
        for row in range(table.rowCount()):
            db_id = table.item(row, 0).data(Qt.ItemDataRole.UserRole)
            if db_id is None:
                continue
            data = [table.item(row, col).text() for col in range(11)]
            data[9]  = self._clean_factor(data[9])
            data[10] = self._clean_factor(data[10])
            data[8]  = self._auto_multiplier(data[9], data[10])
            database.update_register(db_id, *data)

        database.insert_log(action="Bulk Update", detail=f"Updated {table.rowCount()} registers")
        self._disable_table_edit(table, btn_edit, btn_update)
        self.refresh_table()
        self.refresh_history()

    def on_update_row(self, table, row):
        db_id = table.item(row, 0).data(Qt.ItemDataRole.UserRole)
        data = [table.item(row, col).text() for col in range(11)]
        data[9]  = self._clean_factor(data[9])
        data[10] = self._clean_factor(data[10])
        data[8]  = self._auto_multiplier(data[9], data[10])
        database.update_register(db_id, *data)
        self.refresh_table()

    def on_delete_row(self, db_id):
        database.delete_register_by_id(db_id)
        self.refresh_table()

    def _set_update_btn_style(self, btn, active: bool):
        """Toggle style của nút Update: sáng khi active, mờ khi inactive.
        Bao gồm cả :hover và :pressed để hiệu ứng hoạt động đúng khi dùng inline style.
        """
        if active:
            btn.setStyleSheet(
                "QPushButton { background-color: #1a73e8; color: white;"
                " border-radius: 5px; padding: 4px 16px; border: none; }"
                "QPushButton:hover { background-color: #1765cc; }"
                "QPushButton:pressed { background-color: #1257b0;"
                " padding-top: 6px; padding-bottom: 2px; }"
            )
        else:
            btn.setStyleSheet(
                "QPushButton { background-color: #a8c7f5; color: #e8f0fe;"
                " border-radius: 5px; padding: 4px 16px; border: none; }"
                "QPushButton:hover { background-color: #a8c7f5; }"
                "QPushButton:pressed { background-color: #a8c7f5; }"
            )

    def _enable_table_edit(self, table, btn_edit, btn_update):
        """Mở khoá toàn bộ ô trong bảng để user có thể edit tự do."""
        scroll_value = table.verticalScrollBar().value()
        for row in range(table.rowCount()):
            for col in range(11):  # cột 11 là Action (Delete), không cần mở khoá
                item = table.item(row, col)
                if item:
                    item.setFlags(item.flags() | Qt.ItemFlag.ItemIsEditable)
        btn_edit.setEnabled(False)
        self._set_update_btn_style(btn_update, active=True)
        btn_update.setEnabled(True)

    def _disable_table_edit(self, table, btn_edit, btn_update):
        """Khoá lại tất cả ô sau khi update/cancel."""
        scroll_value = table.verticalScrollBar().value()
        for row in range(table.rowCount()):
            for col in range(11):
                item = table.item(row, col)
                if item:
                    item.setFlags(item.flags() & ~Qt.ItemFlag.ItemIsEditable)
        btn_edit.setEnabled(True)
        self._set_update_btn_style(btn_update, active=False)
        btn_update.setEnabled(False)

    def _enable_row_edit(self, table, row, btn_edit, btn_update):
        scroll_value = table.verticalScrollBar().value() # Lưu vị trí scroll trước khi setFlags làm Qt tự cuộn
        for col in range(11):
            item = table.item(row, col)
            item.setFlags(item.flags() | Qt.ItemFlag.ItemIsEditable)
        btn_edit.setEnabled(False)  # ẩn nút Edit
        btn_update.setEnabled(True)  # hiện nút Update
        table.verticalScrollBar().setValue(scroll_value) # Restore lại vị trí scroll cũ — user sẽ không thấy màn hình nhảy

    def _read_editor_fields(self, editor):
        """Đọc giá trị từ tất cả ô nhập liệu trong RegisterEditorWidget.
        Multiplier được tính tự động từ factor — không đọc từ UI nữa.
        """
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
            self._auto_multiplier(f1, f2),  # tự động tính
            f1,
            f2,
        )

    @asyncSlot()
    async def on_scan_ble_clicked(self):
        """Quét thiết bị BLE xung quanh và hiển thị vào dropdown."""
        self.ui.btn_scan_ble.setText("Scanning...")
        self.ui.btn_scan_ble.setEnabled(False)
        self.ui.combo_ble_devices.clear()

        try:
            devices = await BleakScanner.discover()
            for device in devices:
                if device.name:
                    self.ui.combo_ble_devices.addItem(
                        f"{device.name} ({device.address})"
                    )
        finally:
            # finally đảm bảo nút luôn được bật lại dù có lỗi hay không
            self.ui.btn_scan_ble.setText("Scan Devices")
            self.ui.btn_scan_ble.setEnabled(True)

    @asyncSlot()
    async def on_sync_clicked(self):
        """Mở dialog chọn Slave ID, rồi gửi các register tương ứng xuống thiết bị BLE."""
        all_rows = database.get_all_registers()
        if not all_rows:
            QMessageBox.warning(self.ui, "Announce", "No data in table for sync !!!")
            return

        # ── Lấy danh sách Slave ID có trong DB (đã sắp xếp) ──────────────────
        slave_ids = sorted(
            {str(row[1]) for row in all_rows},
            key=lambda x: int(x) if x.isdigit() else x,
        )

        # ── Hiện dialog để user chọn ID ───────────────────────────────────────
        from ui import SyncDialog
        dialog = SyncDialog(slave_ids, parent=self.ui)
        if dialog.exec() != dialog.DialogCode.Accepted:
            return  # user bấm Cancel

        selected_ids = dialog.get_selected_ids()
        if not selected_ids:
            QMessageBox.warning(self.ui, "Announce", "Please select at least one Slave ID !!!")
            return

        # ── Lọc chỉ lấy rows thuộc những ID được chọn ────────────────────────
        rows = [row for row in all_rows if str(row[1]) in selected_ids]

        # ── Lấy địa chỉ BLE từ combo (định dạng: "Tên thiết bị (XX:XX:XX:XX:XX:XX)") ──
        selected_text = self.ui.combo_ble_devices.currentText()
        address_match = re.search(r"\((.*?)\)", selected_text)
        if not address_match:
            QMessageBox.warning(self.ui, "Fail", "Please select a Bluetooth device !!!")
            return

        ble_address = address_match.group(1)
        payload = self._build_ble_payload(rows)
        data_bytes = json.dumps(payload).encode("utf-8")

        try:
            self.ui.btn_sync.setEnabled(False)
            self.ui.btn_sync.setText("Syncing...")

            async with BleakClient(ble_address) as client:
                # Gửi theo từng chunk 180 bytes vì BLE giới hạn kích thước gói
                for i in range(0, len(data_bytes), 180):
                    chunk = data_bytes[i : i + 180]
                    await client.write_gatt_char(MODBUS_CHAR_UUID, chunk, response=True)

            QMessageBox.information(self.ui, "Success", "Data sent successfully!")
            ids_str = ", ".join(selected_ids)
            database.insert_log(
                action="Update data to device",
                detail=f"Sent {len(rows)} registers (IDs: {ids_str}) to: {selected_text}",
            )
            self.refresh_history()

        except Exception as error:
            # Một số thiết bị trả về lỗi "canceled" dù gửi thành công
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
            payload.append(
                {
                    "i": index,
                    "s": int(slave_id),
                    "n": row[2],  # parameter name
                    "u": row[3],  # unit
                    "f": FUNCTION_CODE_MAP.get(row[4], 0),
                    "a": int(row[5]),  # address
                    "q": int(row[6]),  # quantity
                    "t": DATA_TYPE_MAP.get(row[7], 1),
                    "sc": float(row[8]),  # scale
                    "m": MULTIPLIER_MAP.get(row[9], 0),
                    "r": [
                        self._find_register_index(str(row[10]), slave_id, rows),
                        self._find_register_index(str(row[11]), slave_id, rows),
                    ],
                }
            )
        return payload

    def _find_register_index(self, param_name, slave_id, all_rows):
        if not param_name or param_name in ("1.0", "NULL", ""):
            return 65535

        for index, row in enumerate(all_rows):
            same_slave = str(row[1]) == str(slave_id)
            same_name = row[2].strip().upper() == param_name.strip().upper()
            if same_slave and same_name:
                return index

        return 65535  # không tìm thấy

config_logic = AppController