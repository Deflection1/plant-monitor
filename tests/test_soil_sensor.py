import ast
from pathlib import Path
import unittest
from unittest.mock import Mock

from soil_sensor import SoilSensor


class Bus:
    def __init__(self, values=(16000, 8000), ready=True):
        self.values, self.ready = values, ready
        self.writes = []
        self.channel = 0
        self.closed = False

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.closed = True

    def write_i2c_block_data(self, address, register, data):
        self.writes.append((address, register, data))
        self.channel = ((data[0] >> 4) & 7) - 4

    def read_i2c_block_data(self, address, register, count):
        value = (0x8000 if self.ready else 0) if register == 1 else self.values[self.channel] & 65535
        return [value >> 8, value & 255]


class SoilTests(unittest.TestCase):
    def reader(self, bus):
        self.now = 0
        def sleep(seconds):
            self.now += seconds
        self.factory = Mock(return_value=bus)
        return SoilSensor(bus_factory=self.factory, clock=lambda: self.now, sleep=sleep)

    def test_channels_config_voltage_and_cache(self):
        bus = Bus()
        reader = self.reader(bus)
        data = reader.read()
        self.assertTrue(data['soil_adc_connected'])
        self.assertEqual(data['soil_raw_1'], 16000)
        self.assertEqual(data['soil_voltage_1'], 2.0)
        self.assertEqual(data['soil_voltage_2'], 1.0)
        self.assertEqual(bus.writes, [(0x48, 1, [0xC3, 0x83]), (0x48, 1, [0xD3, 0x83])])
        self.assertTrue(bus.closed)
        data['soil_raw_1'] = 99
        self.assertEqual(reader.read()['soil_raw_1'], 16000)
        self.factory.assert_called_once_with(4)
        self.now += 2
        reader.read()
        self.assertEqual(self.factory.call_count, 2)

    def test_signed_conversion(self):
        data = self.reader(Bus(values=(-1, 32767))).read()
        self.assertEqual(data['soil_raw_1'], -1)
        self.assertAlmostEqual(data['soil_voltage_2'], 4.095875, places=5)

    def test_timeout_returns_missing_values_and_closes_bus(self):
        bus = Bus(ready=False)
        result = self.reader(bus).read()
        self.assertFalse(result['soil_adc_connected'])
        self.assertIsNone(result['soil_raw_1'])
        self.assertIn('Konvertierung', result['soil_adc_error'])
        self.assertTrue(bus.closed)

    def test_failure_discards_previous_reading_and_recovers(self):
        reader = self.reader(Bus())
        reader.read()
        self.now += 2
        self.factory.side_effect = OSError('offline')
        result = reader.read()
        self.assertIsNone(result['soil_raw_1'])
        self.assertEqual(result['soil_adc_error'], 'offline')
        self.now += 2
        self.factory.side_effect = None
        self.assertTrue(reader.read()['soil_adc_connected'])

    def test_short_reply_and_missing_library(self):
        bus = Bus()
        bus.read_i2c_block_data = lambda *args: [0]
        self.assertFalse(self.reader(bus).read()['soil_adc_connected'])
        reader = self.reader(Bus())
        self.factory.side_effect = ImportError('missing smbus2')
        self.assertIsNone(reader.read()['soil_raw_2'])

    def test_soil_api_independent_of_climate_and_uncalibrated(self):
        tree = ast.parse(Path('app.py').read_text())
        names = {'soil_status', 'add_soil_values', 'raw_to_soil_percent'}
        functions = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names]
        for node in functions:
            node.decorator_list = []
        import math
        ns = {'read_soil': self.reader(Bus()).read, 'math': math,
              'SOIL_CONFIG': {'pots': [{'dry_raw': None, 'wet_raw': None},
                                       {'dry_raw': 16000, 'wet_raw': 0}]}}
        exec(compile(ast.Module(body=functions, type_ignores=[]), 'app.py', 'exec'), ns)
        result = ns['soil_status']()
        self.assertTrue(result['adc']['connected'])
        self.assertIsNone(result['pots'][0]['moisture_percent'])
        self.assertEqual(result['pots'][1]['moisture_percent'], 50.0)

    def test_current_survives_climate_failure_and_recovers(self):
        tree = ast.parse(Path('app.py').read_text())
        names = {'current', 'add_soil_values', 'raw_to_soil_percent', 'add_light_values'}
        functions = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names]
        for node in functions:
            node.decorator_list = []
        class HTTPException(Exception):
            def __init__(self, status_code, detail):
                self.status_code, self.detail = status_code, detail
        import math
        climate = Mock(side_effect=HTTPException(503, 'climate unavailable'))
        ns = {'read_soil': self.reader(Bus()).read, 'math': math,
              'HTTPException': HTTPException, 'read_available_sensors': climate,
              'lux_to_ppfd': lambda lux: lux / 50, 'CENTER_FACTOR': 1,
              'LIGHT_ON_LUX': 100,
              'SOIL_CONFIG': {'pots': [{'dry_raw': 20000, 'wet_raw': 0},
                                       {'dry_raw': 16000, 'wet_raw': 0}]}}
        exec(compile(ast.Module(body=functions, type_ignores=[]), 'app.py', 'exec'), ns)
        data = ns['current']()
        self.assertFalse(data['environment_available'])
        self.assertEqual(data['soil_moisture_1'], 20.0)
        self.assertEqual(data['soil_moisture_2'], 50.0)
        for key in ('temperature', 'humidity', 'lux', 'ppfd_sensor', 'ppfd_center', 'light_on'):
            self.assertIsNone(data[key])
        climate.side_effect = None
        climate.return_value = {'temperature': 25, 'lux': 0, 'soil_raw_1': 16000}
        data = ns['current']()
        self.assertTrue(data['environment_available'])
        self.assertIsNone(data['environment_error'])
        self.assertEqual(data['lux'], 0)
        self.assertEqual(data['ppfd_center'], 0)
        self.assertFalse(data['light_on'])
        climate.side_effect = HTTPException(400, 'other error')
        with self.assertRaises(HTTPException):
            ns['current']()


if __name__ == '__main__':
    unittest.main()
