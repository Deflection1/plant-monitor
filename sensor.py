import math
import subprocess

from bme280 import BME280

try:
    from ltr559 import LTR559
    ltr559 = LTR559()
except ImportError:
    import ltr559


bme280 = BME280()

# Diesen Wert später kalibrieren.
TEMP_FACTOR = 2.25


def saturation_vapor_pressure(temp_c):
    return 0.6108 * math.exp(
        (17.27 * temp_c) /
        (temp_c + 237.3)
    )


def get_cpu_temperature():
    output = subprocess.check_output(
        ["vcgencmd", "measure_temp"],
        text=True
    ).strip()

    return float(
        output.split("=")[1]
        .replace("'C", "")
    )


def correct_temperature(raw_temp, cpu_temp):
    return raw_temp - (
        (cpu_temp - raw_temp) / TEMP_FACTOR
    )


def correct_humidity(raw_temp, raw_humidity, corrected_temp):
    # tatsächlicher Wasserdampfdruck aus der Messung
    vapor_pressure = (
        raw_humidity / 100.0
        * saturation_vapor_pressure(raw_temp)
    )

    # RH bei der geschätzten Umgebungstemperatur
    corrected_humidity = (
        vapor_pressure
        / saturation_vapor_pressure(corrected_temp)
        * 100.0
    )

    return max(0.0, min(100.0, corrected_humidity))


def calculate_vpd(temp, humidity):
    return (
        saturation_vapor_pressure(temp)
        * (1 - humidity / 100.0)
    )


def read_sensors():
    raw_temp = bme280.get_temperature()
    raw_humidity = bme280.get_humidity()
    cpu_temp = get_cpu_temperature()

    temperature = correct_temperature(
        raw_temp,
        cpu_temp
    )

    humidity = correct_humidity(
        raw_temp,
        raw_humidity,
        temperature
    )

    lux = ltr559.get_lux()

    return {
        "raw_temperature": round(raw_temp, 1),
        "cpu_temperature": round(cpu_temp, 1),
        "temperature": round(temperature, 1),
        "raw_humidity": round(raw_humidity, 1),
        "humidity": round(humidity, 1),
        "vpd": round(
            calculate_vpd(
                temperature,
                humidity
            ),
            2
        ),
        "lux": round(lux, 1)
    }
