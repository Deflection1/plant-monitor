import asyncio
import json
import math
import time
from functools import wraps
from configuration import atomic_write_json, next_capture_time, validate_soil_config
from lamp_profiles import normalize_lamp_config, update_lamp_profile
from lamp_control import LampController
from tank_switch import TankSwitch
from irrigation import default_irrigation_config, validate_irrigation_config, irrigation_status, plan_watering
from fan_control import default_fan_config, validate_fan_config, fan_status
import shutil
import threading
from photo_archive import photo_variant

from io import BufferedIOBase

from datetime import datetime
from time import sleep

from contextlib import (
    asynccontextmanager,
    suppress
)

from pathlib import Path

from fastapi import (
    Body,
    FastAPI,
    HTTPException,
    Query
)

from fastapi.responses import (
    FileResponse,
    HTMLResponse,
    StreamingResponse
)

from fastapi.staticfiles import (
    StaticFiles
)


from sensor import read_sensors
from soil_sensor import read_soil
from picamera2 import Picamera2
from picamera2.encoders import JpegEncoder
from picamera2.outputs import FileOutput

from database import (
    init_db,
    insert_measurement,
    get_history,
    get_light_today,
    get_watering_history,
    lux_to_ppfd,
    CENTER_FACTOR,
    LIGHT_ON_LUX,
    LUX_PER_PPFD
)


BASE_DIR = (
    Path(__file__)
    .resolve()
    .parent
)

PHOTO_DIR = BASE_DIR / "photos"
LATEST_PHOTO = PHOTO_DIR / "latest.jpg"
TIMELAPSE_CONFIG_FILE = BASE_DIR / "data" / "timelapse.json"
SOIL_CONFIG_FILE = BASE_DIR / "data" / "soil_moisture.json"
FAN_CONFIG_FILE = BASE_DIR / "data" / "fan_control.json"
IRRIGATION_CONFIG_FILE = BASE_DIR / "data" / "irrigation.json"
LAMP_CONFIG_FILE = BASE_DIR / "data" / "lamp_control.json"
TIMELAPSE_DEFAULT_INTERVAL_MINUTES = 720
CONFIG_LOCK = threading.RLock()

CAMERA_STREAM_SIZE = (1280, 720)
CAMERA_PHOTO_SIZE = (3280, 2464)
CAMERA_STREAM_FPS = 15
CAMERA_LOCK = threading.Lock()

PHOTO_DIR.mkdir(
    parents=True,
    exist_ok=True
)


# =====================================================
# FOTO-HISTORY / ZEITRAFFER KONFIGURATION
# =====================================================

def configuration_locked(function):
    @wraps(function)
    def locked(*args, **kwargs):
        with CONFIG_LOCK:
            return function(*args, **kwargs)
    return locked


def persist_config(path, config):
    try:
        atomic_write_json(path, config)
    except (OSError, ValueError) as error:
        print("Konfiguration konnte nicht gespeichert werden:", error)
        raise HTTPException(
            status_code=503,
            detail="Speichern fehlgeschlagen. Bisherige Einstellungen bleiben aktiv."
        ) from error




def load_fan_config():
    try:
        return validate_fan_config(json.loads(FAN_CONFIG_FILE.read_text()))
    except FileNotFoundError:
        return default_fan_config()
    except (OSError, ValueError) as error:
        print("Lüfterkonfiguration nicht lesbar:", error)
        return default_fan_config()


FAN_CONFIG = load_fan_config()


def load_irrigation_config():
    try:
        return validate_irrigation_config(json.loads(IRRIGATION_CONFIG_FILE.read_text()))
    except FileNotFoundError:
        return default_irrigation_config()
    except (OSError, ValueError) as error:
        print("Bewässerungskonfiguration nicht lesbar:", error)
        return default_irrigation_config()


IRRIGATION_CONFIG = load_irrigation_config()


