import ast
import json
from pathlib import Path
import tempfile
import unittest
from configuration import atomic_write_json
from fan_control import default_fan_config, validate_fan_config, target_percent, fan_status


class FanTests(unittest.TestCase):
    def test_defaults_and_no_hardware(self):
        config = default_fan_config()
        self.assertEqual(validate_fan_config(config), config)
        status = fan_status(config)
        self.assertFalse(status["output_available"])
        self.assertFalse(status["hardware_connected"])
        self.assertTrue(all(f["rpm"] is None and f["output_percent"] is None for f in status["fans"]))

    def test_mode_minimum_and_separate_fans(self):
        config = default_fan_config()
        fan = config["fans"][0]
        fan.update(mode="manual", power_percent=20, minimum_percent=30)
        self.assertEqual(target_percent(fan), 30)
        self.assertEqual(target_percent(config["fans"][1]), 0)
        fan["power_percent"] = 0
        self.assertEqual(target_percent(fan), 0)
        fan.update(mode="off", power_percent=90)
        self.assertEqual(target_percent(fan), 0)

    def test_invalid(self):
        for change in ({"power_percent": True}, {"power_percent": 1.5},
                       {"power_percent": 101}, {"minimum_percent": -1},
                       {"mode": "auto"}, {"name": " "}, {"id": "exhaust"},
                       {"gpio": 4}):
            with self.subTest(change=change):
                c = default_fan_config()
                c["fans"][0].update(change)
                with self.assertRaises(ValueError):
                    validate_fan_config(c)

    def test_endpoint_persistence_and_failed_save(self):
        # Exercise real endpoint function without importing Raspberry Pi hardware.
        tree = ast.parse(Path("app.py").read_text())
        fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == "fans_config_update")
        fn.decorator_list = []
        scope = {"validate_fan_config": validate_fan_config, "Body": lambda *a: None,
                 "FAN_CONFIG": default_fan_config(), "HTTPException": RuntimeError}
        exec(compile(ast.Module(body=[fn], type_ignores=[]), "endpoint", "exec"), scope)
        changed = default_fan_config()
        changed["fans"][0].update(name="Frischluft", mode="manual", power_percent=45)
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "fan_control.json"
            scope.update(FAN_CONFIG_FILE=file, persist_config=atomic_write_json)
            scope["fans_config_update"](changed)
            self.assertEqual(validate_fan_config(json.loads(file.read_text())), changed)
            original = scope["FAN_CONFIG"]
            def fail(*args):
                raise OSError("Disk full")
            scope["persist_config"] = fail
            another = default_fan_config()
            with self.assertRaises(OSError):
                scope["fans_config_update"](another)
            self.assertEqual(scope["FAN_CONFIG"], original)
            self.assertEqual(json.loads(file.read_text()), changed)


if __name__ == "__main__":
    unittest.main()
