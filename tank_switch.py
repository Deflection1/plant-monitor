"""WLSW1 input only: BCM22 to GND, closed contact means water present."""
import threading
import time

GPIO = 22
PHYSICAL_PIN = 15


def open_input():
    # Lazy import keeps development/test machines independent of GPIO libraries.
    from gpiozero import DigitalInputDevice
    return DigitalInputDevice(GPIO, pull_up=True)


class TankSwitch:
    def __init__(self, device_factory=open_input, clock=time.monotonic):
        self.device_factory = device_factory
        self.clock = clock
        self._lock = threading.RLock()
        self.device = None
        self.state = "unknown"
        self.contact_closed = None
        self.error = None
        self.checked_at = None
        self._checked = None
        self._closed_since = None
        self._retry_at = 0

    def sample(self):
        with self._lock:
            now = self.clock()
            if self.device is None and now < self._retry_at:
                return
            try:
                if self.device is None:
                    self.device = self.device_factory()
                # gpiozero with pull_up=True reports LOW as active.
                closed = bool(self.device.is_active)
                self.contact_closed = closed
                self.error = None
                self._checked = now
                self.checked_at = time.time()
                if not closed:
                    self._closed_since = None
                    self.state = "empty"
                else:
                    if self._closed_since is None:
                        self._closed_since = now
                    # Water is accepted only after 300 ms of stable closure.
                    # An open contact blocks immediately, including wire breaks.
                    if now - self._closed_since >= 0.3:
                        self.state = "ok"
            except Exception as error:
                self.error = str(error)
                self.state = "unknown"
                self.contact_closed = None
                self._checked = None
                self._closed_since = None
                self._retry_at = now + 10
                self._close_device()

    def status(self):
        with self._lock:
            fresh = self._checked is not None and self.clock() - self._checked <= 2
            state = self.state if fresh else "unknown"
            message = ("Wasser vorhanden · Kontakt geschlossen" if state == "ok" else
                       "Tank leer oder Leitung offen" if state == "empty" else
                       "Tankstatus unbekannt" + (" · " + self.error if self.error else " · Eingang noch nicht bestätigt"))
            return {"sensor": "WLSW1", "gpio_bcm": GPIO, "physical_pin": PHYSICAL_PIN,
                    "pull_up": True, "hardware_connected": self.device is not None and fresh,
                    "tank_state": state, "tank_ok": state == "ok",
                    "contact_closed": self.contact_closed if fresh else None,
                    "gpio_level": (0 if self.contact_closed else 1) if fresh else None,
                    "checked_at": self.checked_at, "error": self.error, "message": message}

    def _close_device(self):
        if self.device is not None:
            try:
                self.device.close()
            except Exception:
                pass
            self.device = None

    def close(self):
        with self._lock:
            self._close_device()
            self.state = "unknown"
            self.contact_closed = self._checked = self._closed_since = None
