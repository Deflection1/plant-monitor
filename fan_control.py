"""Fan configuration only: no PWM output, GPIO access or automatic regulation."""


def default_fan_config():
    return {"fans": [
        {"id": "intake", "name": "Zuluft unten", "mode": "off",
         "power_percent": 0, "minimum_percent": 0},
        {"id": "exhaust", "name": "Abluft oben", "mode": "off",
         "power_percent": 0, "minimum_percent": 0},
    ]}


def validate_fan_config(payload):
    if not isinstance(payload, dict) or set(payload) != {"fans"}:
        raise ValueError("Eine Konfiguration mit zwei Lüftern wird erwartet.")
    fans = payload["fans"]
    if not isinstance(fans, list) or len(fans) != 2:
        raise ValueError("Genau zwei Lüfter werden erwartet.")
    result = []
    for source, identity in zip(fans, ("intake", "exhaust")):
        if (not isinstance(source, dict)
                or set(source) != {"id", "name", "mode", "power_percent", "minimum_percent"}
                or source["id"] != identity):
            raise ValueError("Zuluft und Abluft müssen eindeutig zugeordnet sein.")
        name = source["name"]
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 40:
            raise ValueError("Lüfternamen müssen 1 bis 40 Zeichen enthalten.")
        if source["mode"] not in ("off", "manual"):
            raise ValueError("Nur AUS und MANUELL sind derzeit vorbereitet.")
        for key in ("power_percent", "minimum_percent"):
            if type(source[key]) is not int or not 0 <= source[key] <= 100:
                raise ValueError("Prozentwerte müssen ganze Zahlen von 0 bis 100 sein.")
        result.append({**source, "name": name.strip()})
    return {"fans": result}


def target_percent(fan):
    if fan["mode"] == "off" or fan["power_percent"] == 0:
        return 0
    return max(fan["power_percent"], fan["minimum_percent"])


def fan_status(config):
    return {
        "hardware_connected": False, "output_available": False,
        "controller": "Noctua NA-FC1", "channel_mapping": "unassigned",
        "message": "Hardware ausstehend – keine PWM-Ausgabe",
        "fans": [{"id": fan["id"], "state": "unavailable", "rpm": None,
                  "output_percent": None, "target_percent": target_percent(fan)}
                 for fan in config["fans"]],
    }
