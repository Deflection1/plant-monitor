"""Run: python -m unittest discover -s tests -v (no Raspberry Pi hardware needed).

Endpoint/worker functions are loaded from the app AST to avoid importing camera
and sensor drivers. FastAPI transport and real camera exposures need a Pi test.
"""
import ast
import asyncio
import copy
import json
import math
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
import types
import unittest
from datetime import datetime
from functools import wraps
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from configuration import atomic_write_json, next_capture_time, validate_soil_config
from lamp_profiles import normalize_lamp_config, update_lamp_profile


class HTTPException(Exception):
    def __init__(self, status_code, detail):
        self.status_code, self.detail = status_code, detail
        super().__init__(detail)


def load_functions(directory):
    wanted = {'configuration_locked', 'persist_config', 'load_timelapse_config',
              'save_timelapse_config', 'default_soil_config', 'load_soil_config',
              'save_soil_config', 'raw_to_soil_percent', 'default_lamp_config',
              'valid_clock_time', 'load_lamp_config', 'save_lamp_config',
              'lamp_config_update', 'soil_config_update', 'camera_timelapse_update',
              'timelapse_worker'}
    tree = ast.parse((ROOT / 'app.py').read_text())
    nodes = [n for n in tree.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name in wanted]
    for node in nodes:
        node.decorator_list = [d for d in node.decorator_list if isinstance(d, ast.Name) and d.id == 'configuration_locked']
    ns = dict(json=json, math=math, time=time, datetime=datetime, wraps=wraps,
              atomic_write_json=atomic_write_json, next_capture_time=next_capture_time,
              validate_soil_config=validate_soil_config, HTTPException=HTTPException,
              normalize_lamp_config=normalize_lamp_config, update_lamp_profile=update_lamp_profile,
              Body=lambda *a: None, CONFIG_LOCK=threading.RLock(),
              TIMELAPSE_DEFAULT_INTERVAL_MINUTES=720)
    for prefix in ('SOIL', 'LAMP', 'TIMELAPSE'):
        ns[prefix + '_CONFIG_FILE'] = directory / (prefix.lower() + '.json')
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(ROOT / 'app.py'), 'exec'), ns)
    for prefix in ('SOIL', 'LAMP', 'TIMELAPSE'):
        ns[prefix + '_CONFIG'] = ns['load_' + prefix.lower() + '_config']()
    return ns


class ConfigTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)
        self.ns = load_functions(self.path)

    def test_atomic_write_and_replace_failure(self):
        target = self.path / 'config.json'
        atomic_write_json(target, {'value': 1})
        for name in ('os.replace', 'os.fsync'):
            with self.subTest(name=name), patch('configuration.' + name, side_effect=OSError('disk error')):
                with self.assertRaises(OSError): atomic_write_json(target, {'value': 2})
            self.assertEqual(json.loads(target.read_text()), {'value': 1})
            self.assertEqual(list(self.path.glob('*.tmp')), [])
        with self.assertRaises(ValueError): atomic_write_json(target, {'bad': float('nan')})
        self.assertEqual(json.loads(target.read_text()), {'value': 1})

    def test_all_endpoints_keep_ram_and_file_on_write_failure(self):
        cases = [('TIMELAPSE', 'camera_timelapse_update', {'interval_minutes': 60}),
                 ('SOIL', 'soil_config_update', {'pots': [{'name': 'A'}, {'name': 'B'}]}),
                 ('LAMP', 'lamp_config_update', {'name': 'New', 'power_percent': 40})]
        for prefix, name, payload in cases:
            before = copy.deepcopy(self.ns[prefix + '_CONFIG'])
            target = self.ns[prefix + '_CONFIG_FILE']
            atomic_write_json(target, before)
            with self.subTest(config=prefix), patch('configuration.os.replace', side_effect=OSError('disk error')):
                with self.assertRaises(HTTPException) as error: self.ns[name](payload)
                self.assertEqual(error.exception.status_code, 503)
                self.assertEqual(self.ns[prefix + '_CONFIG'], before)
                self.assertEqual(json.loads(target.read_text()), before)

    def test_normal_persistence_and_reload(self):
        self.ns['camera_timelapse_update']({'enabled': True, 'interval_minutes': 360})
        self.ns['soil_config_update']({'pots': [{'name': 'A', 'dry_raw': 20000, 'wet_raw': 10000}, {}]})
        self.ns['lamp_config_update']({'name': 'Lamp', 'power_percent': 35, 'on_time': '20:00', 'off_time': '08:00'})
        fresh = load_functions(self.path)
        for prefix in ('SOIL', 'LAMP', 'TIMELAPSE'):
            self.assertEqual(fresh[prefix + '_CONFIG'], self.ns[prefix + '_CONFIG'])

    def test_invalid_soil_never_changes_config(self):
        before = copy.deepcopy(self.ns['SOIL_CONFIG'])
        bad = [{'pots': [None, {}]}, {'pots': [{}]}, {'pots': [{'dry_raw': 3, 'wet_raw': 3}, {}]}]
        bad += [{'pots': [{'dry_raw': value}, {}]} for value in ('NaN', 'Infinity', '-Infinity', True, [], {})]
        for payload in bad:
            with self.subTest(payload=payload), self.assertRaises(HTTPException) as error:
                self.ns['soil_config_update'](payload)
            self.assertEqual(error.exception.status_code, 422)
            self.assertEqual(self.ns['SOIL_CONFIG'], before)

    def test_corrupt_legacy_calibration_is_not_exposed(self):
        self.ns['SOIL_CONFIG_FILE'].write_text('{"pots":[{"dry_raw":"NaN"},{}]}')
        loaded = self.ns['load_soil_config']()
        json.dumps(loaded, allow_nan=False)
        self.assertIsNone(loaded['pots'][0]['dry_raw'])

    def test_calibration_directions_and_missing_values(self):
        calc = self.ns['raw_to_soil_percent']
        self.assertEqual(calc(15000, 20000, 10000), 50)
        self.assertEqual(calc(15000, 10000, 20000), 50)
        self.assertEqual(calc(10000, 10000, 20000), 0)
        self.assertEqual(calc(30000, 10000, 20000), 100)
        for args in [(1, 2, 2), (None, 1, 2), (float('nan'), 1, 2), (1, float('inf'), 2)]:
            self.assertIsNone(calc(*args))

    def test_deadline_changes_and_stop(self):
        with patch('time.time', return_value=1000):
            started = self.ns['camera_timelapse_update']({'enabled': True, 'interval_minutes': 720})
        self.assertEqual(started['next_capture_at'], 44200)
        with patch('time.time', return_value=2000):
            same = self.ns['camera_timelapse_update']({'interval_minutes': 720})
            changed = self.ns['camera_timelapse_update']({'interval_minutes': 360})
        self.assertEqual(same['next_capture_at'], 44200)
        self.assertEqual(changed['next_capture_at'], 23600)
        self.assertIsNone(self.ns['camera_timelapse_update']({'enabled': False})['next_capture_at'])

    def test_worker_sees_change_instead_of_old_wait(self):
        clock = [1000.0]
        captures, polls = [], []
        self.ns['time'] = types.SimpleNamespace(time=lambda: clock[0])
        self.ns['camera_timelapse_update']({'enabled': True, 'interval_minutes': 720})
        async def sleep(seconds):
            polls.append(seconds)
            if len(polls) == 1:
                self.ns['camera_timelapse_update']({'interval_minutes': 1})
                clock[0] += 60
            else:
                raise asyncio.CancelledError()
        async def to_thread(fn):
            captures.append(clock[0]); return {'filename': 'test.jpg'}
        self.ns['asyncio'] = types.SimpleNamespace(sleep=sleep, to_thread=to_thread)
        self.ns['capture_photo'] = lambda: None
        with self.assertRaises(asyncio.CancelledError): asyncio.run(self.ns['timelapse_worker']())
        self.assertEqual(captures, [1060])
        self.assertEqual(polls, [1, 1])
        self.assertEqual(self.ns['load_timelapse_config']()['next_capture_at'], 1120)

    def test_inflight_capture_does_not_overwrite_new_settings(self):
        self.ns['TIMELAPSE_CONFIG'] = {'enabled': True, 'interval_minutes': 1, 'next_capture_at': 1}
        async def sleep(seconds): raise asyncio.CancelledError()
        async def to_thread(fn):
            self.ns['camera_timelapse_update']({'enabled': False})
            return {'filename': 'test.jpg'}
        self.ns['asyncio'] = types.SimpleNamespace(sleep=sleep, to_thread=to_thread)
        self.ns['capture_photo'] = lambda: None
        with self.assertRaises(asyncio.CancelledError): asyncio.run(self.ns['timelapse_worker']())
        self.assertFalse(self.ns['TIMELAPSE_CONFIG']['enabled'])
        self.assertIsNone(self.ns['TIMELAPSE_CONFIG']['next_capture_at'])


if __name__ == '__main__': unittest.main()