def load_timelapse_config():
    default = {"enabled": False, "interval_minutes": TIMELAPSE_DEFAULT_INTERVAL_MINUTES,
               "next_capture_at": None}
    if not TIMELAPSE_CONFIG_FILE.exists():
        return default
    try:
        data = json.loads(TIMELAPSE_CONFIG_FILE.read_text())
        if not isinstance(data, dict) or not isinstance(data.get("enabled", False), bool):
            return default
        interval = int(data.get("interval_minutes", TIMELAPSE_DEFAULT_INTERVAL_MINUTES))
        if not 1 <= interval <= 10080:
            return default
        enabled = data.get("enabled", False)
        due = data.get("next_capture_at")
        if not isinstance(due, (int, float)) or isinstance(due, bool) or not math.isfinite(due) or due <= 0:
            due = None
        return {"enabled": enabled, "interval_minutes": interval,
                "next_capture_at": due if enabled else None}
    except (OSError, ValueError, TypeError, OverflowError):
        return default


def save_timelapse_config(config):
    persist_config(TIMELAPSE_CONFIG_FILE, config)


TIMELAPSE_CONFIG = load_timelapse_config()


def photo_files():

    return sorted(
        [
            path
            for path in PHOTO_DIR.glob(
                "plant-*.jpg"
            )
            if path.is_file()
        ],
        key=lambda path:
            path.stat().st_mtime,
        reverse=True
    )


def photo_info(
    path
):

    stat = path.stat()

    return {
        "filename":
            path.name,

        "captured_at":
            datetime.fromtimestamp(
                stat.st_mtime
            ).isoformat(
                timespec="seconds"
            ),

        "size_bytes":
            stat.st_size,

        "thumbnail_url": f"/api/camera/photos/{path.name}/thumb",
        "preview_url": f"/api/camera/photos/{path.name}/preview",

        "url":
            (
                "/api/camera/photos/"
                + path.name
            )
    }


# =====================================================
# BODENFEUCHTE KONFIGURATION
# =====================================================

def default_soil_config():

    return {
        "pots": [
            {
                "id": 1,
                "name": "Topf 1",
                "channel": "A0",
                "dry_raw": 17670,
                "wet_raw": 3143
            },
            {
                "id": 2,
                "name": "Topf 2",
                "channel": "A1",
                "dry_raw": 18359,
                "wet_raw": 2892
            }
        ]
    }


def load_soil_config():
    if not SOIL_CONFIG_FILE.exists():
        return default_soil_config()
    try:
        return validate_soil_config(json.loads(SOIL_CONFIG_FILE.read_text()))
    except (OSError, ValueError, TypeError) as error:
        print("Ungültige Bodenfeuchte-Konfiguration:", error)
        config = default_soil_config()
        for pot in config["pots"]:
            pot["dry_raw"] = None
            pot["wet_raw"] = None
        return config


def save_soil_config(config):
    persist_config(SOIL_CONFIG_FILE, config)


SOIL_CONFIG = load_soil_config()


def raw_to_soil_percent(raw_value, dry_raw, wet_raw):
    try:
        raw, dry, wet = float(raw_value), float(dry_raw), float(wet_raw)
    except (TypeError, ValueError, OverflowError):
        return None
    if not all(math.isfinite(value) for value in (raw, dry, wet)) or dry == wet:
        return None
    value = (raw - dry) / (wet - dry) * 100.0
    if not math.isfinite(value):
        return None
    return round(max(0.0, min(100.0, value)), 1)


def add_soil_values(
    data
):

    data.setdefault(
        "soil_raw_1",
        None
    )

    data.setdefault(
        "soil_raw_2",
        None
    )

    for index in range(2):

        number = index + 1

        pot = SOIL_CONFIG[
            "pots"
        ][index]

        data[
            "soil_moisture_"
            + str(number)
        ] = raw_to_soil_percent(
            data.get(
                "soil_raw_"
                + str(number)
            ),
            pot.get(
                "dry_raw"
            ),
            pot.get(
                "wet_raw"
            )
        )

    return data


# =====================================================
# LAMPENSTEUERUNG KONFIGURATION
# =====================================================

def default_lamp_config():
    return normalize_lamp_config({})


def valid_clock_time(
    value
):

    try:

        datetime.strptime(
            str(value),
            "%H:%M"
        )

        return True

    except (
        TypeError,
        ValueError
    ):

        return False


