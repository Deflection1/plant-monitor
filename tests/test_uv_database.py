import sqlite3
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import database


class UVDatabaseTests(unittest.TestCase):
    def test_legacy_climate_values_preserved_and_new_rows_leave_them_empty(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(database, 'DB_PATH', Path(directory) / 'plant.db'):
                database.init_db()
                with database.get_connection() as db:
                    db.execute('''INSERT INTO measurements
                        (timestamp,temperature,humidity,raw_temperature,raw_humidity)
                        VALUES(?,?,?,?,?)''', (int(time.time()), 25, 50, 40, 28))
                # Repeated startup must preserve historical Enviro+ data.
                database.init_db()
                database.insert_measurement({
                    'temperature': 26, 'humidity': 55, 'cpu_temperature': 42,
                    'raw_temperature': 99, 'raw_humidity': 99,
                    'soil_raw_1': 123, 'uv_raw': 8, 'uv_mw_cm2': 0.001132})
                with database.get_connection() as db:
                    rows = db.execute('''SELECT temperature,humidity,
                        raw_temperature,raw_humidity,cpu_temperature,soil_raw_1,
                        uv_raw,uv_mw_cm2 FROM measurements ORDER BY id''').fetchall()
                self.assertEqual(tuple(rows[0]),
                                 (25, 50, 40, 28, None, None, None, None))
                self.assertEqual(tuple(rows[1]),
                                 (26, 55, None, None, 42, 123, 8, 0.001132))

    def test_existing_database_migration_and_uv_history(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'plant.db'
            with sqlite3.connect(path) as db:
                db.execute('''CREATE TABLE measurements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp INTEGER NOT NULL, temperature REAL,
                    humidity REAL, vpd REAL, lux REAL, raw_temperature REAL,
                    raw_humidity REAL, cpu_temperature REAL)''')
                db.execute('INSERT INTO measurements(timestamp,temperature,lux) VALUES(?,?,?)',
                           (int(time.time()), 25, 100))
            with patch.object(database, 'DB_PATH', path):
                database.init_db()
                database.init_db()
                database.insert_measurement({'temperature': 26, 'lux': 110,
                                             'uv_raw': 0, 'uv_mw_cm2': 0.0})
                database.insert_measurement({'temperature': 27, 'lux': 120,
                                             'uv_raw': 2300, 'uv_mw_cm2': 0.325433})
                rows = database.get_connection().execute(
                    'SELECT temperature,lux,uv_raw,uv_mw_cm2 FROM measurements ORDER BY id'
                ).fetchall()
                self.assertEqual(tuple(rows[0]), (25, 100, None, None))
                self.assertEqual(tuple(rows[1]), (26, 110, 0, 0.0))
                self.assertEqual(tuple(rows[2]), (27, 120, 2300, 0.325433))
                for period in database.RANGES:
                    history = database.get_history(period)
                    self.assertTrue(history)
                    self.assertTrue(any(p['uv_mw_cm2'] is not None for p in history))

    def test_old_history_has_no_invented_uv_zero(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(database, 'DB_PATH', Path(directory) / 'plant.db'):
                database.init_db()
                database.insert_measurement({'temperature': 25, 'lux': 5})
                self.assertIsNone(database.get_history()[0]['uv_mw_cm2'])
