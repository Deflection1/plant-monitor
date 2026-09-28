import sqlite3
import time

from datetime import datetime
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "data" / "plant.db"

DB_PATH.parent.mkdir(
    parents=True,
    exist_ok=True
)


# =====================================================
# LICHT-KALIBRIERUNG
# =====================================================

# Deine Kalibrierung:
# 52.5 Lux entsprechen ungefähr
# 1 µmol/m²/s PPFD
LUX_PER_PPFD = 52.5


# Verhältnis:
# ca. 430 PPFD Pflanzenmitte
# ca. 250 PPFD Sensorposition
#
# 430 / 250 ≈ 1.72
CENTER_FACTOR = 1.72


# Ab diesem Lux-Wert gilt die Lampe als eingeschaltet.
LIGHT_ON_LUX = 100.0


# Wenn Messungen fehlen, wird nicht angenommen,
# dass die Lampe während eines langen Datenlochs
# permanent an war.
MAX_SAMPLE_GAP_SECONDS = 120


RANGES = {
    "24h": (
        24 * 60 * 60,
        60
    ),

    "7d": (
        7 * 24 * 60 * 60,
        10 * 60
    ),

    "30d": (
        30 * 24 * 60 * 60,
        60 * 60
    ),

    "1y": (
        365 * 24 * 60 * 60,
        24 * 60 * 60
    ),
}


def get_connection():

    connection = sqlite3.connect(
        DB_PATH
    )

    connection.row_factory = sqlite3.Row

    return connection


def init_db():

    with get_connection() as db:

        db.execute("""
            CREATE TABLE IF NOT EXISTS measurements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp INTEGER NOT NULL,
                temperature REAL,
                humidity REAL,
                vpd REAL,
                lux REAL,
                raw_temperature REAL,
                raw_humidity REAL,
                cpu_temperature REAL
            )
        """)

        columns = {
            row["name"]
            for row in db.execute(
                "PRAGMA table_info(measurements)"
            ).fetchall()
        }

        for column in (
            "soil_raw_1",
            "soil_raw_2",
            "soil_moisture_1",
            "soil_moisture_2"
        ):

            if column not in columns:

                db.execute(
                    "ALTER TABLE measurements "
                    "ADD COLUMN "
                    + column
                    + " REAL"
                )


        db.execute("""
            CREATE INDEX IF NOT EXISTS
            idx_measurements_timestamp
            ON measurements(timestamp)
        """)

        db.commit()


