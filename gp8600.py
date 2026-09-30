"""GP8600 16-bit, single-channel DAC. No hardware access on import.

Protocol: DFRobot/DFRobot_GP8XXX (MIT), GP8600 range 0x01=0x08,
channel 0 at 0x02, low byte first. No EEPROM persistence commands.
"""
import math

BUS = 1
ADDRESS = 0x58
RANGE_REGISTER = 0x01
RANGE_10V = 0x08
OUTPUT_REGISTER = 0x02


def voltage_code(volts):
    if isinstance(volts, bool) or not isinstance(volts, (int, float)):
        raise ValueError("Spannung muss eine Zahl zwischen 0 und 10 V sein")
    if not math.isfinite(volts) or not 0 <= volts <= 10:
        raise ValueError("Spannung muss zwischen 0 und 10 V liegen")
    return int(volts * 65535 / 10 + 0.5)


class GP8600:
    def __init__(self, bus):
        self.bus = bus
        self.ready = False

    def initialize(self):
        self.ready = False
        # Clear the DAC value before changing the range, then clear again.
        self.zero()
        self.bus.write_i2c_block_data(ADDRESS, RANGE_REGISTER, [RANGE_10V])
        self.zero()
        self.ready = True

    def zero(self):
        self.bus.write_i2c_block_data(ADDRESS, OUTPUT_REGISTER, [0, 0])

    def set_voltage(self, volts):
        code = voltage_code(volts)
        if not self.ready:
            raise RuntimeError("GP8600 zuerst initialisieren")
        self.bus.write_i2c_block_data(
            ADDRESS, OUTPUT_REGISTER, [code & 0xFF, code >> 8]
        )
        return code
