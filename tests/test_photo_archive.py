import ast
import tempfile
import unittest
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
from photo_archive import photo_variant

ROOT = Path(__file__).resolve().parents[1]


class PhotoArchiveTests(unittest.TestCase):
    def test_variants_cache_and_original(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "plant-test.jpg"
            Image.new("RGB", (3280, 2464), "green").save(source)
            original = source.read_bytes()
            with ThreadPoolExecutor(max_workers=4) as pool:
                paths = list(pool.map(lambda _: photo_variant(directory, source.name, "thumb"), range(4)))
            self.assertEqual(len(set(paths)), 1)
            with Image.open(paths[0]) as image:
                self.assertEqual(image.width, 320)
                self.assertLess(image.height, 320)
            modified = paths[0].stat().st_mtime_ns
            self.assertEqual(photo_variant(directory, source.name, "thumb").stat().st_mtime_ns, modified)
            preview = photo_variant(directory, source.name, "preview")
            with Image.open(preview) as image:
                self.assertEqual(image.width, 960)
            self.assertEqual(source.read_bytes(), original)
            source.touch()
            self.assertNotEqual(photo_variant(directory, source.name, "thumb"), paths[0])

    def test_invalid_paths_variants_and_missing(self):
        with tempfile.TemporaryDirectory() as directory:
            for filename in ("../plant-test.jpg", "plant-x/../plant-test.jpg", "plant-x\\test.jpg", "latest.jpg"):
                with self.assertRaises(ValueError):
                    photo_variant(directory, filename, "thumb")
            with self.assertRaises(ValueError):
                photo_variant(directory, "plant-test.jpg", "huge")
            with self.assertRaises(FileNotFoundError):
                photo_variant(directory, "plant-missing.jpg", "thumb")

    def test_archive_pagination_keeps_count_and_variant_urls(self):
        with tempfile.TemporaryDirectory() as directory:
            paths = []
            for i in range(38):
                path = Path(directory) / f"plant-{i}.jpg"
                path.write_bytes(b"test")
                paths.append(path)
            tree = ast.parse((ROOT / "app.py").read_text())
            nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in {"photo_info", "camera_photos"}]
            for node in nodes:
                node.decorator_list = []
            ns = {"datetime": datetime, "Query": lambda **kwargs: kwargs["default"], "photo_files": lambda: paths}
            exec(compile(ast.Module(body=nodes, type_ignores=[]), "app.py", "exec"), ns)
            pages = [ns["camera_photos"](limit=12, offset=offset) for offset in (0, 12, 24, 36)]
            self.assertEqual([len(page["photos"]) for page in pages], [12, 12, 12, 2])
            self.assertEqual([page["count"] for page in pages], [38] * 4)
            self.assertEqual(len({photo["filename"] for page in pages for photo in page["photos"]}), 38)
            self.assertTrue(pages[0]["photos"][0]["thumbnail_url"].endswith("/thumb"))
            self.assertTrue(pages[0]["photos"][0]["preview_url"].endswith("/preview"))
