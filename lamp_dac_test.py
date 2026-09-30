"""Standalone commissioning tool; the website never invokes this module."""
import argparse
import fcntl
import signal
import sys
import time
from pathlib import Path

from gp8600 import BUS, ADDRESS, GP8600, voltage_code


def run_test(bus, volts, seconds, wait=time.sleep):
    dac = GP8600(bus)
    try:
        dac.initialize()
        dac.set_voltage(volts)
        print(f"Sollwert {volts:g} V für {seconds:g} Sekunden. Jetzt OUT/GND messen.", flush=True)
        wait(seconds)
    finally:
        try:
            dac.zero()
            print("0-V-Sollwert gesendet (keine Spannungsrückmessung).", flush=True)
        except OSError:
            print("Rücksetzen fehlgeschlagen: Ausgangsspannung unbekannt; Modul spannungsfrei machen.", file=sys.stderr)
            raise


def main(argv=None):
    parser = argparse.ArgumentParser(description="GP8600-Prüfung ohne angeschlossene Lampe")
    parser.add_argument("--volts", type=float, required=True)
    parser.add_argument("--seconds", type=int, default=20, choices=range(1, 61), metavar="1..60")
    parser.add_argument("--apply", action="store_true", help="Tatsächlich auf I2C schreiben")
    parser.add_argument("--output-disconnected", action="store_true", help="DIM-Eingang der Lampe ist abgetrennt")
    args = parser.parse_args(argv)
    try:
        code = voltage_code(args.volts)
    except ValueError as error:
        parser.error(str(error))
    if not args.apply:
        print(f"Simulation: Bus {BUS}, Adresse 0x{ADDRESS:02x}, 0–10 V, Sollwert {args.volts:g} V, DAC {code}.")
        print("Kein Hardwarezugriff. Für die Messung später --apply --output-disconnected ergänzen.")
        return 0
    if not args.output_disconnected:
        parser.error("Vor dem Test DIM-Verbindung trennen und --output-disconnected angeben")

    def interrupted(_signal, _frame):
        raise KeyboardInterrupt

    previous_handler = signal.signal(signal.SIGTERM, interrupted)
    try:
        # Prevent overlapping commissioning processes; does not alter service settings.
        lock_path = Path(__file__).parent / "data" / "gp8600-test.lock"
        lock_path.parent.mkdir(parents=True, exist_ok=True)
        with lock_path.open("a") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            from smbus2 import SMBus
            with SMBus(BUS) as bus:
                run_test(bus, args.volts, args.seconds)
    except KeyboardInterrupt:
        return 130
    except (OSError, ImportError) as error:
        print(f"GP8600-Test fehlgeschlagen: {error}", file=sys.stderr)
        return 1
    finally:
        signal.signal(signal.SIGTERM, previous_handler)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
