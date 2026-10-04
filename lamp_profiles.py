"""Independent lamp profiles and explicit activation; no hardware access here."""
import copy
import re

PROFILE_IDS = ('custom', 'growth', 'flower')
FIELDS = ('schedule_enabled', 'on_time', 'off_time', 'power_percent')


def default_settings():
    return {'schedule_enabled': False, 'on_time': '08:00', 'off_time': '20:00', 'power_percent': 0}


def settings(source, fallback):
    if not isinstance(source, dict):
        raise ValueError('Ungültige Profileinstellungen')
    result = {key: source.get(key, fallback[key]) for key in FIELDS}
    if not isinstance(result['schedule_enabled'], bool):
        raise ValueError('Ungültiger Zeitplanstatus')
    for key in ('on_time', 'off_time'):
        if not isinstance(result[key], str) or not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', result[key]):
            raise ValueError('Schaltzeiten müssen HH:MM entsprechen')
    value = result['power_percent']
    if isinstance(value, bool):
        raise ValueError('Ungültige Lampenleistung')
    try:
        power = int(value)
        if float(value) != power or not 0 <= power <= 100:
            raise ValueError()
    except (TypeError, ValueError, OverflowError) as error:
        raise ValueError('Lampenleistung muss 0 bis 100 ganze Prozent betragen') from error
    result['power_percent'] = power
    return result


def normalize_lamp_config(data):
    if not isinstance(data, dict):
        raise ValueError('Ungültige Lampenkonfiguration')
    active = data.get('profile', 'custom')
    enabled = data.get('control_enabled', False)
    if not isinstance(enabled, bool):
        raise ValueError('Ungültiger Steuerungsstatus')
    if active not in PROFILE_IDS:
        raise ValueError('Ungültiges Lichtprofil')
    bank = {key: default_settings() for key in PROFILE_IDS}
    if 'profiles' in data:
        if not isinstance(data['profiles'], dict):
            raise ValueError('Ungültige Profilliste')
        for key in PROFILE_IDS:
            bank[key] = settings(data['profiles'].get(key, {}), bank[key])
    else:
        # Preserve the old single set of settings under its selected profile.
        bank[active] = settings(data, bank[active])
    return {'name': str(data.get('name', 'Pflanzenlampe'))[:40], 'profile': active, 'control_enabled': enabled,
            'profiles': bank, **bank[active]}


def update_lamp_profile(previous, payload):
    if not isinstance(payload, dict):
        raise ValueError('Ungültige Lampenkonfiguration')
    result = copy.deepcopy(normalize_lamp_config(previous))
    enabled = payload.get('control_enabled', result['control_enabled'])
    if not isinstance(enabled, bool):
        raise ValueError('Ungültiger Steuerungsstatus')
    result['control_enabled'] = enabled
    active = payload.get('profile', result['profile'])
    if active not in PROFILE_IDS:
        raise ValueError('Ungültiges Lichtprofil')
    result['profiles'][active] = settings(payload, result['profiles'][active])
    result.update(name=str(payload.get('name', result['name']))[:40], profile=active)
    result.update(result['profiles'][active])
    return result
