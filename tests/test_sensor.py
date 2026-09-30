import importlib
import ast
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import patch

import sensor


class FakeBus:
    registers = {0x04: 0x22, 0x14: 26214, 0x16: 32768,
                 0x12: 1000, 0x18: 1013, 0x10: 123}
    calls = []

    def __init__(self, number):
        self.number = number
        if number != 3:
            raise AssertionError("Wrong I2C bus")

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass

    def read_i2c_block_data(self, address, register, count):
        if address != 0x22 or count != 2:
            raise AssertionError("Wrong address or register size")
        self.calls.append(register)
        value = self.registers[register]
        return [value >> 8, value & 255]


class SensorTests(unittest.TestCase):
    def test_uv_zero_missing_and_saturation(self):
        self.assertEqual(sensor.uv_irradiance(0), 0.0)
        self.assertIsNone(sensor.uv_irradiance(None))
        self.assertIsNone(sensor.uv_irradiance(65535))
        self.assertAlmostEqual(sensor.uv_irradiance(2300), 0.325433, places=6)
        self.assertAlmostEqual(sensor.uv_irradiance(1), 0.000141, places=6)
        for invalid in (-1, 65536, float('nan'), True):
            with self.assertRaises(ValueError):
                sensor.uv_irradiance(invalid)

    def test_uv_failure_preserves_climate_readings(self):
        fake = types.SimpleNamespace(SMBus=FakeBus)
        original = FakeBus.read_i2c_block_data
        def fail_uv(bus, address, register, count):
            if register == 0x10:
                raise OSError('UV unavailable')
            return original(bus, address, register, count)
        with patch.dict(sys.modules, {"smbus2": fake}), \
                patch.object(FakeBus, "read_i2c_block_data", fail_uv), \
                patch.object(sensor, "get_cpu_temperature", return_value=40):
            result = sensor.read_sensors()
        self.assertEqual(result['temperature'], 25.0)
        self.assertIsNone(result['uv_raw'])
        self.assertIsNone(result['uv_mw_cm2'])

    def test_import_does_not_open_hardware(self):
        with patch.dict(sys.modules, {"smbus2": None, "bme280": None, "ltr559": None}):
            importlib.reload(sensor)

    def test_register_conversion_without_cpu_correction(self):
        fake = types.SimpleNamespace(SMBus=FakeBus)
        with patch.dict(sys.modules, {"smbus2": fake}), \
                patch.object(sensor, "get_cpu_temperature", return_value=60):
            result = sensor.read_sensors()
        self.assertEqual(result["temperature"], 25.0)
        self.assertEqual(result["humidity"], 50.0)
        self.assertNotIn("raw_temperature", result)
        self.assertNotIn("raw_humidity", result)
        self.assertEqual(result["cpu_temperature"], 60)
        self.assertEqual(result["pressure_hpa"], 1013)
        self.assertEqual(result["uv_raw"], 123)
        self.assertAlmostEqual(result["lux"], 1075.0, places=1)
        self.assertAlmostEqual(result["vpd"], 1.58, places=2)

    def test_i2c_failure_is_not_a_fake_measurement(self):
        fake = types.SimpleNamespace(SMBus=lambda _: (_ for _ in ()).throw(OSError("offline")))
        with patch.dict(sys.modules, {"smbus2": fake}):
            with self.assertRaises(OSError):
                sensor.read_sensors()

    def test_wrong_device_is_rejected(self):
        fake = types.SimpleNamespace(SMBus=FakeBus)
        with patch.dict(sys.modules, {"smbus2": fake}), \
                patch.dict(FakeBus.registers, {0x04: 0x58}):
            with self.assertRaises(OSError):
                sensor.read_sensors()

    def test_short_reply_is_rejected(self):
        bus = types.SimpleNamespace(read_i2c_block_data=lambda *args: [0])
        with self.assertRaises(OSError):
            sensor._read_word(bus, 0x14)

    def test_api_returns_503_for_sensor_failure(self):
        class HTTPException(Exception):
            def __init__(self, status_code, detail):
                self.status_code = status_code
                self.detail = detail
        tree = ast.parse(Path("app.py").read_text())
        function = next(n for n in tree.body if isinstance(n, ast.FunctionDef)
                        and n.name == "read_available_sensors")
        code = compile(ast.Module(body=[function], type_ignores=[]), "app.py", "exec")
        namespace = {"HTTPException": HTTPException,
                     "read_sensors": lambda: (_ for _ in ()).throw(OSError("offline"))}
        exec(code, namespace)
        with self.assertRaises(HTTPException) as caught:
            namespace["read_available_sensors"]()
        self.assertEqual(caught.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
