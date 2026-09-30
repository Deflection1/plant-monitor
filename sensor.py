"""SEN0501 V2 I2C readings; no Enviro+ hardware is opened at import time.

Register layout and T/RH/lux conversions follow DFRobot's MIT-licensed
DFRobot_EnvironmentalSensor implementation. UV uses the V2 conversion from the DFRobot-linked cdjq library; the
result is estimated equivalent UVA irradiance, not a calibrated UV index.
"""
import math
import subprocess
import threading

SENSOR_BUS = 3
SENSOR_ADDRESS = 0x22
_sensor_lock = threading.Lock()


def saturation_vapor_pressure(temp_c):
    return 0.6108 * math.exp(17.27 * temp_c / (temp_c + 237.3))


def calculate_vpd(temp, humidity):
    return saturation_vapor_pressure(temp) * (1 - humidity / 100.0)


def get_cpu_temperature():
    try:
        output = subprocess.check_output(
            ["vcgencmd", "measure_temp"], text=True, timeout=2
        ).strip()
        return float(output.split("=")[1].replace("'C", ""))
    except (OSError, subprocess.SubprocessError, ValueError, IndexError):
        return None


def _read_word(bus, register):
    data = bus.read_i2c_block_data(SENSOR_ADDRESS, register, 2)
    if len(data) != 2:
        raise OSError("SEN0501: unvollständige Registerantwort")
    return (data[0] << 8) | data[1]


def uv_irradiance(raw):
    """Estimated equivalent UVA mW/cm², SEN0501 V2 firmware (20-bit, gain 6).
    
    DFRobot-linked V2 library: counts/(2300/3) * (0.23*1.58/3.35).
    The module exposes only a 16-bit register; its maximum is treated as
    saturation rather than a reliable intensity.
    """
    if raw is None or raw == 65535:
        return None
    if type(raw) is not int or not 0 <= raw <= 65535:
        raise ValueError("SEN0501: ungültiger UV-Rohwert")
    return round(raw / (2300.0 / 3.0) * (0.23 * 1.58 / 3.35), 6)


def read_sensors():
    # Lazy import and bus opening keep the website available if hardware fails.
    from smbus2 import SMBus

    with _sensor_lock, SMBus(SENSOR_BUS) as bus:
        address = _read_word(bus, 0x04) & 0xFF
        if address != SENSOR_ADDRESS:
            raise OSError("SEN0501: unerwartete Geräteadresse")
        temperature = -45 + _read_word(bus, 0x14) * 175.0 / 65536
        humidity = _read_word(bus, 0x16) * 100.0 / 65536
        light_raw = _read_word(bus, 0x12)
        pressure_hpa = _read_word(bus, 0x18)
        try:
            uv_raw = _read_word(bus, 0x10)
        except OSError:
            uv_raw = None

    lux = light_raw * (
        1.0023 + light_raw * (
            8.1488e-5 + light_raw * (-9.3924e-9 + light_raw * 6.0135e-13)
        )
    )
    if not (-20 <= temperature <= 70 and 0 <= humidity <= 100):
        raise ValueError("SEN0501: Temperatur oder Luftfeuchtigkeit unplausibel")
    if not (300 <= pressure_hpa <= 1100):
        raise ValueError("SEN0501: Luftdruck unplausibel")
    cpu_temperature = get_cpu_temperature()
    return {
        "raw_temperature": round(temperature, 1),
        "temperature": round(temperature, 1),
        "raw_humidity": round(humidity, 1),
        "humidity": round(humidity, 1),
        "cpu_temperature": (
            round(cpu_temperature, 1) if cpu_temperature is not None else None
        ),
        "vpd": round(calculate_vpd(temperature, humidity), 2),
        "lux": round(lux, 1),
        "pressure_hpa": pressure_hpa,
        "uv_raw": uv_raw,
        "uv_mw_cm2": uv_irradiance(uv_raw),
        "uv_saturated": uv_raw == 65535,
        "sensor_model": "SEN0501 V2.0",
    }
