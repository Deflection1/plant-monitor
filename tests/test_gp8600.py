import unittest
from unittest.mock import Mock, patch

from gp8600 import GP8600, voltage_code
from lamp_dac_test import main, run_test


class GP8600Tests(unittest.TestCase):
    def test_voltage_boundaries_and_invalid_values(self):
        self.assertEqual([voltage_code(v) for v in (0, 1, 5, 10)], [0, 6554, 32768, 65535])
        for value in (-1, 10.01, float('nan'), float('inf'), True, '5', None):
            with self.subTest(value=value), self.assertRaises(ValueError):
                voltage_code(value)

    def test_manufacturer_protocol_and_initialization(self):
        bus = Mock()
        dac = GP8600(bus)
        bus.write_i2c_block_data.assert_not_called()
        with self.assertRaises(RuntimeError):
            dac.set_voltage(5)
        dac.initialize()
        dac.set_voltage(5)
        self.assertEqual([c.args for c in bus.write_i2c_block_data.call_args_list], [
            (0x58, 0x02, [0, 0]), (0x58, 0x01, [0x08]),
            (0x58, 0x02, [0, 0]), (0x58, 0x02, [0, 128])])

    def test_normal_timeout_and_interrupt_reset(self):
        for error in (None, KeyboardInterrupt(), OSError('failed')):
            bus = Mock()
            wait = Mock(side_effect=error)
            if error is None:
                run_test(bus, 10, 20, wait)
            else:
                with self.assertRaises(type(error)):
                    run_test(bus, 10, 20, wait)
            self.assertEqual(bus.write_i2c_block_data.call_args.args, (0x58, 0x02, [0, 0]))

    def test_failed_range_never_sends_positive_voltage(self):
        bus = Mock()
        bus.write_i2c_block_data.side_effect = [None, OSError('offline'), None]
        with self.assertRaises(OSError):
            run_test(bus, 5, 20, Mock())
        self.assertEqual(bus.write_i2c_block_data.call_args.args, (0x58, 0x02, [0, 0]))

    def test_dry_run_and_apply_guard_do_not_open_hardware(self):
        with patch.dict('sys.modules', {'smbus2': None}):
            self.assertEqual(main(['--volts', '5']), 0)
            with self.assertRaises(SystemExit) as raised:
                main(['--volts', '5', '--apply'])
            self.assertEqual(raised.exception.code, 2)