def load_lamp_config():
    if not LAMP_CONFIG_FILE.exists():
        return default_lamp_config()
    try:
        return normalize_lamp_config(json.loads(LAMP_CONFIG_FILE.read_text()))
    except (OSError, ValueError, TypeError) as error:
        print("Ungültige Lampenkonfiguration:", error)
        return default_lamp_config()


def save_lamp_config(config):
    persist_config(LAMP_CONFIG_FILE, config)


LAMP_CONFIG = load_lamp_config()
LAMP_CONTROLLER = LampController(BASE_DIR / "data" / "gp8600-test.lock")
TANK_SWITCH = TankSwitch()


async def tank_worker(stop):
    while not stop.is_set():
        await asyncio.to_thread(TANK_SWITCH.sample)
        try:
            await asyncio.wait_for(stop.wait(), timeout=0.1)
        except asyncio.TimeoutError:
            pass



@configuration_locked
def apply_lamp_output():
    return LAMP_CONTROLLER.apply(LAMP_CONFIG)


@configuration_locked
def close_lamp_output():
    LAMP_CONTROLLER.close()


async def lamp_worker(stop):
    while not stop.is_set():
        await asyncio.to_thread(apply_lamp_output)
        try:
            await asyncio.wait_for(stop.wait(), timeout=1)
        except asyncio.TimeoutError:
            pass


# =====================================================
# KAMERA
# =====================================================

class StreamingOutput(BufferedIOBase):

    def __init__(self):

        self.frame = None
        self.condition = threading.Condition()


    def write(
        self,
        buf
    ):

        frame = bytes(buf)

        with self.condition:

            self.frame = frame
            self.condition.notify_all()

        return len(buf)


CAMERA = None
CAMERA_OUTPUT = StreamingOutput()
CAMERA_LOCK = threading.Lock()


def start_camera_stream(camera):

    config = camera.create_video_configuration(
        main={
            "size": CAMERA_STREAM_SIZE,
            "format": "RGB888"
        },
        controls={
            "FrameRate": CAMERA_STREAM_FPS
        }
    )

    camera.configure(config)

    camera.start_recording(
        JpegEncoder(q=85),
        FileOutput(CAMERA_OUTPUT)
    )


def start_camera():

    global CAMERA

    if CAMERA is not None:
        return

    camera = Picamera2()

    start_camera_stream(camera)

    CAMERA = camera

    print(
        "Kamera-Livestream gestartet"
    )


def stop_camera():

    global CAMERA

    if CAMERA is None:
        return

    with suppress(Exception):
        CAMERA.stop_recording()

    with suppress(Exception):
        CAMERA.close()

    CAMERA = None


def get_camera_frame(
    wait=True
):

    with CAMERA_OUTPUT.condition:

        if (
            wait
            or CAMERA_OUTPUT.frame is None
        ):
            CAMERA_OUTPUT.condition.wait(
                timeout=2
            )

        return CAMERA_OUTPUT.frame


def mjpeg_stream():

    while True:

        frame = get_camera_frame()

        if frame is None:
            continue

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n"
            b"Cache-Control: no-cache\r\n\r\n"
            + frame
            + b"\r\n"
        )


def capture_photo():

    if CAMERA is None:
        raise RuntimeError(
            "Kamera ist nicht gestartet"
        )

    with CAMERA_LOCK:

        timestamp = datetime.now()

        filename = (
            "plant-"
            + timestamp.strftime(
                "%Y%m%d-%H%M%S"
            )
            + ".jpg"
        )

        photo_path = PHOTO_DIR / filename

        # Gespeicherte Fotos werden in voller IMX219-Auflösung
        # aufgenommen. Der 720p-Livestream pausiert dafür kurz.
        CAMERA.stop_recording()

        try:

            still_config = CAMERA.create_still_configuration(
                main={
                    "size": CAMERA_PHOTO_SIZE,
                    "format": "RGB888"
                }
            )

            CAMERA.configure(still_config)
            CAMERA.start()

            # AE/AWB nach dem Moduswechsel kurz stabilisieren.
            sleep(1.0)

            CAMERA.capture_file(
                str(photo_path)
            )

        finally:

            with suppress(Exception):
                CAMERA.stop()

            start_camera_stream(
                CAMERA
            )

        shutil.copyfile(
            photo_path,
            LATEST_PHOTO
        )

        return {
            "filename": filename,
            "captured_at": timestamp.isoformat(
                timespec="seconds"
            ),
            "width": CAMERA_PHOTO_SIZE[0],
            "height": CAMERA_PHOTO_SIZE[1],
            "image_url": "/api/camera/image"
        }


