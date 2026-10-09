"""Bounded manual pump tests. GPIO setup does not energize either output."""
import threading
import time

PINS = {1: 17, 2: 27}


def open_output(pin):
    from gpiozero import DigitalOutputDevice
    return DigitalOutputDevice(pin, active_high=True, initial_value=False)


class PumpController:
    def __init__(self, tank, factory=open_output, clock=time.monotonic, require_tank=True):
        self.require_tank = require_tank
        self.tank = tank
        self.factory = factory
        self.clock = clock
        self.lock = threading.RLock()
        self.outputs = {}
        self.active = None
        self.deadline = None
        self.error = None
        self.message = "Pumpenausgänge noch nicht initialisiert"
        self.closed = False
        self.stop_event = threading.Event()
        self.thread = None

    def initialize(self):
        with self.lock:
            try:
                for id, pin in PINS.items():
                    self.outputs[id] = self.factory(pin)
                self.message = "Manueller Pumpentest bereit"
            except Exception as error:
                self.error = str(error)
                for output in self.outputs.values():
                    output.close()
                self.outputs.clear()
            self.thread = threading.Thread(target=self._watch, daemon=True,
                                           name="pump-test-watchdog")
            self.thread.start()

    def start(self, id, seconds=5):
        if type(id) is not int or id not in PINS:
            raise ValueError("Pumpe 1 oder 2 erwartet")
        if type(seconds) not in (int, float) or not 1 <= seconds <= 10:
            raise ValueError("Testdauer muss 1 bis 10 Sekunden betragen")
        with self.lock:
            if self.closed or len(self.outputs) != 2 or self.error:
                raise RuntimeError("Pumpenausgänge nicht verfügbar")
            if self.active is not None:
                raise RuntimeError("Eine Pumpe läuft bereits")
            if self.require_tank:
                self.tank.sample()
                if not self.tank.status()["tank_ok"]:
                    raise RuntimeError("Tank leer oder Tankstatus unbekannt")
            self.active = id
            self.deadline = self.clock() + seconds
            try:
                self.outputs[id].on()
            except Exception as error:
                self.error = str(error)
                self.stop("GPIO-Fehler")
                raise RuntimeError("Pumpenausgabe fehlgeschlagen") from error
            self.message = f"Pumpe {id}: Test läuft"
            return self.status()

    def stop(self, message="Manuell gestoppt"):
        with self.lock:
            for output in self.outputs.values():
                try:
                    output.off()
                except Exception as error:
                    self.error = str(error)
            self.active = self.deadline = None
            self.message = message
            return self.status()

    def check(self):
        with self.lock:
            if self.active is None:
                return
            if self.require_tank:
                self.tank.sample()
            if self.require_tank and not self.tank.status()["tank_ok"]:
                self.stop("Test gestoppt: Tank leer oder unbekannt")
            elif self.clock() >= self.deadline:
                self.stop("Pumpentest abgeschlossen")

    def _watch(self):
        while not self.stop_event.wait(0.1):
            try:
                self.check()
            except Exception as error:
                with self.lock:
                    self.error = str(error)
                    self.stop("Test wegen Fehler gestoppt")

    def status(self):
        with self.lock:
            ready = len(self.outputs) == 2 and not self.closed and not self.error
            return {"hardware_connected": ready, "output_available": ready,
                    "mode": "manual_test", "active_pump": self.active,
                    "test_requires_tank": self.require_tank,
                    "message": self.message, "error": self.error,
                    "pumps": [{"id": id, "gpio_bcm": pin,
                               "state": "running" if self.active == id else
                                        "idle" if ready else "unavailable",
                               "remaining_seconds": max(0, self.deadline - self.clock())
                                   if self.active == id else 0,
                               "last_watered_at": None} for id, pin in PINS.items()]}

    def close(self):
        with self.lock:
            self.closed = True
            self.stop("Pumpenausgänge abgeschaltet")
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=2)
        with self.lock:
            for output in self.outputs.values():
                output.close()
            self.outputs.clear()
