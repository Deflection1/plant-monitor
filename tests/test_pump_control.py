import unittest
from pump_control import PumpController


class Output:
    def __init__(self, pin):
        self.pin = pin
        self.value = False
        self.closed = False
    def on(self): self.value = True
    def off(self): self.value = False
    def close(self): self.value = False; self.closed = True


class Tank:
    ok = True
    def sample(self): pass
    def status(self): return {"tank_ok": self.ok}


class PumpTests(unittest.TestCase):
    def setUp(self):
        self.now = 0
        self.tank = Tank()
        self.controller = PumpController(self.tank, Output, lambda: self.now)
        self.controller.initialize()
    def tearDown(self): self.controller.close()
    def test_initially_off_and_correct_pins(self):
        self.assertEqual([o.pin for o in self.controller.outputs.values()], [17, 27])
        self.assertFalse(any(o.value for o in self.controller.outputs.values()))
    def test_serialized_and_timed_stop(self):
        self.controller.start(1, 5)
        with self.assertRaises(RuntimeError): self.controller.start(2)
        self.now = 5
        self.controller.check()
        self.assertFalse(self.controller.outputs[1].value)
        self.controller.start(2)
        self.assertTrue(self.controller.outputs[2].value)
    def test_empty_tank_blocks_and_stops(self):
        self.tank.ok = False
        with self.assertRaises(RuntimeError): self.controller.start(1)
        self.tank.ok = True
        self.controller.start(1)
        self.tank.ok = False
        self.controller.check()
        self.assertFalse(self.controller.outputs[1].value)
    def test_tank_bypass_keeps_time_limit_and_serialization(self):
        self.controller.close()
        self.controller = PumpController(self.tank, Output, lambda: self.now,
                                         require_tank=False)
        self.controller.initialize()
        self.tank.ok = False
        def fail(): raise RuntimeError("Sensor absent")
        self.tank.sample = fail
        self.controller.start(1, 5)
        self.controller.check()
        self.assertTrue(self.controller.outputs[1].value)
        self.assertFalse(self.controller.status()["test_requires_tank"])
        with self.assertRaises(RuntimeError): self.controller.start(2)
        self.now = 5
        self.controller.check()
        self.assertFalse(self.controller.outputs[1].value)

    def test_validation(self):
        for id, seconds in [(True, 5), (3, 5), (1, 0), (1, 11), (1, float("nan"))]:
            with self.assertRaises(ValueError): self.controller.start(id, seconds)
    def test_stop_and_shutdown(self):
        self.controller.start(1)
        self.controller.stop()
        self.assertFalse(any(o.value for o in self.controller.outputs.values()))
        self.controller.start(2)
        outputs = list(self.controller.outputs.values())
        self.controller.close()
        self.assertTrue(all(o.closed and not o.value for o in outputs))
        with self.assertRaises(RuntimeError): self.controller.start(1)
    def test_gpio_failure_blocks_restart(self):
        def fail(): raise OSError("GPIO fault")
        self.controller.outputs[1].on = fail
        with self.assertRaises(RuntimeError): self.controller.start(1)
        self.assertFalse(any(o.value for o in self.controller.outputs.values()))
        with self.assertRaises(RuntimeError): self.controller.start(2)


if __name__ == "__main__": unittest.main()