async def timelapse_worker():
    global TIMELAPSE_CONFIG
    retry_after = 0.0
    retry_schedule = None
    while True:
        try:
            with CONFIG_LOCK:
                config = TIMELAPSE_CONFIG.copy()
                if config["enabled"] and config.get("next_capture_at") is None:
                    # Migrate older configurations once, then keep the deadline across restarts.
                    config["next_capture_at"] = time.time() + config["interval_minutes"] * 60
                    save_timelapse_config(config)
                    TIMELAPSE_CONFIG = config
            due = config.get("next_capture_at")
            schedule = (config["enabled"], config["interval_minutes"], due)
            if schedule != retry_schedule:
                retry_after = 0.0
            if config["enabled"] and due is not None and time.time() >= max(due, retry_after):
                # Recheck immediately before starting. An exposure already in progress can finish.
                with CONFIG_LOCK:
                    unchanged = TIMELAPSE_CONFIG == config
                if unchanged:
                    try:
                        result = await asyncio.to_thread(capture_photo)
                        print("Zeitraffer-Foto gespeichert:", result["filename"])
                    finally:
                        # On camera or disk errors, avoid a rapid retry loop.
                        retry_schedule = schedule
                        retry_after = time.time() + 60
                    with CONFIG_LOCK:
                        if TIMELAPSE_CONFIG == config:
                            updated = {**config, "next_capture_at": time.time() + config["interval_minutes"] * 60}
                            save_timelapse_config(updated)
                            TIMELAPSE_CONFIG = updated
        except Exception as error:
            print("Zeitraffer-Fehler:", error)
        # Re-read settings at least once per second instead of sleeping for hours.
        await asyncio.sleep(1)


# =====================================================
# LICHTWERTE ERWEITERN
# =====================================================

def add_light_values(data):

    if data.get("lux") is None:
        data.update(ppfd_sensor=None, ppfd_center=None, light_on=None)
        return data

    lux = float(
        data.get(
            "lux",
            0
        )
        or 0
    )

    ppfd_sensor = (
        lux_to_ppfd(
            lux
        )
    )

    ppfd_center = (
        ppfd_sensor
        * CENTER_FACTOR
    )


    data["ppfd_sensor"] = round(
        ppfd_sensor,
        1
    )

    data["ppfd_center"] = round(
        ppfd_center,
        1
    )

    data["light_on"] = (
        lux >= LIGHT_ON_LUX
    )

    return data


# =====================================================
# MESS-WORKER
# =====================================================

async def measurement_worker():

    # Sensor nach Start kurz stabilisieren
    await asyncio.sleep(5)


    for _ in range(5):

        try:

            await asyncio.to_thread(
                read_sensors
            )

        except Exception as error:

            print(
                "Warmup-Fehler:",
                error
            )

        await asyncio.sleep(1)


    print(
        "Sensor-Warmup abgeschlossen"
    )


    while True:

        try:

            data = await asyncio.to_thread(
                read_sensors
            )

            data = add_soil_values(
                data
            )

            insert_measurement(
                data
            )

            print(
                "Messung gespeichert:",
                data
            )

        except Exception as error:

            print(
                "Fehler beim Speichern:",
                error
            )


        await asyncio.sleep(60)


# =====================================================
# LIFESPAN
# =====================================================

