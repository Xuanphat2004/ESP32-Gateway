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
)
from PyQt6.QtCore import Qt


class ModbusApp(QWidget):  # Cửa sổ chính, có 3 tab: Home / Setup / History
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Energy Monitoring System - Smart Manual Setup")
        self.resize(1300, 850)
        self.setup_ui()

    def setup_ui(self):
        main_layout = QVBoxLayout(self)
        self.tabs_main = QTabWidget()
        self.tab_home = QWidget()
        self.tab_setup = QWidget()
        self.tab_history = QWidget()

        self.tabs_main.addTab(self.tab_home, "Home")
        self.tabs_main.addTab(self.tab_setup, "Setup")
        self.tabs_main.addTab(self.tab_history, "History")
        main_layout.addWidget(self.tabs_main)

        setup_lay = QVBoxLayout(self.tab_setup)
        history_lay = QVBoxLayout(self.tab_history)

        self.history_table = QTableWidget()
        self.history_table.setColumnCount(3)
        self.history_table.setHorizontalHeaderLabels(["Timestamp", "Action", "Detail"])
        self.history_table.horizontalHeader().setSectionResizeMode(
            QHeaderView.ResizeMode.Stretch
        )
        self.history_table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
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
        self.btn_new.setStyleSheet(
            "background-color: #34a853; color: white; height: 50px;"
        )
        self.btn_new.setFixedSize(130, 40)
        self.btn_sync = QPushButton("Sync to Device")
        self.btn_sync.setStyleSheet(
            "background-color: #ea4335; color: white; height: 50px;"
        )
        self.btn_sync.setFixedSize(150, 40)
        btn_lay.addWidget(self.btn_new)
        btn_lay.addWidget(self.btn_sync)
        btn_lay.addStretch()
        setup_lay.addLayout(btn_lay)

        self.device_tabs = QTabWidget()
        setup_lay.addWidget(self.device_tabs)


class RegisterEditorWidget(QGroupBox):  #  Form nhập liệu thanh ghi
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
                "Integer 32 bits CDAB",
                "Integer 32 bits ABCD",
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
        self.cb_scale.addItems(["---", "0.001", "0.01", "0.1", "1"])
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

        # Ô dành cho những thanh ghi cần nhân thêm hệ số
        self.cb_mul = QComboBox()
        self.cb_mul.addItems(
            [
                "---",
                "Data * Scale",
                "Data * Scale * Factor 1",
                "Data * Scale * Factor 1 * Factor 2",
            ]
        )
        grid.addWidget(QLabel("Mul:"), 2, 4)
        grid.addWidget(self.cb_mul, 2, 5)

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
        self.btn_action.setStyleSheet(
            "background-color: #4285f4; color: white; height: 30px;"
        )
        grid.addWidget(self.btn_action, 4, 4, 1, 2)

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
