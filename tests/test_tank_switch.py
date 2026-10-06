import ast
import asyncio
import unittest
from pathlib import Path
from unittest.mock import Mock
from tank_switch import TankSwitch
from irrigation import irrigation_status


class TankSwitchTests(unittest.TestCase):
    def setUp(self):
        self.now = 0
        self.device = Mock(is_active=False)
        self.factory = Mock(return_value=self.device)
        self.sensor = TankSwitch(self.factory, lambda: self.now)
        self.addCleanup(self.sensor.close)

    def sample(self, closed, seconds=0.1):
        self.now += seconds
        self.device.is_active = closed
        self.sensor.sample()

    def test_no_gpio_on_construction_and_low_means_water(self):
        self.factory.assert_not_called()
        self.assertEqual(self.sensor.status()["tank_state"], "unknown")
        self.sample(True)
        self.assertFalse(self.sensor.status()["tank_ok"])
        self.sample(True, 0.31)
        status = self.sensor.status()
        self.assertEqual(status["tank_state"], "ok")
        self.assertEqual(status["gpio_level"], 0)
        self.assertEqual(status["gpio_bcm"], 22)

    def test_open_wire_and_bouncing_contacts_never_report_water(self):
        self.sample(False)
        self.assertEqual(self.sensor.status()["tank_state"], "empty")
        self.assertEqual(self.sensor.status()["gpio_level"], 1)
        for _ in range(5):
            self.sample(True)
            self.sample(False)
            self.assertFalse(self.sensor.status()["tank_ok"])
        self.sample(True)
        self.sample(True, 0.31)
        self.assertTrue(self.sensor.status()["tank_ok"])
        self.sample(False)
        self.assertFalse(self.sensor.status()["tank_ok"])

    def test_failure_retry_and_stale_status(self):
        self.factory.side_effect = OSError("GPIO unavailable")
        self.sensor.sample()
        status = self.sensor.status()
        self.assertEqual(status["tank_state"], "unknown")
        self.assertEqual(status["error"], "GPIO unavailable")
        self.now = 5
        self.sensor.sample()
        self.factory.assert_called_once()
        self.factory.side_effect = None
        self.now = 10
        self.sensor.sample()
        self.sample(True)
        self.sample(True, 0.31)
        self.assertTrue(self.sensor.status()["tank_ok"])
        self.now += 3
        self.assertEqual(self.sensor.status()["tank_state"], "unknown")
        self.assertFalse(self.sensor.status()["tank_ok"])

    def test_read_error_releases_pin_and_invalidates_ok(self):
        self.sample(True)
        self.sample(True, 0.31)
        class Broken:
            @property
            def is_active(self):
                raise OSError("read failed")
            close = Mock()
        broken = Broken()
        self.sensor.device = broken
        self.sensor.sample()
        broken.close.assert_called_once()
        self.assertFalse(self.sensor.status()["tank_ok"])
        self.assertIsNone(self.sensor.status()["contact_closed"])

    def test_close_releases_pin_and_status(self):
        self.sensor.sample()
        self.sensor.close()
        self.device.close.assert_called_once()
        self.assertEqual(self.sensor.status()["tank_state"], "unknown")

    def test_api_uses_live_input_without_enabling_pumps(self):
        tree = ast.parse((Path(__file__).parents[1] / "app.py").read_text())
        nodes = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
                 and n.name in {"irrigation_status_read", "tank_status_read", "tank_worker"}]
        for node in nodes:
            node.decorator_list = []
        ns = {"TANK_SWITCH": self.sensor, "irrigation_status": irrigation_status, "asyncio": asyncio}
        exec(compile(ast.Module(body=nodes, type_ignores=[]), "app.py", "exec"), ns)
        for closed, expected in [(True, "ok"), (False, "empty")]:
            self.sample(closed)
            self.sample(closed, 0.31)
            status = ns["irrigation_status_read"]()
            self.assertEqual(status["tank_state"], expected)
            self.assertEqual(ns["tank_status_read"]()["tank_state"], expected)
            self.assertFalse(status["output_available"])
            self.assertFalse(status["hardware_connected"])
            self.assertTrue(all(p["state"] == "unavailable" for p in status["pumps"]))
        async def run():
            stop = asyncio.Event()
            task = asyncio.create_task(ns["tank_worker"](stop))
            await asyncio.sleep(0.02)
            stop.set()
            await asyncio.wait_for(task, 1)
        asyncio.run(run())