@asynccontextmanager
async def lifespan(
    app: FastAPI
):

    init_db()
    await asyncio.to_thread(TANK_SWITCH.sample)
    tank_stop = asyncio.Event()
    tank_task = asyncio.create_task(tank_worker(tank_stop))
    await asyncio.to_thread(apply_lamp_output)
    lamp_stop = asyncio.Event()
    lamp_task = asyncio.create_task(lamp_worker(lamp_stop))

    try:

        await asyncio.to_thread(
            start_camera
        )

    except Exception as error:

        print(
            "Kamera-Startfehler:",
            error
        )


    worker = asyncio.create_task(
        measurement_worker()
    )

    timelapse_task = asyncio.create_task(
        timelapse_worker()
    )

    try:
        yield
    finally:
        tank_stop.set()
        await tank_task
        await asyncio.to_thread(TANK_SWITCH.close)
        lamp_stop.set()
        try:
            await lamp_task
        finally:
            await asyncio.to_thread(close_lamp_output)
            worker.cancel()
            timelapse_task.cancel()
            with suppress(asyncio.CancelledError):
                await worker
            with suppress(asyncio.CancelledError):
                await timelapse_task
            await asyncio.to_thread(stop_camera)


# =====================================================
# FASTAPI
# =====================================================

app = FastAPI(
    title="Pflanzenschrank",
    lifespan=lifespan
)


app.mount(
    "/static",

    StaticFiles(
        directory=
            BASE_DIR / "static"
    ),

    name="static"
)


# =====================================================
# WEBSEITE
# =====================================================

@app.get(
    "/",
    response_class=HTMLResponse
)
def index():

    return (
        BASE_DIR
        / "templates"
        / "index.html"
    ).read_text()


# =====================================================
# STATUS
# =====================================================

@app.get(
    "/api/status"
)
def status():

    return {
        "status":
            "online",

        "message":
            "Pflanzenschrank läuft"
    }


def read_available_sensors():
    try:
        return read_sensors()
    except (OSError, ValueError, ImportError) as error:
        print("Umgebungssensor nicht verfügbar:", error)
        raise HTTPException(
            status_code=503,
            detail="SEN0501 nicht erreichbar oder Messwerte ungültig."
        ) from error


# =====================================================
# AKTUELLE WERTE
# =====================================================

@app.get(
    "/api/current"
)
def current():

    try:
        data = read_available_sensors()
        data["environment_available"] = True
        data["environment_error"] = None
    except HTTPException as error:
        if error.status_code != 503:
            raise
        # Soil ADC is independent of the climate sensor. Do not turn missing
        # light measurements into zero lux or report the lamp as off.
        data = {key: None for key in (
            "temperature", "humidity", "vpd", "lux", "pressure_hpa",
            "uv_raw", "uv_mw_cm2", "cpu_temperature")}
        data.update(read_soil())
        data.update(environment_available=False, environment_error=error.detail,
                    sensor_model="SEN0501 V2.0", uv_saturated=False)

    data = add_soil_values(
        data
    )

    return add_light_values(
        data
    )


# =====================================================
# HISTORY
# =====================================================

@app.get(
    "/api/history"
)
def history(
    range_name: str = Query(
        default="24h",
        alias="range"
    )
):

    return {
        "range":
            range_name,

        "points":
            get_history(
                range_name
            )
    }


# =====================================================
# LICHT HEUTE
# =====================================================

@app.get(
    "/api/light/today"
)
def light_today():

    stats = get_light_today()

    stats.update({

        "light_on_threshold_lux":
            LIGHT_ON_LUX,

        "lux_per_ppfd":
            LUX_PER_PPFD,

        "center_factor":
            CENTER_FACTOR,

        "uncertainty_percent":
            20
    })

    return stats




# Display-only preparation. No GPIO, scheduler or watering execution endpoints.
@app.get("/api/fans/config")
@configuration_locked
def fans_config():
    return FAN_CONFIG


