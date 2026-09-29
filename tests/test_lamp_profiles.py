import json
import unittest
import test_configuration
from lamp_profiles import normalize_lamp_config


class LampProfileTests(unittest.TestCase):
    setUp = test_configuration.ConfigTests.setUp
    def test_profiles_survive_switch_and_restart(self):
        update = self.ns['lamp_config_update']
        update({'profile': 'custom', 'on_time': '07:30', 'off_time': '17:45', 'power_percent': 25})
        update({'profile': 'growth', 'on_time': '22:00', 'off_time': '06:00', 'power_percent': 40})
        switched = update({'profile': 'custom'})
        self.assertEqual(switched['on_time'], '07:30')
        self.assertEqual(switched['off_time'], '17:45')
        self.assertEqual(switched['power_percent'], 25)
        restart = self.ns['load_lamp_config']()
        self.assertEqual(restart['profiles']['growth']['on_time'], '22:00')
        self.assertEqual(restart['profiles']['growth']['power_percent'], 40)
        self.assertEqual(restart['profiles']['custom']['off_time'], '17:45')

    def test_old_selected_profile_migrates_without_loss(self):
        old = {'name': 'My lamp', 'profile': 'flower', 'on_time': '09:15',
               'off_time': '19:30', 'power_percent': 37, 'schedule_enabled': True}
        self.ns['LAMP_CONFIG_FILE'].write_text(json.dumps(old))
        loaded = self.ns['load_lamp_config']()
        for field in ('on_time', 'off_time', 'power_percent', 'schedule_enabled'):
            self.assertEqual(loaded['profiles']['flower'][field], old[field])
        self.assertEqual(loaded['name'], 'My lamp')
        self.assertEqual(len(loaded['profiles']), 3)

    def test_bad_profile_values_do_not_change_state(self):
        before = json.dumps(self.ns['LAMP_CONFIG'], sort_keys=True)
        from test_configuration import HTTPException
        for payload in ({'profile': 'invalid'}, {'on_time': '25:00'}, {'power_percent': 'NaN'}, {'schedule_enabled': 'false'}):
            with self.assertRaises(HTTPException):self.ns['lamp_config_update'](payload)
            self.assertEqual(json.dumps(self.ns['LAMP_CONFIG'], sort_keys=True), before)
