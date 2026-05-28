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
    QTabWidget,
    QDialog,
    QCompleter,
    QCheckBox,
    QScrollArea,
    QFrame,
    QDialogButtonBox,
)
from PyQt6.QtCore import Qt


class ModbusApp(QWidget):  # Main window with 2 tabs: Setup / History
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Energy Monitoring System - Smart Manual Setup")
        self.resize(1300, 850)
        self.setup_ui()

    def setup_ui(self):
        main_layout = QVBoxLayout(self)
        self.tabs_main = QTabWidget()
        # self.tab_home = QWidget()
        self.tab_setup = QWidget()
        self.tab_history = QWidget()

        # self.tabs_main.addTab(self.tab_home, "Home")
        self.tabs_main.addTab(self.tab_setup, "Setup")
        self.tabs_main.addTab(self.tab_history, "History")
        main_layout.addWidget(self.tabs_main)

        setup_lay = QVBoxLayout(self.tab_setup)
        history_lay = QVBoxLayout(self.tab_history)

        self.history_table = QTableWidget()
        self.history_table.setColumnCount(3)
        self.history_table.setHorizontalHeaderLabels(["Timestamp", "Action", "Detail"])
        hist_header = self.history_table.horizontalHeader()
        hist_header.setSectionResizeMode(QHeaderView.ResizeMode.Interactive)
        hist_header.setStretchLastSection(True)
        self.history_table.setColumnWidth(0, 160)
        self.history_table.setColumnWidth(1, 180)
        self.history_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.history_table.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        for i in range(3):
            item = self.history_table.horizontalHeaderItem(i)
            if item:
                item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
        history_lay.addWidget(self.history_table)

        ble_grp = QGroupBox("Bluetooth Connection")
        ble_lay = QHBoxLayout()
        self.btn_scan_ble = QPushButton("Scan Devices")
        self.combo_ble_devices = QComboBox()
        ble_lay.addWidget(self.btn_scan_ble)
        ble_lay.addWidget(self.combo_ble_devices)
        ble_grp.setLayout(ble_lay)
        setup_lay.addWidget(ble_grp)

        btn_lay = QHBoxLayout()
        self.btn_new = QPushButton("+ New Device")
        self.btn_new.setFixedSize(130, 40)
        self.btn_sync = QPushButton("Sync to Device")
        self.btn_sync.setFixedSize(150, 40)
        self.btn_delete_device = QPushButton("🗑  Delete Device")
        self.btn_delete_device.setFixedSize(150, 40)
        btn_lay.addWidget(self.btn_new)
        btn_lay.addWidget(self.btn_sync)
        btn_lay.addWidget(self.btn_delete_device)
        btn_lay.addStretch()
        setup_lay.addLayout(btn_lay)

        self.device_tabs = QTabWidget()
        setup_lay.addWidget(self.device_tabs)


class RegisterEditorWidget(QGroupBox):  # Form for entering register info
    def __init__(self, parent=None):
        super().__init__("Register Editor", parent)
        grid = QGridLayout(self)

        # Ô nhập liệu slave id
        self.ent_sid = QLineEdit()
        grid.addWidget(QLabel("Slave ID:"), 0, 0)
        grid.addWidget(self.ent_sid, 0, 1)

        # Ô nhập liệu cho function code
        self.cb_fc = QComboBox()
        self.cb_fc.addItems(
            [
                "---",
                "Read Holding Registers (0x03)",
                "Read Input Registers (0x04)",
            ]
        )
        grid.addWidget(QLabel("Function:"), 0, 2)
        grid.addWidget(self.cb_fc, 0, 3)

        # Ô nhập liệu cho data type
        self.cb_type = QComboBox()
        self.cb_type.addItems(
            [
                "---",
                "Unsigned 16 bits",
                "Unsigned 32 bits",
                "Int 16 bits AB",
                "Int 16 bits BA",
                "Uint 16 bits AB",
                "Uint 16 bits BA",
                "Int 32 bits ABCD",
                "Int 32 bits CDAB",
                "Uint 32 bits ABCD",
                "Uint 32 bits CDAB",
                "Float ABCD",
                "Float CDAB",
                "Long",
            ]
        )
        grid.addWidget(QLabel("Type:"), 0, 4)
        grid.addWidget(self.cb_type, 0, 5)

        # Ô nhập tên của thanh ghi
        self.ent_name = QLineEdit()
        grid.addWidget(QLabel("Parameter:"), 1, 0)
        grid.addWidget(self.ent_name, 1, 1)

        # Ô nhập start address
        self.ent_addr = QLineEdit()
        grid.addWidget(QLabel("Address:"), 1, 2)
        grid.addWidget(self.ent_addr, 1, 3)

        # Ô nhập hệ số scale
        self.cb_scale = QComboBox()
        self.cb_scale.addItems(["---", "0.000003125", "0.001", "0.01", "0.1", "1"])
        grid.addWidget(QLabel("Scale:"), 1, 4)
        grid.addWidget(self.cb_scale, 1, 5)

        # Ô nhập đơn vị của thông số
        self.ent_unit = QLineEdit()
        grid.addWidget(QLabel("Unit:"), 2, 0)
        grid.addWidget(self.ent_unit, 2, 1)

        # Ô nhập số lượng thanh ghi
        self.cb_qty = QComboBox()
        self.cb_qty.addItems(["---", "1", "2"])
        grid.addWidget(QLabel("Quantity:"), 2, 2)
        grid.addWidget(self.cb_qty, 2, 3)

        # Ô nhập cho Factor 1
        self.ent_f1 = QLineEdit("")
        grid.addWidget(QLabel("Factor 1:"), 3, 0)
        grid.addWidget(self.ent_f1, 3, 1)

        # Ô nhập cho Factor 2
        self.ent_f2 = QLineEdit("")
        grid.addWidget(QLabel("Factor 2:"), 3, 2)
        grid.addWidget(self.ent_f2, 3, 3)

        # Nút thêm thanh ghi
        self.btn_action = QPushButton("Add Register")
        grid.addWidget(self.btn_action, 3, 4, 1, 2)

    def set_suggestions(self, column, data_list):
        completer = QCompleter(data_list)
        completer.setCaseSensitivity(Qt.CaseSensitivity.CaseInsensitive)
        if column == "parameter":
            self.ent_name.setCompleter(completer)
        elif column == "unit":
            self.ent_unit.setCompleter(completer)
        elif column == "address":
            self.ent_addr.setCompleter(completer)
        elif column == "factor":
            self.ent_f1.setCompleter(completer)
            self.ent_f2.setCompleter(completer)


