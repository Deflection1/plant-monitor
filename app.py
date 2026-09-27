import asyncio

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
    HTMLResponse
)

from fastapi.staticfiles import (
    StaticFiles
)


from sensor import read_sensors

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