def insert_measurement(data):

    timestamp = int(
        time.time()
    )

    with get_connection() as db:

        db.execute("""
            INSERT INTO measurements (
                timestamp,
                temperature,
                humidity,
                vpd,
                lux,
                raw_temperature,
                raw_humidity,
                cpu_temperature,
                soil_raw_1,
                soil_raw_2,
                soil_moisture_1,
                soil_moisture_2
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            timestamp,

            data.get(
                "temperature"
            ),

            data.get(
                "humidity"
            ),

            data.get(
                "vpd"
            ),

            data.get(
                "lux"
            ),

            data.get(
                "raw_temperature"
            ),

            data.get(
                "raw_humidity"
            ),

            data.get(
                "cpu_temperature"
            ),

            data.get(
                "soil_raw_1"
            ),

            data.get(
                "soil_raw_2"
            ),

            data.get(
                "soil_moisture_1"
            ),

            data.get(
                "soil_moisture_2"
            )
        ))

        db.commit()


def get_history(
    range_name="24h"
):

    if range_name not in RANGES:
        range_name = "24h"

    seconds, bucket_size = (
        RANGES[range_name]
    )

    cutoff = (
        int(time.time())
        - seconds
    )

    with get_connection() as db:

        rows = db.execute("""
            SELECT

                CAST(
                    timestamp / ?
                    AS INTEGER
                ) * ? AS timestamp,

                AVG(temperature)
                    AS temperature,

                AVG(humidity)
                    AS humidity,

                AVG(vpd)
                    AS vpd,

                AVG(lux)
                    AS lux,

                AVG(soil_moisture_1)
                    AS soil_moisture_1,

                AVG(soil_moisture_2)
                    AS soil_moisture_2

            FROM measurements

            WHERE timestamp >= ?

            GROUP BY
                CAST(
                    timestamp / ?
                    AS INTEGER
                )

            ORDER BY timestamp ASC
        """, (
            bucket_size,
            bucket_size,
            cutoff,
            bucket_size
        )).fetchall()


    return [
        {
            "timestamp":
                row["timestamp"],

            "temperature":
                round(
                    row["temperature"],
                    2
                )
                if row["temperature"]
                is not None
                else None,

            "humidity":
                round(
                    row["humidity"],
                    2
                )
                if row["humidity"]
                is not None
                else None,

            "vpd":
                round(
                    row["vpd"],
                    3
                )
                if row["vpd"]
                is not None
                else None,

            "lux":
                round(
                    row["lux"],
                    1
                )
                if row["lux"]
                is not None
                else None,

            "soil_moisture_1":
                round(
                    row["soil_moisture_1"],
                    1
                )
                if row["soil_moisture_1"]
                is not None
                else None,

            "soil_moisture_2":
                round(
                    row["soil_moisture_2"],
                    1
                )
                if row["soil_moisture_2"]
                is not None
                else None
        }

        for row in rows
    ]


# =====================================================
# LICHT
# =====================================================

def lux_to_ppfd(lux):

    if lux is None:
        return 0.0

    lux = max(
        0.0,
        float(lux)
    )

    return (
        lux
        / LUX_PER_PPFD
    )


def lux_to_center_ppfd(lux):

    return (
        lux_to_ppfd(lux)
        * CENTER_FACTOR
    )


def get_light_today():

    now = datetime.now().astimezone()

    start_of_day = now.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0
    )

    start_timestamp = int(
        start_of_day.timestamp()
    )

    now_timestamp = int(
        time.time()
    )


    with get_connection() as db:

        rows = db.execute("""
            SELECT
                timestamp,
                lux

            FROM measurements

            WHERE timestamp >= ?

            ORDER BY timestamp ASC
        """, (
            start_timestamp,
        )).fetchall()


    if not rows:

        return {
            "light_on_seconds": 0,

            "dli_sensor": 0.0,

            "dli_center": 0.0,

            "max_lux": 0.0,

            "max_ppfd_sensor": 0.0,

            "max_ppfd_center": 0.0,

            "samples": 0
        }


    light_on_seconds = 0

    dli_sensor = 0.0

    dli_center = 0.0


    lux_values = []


    for index, row in enumerate(rows):

        timestamp = int(
            row["timestamp"]
        )

        lux = float(
            row["lux"] or 0.0
        )

        lux = max(
            0.0,
            lux
        )

        lux_values.append(
            lux
        )


        if index + 1 < len(rows):

            next_timestamp = int(
                rows[index + 1][
                    "timestamp"
                ]
            )

        else:

            next_timestamp = (
                now_timestamp
            )


        interval = (
            next_timestamp
            - timestamp
        )


        if interval < 0:
            interval = 0


        interval = min(
            interval,
            MAX_SAMPLE_GAP_SECONDS
        )


        if lux >= LIGHT_ON_LUX:

            light_on_seconds += (
                interval
            )


        sensor_ppfd = (
            lux_to_ppfd(
                lux
            )
        )

        center_ppfd = (
            sensor_ppfd
            * CENTER_FACTOR
        )


        # PPFD × Sekunden / 1.000.000
        # ergibt mol/m²
        dli_sensor += (
            sensor_ppfd
            * interval
            / 1_000_000
        )

        dli_center += (
            center_ppfd
            * interval
            / 1_000_000
        )


    max_lux = max(
        lux_values
    )


    max_ppfd_sensor = (
        lux_to_ppfd(
            max_lux
        )
    )

    max_ppfd_center = (
        max_ppfd_sensor
        * CENTER_FACTOR
    )


    return {

        "light_on_seconds":
            int(
                light_on_seconds
            ),

        "dli_sensor":
            round(
                dli_sensor,
                2
            ),

        "dli_center":
            round(
                dli_center,
                2
            ),

        "max_lux":
            round(
                max_lux,
                1
            ),

        "max_ppfd_sensor":
            round(
                max_ppfd_sensor,
                1
            ),

        "max_ppfd_center":
            round(
                max_ppfd_center,
                1
            ),

        "samples":
            len(rows)
    }
