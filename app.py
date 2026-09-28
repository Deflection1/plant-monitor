import asyncio
import shutil
import threading

from datetime import datetime
from time import sleep

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
    HTMLResponse
)

from fastapi.staticfiles import (
    StaticFiles
)


from sensor import read_sensors
from picamera2 import Picamera2

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

def capture_photo():

    with CAMERA_LOCK:

        timestamp = datetime.now()

        filename = (
            "plant-"
            + timestamp.strftime("%Y%m%d-%H%M%S")
            + ".jpg"
        )

        photo_path = PHOTO_DIR / filename

        camera = Picamera2()

        try:

            config = camera.create_still_configuration(
                main={
                    "size": (
                        1640,
                        1232
                    )
                }
            )

            camera.configure(
                config
            )

            camera.start()

            # Automatische Belichtung und Weißabgleich
            # kurz stabilisieren lassen.
            sleep(1.5)

            camera.capture_file(
                str(photo_path)
            )

        finally:

            with suppress(Exception):
                camera.stop()

            with suppress(Exception):
                camera.close()


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

    worker = asyncio.create_task(
        measurement_worker()
    )

    yield

    worker.cancel()

    with suppress(
        asyncio.CancelledError
    ):
        await worker


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
            bool(cameras),

        "cameras":
            cameras,

        "has_image":
            LATEST_PHOTO.exists()
    }


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
