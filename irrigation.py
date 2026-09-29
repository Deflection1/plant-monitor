"""Validated irrigation settings and dry-run decisions; no hardware outputs."""
import math


def pump_defaults(index):
    return {"id": index, "name": f"Pumpe Topf {index}", "enabled": False,
            "threshold_percent": None, "dose_ml": None, "pause_minutes": 30,
            "daily_limit_ml": None, "max_run_seconds": 60,
            "calibration_ml": None, "calibration_seconds": None}


def default_irrigation_config():
    return {"tank_name": "Wassertank", "pumps": [pump_defaults(i) for i in (1, 2)]}


def validate_irrigation_config(payload):
    if not isinstance(payload, dict) or set(payload) != {"tank_name", "pumps"}:
        raise ValueError("Tankname und genau zwei Pumpen werden erwartet.")

    def name(value):
        if not isinstance(value, str) or not 1 <= len(value.strip()) <= 40:
            raise ValueError("Namen müssen 1 bis 40 Zeichen enthalten.")
        return value.strip()

    pumps = payload["pumps"]
    if not isinstance(pumps, list) or len(pumps) != 2:
        raise ValueError("Genau zwei Pumpen werden erwartet.")
    result = []
    ranges = {"threshold_percent": (0, 100), "dose_ml": (0.1, 10000),
              "pause_minutes": (1, 10080), "daily_limit_ml": (0.1, 100000),
              "max_run_seconds": (1, 600), "calibration_ml": (0.1, 10000),
              "calibration_seconds": (1, 600)}
    nullable = {"threshold_percent", "dose_ml", "daily_limit_ml",
                "calibration_ml", "calibration_seconds"}
    for index, source in enumerate(pumps, 1):
        defaults = pump_defaults(index)
        if (not isinstance(source, dict) or set(source) - set(defaults)
                or type(source.get("id")) is not int or source["id"] != index
                or "name" not in source):
            raise ValueError("Pumpen müssen in der Reihenfolge 1, 2 angegeben werden.")
        p = {**defaults, **source}
        p["name"] = name(p["name"])
        if type(p["enabled"]) is not bool:
            raise ValueError("Automatik muss ein boolescher Wert sein.")
        for field, (low, high) in ranges.items():
            value = p[field]
            if value is None and field in nullable:
                continue
            if (type(value) not in (int, float) or not math.isfinite(value)
                    or not low <= value <= high):
                raise ValueError(f"Topf {index}: {field} muss zwischen {low} und {high} liegen.")
        a, b = p["calibration_ml"], p["calibration_seconds"]
        if (a is None) != (b is None):
            raise ValueError("Kalibrierung benötigt gemessene ml und Laufzeit gemeinsam.")
        if p["dose_ml"] is not None and p["daily_limit_ml"] is not None:
            if p["dose_ml"] > p["daily_limit_ml"]:
                raise ValueError("Einzelmenge darf das Tageslimit nicht überschreiten.")
        if a is not None and p["dose_ml"] is not None:
            if p["dose_ml"] * b / a > p["max_run_seconds"]:
                raise ValueError("Die berechnete Pumpdauer überschreitet die maximale Laufzeit.")
        if p["enabled"] and any(p[k] is None for k in nullable):
            raise ValueError("Für Automatik bitte Schwelle, Menge, Tageslimit und Kalibrierung ausfüllen.")
        result.append(p)
    return {"tank_name": name(payload["tank_name"]), "pumps": result}


def plan_watering(pump, *, moisture, sensor_age_seconds, tank_ok,
                  seconds_since_last, used_today_ml):
    """Pure decision for a simulation or a future controller, never pump execution.

    Real integration must supply calibrated fresh readings, persisted usage and
    cooldown state, serialize pump access, and enforce stop conditions in hardware.
    """
    def blocked(reason):
        return {"eligible": False, "reason": reason, "dose_ml": 0, "duration_seconds": 0}
    def finite(value):
        return type(value) in (int, float) and math.isfinite(value)

    if not pump["enabled"]:
        return blocked("Automatik deaktiviert")
    if tank_ok is not True:
        return blocked("Tank leer oder Status unbekannt")
    if (not finite(moisture) or not 0 <= moisture <= 100
            or not finite(sensor_age_seconds) or not 0 <= sensor_age_seconds <= 120):
        return blocked("Sensorwert fehlt, ist ungültig oder älter als 120 Sekunden")
    if (not finite(seconds_since_last) or seconds_since_last < 0
            or not finite(used_today_ml) or used_today_ml < 0):
        return blocked("Verbrauch oder letzte Bewässerung unbekannt")
    if seconds_since_last < pump["pause_minutes"] * 60:
        return blocked("Einziehpause läuft")
    if moisture >= pump["threshold_percent"]:
        return blocked("Bodenfeuchte liegt nicht unter der Schwelle")
    if used_today_ml + pump["dose_ml"] > pump["daily_limit_ml"]:
        return blocked("Tageslimit würde überschritten")
    duration = pump["dose_ml"] * pump["calibration_seconds"] / pump["calibration_ml"]
    if duration > pump["max_run_seconds"]:
        return blocked("Maximale Pumpdauer überschritten")
    return {"eligible": True, "reason": "Einzelgabe vorgesehen; danach Einziehpause und neue Messung",
            "dose_ml": pump["dose_ml"], "duration_seconds": duration}


def irrigation_status():
    return {"hardware_connected": False, "output_available": False,
            "mode": "unavailable", "tank_state": "unknown",
            "message": "Hardware ausstehend – keine Pumpenansteuerung",
            "pumps": [{"id": i, "state": "unavailable", "last_watered_at": None} for i in (1, 2)]}
