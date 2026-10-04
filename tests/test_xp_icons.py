"""Check dedicated XP artwork and the hooks consumed by existing status scripts."""
import re
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


class XpIconTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.template = (ROOT / 'templates/index.html').read_text()
        cls.icons = [ET.fromstring(svg) for svg in re.findall(r'<svg\b[^>]*>.*?</svg>', cls.template, re.S)]
        cls.xp = [svg for svg in cls.icons if svg.get('data-icon-theme') == 'windows-xp']

    def test_xp_coverage_and_local_gradient_references(self):
        # Every existing SVG gets its own XP counterpart, including shared navigation.
        originals = [svg for svg in self.icons if svg.get('data-icon-theme') in ('glass', 'shared')]
        cameras = self.template.count('<span data-icon-theme="glass" aria-hidden="true">📷</span>')
        self.assertEqual(len(self.xp), len(originals) + cameras)
        all_ids = re.findall(r'\bid="([^"]+)"', self.template)
        self.assertEqual(len(all_ids), len(set(all_ids)))
        for svg in self.xp:
            ids = {node.get('id') for node in svg.iter() if node.get('id')}
            refs = re.findall(r'url\(#([^)]*)\)', ET.tostring(svg).decode())
            self.assertTrue(set(refs) <= ids)
            self.assertFalse(any(node.get('fill-opacity') or node.get('stop-opacity') for node in svg.iter()))

    def test_device_state_and_animation_hooks(self):
        hooks = {'pump': 'pump-rotor', 'fan': 'fan-rotor', 'tank': 'tank-fill-full',
                 'lamp': 'grow-lamp-emitter', 'lamp-control': 'control-lamp-emitter'}
        for kind, hook in hooks.items():
            icons = [svg for svg in self.xp if svg.get('data-xp-icon') == kind]
            self.assertTrue(icons, kind)
            for svg in icons:
                self.assertTrue(any(hook in node.get('class', '').split() for node in svg.iter()), kind)
                self.assertEqual(svg.get('viewBox'), '0 0 96 96')
        for svg in [svg for svg in self.xp if svg.get('data-xp-icon') == 'tank']:
            classes = {name for node in svg.iter() for name in node.get('class', '').split()}
            self.assertTrue({'tank-fill-full','tank-wave-full','tank-fill-empty','tank-empty-mark','tank-unknown-mark'} <= classes)
        states = [svg for svg in self.xp if 'light-state-' in svg.get('class','')]
        self.assertEqual(sum('light-state-sun' in svg.get('class','') for svg in states), 3)
        self.assertEqual(sum('light-state-moon' in svg.get('class','') for svg in states), 3)

    def test_profiles_are_self_contained_xp_artwork(self):
        for profile in ('growth', 'flower'):
            svg = ET.fromstring((ROOT / 'static/windows-xp' / f'profile-{profile}.svg').read_text())
            self.assertEqual(svg.get('viewBox'), '0 0 48 48')
            self.assertFalse(any(node.get('fill-opacity') or node.get('stop-opacity') for node in svg.iter()))
            self.assertFalse(any(node.get('href','').startswith('http') for node in svg.iter()))


if __name__ == '__main__':
    unittest.main()
