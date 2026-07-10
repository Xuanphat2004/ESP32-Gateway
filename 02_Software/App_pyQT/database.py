import sqlite3

DB_NAME = "gateway_config.db"


def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS registers (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        slave_id      TEXT,
        parameter     TEXT,
        unit          TEXT,
        function_code TEXT,
        address       TEXT,
        quantity      TEXT,
        type          TEXT,
        scale         TEXT,
        multiplier    TEXT,
        factor_1      TEXT,
        factor_2      TEXT
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS activity_log (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        action    TEXT,
        detail    TEXT
    )""")
    conn.commit()
    conn.close()


def init_tcp_tables():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()

    # Xóa bảng cũ nếu schema không còn phù hợp
    c.execute("PRAGMA table_info(modbus_tcp_config)")
    cfg_cols = [row[1] for row in c.fetchall()]
    if "unit_id" in cfg_cols or "enabled" in cfg_cols:
        c.execute("DROP TABLE modbus_tcp_config")

    c.execute("PRAGMA table_info(modbus_tcp_mapping)")
    map_cols = [row[1] for row in c.fetchall()]
    if "slave_id" in map_cols or "function_code" not in map_cols:
        c.execute("DROP TABLE IF EXISTS modbus_tcp_mapping")

    c.execute("""CREATE TABLE IF NOT EXISTS modbus_tcp_config (
        id   INTEGER PRIMARY KEY,
        port TEXT DEFAULT '502'
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS modbus_tcp_mapping (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        tcp_address   TEXT,
        unit_id       TEXT,
        function_code TEXT,
        parameter     TEXT,
        description   TEXT
    )""")
    c.execute("INSERT OR IGNORE INTO modbus_tcp_config (id, port) VALUES (1,'502')")
    conn.commit()
    conn.close()


def get_all_registers():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT * FROM registers ORDER BY CAST(slave_id AS INTEGER) ASC, CAST(address AS INTEGER) ASC")
    rows = c.fetchall()
    conn.close()
    return rows


def insert_register(*args):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("""INSERT INTO registers (
        slave_id, parameter, unit, function_code, address,
        quantity, type, scale, multiplier, factor_1, factor_2
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)""", args)
    conn.commit()
    conn.close()


def update_register(db_id, *args):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("""UPDATE registers SET
        slave_id=?, parameter=?, unit=?, function_code=?, address=?,
        quantity=?, type=?, scale=?, multiplier=?, factor_1=?, factor_2=?
        WHERE id=?""", (*args, db_id))
    conn.commit()
    conn.close()


def delete_register_by_id(db_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM registers WHERE id = ?", (db_id,))
    conn.commit()
    conn.close()


def check_slave_id_exists(slave_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT 1 FROM registers WHERE slave_id = ?", (slave_id,))
    res = c.fetchone() is not None
    conn.close()
    return res


def get_distinct_suggestions(column_name):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute(f"SELECT DISTINCT {column_name} FROM registers WHERE {column_name} IS NOT NULL AND {column_name} != ''")
    res = [str(r[0]) for r in c.fetchall()]
    conn.close()
    return res


def insert_log(action, detail):
    from datetime import datetime
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT INTO activity_log (timestamp, action, detail) VALUES (?,?,?)",
              (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), action, detail))
    conn.commit()
    conn.close()


def get_all_logs():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT timestamp, action, detail FROM activity_log ORDER BY id DESC")
    rows = c.fetchall()
    conn.close()
    return rows


def delete_device_by_slave_id(slave_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM registers WHERE slave_id = ?", (str(slave_id),))
    count = c.rowcount
    conn.commit()
    conn.close()
    return count


def get_all_slave_ids():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT DISTINCT slave_id FROM registers ORDER BY CAST(slave_id AS INTEGER) ASC")
    ids = [str(row[0]) for row in c.fetchall()]
    conn.close()
    return ids


def get_tcp_config():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT port FROM modbus_tcp_config WHERE id=1")
    row = c.fetchone()
    conn.close()
    return {"port": row[0]} if row else {"port": "502"}


def save_tcp_config(port):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("UPDATE modbus_tcp_config SET port=? WHERE id=1", (port,))
    conn.commit()
    conn.close()


def get_tcp_mappings():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("""SELECT id, tcp_address, unit_id, function_code, parameter, description
        FROM modbus_tcp_mapping
        ORDER BY CAST(tcp_address AS INTEGER) ASC, CAST(unit_id AS INTEGER) ASC""")
    rows = c.fetchall()
    conn.close()
    return rows


def save_tcp_mappings(mappings):
    """mappings = list of (tcp_address, unit_id, function_code, parameter, description)"""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM modbus_tcp_mapping")
    c.executemany(
        "INSERT INTO modbus_tcp_mapping (tcp_address, unit_id, function_code, parameter, description) VALUES (?,?,?,?,?)",
        mappings,
    )
    conn.commit()
    conn.close()


def get_registers_for_dropdown():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT slave_id, parameter, function_code FROM registers ORDER BY CAST(slave_id AS INTEGER) ASC, CAST(address AS INTEGER) ASC")
    rows = c.fetchall()
    conn.close()
    return rows
