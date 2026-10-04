import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import Mock

from gp8600 import OUTPUT_REGISTER
from lamp_control import LampController, target_percent
from lamp_profiles import normalize_lamp_config, update_lamp_profile


class LampControlTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.bus = Mock()
        self.factory = Mock(return_value=self.bus)
        self.controller = LampController(Path(self.temp.name) / "dac.lock", self.factory)
        self.addCleanup(self.controller.close)
        self.config = normalize_lamp_config({"control_enabled": True, "power_percent": 50})

    def stamp(self, hour, minute=0):
        # January: Zurich = UTC+1.
        return datetime(2026, 1, 1, hour - 1, minute, tzinfo=timezone.utc)

    def test_legacy_configs_cannot_turn_on_after_update(self):
        migrated = normalize_lamp_config({"power_percent": 100, "schedule_enabled": True})
        self.assertFalse(migrated["control_enabled"])
        self.assertEqual(target_percent(migrated, self.stamp(12)), 0)
        with self.assertRaises(ValueError):
            update_lamp_profile(migrated, {"control_enabled": "true"})

    def test_manual_and_disabled(self):
        self.assertEqual(target_percent(self.config), 50)
        self.config["control_enabled"] = False
        self.assertEqual(target_percent(self.config), 0)

    def test_day_schedule_and_exact_boundaries(self):
        self.config["schedule_enabled"] = True
        for hour, minute, expected in [(7,59,0),(8,0,50),(19,59,50),(20,0,0)]:
            self.assertEqual(target_percent(self.config, self.stamp(hour, minute)), expected)

    def test_overnight_equal_times_and_summer_timezone(self):
        self.config.update(schedule_enabled=True, on_time="22:00", off_time="06:00")
        for hour, expected in [(22,50),(1,50),(6,0),(12,0)]:
            self.assertEqual(target_percent(self.config, self.stamp(hour)), expected)
        summer = datetime(2026, 7, 1, 20, tzinfo=timezone.utc)
        self.assertEqual(target_percent(self.config, summer), 50)
        self.config["off_time"] = "22:00"
        self.assertEqual(target_percent(self.config, summer), 0)

    def test_output_mapping_shutdown_and_exclusive_ownership(self):
        status = self.controller.apply(self.config)
        self.assertEqual(status["output_voltage"], 5)
        self.assertTrue(status["output_available"])
        self.assertFalse(status["voltage_measured"])
        self.bus.write_i2c_block_data.assert_called_with(0x58, OUTPUT_REGISTER, [0,128])
        other_factory = Mock()
        other = LampController(self.controller.lock_path, other_factory)
        self.addCleanup(other.close)
        self.assertFalse(other.apply(self.config)["output_available"])
        other_factory.assert_not_called()
        self.controller.close()
        self.bus.write_i2c_block_data.assert_called_with(0x58, OUTPUT_REGISTER, [0,0])
        self.bus.close.assert_called_once()
        other.bus_factory = Mock(return_value=Mock())
        self.assertTrue(other.apply(self.config, reset_fault=True)["output_available"])

    def test_io_failure_reports_unknown_and_latches_until_save(self):
        self.controller.apply(self.config)
        self.bus.write_i2c_block_data.side_effect = OSError("bus error")
        status = self.controller.apply(self.config)
        self.assertIsNone(status["output_percent"])
        self.assertFalse(status["output_available"])
        self.assertIn("bus error", status["error"])
        self.bus.write_i2c_block_data.side_effect = None
        self.controller.apply(self.config)
        self.assertEqual(self.factory.call_count, 1)
        self.assertTrue(self.controller.apply(self.config, reset_fault=True)["output_available"])

    def test_zero_and_full_scale(self):
        self.config["power_percent"] = 100
        self.controller.apply(self.config)
        self.bus.write_i2c_block_data.assert_called_with(0x58, OUTPUT_REGISTER, [255,255])
        self.config["control_enabled"] = False
        self.controller.apply(self.config)
        self.bus.write_i2c_block_data.assert_called_with(0x58, OUTPUT_REGISTER, [0,0])


if __name__ == "__main__":
    unittest.main()