class SyncDialog(QDialog):
    """Dialog cho phép user chọn Slave ID nào muốn sync xuống thiết bị."""

    def __init__(self, slave_ids: list[str], parent=None):
        super().__init__(parent)
        self.setWindowTitle("Select Slave IDs to Sync")
        self.setMinimumWidth(320)
        self.setModal(True)

        layout = QVBoxLayout(self)

        # ── Header ────────────────────────────────────────────────────────────
        lbl = QLabel("Choose which Slave IDs to send to the device:")
        lbl.setWordWrap(True)
        layout.addWidget(lbl)

        # ── Separator ─────────────────────────────────────────────────────────
        line = QFrame()
        line.setFrameShape(QFrame.Shape.HLine)
        line.setFrameShadow(QFrame.Shadow.Sunken)
        layout.addWidget(line)

        # ── Checkbox "Select All" ─────────────────────────────────────────────
        self.chk_all = QCheckBox("Select All")
        self.chk_all.setChecked(True)
        self.chk_all.setStyleSheet("font-weight: bold;")
        self.chk_all.stateChanged.connect(self._on_select_all_changed)
        layout.addWidget(self.chk_all)

        # ── Scrollable list of per-ID checkboxes ──────────────────────────────
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)

        container = QWidget()
        self.id_layout = QVBoxLayout(container)
        self.id_layout.setSpacing(4)
        self.id_layout.setContentsMargins(8, 4, 8, 4)

        self.checkboxes: dict[str, QCheckBox] = {}
        for sid in slave_ids:
            chk = QCheckBox(f"Slave ID  {sid}")
            chk.setChecked(True)
            chk.stateChanged.connect(self._on_id_checkbox_changed)
            self.id_layout.addWidget(chk)
            self.checkboxes[sid] = chk

        scroll.setWidget(container)
        layout.addWidget(scroll)

        # ── Buttons OK / Cancel ───────────────────────────────────────────────
        btn_box = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        btn_box.accepted.connect(self.accept)
        btn_box.rejected.connect(self.reject)
        layout.addWidget(btn_box)

    # ── Internal helpers ──────────────────────────────────────────────────────
    def _on_select_all_changed(self, state):
        """Đồng bộ tất cả checkbox con khi bấm Select All."""
        checked = state == Qt.CheckState.Checked.value
        for chk in self.checkboxes.values():
            chk.blockSignals(True)
            chk.setChecked(checked)
            chk.blockSignals(False)

    def _on_id_checkbox_changed(self):
        """Cập nhật trạng thái Select All dựa theo các checkbox con."""
        all_checked = all(chk.isChecked() for chk in self.checkboxes.values())
        none_checked = not any(chk.isChecked() for chk in self.checkboxes.values())
        self.chk_all.blockSignals(True)
        if all_checked:
            self.chk_all.setCheckState(Qt.CheckState.Checked)
        elif none_checked:
            self.chk_all.setCheckState(Qt.CheckState.Unchecked)
        else:
            self.chk_all.setCheckState(Qt.CheckState.PartiallyChecked)
        self.chk_all.blockSignals(False)

    def get_selected_ids(self) -> list[str]:
        """Trả về danh sách Slave ID được tích chọn."""
        return [sid for sid, chk in self.checkboxes.items() if chk.isChecked()]

