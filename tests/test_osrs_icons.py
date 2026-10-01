import re
import unittest
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


class OsrsIconTests(unittest.TestCase):
    def test_complete_pixel_icons_and_device_states(self):
        template = (ROOT / 'templates/index.html').read_text()
        svgs = [ET.fromstring(svg) for svg in re.findall(r'<svg\b[^>]*>.*?</svg>', template, re.S)]
        xp = [svg for svg in svgs if svg.get('data-icon-theme') == 'windows-xp']
        icons = [svg for svg in svgs if svg.get('data-icon-theme') == 'osrs']
        self.assertEqual(len(icons), len(xp))
        for original, icon in zip(xp, icons):
            self.assertEqual(icon.get('data-osrs-icon'), original.get('data-xp-icon'))
            self.assertEqual(icon.get('shape-rendering'), 'crispEdges')
            hooks = lambda svg: {name for node in svg.iter() for name in node.get('class','').split() if name.startswith(('tank-', 'pump-', 'fan-', 'grow-lamp-', 'control-lamp-', 'light-state-'))}
            self.assertEqual(hooks(original), hooks(icon))
            step = int(icon.get('viewBox').split()[-1]) // 16
            rects = list(icon.iter('rect'))
            self.assertTrue(rects)
            for rect in rects:
                self.assertTrue(all(int(rect.get(a)) % step == 0 for a in ('x','y','width','height')))
            self.assertFalse(list(icon.iter('linearGradient')))

    def test_profiles_are_local_pixel_art(self):
        for profile in ('growth', 'flower'):
            svg = ET.fromstring((ROOT / 'static/osrs' / f'profile-{profile}.svg').read_text())
            self.assertEqual(svg.get('shape-rendering'), 'crispEdges')
            self.assertTrue([n for n in svg.iter() if n.tag.endswith('rect')])
            self.assertFalse(any(node.get('href','').startswith('http') for node in svg.iter()))


if __name__ == '__main__':
    unittest.main()
