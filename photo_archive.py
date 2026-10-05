"""Cached JPEG variants; originals are never modified."""
import os
from pathlib import Path
from threading import Lock
from PIL import Image, ImageOps

VARIANT_WIDTHS = {"thumb": 320, "preview": 960}
_resize_lock = Lock()


def photo_variant(photo_dir, filename, variant):
    if (Path(filename).name != filename or "\\" in filename
            or not filename.startswith("plant-") or not filename.endswith(".jpg")):
        raise ValueError("Ungültiger Dateiname")
    if variant not in VARIANT_WIDTHS:
        raise ValueError("Ungültige Bildgröße")
    source = Path(photo_dir) / filename
    if not source.is_file():
        raise FileNotFoundError(filename)
    stat = source.stat()
    cache = Path(photo_dir) / ".cache" / variant
    target = cache / f"{source.stem}-{stat.st_mtime_ns}-{stat.st_size}.jpg"
    # Serialize first-time conversions to avoid decoding many originals at once.
    with _resize_lock:
        if not target.is_file():
            cache.mkdir(parents=True, exist_ok=True)
            temporary = target.with_suffix(".tmp")
            try:
                with Image.open(source) as image:
                    image.draft("RGB", (VARIANT_WIDTHS[variant], VARIANT_WIDTHS[variant]))
                    image = ImageOps.exif_transpose(image)
                    image.thumbnail((VARIANT_WIDTHS[variant], VARIANT_WIDTHS[variant]), Image.Resampling.LANCZOS)
                    image.convert("RGB").save(temporary, format="JPEG", quality=78)
                os.replace(temporary, target)
            finally:
                temporary.unlink(missing_ok=True)
    return target