class ImportChoiceDialog(QDialog):
    """Dialog hỏi người dùng muốn nhập tay hay import Excel."""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Add Registers")
        self.setMinimumWidth(340)
        self.setModal(True)
        self.choice = None

        layout = QVBoxLayout(self)

        lbl = QLabel("Choose how to add registers for this device:")
        lbl.setStyleSheet("font-size: 13px; margin-bottom: 6px;")
        layout.addWidget(lbl)

        sep = QFrame()
        sep.setFrameShape(QFrame.Shape.HLine)
        sep.setFrameShadow(QFrame.Shadow.Sunken)
        layout.addWidget(sep)

        btn_manual = QPushButton("✏️   Enter registers manually")
        btn_manual.setFixedHeight(46)
        btn_manual.setStyleSheet(
            "QPushButton{background:#1a73e8;color:white;border-radius:6px;"
            "font-size:13px;text-align:left;padding-left:14px;border:none;}"
            "QPushButton:hover{background:#1765cc;}"
            "QPushButton:pressed{background:#1257b0;}"
        )
        btn_manual.clicked.connect(lambda: self._pick("manual"))
        layout.addWidget(btn_manual)

        lbl_m = QLabel("Use the built-in form to add registers one by one.")
        lbl_m.setStyleSheet("color:#666;font-size:10px;margin-left:4px;margin-bottom:8px;")
        layout.addWidget(lbl_m)

        btn_import = QPushButton("📂   Import from Excel file")
        btn_import.setFixedHeight(46)
        btn_import.setStyleSheet(
            "QPushButton{background:#34a853;color:white;border-radius:6px;"
            "font-size:13px;text-align:left;padding-left:14px;border:none;}"
            "QPushButton:hover{background:#2d9147;}"
            "QPushButton:pressed{background:#256e39;}"
        )
        btn_import.clicked.connect(lambda: self._pick("import"))
        layout.addWidget(btn_import)

        lbl_i = QLabel("Import multiple registers at once from an Excel file.")
        lbl_i.setStyleSheet("color:#666;font-size:10px;margin-left:4px;margin-bottom:8px;")
        layout.addWidget(lbl_i)

        btn_cancel = QPushButton("Cancel")
        btn_cancel.setFixedHeight(34)
        btn_cancel.clicked.connect(self.reject)
        layout.addWidget(btn_cancel)

    def _pick(self, choice):
        self.choice = choice
        self.accept()


class DeleteDeviceDialog(QDialog):
    """Dialog chọn Slave ID nào muốn xóa — tương tự SyncDialog."""

    def __init__(self, slave_ids: list, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Delete Device")
        self.setMinimumWidth(320)
        self.setModal(True)

        layout = QVBoxLayout(self)

        lbl = QLabel("Select Slave IDs to delete:")
        lbl.setWordWrap(True)
        lbl.setStyleSheet("font-size: 13px; margin-bottom: 4px;")
        layout.addWidget(lbl)

        sep = QFrame()
        sep.setFrameShape(QFrame.Shape.HLine)
        sep.setFrameShadow(QFrame.Shadow.Sunken)
        layout.addWidget(sep)

        self.chk_all = QCheckBox("Select All")
        self.chk_all.setChecked(False)
        self.chk_all.setStyleSheet("font-weight: bold;")
        self.chk_all.stateChanged.connect(self._on_select_all)
        layout.addWidget(self.chk_all)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.Shape.NoFrame)
        container = QWidget()
        id_layout = QVBoxLayout(container)
        id_layout.setSpacing(4)
        id_layout.setContentsMargins(8, 4, 8, 4)

        self.checkboxes: dict = {}
        for sid in slave_ids:
            chk = QCheckBox(f"Slave ID  {sid}")
            chk.setChecked(False)
            chk.stateChanged.connect(self._on_child_changed)
            id_layout.addWidget(chk)
            self.checkboxes[sid] = chk

        scroll.setWidget(container)
        layout.addWidget(scroll)

        btn_box = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | QDialogButtonBox.StandardButton.Cancel
        )
        btn_box.accepted.connect(self.accept)
        btn_box.rejected.connect(self.reject)
        layout.addWidget(btn_box)

    def _on_select_all(self, state):
        checked = state == Qt.CheckState.Checked.value
        for chk in self.checkboxes.values():
            chk.blockSignals(True)
            chk.setChecked(checked)
            chk.blockSignals(False)

    def _on_child_changed(self):
        all_c = all(c.isChecked() for c in self.checkboxes.values())
        none_c = not any(c.isChecked() for c in self.checkboxes.values())
        self.chk_all.blockSignals(True)
        if all_c:
            self.chk_all.setCheckState(Qt.CheckState.Checked)
        elif none_c:
            self.chk_all.setCheckState(Qt.CheckState.Unchecked)
        else:
            self.chk_all.setCheckState(Qt.CheckState.PartiallyChecked)
        self.chk_all.blockSignals(False)

    def get_selected_ids(self) -> list:
        return [sid for sid, chk in self.checkboxes.items() if chk.isChecked()]