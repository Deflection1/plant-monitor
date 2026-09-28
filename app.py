import asyncio
import json
import shutil
import threading

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
from picamera2 import Picamera2
from picamera2.encoders import JpegEncoder
from picamera2.outputs import FileOutput

from database import (
    init_db,
    insert_measurement,
    get_history,
    get_light_today,
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
TIMELAPSE_DEFAULT_INTERVAL_MINUTES = 720

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

def load_timelapse_config():

    default = {
        "enabled":
            False,

        "interval_minutes":
            TIMELAPSE_DEFAULT_INTERVAL_MINUTES
    }

    if not TIMELAPSE_CONFIG_FILE.exists():
        return default

    try:

        data = json.loads(
            TIMELAPSE_CONFIG_FILE.read_text()
        )

        interval = int(
            data.get(
                "interval_minutes",
                TIMELAPSE_DEFAULT_INTERVAL_MINUTES
            )
        )

        return {
            "enabled":
                bool(
                    data.get(
                        "enabled",
                        False
                    )
                ),

            "interval_minutes":
                max(
                    1,
                    interval
                )
        }

    except Exception:

        return default


def save_timelapse_config(
    config
):

    TIMELAPSE_CONFIG_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    TIMELAPSE_CONFIG_FILE.write_text(
        json.dumps(
            config,
            indent=2
        )
    )


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
                "dry_raw": None,
                "wet_raw": None
            },
            {
                "id": 2,
                "name": "Topf 2",
                "channel": "A1",
                "dry_raw": None,
                "wet_raw": None
            }
        ]
    }


def load_soil_config():

    default = default_soil_config()

    if not SOIL_CONFIG_FILE.exists():
        return default

    try:

        data = json.loads(
            SOIL_CONFIG_FILE.read_text()
        )

        pots = data.get(
            "pots",
            []
        )

        if len(pots) != 2:
            return default

        result = default_soil_config()

        for index in range(2):

            source = pots[index]
            target = result["pots"][index]

            target["name"] = str(
                source.get(
                    "name",
                    target["name"]
                )
            )[:40]

            for key in (
                "dry_raw",
                "wet_raw"
            ):

                value = source.get(key)

                if value is None:
                    target[key] = None

                else:
                    target[key] = float(value)

        return result

    except Exception:

        return default


def save_soil_config(
    config
):

    SOIL_CONFIG_FILE.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    SOIL_CONFIG_FILE.write_text(
        json.dumps(
            config,
            indent=2
        )
    )


SOIL_CONFIG = load_soil_config()


def raw_to_soil_percent(
    raw_value,
    dry_raw,
    wet_raw
):

    if (
        raw_value is None
        or dry_raw is None
        or wet_raw is None
        or dry_raw == wet_raw
    ):
        return None

    value = (
        (
            float(raw_value)
            - float(dry_raw)
        )
        /
        (
            float(wet_raw)
            - float(dry_raw)
        )
        * 100.0
    )

    return round(
        max(
            0.0,
            min(
                100.0,
                value
            )
        ),
        1
    )


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

    while True:

        config = TIMELAPSE_CONFIG.copy()

        if not config.get(
            "enabled",
            False
        ):

            await asyncio.sleep(
                5
            )

            continue


        interval_seconds = max(
            60,
            int(
                config.get(
                    "interval_minutes",
                    TIMELAPSE_DEFAULT_INTERVAL_MINUTES
                )
            )
            * 60
        )


        await asyncio.sleep(
            interval_seconds
        )


        if not TIMELAPSE_CONFIG.get(
            "enabled",
            False
        ):
            continue


        try:

            result = await asyncio.to_thread(
                capture_photo
            )

            print(
                "Zeitraffer-Foto gespeichert:",
                result["filename"]
            )

        except Exception as error:

            print(
                "Zeitraffer-Fehler:",
                error
            )


# =====================================================
# LICHTWERTE ERWEITERN
# =====================================================

def add_light_values(data):

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

    yield

    worker.cancel()
    timelapse_task.cancel()

    with suppress(
        asyncio.CancelledError
    ):
        await worker

    with suppress(
        asyncio.CancelledError
    ):
        await timelapse_task

    await asyncio.to_thread(
        stop_camera
    )


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


# =====================================================
# AKTUELLE WERTE
# =====================================================

@app.get(
    "/api/current"
)
def current():

    data = read_sensors()

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
    )
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
                for path in files[:limit]
            ]
    }


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
def camera_timelapse_update(
    payload: dict = Body(...)
):

    enabled = bool(
        payload.get(
            "enabled",
            TIMELAPSE_CONFIG.get(
                "enabled",
                False
            )
        )
    )

    try:

        interval = int(
            payload.get(
                "interval_minutes",
                TIMELAPSE_CONFIG.get(
                    "interval_minutes",
                    TIMELAPSE_DEFAULT_INTERVAL_MINUTES
                )
            )
        )

    except (
        TypeError,
        ValueError
    ):

        interval = (
            TIMELAPSE_DEFAULT_INTERVAL_MINUTES
        )


    interval = max(
        1,
        min(
            interval,
            10080
        )
    )


    TIMELAPSE_CONFIG.update({
        "enabled":
            enabled,

        "interval_minutes":
            interval
    })


    save_timelapse_config(
        TIMELAPSE_CONFIG
    )


    return {
        "status":
            "ok",

        **TIMELAPSE_CONFIG
    }



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
def soil_config_update(
    payload: dict = Body(...)
):

    pots = payload.get(
        "pots"
    )

    if (
        not isinstance(
            pots,
            list
        )
        or len(pots) != 2
    ):

        return {
            "status":
                "error",

            "message":
                "Genau zwei Topf-Konfigurationen erwartet"
        }


    updated = default_soil_config()


    for index in range(2):

        source = pots[index]
        target = updated[
            "pots"
        ][index]

        target["name"] = str(
            source.get(
                "name",
                target["name"]
            )
        )[:40]


        for key in (
            "dry_raw",
            "wet_raw"
        ):

            value = source.get(
                key
            )

            if (
                value is None
                or value == ""
            ):

                target[key] = None

            else:

                try:

                    target[key] = float(
                        value
                    )

                except (
                    TypeError,
                    ValueError
                ):

                    return {
                        "status":
                            "error",

                        "message":
                            (
                                "Ungültiger Kalibrierwert "
                                + key
                            )
                    }


    SOIL_CONFIG.clear()

    SOIL_CONFIG.update(
        updated
    )

    save_soil_config(
        SOIL_CONFIG
    )


    return {
        "status":
            "ok",

        **SOIL_CONFIG
    }


@app.get(
    "/api/soil/status"
)
def soil_status():

    data = add_soil_values(
        read_sensors()
    )

    return {
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
