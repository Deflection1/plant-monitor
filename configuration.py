"""Hardware-independent configuration validation and atomic persistence."""
import json
import math
import os
import tempfile
from pathlib import Path


def atomic_write_json(path, config):
    """Replace a config only after a complete, flushed write in the same directory."""
    payload = json.dumps(config, indent=2, ensure_ascii=False, allow_nan=False)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                         prefix="." + path.name + ".", suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        # Directory sync improves durability across power loss on Linux. Once
        # replace succeeds, a sync limitation must not report a rolled-back save.
        try:
            directory = os.open(path.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
        except OSError as error:
            print("Konfiguration gespeichert; Verzeichnis-Sync nicht verfügbar:", error)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def next_capture_time(previous, enabled, interval, now):
    """A changed interval starts now; unchanged settings retain the saved deadline."""
    if not enabled:
        return None
    if previous.get("enabled") and previous.get("interval_minutes") == interval:
        due = previous.get("next_capture_at")
        if isinstance(due, (int, float)) and not isinstance(due, bool) and math.isfinite(due) and due > 0:
            return due
    return now + interval * 60


def validate_soil_config(payload):
    if not isinstance(payload, dict):
        raise ValueError("Ungültige Bodenfeuchte-Konfiguration")
    pots = payload.get("pots")
    if not isinstance(pots, list) or len(pots) != 2:
        raise ValueError("Genau zwei Topf-Konfigurationen erwartet")
    result = []
    for index, source in enumerate(pots):
        if not isinstance(source, dict):
            raise ValueError("Jede Topf-Konfiguration muss ein Objekt sein")
        pot = {"id": index + 1, "channel": "A" + str(index),
               "name": str(source.get("name", "Topf " + str(index + 1)))[:40]}
        for key in ("dry_raw", "wet_raw"):
            value = source.get(key)
            if value is None or value == "":
                pot[key] = None
                continue
            try:
                if isinstance(value, bool):
                    raise ValueError()
                value = float(value)
                if not math.isfinite(value):
                    raise ValueError()
            except (TypeError, ValueError, OverflowError) as error:
                raise ValueError("Topf %s: Ungültiger Kalibrierwert %s" % (index + 1, key)) from error
            pot[key] = value
        if pot["dry_raw"] is not None and pot["dry_raw"] == pot["wet_raw"]:
            raise ValueError("Topf %s: Trocken- und Nasswert müssen verschieden sein" % (index + 1))
        result.append(pot)
    return {"pots": result}
