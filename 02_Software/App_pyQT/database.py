import sqlite3

DB_NAME = "gateway_config.db"


# Tạo bảng registers nếu chưa có
def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute(
        """CREATE TABLE IF NOT EXISTS registers (
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
        )"""
    )
    c.execute(
        """CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        action TEXT,
        detail TEXT
    )"""
    )
    conn.commit()
    conn.close()


# Lấy tất cả thanh ghi
def get_all_registers():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute(
        "SELECT * FROM registers ORDER BY CAST(slave_id AS INTEGER) ASC, CAST(address AS INTEGER) ASC"
    )
    rows = c.fetchall()
    conn.close()
    return rows


# Thêm thanh ghi mới
def insert_register(*args):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute(
        """INSERT INTO registers (
        slave_id, 
        parameter, 
        unit, 
        function_code, 
        address, 
        quantity, 
        type, 
        scale, 
        multiplier, 
        factor_1, 
        factor_2
        ) 
        VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        args,
    )
    conn.commit()
    conn.close()


# Cập nhật thanh ghi
def update_register(db_id, *args):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute(
        """UPDATE registers SET 
        slave_id=?, 
        parameter=?, 
        unit=?, 
        function_code=?, 
        address=?, 
        quantity=?, 
        type=?, 
        scale=?, 
        multiplier=?, 
        factor_1=?, 
        factor_2=? 
        WHERE id=?""",
        (*args, db_id),
    )
    conn.commit()
    conn.close()


# Xoá thanh ghi
def delete_register_by_id(db_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM registers WHERE id = ?", (db_id,))
    conn.commit()
    conn.close()


# Kiểm tra Slave ID đã tồn tại chưa
def check_slave_id_exists(slave_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT 1 FROM registers WHERE slave_id = ?", (slave_id,))
    res = c.fetchone() is not None
    conn.close()
    return res


# Lấy gợi ý autocomplete
def get_distinct_suggestions(column_name):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute(
        f"SELECT DISTINCT {column_name} FROM registers WHERE {column_name} IS NOT NULL AND {column_name} != ''"
    )
    res = [str(r[0]) for r in c.fetchall()]
    conn.close()
    return res


def insert_log(action, detail):
    """Ghi 1 dòng log vào database"""
    from datetime import datetime

    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute(
        "INSERT INTO activity_log (timestamp, action, detail) VALUES (?,?,?)",
        (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), action, detail),
    )
    conn.commit()
    conn.close()


def get_all_logs():
    """Lấy toàn bộ log, mới nhất lên đầu"""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT timestamp, action, detail FROM activity_log ORDER BY id DESC")
    rows = c.fetchall()
    conn.close()
    return rows


def delete_device_by_slave_id(slave_id):
    """Xóa toàn bộ thanh ghi thuộc 1 slave_id được chọn."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM registers WHERE slave_id = ?", (str(slave_id),))
    count = c.rowcount
    conn.commit()
    conn.close()
    return count


def get_all_slave_ids():
    """Lấy danh sách tất cả slave_id đang có trong DB, sắp xếp tăng dần."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute(
        "SELECT DISTINCT slave_id FROM registers "
        "ORDER BY CAST(slave_id AS INTEGER) ASC"
    )
    ids = [str(row[0]) for row in c.fetchall()]
    conn.close()
    return ids