@app.post("/api/fans/config")
@configuration_locked
def fans_config_update(payload: dict = Body(...)):
    global FAN_CONFIG
    try:
        updated = validate_fan_config(payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    persist_config(FAN_CONFIG_FILE, updated)
    FAN_CONFIG = updated
    return {"status": "ok", **updated}


@app.get("/api/fans/status")
@configuration_locked
def fans_status():
    return fan_status(FAN_CONFIG)


@app.get("/api/irrigation/config")
@configuration_locked
def irrigation_config():
    return IRRIGATION_CONFIG


@app.post("/api/irrigation/config")
@configuration_locked
def irrigation_config_update(payload: dict = Body(...)):
    global IRRIGATION_CONFIG
    try:
        updated = validate_irrigation_config(payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    persist_config(IRRIGATION_CONFIG_FILE, updated)
    IRRIGATION_CONFIG = updated
    return {"status": "ok", **updated}


@app.post("/api/irrigation/preview")
@configuration_locked
def irrigation_preview(payload: dict = Body(...)):
    """Explicit dry-run only. Never sends commands to pump hardware."""
    pot_id = payload.get("pot_id")
    if type(pot_id) is not int or pot_id not in (1, 2):
        raise HTTPException(status_code=422, detail="Topf 1 oder 2 erwartet.")
    decision = plan_watering(
        IRRIGATION_CONFIG["pumps"][pot_id - 1],
        moisture=payload.get("moisture"),
        sensor_age_seconds=payload.get("sensor_age_seconds"),
        tank_ok=payload.get("tank_ok"),
        seconds_since_last=payload.get("seconds_since_last"),
        used_today_ml=payload.get("used_today_ml"),
    )
    return {"simulation": True, "output_available": False, **decision}


@app.get("/api/irrigation/history")
def irrigation_history_read():
    return get_watering_history()


@app.get("/api/irrigation/status")
def irrigation_status_read():
    tank = TANK_SWITCH.status()
    return {**irrigation_status(), "tank_state": tank["tank_state"],
            "tank_ok": tank["tank_ok"], "tank_sensor": tank}


@app.get("/api/tank/status")
def tank_status_read():
    return TANK_SWITCH.status()


# =====================================================
# LAMPENSTEUERUNG API
# =====================================================

@app.get(
    "/api/light/config"
)
def lamp_config():

    return LAMP_CONFIG


@app.post(
    "/api/light/config"
)
@configuration_locked
def lamp_config_update(payload: dict = Body(...)):
    global LAMP_CONFIG
    try:
        updated = update_lamp_profile(LAMP_CONFIG, payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    save_lamp_config(updated)
    LAMP_CONFIG = updated
    output = LAMP_CONTROLLER.apply(LAMP_CONFIG, reset_fault=True)
    return {"status": "ok", **LAMP_CONFIG, "output_state": output}


@app.get(
    "/api/light/status"
)
@configuration_locked
def lamp_status():
    return LAMP_CONTROLLER.status(LAMP_CONFIG)


# =====================================================
# KAMERA API
# =====================================================

@app.get(
    "/api/camera/status"
)
def camera_status():

    cameras = Picamera2.global_camera_info()

    return {
        "available":
            CAMERA is not None
            and bool(cameras),

        "streaming":
            CAMERA is not None,

        "cameras":
            cameras,

        "has_image":
            LATEST_PHOTO.exists()
    }


@app.get(
    "/api/camera/stream"
)
def camera_stream():

    if CAMERA is None:

        return {
            "available":
                False,

            "message":
                "Kamera ist nicht gestartet"
        }


    return StreamingResponse(
        mjpeg_stream(),
        media_type=(
            "multipart/x-mixed-replace;"
            " boundary=frame"
        ),
        headers={
            "Cache-Control":
                "no-store, no-cache, must-revalidate"
        }
    )


@app.get(
    "/api/camera/image"
)
def camera_image():

    if not LATEST_PHOTO.exists():

        return {
            "available":
                False,

            "message":
                "Noch kein Kamerabild vorhanden"
        }


    return FileResponse(
        LATEST_PHOTO,
        media_type="image/jpeg",
        headers={
            "Cache-Control":
                "no-store, no-cache, must-revalidate"
        }
    )


@app.post(
    "/api/camera/capture"
)
async def camera_capture():

    result = await asyncio.to_thread(
        capture_photo
    )

    return {
        "status":
            "ok",

        **result
    }



# =====================================================
# FOTO-HISTORY / ZEITRAFFER API
# =====================================================

@app.get(
    "/api/camera/photos"
)
def camera_photos(
    limit: int = Query(
        default=100,
        ge=1,
        le=1000
    ),
    offset: int = Query(default=0, ge=0)
):

    files = photo_files()

    return {
        "count":
            len(files),

        "photos":
            [
                photo_info(
                    path
                )
                for path in files[offset:offset + limit]
            ]
    }


@app.get("/api/camera/photos/{filename}/{variant}")
def camera_photo_variant(filename: str, variant: str):
    try:
        path = photo_variant(PHOTO_DIR, filename, variant)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Bild nicht gefunden") from error
    except OSError as error:
        raise HTTPException(status_code=503, detail="Vorschau konnte nicht geladen werden") from error
    return FileResponse(path, media_type="image/jpeg",
                        headers={"Cache-Control": "private, max-age=86400"})


@app.get(
    "/api/camera/photos/{filename}"
)
def camera_photo(
    filename: str
):

    if (
        "/" in filename
        or "\\" in filename
        or not filename.startswith(
            "plant-"
        )
        or not filename.endswith(
            ".jpg"
        )
    ):

        return {
            "available":
                False,

            "message":
                "Ungültiger Dateiname"
        }


    path = (
        PHOTO_DIR
        / filename
    )


    if not path.exists():

        return {
            "available":
                False,

            "message":
                "Bild nicht gefunden"
        }


    return FileResponse(
        path,
        media_type="image/jpeg",
        headers={
            "Cache-Control":
                "private, max-age=31536000"
        }
    )


@app.get(
    "/api/camera/timelapse"
)
def camera_timelapse_status():

    return {
        **TIMELAPSE_CONFIG,

        "photo_count":
            len(
                photo_files()
            )
    }


@app.post(
    "/api/camera/timelapse"
)
@configuration_locked
def camera_timelapse_update(payload: dict = Body(...)):
    global TIMELAPSE_CONFIG
    enabled = payload.get("enabled", TIMELAPSE_CONFIG["enabled"])
    value = payload.get("interval_minutes", TIMELAPSE_CONFIG["interval_minutes"])
    if not isinstance(enabled, bool) or isinstance(value, bool):
        raise HTTPException(status_code=422, detail="Ungültige Zeitraffer-Einstellung")
    try:
        interval = int(value)
        if float(value) != interval or not 1 <= interval <= 10080:
            raise ValueError()
    except (ValueError, TypeError, OverflowError) as error:
        raise HTTPException(status_code=422, detail="Intervall muss 1 bis 10080 ganze Minuten betragen") from error
    updated = {"enabled": enabled, "interval_minutes": interval,
               "next_capture_at": next_capture_time(TIMELAPSE_CONFIG, enabled, interval, time.time())}
    save_timelapse_config(updated)
    TIMELAPSE_CONFIG = updated
    return {"status": "ok", **TIMELAPSE_CONFIG}



# =====================================================
# BODENFEUCHTE API
# =====================================================

@app.get(
    "/api/soil/config"
)
def soil_config():

    return SOIL_CONFIG


@app.post(
    "/api/soil/config"
)
@configuration_locked
def soil_config_update(payload: dict = Body(...)):
    global SOIL_CONFIG
    try:
        updated = validate_soil_config(payload)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    save_soil_config(updated)
    SOIL_CONFIG = updated
    return {"status": "ok", **SOIL_CONFIG}


@app.get(
    "/api/soil/status"
)
def soil_status():

    data = add_soil_values(
        read_soil()
    )

    return {
        "adc": {"connected": data["soil_adc_connected"],
                "bus": data["soil_adc_bus"], "address": data["soil_adc_address"],
                "error": data["soil_adc_error"]},
        "connected":
            (
                data.get(
                    "soil_raw_1"
                )
                is not None
                or data.get(
                    "soil_raw_2"
                )
                is not None
            ),

        "pots": [
            {
                **SOIL_CONFIG[
                    "pots"
                ][0],
                "voltage": data.get("soil_voltage_1"),

                "raw":
                    data.get(
                        "soil_raw_1"
                    ),

                "moisture_percent":
                    data.get(
                        "soil_moisture_1"
                    )
            },
            {
                **SOIL_CONFIG[
                    "pots"
                ][1],
                "voltage": data.get("soil_voltage_2"),

                "raw":
                    data.get(
                        "soil_raw_2"
                    ),

                "moisture_percent":
                    data.get(
                        "soil_moisture_2"
                    )
            }
        ]
    }



