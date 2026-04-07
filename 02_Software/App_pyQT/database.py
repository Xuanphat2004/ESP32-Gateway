import sqlite3

DB_NAME = 'gateway_config.db'

#=============================================================================================================================
#======== Hàm khởi tạo 1 bảng mới nếu bảng chưa tồn tại trong file.db ============================
def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS registers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slave_id TEXT,
            parameter TEXT,
            unit TEXT,  
            function_code TEXT,
            address TEXT,
            quantity TEXT,
            type TEXT,
            scale TEXT,
            multiplier TEXT,
            factor_1 TEXT,
            factor_2 TEXT  
        )
    ''')
    conn.commit()
    conn.close()

#=============================================================================================================================
#==== Hàm get toàn bộ dữ liệu trong bảng registers và trả về dưới dạng một list các tuple, mỗi tuple là một dòng dữ liệu từ bảng. ====
def get_all_registers():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    # Thêm đoạn ORDER BY vào cuối câu lệnh SELECT mặc định
    c.execute('''
        SELECT id, slave_id, parameter, unit, function_code, address, quantity, type, scale, multiplier, factor_1, factor_2 
        FROM registers 
        ORDER BY CAST(slave_id AS INTEGER) ASC, CAST(address AS INTEGER) ASC
    ''')
    rows = c.fetchall()
    conn.close()
    return rows
    # trả về 1 lists gồm nhiều tuple [(tuple 1), (tuple 2), ..., (tuple n)]
    # Trong mỗi tuple sẽ là các thành phần của 1 row trong database

#=============================================================================================================================
#==== Hàm insert một dòng dữ liệu mới vào bảng registers===========
def insert_register(slave_id, parameter, unit, function_code, address, quantity, data_type, scale, multiplier, factor_1, factor_2):
    conn = sqlite3.connect(DB_NAME) # Tạo key để app truy cập vào file .db trên ổ cứng máy tính
    c = conn.cursor()

    # INSERT: chèn thêm một dòng dữ liệu hoàn toàn mới vào bảng
    c.execute('''
        INSERT INTO registers (slave_id, parameter, unit, function_code, address, quantity, type, scale, multiplier, factor_1, factor_2)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (slave_id, parameter, unit, function_code, address, quantity, data_type, scale, multiplier, factor_1, factor_2))
    conn.commit() # Lưu vĩnh viễn (Save) vào file .db trên ổ cứng
    conn.close() # Trả key về cho hệ thống, kết thúc quá trình thao tác với file .db

#=============================================================================================================================
#==== Hàm update 1 thành phần bất kì trong 1 dòng khi chức năng edit được bấm bảng ===========  
def update_register(db_id, slave_id, parameter, unit, function_code, address, quantity, data_type, scale, multiplier, factor_1, factor_2):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''
        UPDATE registers 
        SET slave_id=?, parameter=?,  unit=? ,function_code=?, address=?, quantity=?, type=?, scale=?, multiplier=?, factor_1=?, factor_2=?
        WHERE id=?
    ''', (slave_id, parameter, unit, function_code, address, quantity, data_type, scale, multiplier, factor_1, factor_2, db_id))
    conn.commit()
    conn.close()
#=============================================================================================================================
#==== Hàm delete một dòng dữ liệu ra khỏi bảng registers dựa vào id (db_id) của dòng đó===========
def delete_register_by_id(db_id):
    conn = sqlite3.connect(DB_NAME) # Tạo key để app truy cập vào file .db trên ổ cứng máy tính
    c = conn.cursor()
    # DELETE: xóa một hoặc nhiều dòng ra khỏi bảng
    c.execute("DELETE FROM registers WHERE id = ?", (db_id,))
    conn.commit()
    conn.close() # Trả key về cho hệ thống, kết thúc quá trình thao tác với file .db

#=============================================================================================================================
#==== Hàm sort ===========
def get_registers_sorted():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    # ORDER BY slave_id ASC: Sắp xếp Slave ID tăng dần
    # address ASC: Nếu cùng Slave ID thì Address nào nhỏ hơn đứng trước
    query = """
        SELECT id, slave_id, parameter, unit, function_code, address, quantity, type, scale, multiplier, factor_1, factor_2 
        FROM registers 
        ORDER BY CAST(slave_id AS INTEGER) ASC, CAST(address AS INTEGER) ASC
    """
    c.execute(query)
    rows = c.fetchall()
    conn.close()
    return rows