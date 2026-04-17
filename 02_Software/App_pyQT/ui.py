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
)
from PyQt6.QtCore import Qt


class ModbusApp(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Gateway Config - Model Management")
        self.resize(1300, 850)
        self.setup_ui()

    def setup_ui(self):
        main_layout = QVBoxLayout(self)
        self.tabs_main = QTabWidget()
        self.tab_home = QWidget()
        self.tab_setup = QWidget()
        self.tabs_main.addTab(self.tab_home, "Home")
        self.tabs_main.addTab(self.tab_setup, "Setup")
        self.tabs_main.addTab(QWidget(), "History")
        main_layout.addWidget(self.tabs_main)

        # Tab Home (BLE)
        home_lay = QVBoxLayout(self.tab_home)
        ble_grp = QGroupBox("Bluetooth Connection")
        ble_lay = QHBoxLayout()
        self.btn_scan_ble = QPushButton("Scan Devices")
        self.combo_ble_devices = QComboBox()
        ble_lay.addWidget(self.btn_scan_ble)
        ble_lay.addWidget(self.combo_ble_devices)
        ble_grp.setLayout(ble_lay)
        home_lay.addWidget(ble_grp)
        home_lay.addStretch()

        # Tab Setup
        setup_lay = QVBoxLayout(self.tab_setup)
        btn_lay = QHBoxLayout()
        self.btn_new = QPushButton("+ New")
        self.btn_new.setFixedSize(120, 40)
        self.btn_sync = QPushButton("Sync to Device")
        self.btn_sync.setFixedSize(150, 40)
        btn_lay.addWidget(self.btn_new)
        btn_lay.addWidget(self.btn_sync)
        btn_lay.addStretch()
        setup_lay.addLayout(btn_lay)

        self.device_tabs = QTabWidget()
        setup_lay.addWidget(self.device_tabs)


class RegisterEditorWidget(QGroupBox):
    def __init__(self, parent=None):
        super().__init__("Register Editor", parent)
        grid = QGridLayout(self)
        self.ent_sid = QLineEdit()
        grid.addWidget(QLabel("Slave ID:"), 0, 0)
        grid.addWidget(self.ent_sid, 0, 1)
        self.cb_fc = QComboBox()
        self.cb_fc.addItems(
            ["---", "Read Holding Registers (0x03)", "Read Input Registers (0x04)"]
        )
        grid.addWidget(QLabel("FC:"), 0, 2)
        grid.addWidget(self.cb_fc, 0, 3)
        self.cb_type = QComboBox()
        self.cb_type.addItems(
            [
                "---",
                "Unsigned 16 bits",
                "Unsigned 32 bits",
                "Float ABCD",
                "Float CDAB",
                "Integer",
                "Long",
            ]
        )
        grid.addWidget(QLabel("Type:"), 0, 4)
        grid.addWidget(self.cb_type, 0, 5)

        self.ent_name = QLineEdit()
        grid.addWidget(QLabel("Name:"), 1, 0)
        grid.addWidget(self.ent_name, 1, 1)
        self.ent_addr = QLineEdit()
        grid.addWidget(QLabel("Addr:"), 1, 2)
        grid.addWidget(self.ent_addr, 1, 3)
        self.cb_scale = QComboBox()
        self.cb_scale.addItems(["---", "0.001", "0.01", "0.1", "1"])
        grid.addWidget(QLabel("Scale:"), 1, 4)
        grid.addWidget(self.cb_scale, 1, 5)

        self.ent_unit = QLineEdit()
        grid.addWidget(QLabel("Unit:"), 2, 0)
        grid.addWidget(self.ent_unit, 2, 1)
        self.cb_qty = QComboBox()
        self.cb_qty.addItems(["---", "1", "2"])
        grid.addWidget(QLabel("Qty:"), 2, 2)
        grid.addWidget(self.cb_qty, 2, 3)
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

        self.btn_action = QPushButton("Add Register")
        self.btn_action.setStyleSheet(
            "background-color: #4285f4; color: white; height: 30px;"
        )
        grid.addWidget(self.btn_action, 3, 4, 1, 2)


class NewDeviceDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Model Creation Mode")
        self.resize(1100, 600)
        lay = QVBoxLayout(self)
        self.editor = RegisterEditorWidget()
        lay.addWidget(self.editor)
        self.temp_table = QTableWidget()
        self.temp_table.setColumnCount(11)
        self.temp_table.setHorizontalHeaderLabels(
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
            ]
        )
        lay.addWidget(self.temp_table)
        self.btn_finish = QPushButton("Finish & Save Model")
        self.btn_finish.setStyleSheet(
            "background-color: #34a853; color: white; height: 40px;"
        )
        lay.addWidget(self.btn_finish)
