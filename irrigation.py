"""Display configuration only; this module never accesses pump hardware."""


def default_irrigation_config():
    return {"tank_name": "Wassertank", "pumps": [
        {"id": 1, "name": "Pumpe Topf 1"},
        {"id": 2, "name": "Pumpe Topf 2"},
    ]}


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
    for index, pump in enumerate(pumps, 1):
        if (not isinstance(pump, dict) or set(pump) != {"id", "name"}
                or type(pump["id"]) is not int or pump["id"] != index):
            raise ValueError("Pumpen müssen in der Reihenfolge 1, 2 angegeben werden.")
        result.append({"id": index, "name": name(pump["name"])})
    return {"tank_name": name(payload["tank_name"]), "pumps": result}


def irrigation_status():
    return {
        "hardware_connected": False,
        "output_available": False,
        "mode": "unavailable",
        "tank_state": "unknown",
        "message": "Hardware ausstehend – keine Pumpenansteuerung",
        "pumps": [{"id": i, "state": "unavailable", "last_watered_at": None}
                  for i in (1, 2)],
    }
