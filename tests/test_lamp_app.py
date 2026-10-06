import ast
import asyncio
import unittest
from contextlib import asynccontextmanager, suppress
from unittest.mock import Mock

from lamp_control import LampController
import test_configuration


class LampAppTests(unittest.TestCase):
    setUp = test_configuration.ConfigTests.setUp
    def test_save_applies_output_and_lifespan_resets_it(self):
        bus = Mock()
        controller = LampController(self.path / "output.lock", lambda: bus)
        self.addCleanup(controller.close)
        self.ns["LAMP_CONTROLLER"] = controller
        result = self.ns["lamp_config_update"]({"control_enabled": True, "power_percent": 10})
        self.assertEqual(result["output_state"]["output_voltage"], 1)
        self.assertTrue(self.ns["load_lamp_config"]()["control_enabled"])

        tree = ast.parse((test_configuration.ROOT / "app.py").read_text())
        wanted = {"lamp_status", "apply_lamp_output", "close_lamp_output", "lamp_worker", "tank_worker", "lifespan"}
        nodes = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name in wanted]
        for node in nodes:
            node.decorator_list = [d for d in node.decorator_list if isinstance(d, ast.Name)]
        async def idle():
            await asyncio.Event().wait()
        self.ns.update(asyncio=asyncio, asynccontextmanager=asynccontextmanager,
                       suppress=suppress, FastAPI=object, init_db=Mock(),
                       start_camera=Mock(), stop_camera=Mock(),
                       measurement_worker=idle, timelapse_worker=idle,
                       TANK_SWITCH=Mock())
        exec(compile(ast.Module(body=nodes, type_ignores=[]), str(test_configuration.ROOT / "app.py"), "exec"), self.ns)
        async def run():
            async with self.ns["lifespan"](None):
                await asyncio.sleep(0.01)
                self.assertEqual(self.ns["lamp_status"]()["output_percent"], 10)
        asyncio.run(run())
        bus.write_i2c_block_data.assert_called_with(0x58, 0x02, [0,0])
        self.assertIsNone(controller.lock)
        self.ns["stop_camera"].assert_called_once()
        self.ns["TANK_SWITCH"].sample.assert_called()
        self.ns["TANK_SWITCH"].close.assert_called_once()

    def test_hardware_failure_keeps_saved_config_and_reports_error(self):
        def unavailable():
            raise OSError("bus offline")
        controller = LampController(self.path / "output.lock", unavailable)
        self.addCleanup(controller.close)
        self.ns["LAMP_CONTROLLER"] = controller
        result = self.ns["lamp_config_update"]({"control_enabled": True, "power_percent": 50})
        self.assertEqual(result["status"], "ok")
        self.assertFalse(result["output_state"]["output_available"])
        self.assertEqual(result["output_state"]["error"], "bus offline")
        self.assertEqual(self.ns["load_lamp_config"]()["power_percent"], 50)
