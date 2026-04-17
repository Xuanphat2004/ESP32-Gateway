import sqlite3

DB_NAME = "gateway_config.db"


def init_db():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS registers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slave_id TEXT, parameter TEXT, unit TEXT, function_code TEXT,
            address TEXT, quantity TEXT, type TEXT, scale TEXT,
            multiplier TEXT, factor_1 TEXT, factor_2 TEXT
        )
    """
    )
    c.execute("CREATE TABLE IF NOT EXISTS device_models (model_name TEXT PRIMARY KEY)")
    conn.commit()
    conn.close()


def get_all_models():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT model_name FROM device_models")
    models = [row[0] for row in c.fetchall()]
    conn.close()
    return models


def check_slave_id_exists(slave_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT 1 FROM registers WHERE slave_id = ?", (slave_id,))
    exists = c.fetchone() is not None
    conn.close()
    return exists


def create_model_template(model_name, slave_id_source):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    table_name = f"model_{model_name.replace(' ', '_').replace('-', '_')}"
    c.execute(
        f"CREATE TABLE IF NOT EXISTS {table_name} (parameter TEXT, unit TEXT, function_code TEXT, address TEXT, quantity TEXT, type TEXT, scale TEXT, multiplier TEXT, factor_1 TEXT, factor_2 TEXT)"
    )
    c.execute(
        "SELECT parameter, unit, function_code, address, quantity, type, scale, multiplier, factor_1, factor_2 FROM registers WHERE slave_id = ?",
        (slave_id_source,),
    )
    rows = c.fetchall()
    c.execute(f"DELETE FROM {table_name}")
    c.executemany(f"INSERT INTO {table_name} VALUES (?,?,?,?,?,?,?,?,?,?)", rows)
    c.execute("INSERT OR IGNORE INTO device_models VALUES (?)", (model_name,))
    conn.commit()
    conn.close()


def clone_device_from_model(model_name, new_slave_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    table_name = f"model_{model_name.replace(' ', '_').replace('-', '_')}"
    c.execute(f"SELECT * FROM {table_name}")
    rows = c.fetchall()
    for r in rows:
        c.execute(
            "INSERT INTO registers (slave_id, parameter, unit, function_code, address, quantity, type, scale, multiplier, factor_1, factor_2) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (new_slave_id, *r),
        )
    conn.commit()
    conn.close()


def get_all_registers():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute(
        "SELECT * FROM registers ORDER BY CAST(slave_id AS INTEGER) ASC, CAST(address AS INTEGER) ASC"
    )
    rows = c.fetchall()
    conn.close()
    return rows


def insert_register(*args):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute(
        "INSERT INTO registers (slave_id, parameter, unit, function_code, address, quantity, type, scale, multiplier, factor_1, factor_2) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        args,
    )
    conn.commit()
    conn.close()


def update_register(db_id, *args):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute(
        "UPDATE registers SET slave_id=?, parameter=?, unit=?, function_code=?, address=?, quantity=?, type=?, scale=?, multiplier=?, factor_1=?, factor_2=? WHERE id=?",
        (*args, db_id),
    )
    conn.commit()
    conn.close()


def delete_register_by_id(db_id):
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM registers WHERE id = ?", (db_id,))
    conn.commit()
    conn.close()
