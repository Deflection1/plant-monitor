import asyncio
import shutil
import threading

from io import BufferedIOBase

from datetime import datetime

from contextlib import (
    asynccontextmanager,
    suppress
)

from pathlib import Path

from fastapi import (
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
CAMERA_LOCK = threading.Lock()

PHOTO_DIR.mkdir(
    parents=True,
    exist_ok=True
)


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


def start_camera():

    global CAMERA

    if CAMERA is not None:
        return

    camera = Picamera2()

    config = camera.create_video_configuration(
        main={
            "size": (
                1280,
                720
            ),
            "format":
                "RGB888"
        },
        controls={
            "FrameRate":
                15
        }
    )

    camera.configure(
        config
    )

    camera.start_recording(
        JpegEncoder(
            q=85
        ),
        FileOutput(
            CAMERA_OUTPUT
        )
    )

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

    with CAMERA_LOCK:

        frame = get_camera_frame()

        if frame is None:

            raise RuntimeError(
                "Kein Kameraframe verfügbar"
            )


        timestamp = datetime.now()

        filename = (
            "plant-"
            + timestamp.strftime(
                "%Y%m%d-%H%M%S"
            )
            + ".jpg"
        )

        photo_path = (
            PHOTO_DIR
            / filename
        )


        photo_path.write_bytes(
            frame
        )

        shutil.copyfile(
            photo_path,
            LATEST_PHOTO
        )


        return {
            "filename":
                filename,

            "captured_at":
                timestamp.isoformat(
                    timespec="seconds"
                ),

            "image_url":
                "/api/camera/image"
        }


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

    yield

    worker.cancel()

    with suppress(
        asyncio.CancelledError
    ):
        await worker

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
