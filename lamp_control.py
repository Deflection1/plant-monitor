"""Live GP8600 control. No hardware access until apply(); one process owns output."""
import fcntl
import time
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from gp8600 import BUS, GP8600

TIMEZONE = ZoneInfo("Europe/Zurich")


def target_percent(config, now=None):
    if not config.get("control_enabled", False):
        return 0
    if not config["schedule_enabled"]:
        return config["power_percent"]
    now = datetime.now(TIMEZONE) if now is None else now.astimezone(TIMEZONE)
    minute = now.hour * 60 + now.minute
    start, end = [int(t[:2]) * 60 + int(t[3:]) for t in (config["on_time"], config["off_time"])]
    active = start <= minute < end if start < end else minute >= start or minute < end
    # Equal times mean off, never an implicit 24-hour schedule.
    return config["power_percent"] if start != end and active else 0


def open_bus():
    from smbus2 import SMBus
    return SMBus(BUS)


class LampController:
    def __init__(self, lock_path, bus_factory=open_bus):
        self.lock_path = Path(lock_path)
        self.bus_factory = bus_factory
        self.lock = None
        self.bus = None
        self.dac = None
        self.output_percent = None
        self.last_write_at = None
        self.error = None

    def apply(self, config, now=None, reset_fault=False):
        if self.error and not reset_fault:
            return self.status(config, now)
        if reset_fault:
            self.error = None
        try:
            if self.lock is None:
                self.lock_path.parent.mkdir(parents=True, exist_ok=True)
                lock = self.lock_path.open("a")
                try:
                    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except OSError:
                    lock.close()
                    raise OSError("GP8600 wird bereits von einem anderen Prozess verwendet")
                self.lock = lock
            if self.bus is None:
                self.bus = self.bus_factory()
                self.dac = GP8600(self.bus)
                self.dac.initialize()
                self.output_percent = 0
            target = target_percent(config, now)
            # Refresh every second so changes and time boundaries take effect.
            self.dac.set_voltage(target / 10)
            self.output_percent = target
            self.last_write_at = time.time()
        except (OSError, ImportError) as error:
            self.error = str(error)
            self.output_percent = None
            if self.dac is not None:
                try:
                    self.dac.zero()
                except OSError:
                    pass
            if self.bus is not None:
                try:
                    self.bus.close()
                except OSError:
                    pass
            self.bus = self.dac = None
        return self.status(config, now)

    def status(self, config, now=None):
        available = self.dac is not None and self.error is None
        return {"controller": "DFRobot GP8600", "hardware_connected": available,
                "output_available": available, "output_percent": self.output_percent,
                "output_voltage": None if self.output_percent is None else self.output_percent / 10,
                "target_percent": target_percent(config, now), "last_write_at": self.last_write_at,
                "voltage_measured": False, "timezone": "Europe/Zurich", "error": self.error,
                "message": ("Ausgabe unbekannt · " + self.error + " · nach Prüfung erneut speichern") if self.error else
                    ("Steuerung aus · 0-V-Sollwert" if not config.get("control_enabled") else
                     "Zeitplan aktiv" if config["schedule_enabled"] else "Manuelle Steuerung"),
                "config": config}

    def close(self):
        try:
            if self.dac is not None:
                try:
                    self.dac.zero()
                    self.output_percent = 0
                except OSError as error:
                    self.output_percent = None
                    self.error = str(error)
                    print("Lampe: Rücksetzen fehlgeschlagen; Ausgang unbekannt:", error)
        finally:
            try:
                if self.bus is not None:
                    self.bus.close()
            finally:
                self.bus = self.dac = None
                if self.lock is not None:
                    self.lock.close()
                    self.lock = None
