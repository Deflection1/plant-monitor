import unittest
from irrigation import default_irrigation_config, validate_irrigation_config, plan_watering


class IrrigationTests(unittest.TestCase):
    def setUp(self):
        self.config = default_irrigation_config()
        self.config["pumps"][0].update(enabled=True, threshold_percent=35, dose_ml=20,
            daily_limit_ml=100, calibration_ml=40, calibration_seconds=20)
        self.config = validate_irrigation_config(self.config)
        self.pump = self.config["pumps"][0]
        self.state = dict(moisture=20, sensor_age_seconds=10, tank_ok=True,
                          seconds_since_last=3600, used_today_ml=0)

    def test_dose_and_calibration(self):
        plan = plan_watering(self.pump, **self.state)
        self.assertTrue(plan["eligible"])
        self.assertEqual(plan["dose_ml"], 20)
        self.assertEqual(plan["duration_seconds"], 10)

    def test_guards(self):
        for changes in (
            {"moisture":35}, {"moisture":None}, {"moisture":float("nan")},
            {"moisture":True}, {"moisture":-1}, {"sensor_age_seconds":121},
            {"sensor_age_seconds":-1}, {"tank_ok":False}, {"tank_ok":None},
            {"tank_ok":1}, {"seconds_since_last":1799}, {"seconds_since_last":None},
            {"used_today_ml":81}, {"used_today_ml":None}, {"used_today_ml":-1},
        ):
            with self.subTest(changes=changes):
                self.assertFalse(plan_watering(self.pump, **{**self.state, **changes})["eligible"])

    def test_boundaries(self):
        self.assertTrue(plan_watering(self.pump, **{**self.state,
            "seconds_since_last":1800, "used_today_ml":80, "sensor_age_seconds":120})["eligible"])

    def test_disabled(self):
        self.pump["enabled"]=False
        self.assertFalse(plan_watering(self.pump, **self.state)["eligible"])

    def test_migrate_names(self):
        old={"tank_name":"Tank", "pumps":[{"id":i,"name":f"P{i}"} for i in (1,2)]}
        migrated=validate_irrigation_config(old)
        self.assertFalse(migrated["pumps"][0]["enabled"])
        self.assertIsNone(migrated["pumps"][0]["dose_ml"])
        self.assertEqual(migrated["tank_name"],"Tank")

    def test_invalid_settings(self):
        for update in ({"dose_ml":101}, {"max_run_seconds":9},
                       {"calibration_ml":0}, {"calibration_seconds":None},
                       {"threshold_percent":float("inf")}, {"enabled":"true"},
                       {"dose_ml":None}, {"pause_minutes":0}):
            with self.subTest(update=update):
                c=default_irrigation_config()
                c["pumps"][0]={**self.pump,**update}
                with self.assertRaises(ValueError):
                    validate_irrigation_config(c)

    def test_separate_pots(self):
        self.assertIsNone(self.config["pumps"][1]["dose_ml"])
        self.assertFalse(self.config["pumps"][1]["enabled"])


if __name__ == "__main__":
    unittest.main()
