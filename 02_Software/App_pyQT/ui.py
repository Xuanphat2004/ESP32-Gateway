from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QGridLayout, 
                             QGroupBox, QLabel, QLineEdit, QComboBox, 
                             QPushButton, QTableWidget, QTableWidgetItem, 
                             QHeaderView, QMessageBox, QAbstractItemView, QTabWidget)
from PyQt6.QtCore import Qt
import database

class ModbusApp(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Modbus Gateway Configuration")
        self.resize(1200, 650)
        
        #database.init_db() # Khởi tạo Database
        
        self.setup_ui()    # Vẽ giao diện
        #self.load_data()   # Kéo dữ liệu lên
        self.editing_id = None # Nếu là None thì là Thêm mới, nếu khác NULL thì là Đang sửa ID


#=============================================================================================================================
# ================= KHUNG 1: FORM NHẬP LIỆU =================
# Thứ tự các dòng nhập sẽ là: Address + SlaveID, Parameter + Data Type, Scale + Unit, Quantity + Function Code
# Vị trí hàng 0:  00, 01, 02, 03
# Vị trí hàng 1:  10, 11, 12, 13
# Vị trí hàng 2:  20, 21, 22, 23
# Vị trí hàng 3:  30, 31, 32, 33
#==============================================================================================================================
    def setup_ui(self):
        #============================================================================================================================
        # ================= Quản lý tổng  =================
        # 1. Tạo thanh Tab tổng
        self.tabs = QTabWidget() # Biến này sẽ trực tiếp quản lý các tab
        window_layout = QVBoxLayout(self)

        # Tạo các "trang giấy" trống cho từng Tab
        self.tab_home = QWidget()
        self.tab_setup = QWidget()
        self.tab_data = QWidget()
        self.tab_history = QWidget()
        
        # 3. Thêm các trang này vào thanh Tab tổng
        self.tabs.addTab(self.tab_home, "Home")
        self.tabs.addTab(self.tab_setup, "Setup")
        self.tabs.addTab(self.tab_data, "Data")
        self.tabs.addTab(self.tab_history, "History")

        window_layout.addWidget(self.tabs)

        #=============================================================================================================================
        # ================= Tab Home  =================
        home_tab_layout = QVBoxLayout(self.tab_home)
         # 2. Tạo GroupBox cho phần Bluetooth
        self.ble_group = QGroupBox("Bluetooth Device Management")
        self.ble_group.setStyleSheet("QGroupBox { font-weight: bold; font-size: 14px; color: #1a73e8; }")
        
        # 3. Tạo bố cục ngang bên trong GroupBox
        ble_hbox = QHBoxLayout()
        
        # Nút quét
        self.btn_scan_ble = QPushButton("Scan Devices")
        self.btn_scan_ble.setFixedWidth(150)
        self.btn_scan_ble.setStyleSheet("background-color: #fbbc05; color: black; font-weight: bold; padding: 8px;")
        
        # Danh sách thiết bị
        self.combo_ble_devices = QComboBox()
        self.combo_ble_devices.setPlaceholderText("List of Device ....")
        self.combo_ble_devices.setMinimumHeight(35)
        
        # Nút kết nối
        self.btn_connect_ble = QPushButton("Connect BLE")
        self.btn_connect_ble.setFixedWidth(120)
        self.btn_connect_ble.setStyleSheet("background-color: #34a853; color: white; font-weight: bold; padding: 8px;")

        # Thêm các linh kiện vào bố cục ngang
        ble_hbox.addWidget(self.btn_scan_ble)
        ble_hbox.addWidget(self.combo_ble_devices)
        ble_hbox.addWidget(self.btn_connect_ble)
        
        # Đưa bố cục ngang vào GroupBox
        self.ble_group.setLayout(ble_hbox)
        
        # Đưa GroupBox vào Tab Home
        home_tab_layout.addWidget(self.ble_group)
        home_tab_layout.addStretch() # Đẩy khung lên trên cùng

        #=============================================================================================================================
        # ================= Tab Setup  =================
        setup_tab_layout = QVBoxLayout(self.tab_setup) # biến này đucợ tạo ra với mục đích là quản lý giao diện của tab

#=============================================================================================================================
# ================= Khung 1 - Tạo khung và các ô nhập liệu =================        
        self.group_box = QGroupBox("Add New Register")
        self.group_box.setStyleSheet("QGroupBox { font-weight: bold; font-size: 14px; }")
        
        grid = QGridLayout() # Dùng lưới để sắp xếp các ô nhập
        self.group_box.setLayout(grid)

        # grid.setColumnStretch(4, 1)
        grid.setHorizontalSpacing(100)

        setup_tab_layout.addWidget(self.group_box)

        # Dòng 1
        grid.addWidget(QLabel("Slave ID:"), 0, 0) # tạo một dòng chữ và đặt nó vào đúng tọa độ Vị trí dòng 0, cột 2 của tên
        self.entry_slave_id = QLineEdit() # Tạo ra một ô nhập văn bản một dòng
        self.entry_slave_id.setFixedWidth(250)
        grid.addWidget(self.entry_slave_id, 0, 1) # Đặt ô nhập vào đúng tọa độ Vị trí dòng 0, cột 3 của tên

        grid.addWidget(QLabel("Function Code:"), 0, 2)
        self.combo_function = QComboBox() # Tạo tùy chọn dạng dropdown
        self.combo_function.setFixedWidth(250) # Đặt kích thước cố định cho dropdown
        self.combo_function.addItems(["---", "Read Holding Registers (0x03)", "Read Input Registers (0x04)"])
        grid.addWidget(self.combo_function, 0, 3) # Đặt ô nhập vào đúng tọa độ Vị trí dòng 3, cột 3 của tên

        grid.addWidget(QLabel("Data Type:"), 0, 4) # tạo một dòng chữ và đặt nó vào đúng tọa độ Vị trí dòng 0, cột 0 của tên
        self.combo_type = QComboBox() # Tạo tùy chọn dạng dropdown
        self.combo_type.setFixedWidth(250) # Đặt kích thước cố định cho dropdown
        self.combo_type.addItems(["---", "Unsigned 16 bits", "Unsigned 32 bits", "Float ABCD", "Float CDAB", "Integer", "Long"]) # các lựa chọn trong dropdown
        grid.addWidget(self.combo_type, 0, 5) # Đặt ô nhập vào đúng tọa độ Vị trí dòng 1, cột 3 của tên

        # Dòng 2
        grid.addWidget(QLabel("Parameter:"), 1, 0) # tạo một dòng chữ và đặt nó vào đúng tọa độ Vị trí dòng 1, cột 0 của tên
        self.entry_name = QLineEdit() # Tạo ra một ô nhập văn bản một dòng
        self.entry_name.setMaxLength(15) # Người dùng không thể gõ ký tự thứ 16
        self.entry_name.setFixedWidth(250) # Đặt kích thước cố định cho ô nhập
        grid.addWidget(self.entry_name, 1, 1) # Đặt ô nhập vào đúng tọa độ Vị trí dòng 1, cột 1 của tên

        grid.addWidget(QLabel("Register Address:"), 1, 2)
        self.entry_address = QLineEdit() # Tạo ra một ô nhập văn bản một dòng
        self.entry_address.setFixedWidth(250) # Đặt kích thước cố định cho ô nhập
        grid.addWidget(self.entry_address, 1, 3) # Đặt ô nhập vào đúng tọa độ Vị trí dòng 0, cột 1 của tên

        grid.addWidget(QLabel("Scale:"), 1, 4)
        self.combo_scale = QComboBox() # Tạo tùy chọn dạng dropdown
        self.combo_scale.setFixedWidth(250) # Đặt kích thước cố định cho dropdown
        self.combo_scale.addItems(["---", "0.000001", "0.00001", "0.0001", "0.001", "0.1", "1", "10", "100", "1000"])
        grid.addWidget(self.combo_scale, 1, 5)

        # Dòng 3
        grid.addWidget(QLabel("Unit:"), 2, 0)
        self.entry_unit = QLineEdit() # Tạo ra một ô nhập văn bản một dòng
        self.entry_unit.setFixedWidth(250) # Đặt kích thước cố định cho ô nhập
        grid.addWidget(self.entry_unit, 2, 1) # Đặt ô nhập vào đúng tọa độ Vị trí dòng 2, cột 3 của tên
        
        grid.addWidget(QLabel("Quantity:"), 2, 2)
        self.combo_quantity = QComboBox() # Tạo tùy chọn dạng dropdown
        self.combo_quantity.setFixedWidth(250) # Đặt kích thước cố định cho dropdown
        self.combo_quantity.addItems(["---", "1", "2"])
        grid.addWidget(self.combo_quantity, 2, 3) # Đặt ô nhập vào đúng tọa độ Vị trí dòng 3, cột 1 của tên
        
        grid.addWidget(QLabel("Multiplier:"), 2, 4)
        self.combo_mul = QComboBox() # Tạo tùy chọn dạng dropdown
        self.combo_mul.setFixedWidth(250) # Đặt kích thước cố định cho dropdown
        self.combo_mul.addItems(["---", "Data * Scale", "Data * Scale * Factor 1", "Data * Scale * Factor 1 * Factor 2"])
        grid.addWidget(self.combo_mul, 2, 5) # Đặt ô nhập vào đúng tọa độ Vị trí dòng 3, cột 1 của tên
        # Tạo sẵn 2 bộ Nhãn và Ô nhập cho Factor 1 và 2
        self.label_f1 = QLabel("Factor 1:")
        self.entry_f1 = QLineEdit()
        self.entry_f1.setPlaceholderText("Example: CTR")

        self.label_f2 = QLabel("Factor 2:")
        self.entry_f2 = QLineEdit()
        self.entry_f2.setPlaceholderText("Example: VTR")

        # Đặt chúng vào hàng số 3 của Grid
        grid.addWidget(self.label_f1, 3, 0)
        grid.addWidget(self.entry_f1, 3, 1)
        grid.addWidget(self.label_f2, 3, 2)
        grid.addWidget(self.entry_f2, 3, 3)

        # Mặc định giấu tất cả đi khi khởi động App
        self.label_f1.hide()
        self.entry_f1.hide()
        self.label_f2.hide()
        self.entry_f2.hide()
                
        setup_tab_layout.addWidget(self.group_box) # đưa toàn bộ các cấu hình vừa khởi tạo vào bố cục chính của cửa sổ phần mềm


# =================Nút nhấn của khung Add new Register =================
        btn_box_1 = QHBoxLayout() # Xếp các nút theo chiều ngang, một lớp trong thư viện PyQt6 dùng để quản lý bố cục theo hàng ngang.
        
        self.btn_add = QPushButton("Add")
        self.btn_add.setStyleSheet("background-color: #1a73e8; color: white; font-weight: bold; padding: 7px;")

        self.btn_clear = QPushButton("Clear Form")
        self.btn_clear.setStyleSheet("background-color: #ea4335; color: white; font-weight: bold; padding: 7px;")

        btn_box_1.addWidget(self.btn_add) # Hiển thị nút nhấn Add trên app
        btn_box_1.addWidget(self.btn_clear) # Hiển thị nút nhấn Clear trên app

        setup_tab_layout.addLayout(btn_box_1) # Đưa bố cục chứa 2 nút này vào bố cục chính của cửa sổ phần mềm


#=============================================================================================================================
#================== KHUNG 2 - Nút nhấn của khung update dữ liệu ============================
        self.update_box = QGroupBox("Update to Device") # Tạo khung cho chức năng update 
        self.update_box.setStyleSheet("QGroupBox { font-weight: bold; font-size: 14px; }") # front chữ này kia

        # Tạo ô chọn Select Device 
        btn_box_2 = QHBoxLayout()
        btn_box_2.addWidget(QLabel("Select Device:"))
        self.combo_device_target = QComboBox()
        self.combo_device_target.setFixedWidth(250)
        self.combo_device_target.addItems(["Device 1", "Device 2"])
        btn_box_2.addWidget(self.combo_device_target)

        # Tạo nút Sync to Device
        self.btn_update = QPushButton("Sync to Device")
        self.btn_update.setStyleSheet("background-color: #34a853; color: white;font-weight: bold; padding: 14px;")
        self.btn_update.setMinimumHeight(40)
        btn_box_2.addWidget(self.btn_update)

        btn_box_2.addStretch() # Đẩy tất cả về bên trái
        self.update_box.setLayout(btn_box_2) # # Hiển thị nút nhấn Add trên app
        setup_tab_layout.addWidget(self.update_box) # Đưa khung update vào bố cục chính của cửa sổ phần mềm


#=============================================================================================================================
# ================= KHUNG 4: BẢNG DỮ LIỆU và CÁC HÀNH ĐỘNG ĐƯỢC SỬ DỤNG TRỰC TIẾP TRONG BẢNG =================
        self.table = QTableWidget() # Tạo ra một cái bảng trống
        self.table.setColumnCount(12) # Bảng có 8 cột
        self.table.setHorizontalHeaderLabels(["Slave ID", "Parameter", "Unit", "Function", "Address", "Quantity", "Type", "Scale","Multiplier", "Factor 1","Factor 2", "Action"]) # Đặt tên cho từng cột
        
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Stretch) # Cho bảng giãn ra full màn hình và chọn theo từng dòng
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows) # Ép bảng phải bôi đen (chọn) CẢ MỘT HÀNG NGANG khi người dùng click chuột vào bất kỳ ô nào trên hàng đó.
        self.table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers) # Không cho sửa trực tiếp trên ô
        self.table.setEditTriggers(QAbstractItemView.EditTrigger.DoubleClicked) # Chỉ cho phép sửa khi người dùng double click vào ô đó, nhưng ở đây ta sẽ không dùng đến tính năng này vì đã có nút Edit riêng biệt để bật chế độ sửa, nên ta sẽ tắt luôn tính năng sửa trực tiếp trên ô bằng cách NoEditTriggers ở dòng trên
        setup_tab_layout.addWidget(self.table) # Nạp cái bảng vào bố cục chính của cửa sổ phần mềm

