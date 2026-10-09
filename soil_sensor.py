"""ADS1115 A0/A1 on a dedicated I2C bus; no hardware opened on import.

Single-shot, 128 SPS, +/-4.096 V range (125 uV/count), comparator disabled.
Register layout: https://www.ti.com/lit/ds/symlink/ads1115.pdf
"""
import argparse
import json
import threading
import time


def open_bus(number):
    from smbus2 import SMBus
    return SMBus(number)


class SoilSensor:
    def __init__(self, bus_number=4, address=0x48, bus_factory=open_bus,
                 clock=time.monotonic, sleep=time.sleep):
        if bus_number < 0 or address not in range(0x48, 0x4C):
            raise ValueError("Ungültiger ADS1115-Bus oder Adresse")
        self.bus_number, self.address = bus_number, address
        self.bus_factory, self.clock, self.sleep = bus_factory, clock, sleep
        self.lock = threading.Lock()
        self.cached = None
        self.expires = 0

    def word(self, bus, register):
        data = bus.read_i2c_block_data(self.address, register, 2)
        if len(data) != 2:
            raise OSError("ADS1115: unvollständige Registerantwort")
        return (data[0] << 8) | data[1]

    def channel(self, bus, channel):
        config = 0x8000 | ((4 + channel) << 12) | 0x0200 | 0x0100 | 0x0080 | 3
        bus.write_i2c_block_data(self.address, 1, [config >> 8, config & 255])
        deadline = self.clock() + 0.1
        self.sleep(0.009)
        while True:
            if self.word(bus, 1) & 0x8000:
                break
            if self.clock() >= deadline:
                raise TimeoutError("ADS1115: Konvertierung nicht abgeschlossen")
            self.sleep(0.002)
        value = self.word(bus, 0)
        return value - 65536 if value & 0x8000 else value

    def read(self):
        # Serialize channel selection and share readings across concurrent API calls.
        with self.lock:
            if self.cached is not None and self.clock() < self.expires:
                return dict(self.cached)
            result = {"soil_raw_1": None, "soil_raw_2": None,
                      "soil_voltage_1": None, "soil_voltage_2": None,
                      "soil_adc_connected": False, "soil_adc_error": None,
                      "soil_adc_bus": self.bus_number,
                      "soil_adc_address": hex(self.address)}
            try:
                with self.bus_factory(self.bus_number) as bus:
                    values = [self.channel(bus, channel) for channel in (0, 1)]
                for number, value in enumerate(values, 1):
                    result[f"soil_raw_{number}"] = value
                    result[f"soil_voltage_{number}"] = round(value * 0.000125, 5)
                result["soil_adc_connected"] = True
            except (OSError, ValueError, ImportError) as error:
                result["soil_adc_error"] = str(error)
            self.cached = result
            self.expires = self.clock() + 1
            return dict(result)


SOIL_SENSOR = SoilSensor()


def read_soil():
    return SOIL_SENSOR.read()


def main():
    parser = argparse.ArgumentParser(description="ADS1115 A0/A1 testen")
    parser.add_argument("--bus", type=int, default=4)
    parser.add_argument("--address", type=lambda value: int(value, 0), default=0x48)
    parser.add_argument("--samples", type=int, default=5)
    args = parser.parse_args()
    if not 1 <= args.samples <= 600:
        parser.error("--samples muss zwischen 1 und 600 liegen")
    reader = SoilSensor(args.bus, args.address)
    failed = False
    for index in range(args.samples):
        result = reader.read()
        print(json.dumps(result, ensure_ascii=False), flush=True)
        failed = failed or not result["soil_adc_connected"]
        if index + 1 < args.samples:
            time.sleep(1)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
