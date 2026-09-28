const $ = (id) =>
    document.getElementById(id);


let historyRange = "24h";


let temperatureChart;
let humidityChart;
let vpdChart;
let luxChart;

let photoHistory = [];
let timelapsePlaying = false;
let timelapseTimer = null;
let timelapseIndex = 0;


// =====================================================
// FORMAT
// =====================================================

function number(
    value,
    decimals = 1
) {

    if (
        value === null ||
        value === undefined
    ) {
        return "--";
    }

    return Number(
        value
    ).toFixed(
        decimals
    );
}


function formatDuration(
    seconds
) {

    seconds = Number(
        seconds || 0
    );


    const hours = Math.floor(
        seconds / 3600
    );


    const minutes = Math.floor(
        (
            seconds % 3600
        )
        / 60
    );


    return (
        String(hours).padStart(
            2,
            "0"
        )
        +
        " h "
        +
        String(minutes).padStart(
            2,
            "0"
        )
        +
        " min"
    );
}


// =====================================================
// AKTUELLE SENSORWERTE
// =====================================================

async function loadCurrent() {

    try {

        const response = await fetch(
            "/api/current",
            {
                cache: "no-store"
            }
        );


        if (!response.ok) {

            throw new Error(
                "HTTP "
                + response.status
            );
        }


        const data =
            await response.json();


        $("temperature").textContent =
            number(
                data.temperature
            );


        $("humidity").textContent =
            number(
                data.humidity
            );


        $("vpd").textContent =
            number(
                data.vpd,
                2
            );


        $("lux").textContent =
            Math.round(
                data.lux || 0
            );


        $("cpuTemperature").textContent =
            number(
                data.cpu_temperature
            );


        $("rawTemperature").textContent =
            number(
                data.raw_temperature
            );


        $("rawHumidity").textContent =
            number(
                data.raw_humidity
            );


        $("lastUpdate").textContent =
            new Date()
            .toLocaleTimeString(
                "de-CH"
            );


        // PPFD

        $("ppfdSensor").textContent =
            number(
                data.ppfd_sensor,
                1
            );


        $("ppfdCenter").textContent =
            number(
                data.ppfd_center,
                1
            );


        // LICHT AN / AUS

        if (data.light_on) {

            $("lightStatus").textContent =
                "Beleuchtung aktiv";


            $("lightText").textContent =
                "An";


            $("lightIcon").textContent =
                "☀️";

        } else {

            $("lightStatus").textContent =
                "Beleuchtung aus";


            $("lightText").textContent =
                "Aus";


            $("lightIcon").textContent =
                "🌙";
        }


        $("lightValue").textContent =
            Math.round(
                data.lux || 0
            )
            +
            " Lux";


        // KLIMA

        $("climateState").textContent =

            number(
                data.temperature
            )

            + " °C · "

            + number(
                data.humidity
            )

            + " % RH · "

            + number(
                data.vpd,
                2
            )

            + " kPa VPD";


        $("systemStatus").innerHTML =

            '<span class="status-dot"></span>'

            +
            '<span>Online</span>';


    } catch (error) {

        console.error(
            "Current API error:",
            error
        );


        $("systemStatus").innerHTML =

            "<span>🔴</span>"

            +
            "<span>Offline</span>";
    }
}


// =====================================================
// LICHT HEUTE
// =====================================================

async function loadLightToday() {

    try {

        const response = await fetch(
            "/api/light/today",
            {
                cache: "no-store"
            }
        );


        if (!response.ok) {

            throw new Error(
                "HTTP "
                + response.status
            );
        }


        const data =
            await response.json();


        $("lightDuration").textContent =
            formatDuration(
                data.light_on_seconds
            );


        $("dliToday").textContent =
            number(
                data.dli_center,
                2
            );


        $("lightMax").textContent =
            Math.round(
                data.max_lux || 0
            );


        $("ppfdMaxCenter").textContent =
            number(
                data.max_ppfd_center,
                1
            );


    } catch (error) {

        console.error(
            "Light today API error:",
            error
        );
    }
}


// =====================================================
// CHART OPTIONS
// =====================================================

function chartOptions(
    unit
) {

    return {

        responsive: true,

        maintainAspectRatio: false,


        plugins: {

            legend: {
                display: false
            },


            tooltip: {

                callbacks: {

                    label:
                        function(
                            context
                        ) {

                            return (
                                context
                                .parsed
                                .y

                                + " "

                                + unit
                            );
                        }
                }
            }
        },


        scales: {

            x: {

                ticks: {

                    color:
                        "#89988e",

                    maxTicksLimit:
                        8
                },


                grid: {

                    color:
                        "rgba(255,255,255,0.03)"
                }
            },


            y: {

                ticks: {

                    color:
                        "#89988e"
                },


                grid: {

                    color:
                        "rgba(255,255,255,0.05)"
                }
            }
        }
    };
}


// =====================================================
// CHART ERSTELLEN
// =====================================================

function makeChart(
    id,
    unit,
    color
) {

    return new Chart(

        $(id),

        {

            type:
                "line",


            data: {

                labels: [],


                datasets: [{

                    data: [],

                    borderColor:
                        color,

                    backgroundColor:
                        color,

                    borderWidth:
                        2,

                    pointRadius:
                        2,

                    pointHoverRadius:
                        5,

                    tension:
                        0.25,

                    fill:
                        false
                }]
            },


            options:
                chartOptions(
                    unit
                )
        }
    );
}


function createCharts() {

    temperatureChart =
        makeChart(
            "temperatureChart",
            "°C",
            "#67d391"
        );


    humidityChart =
        makeChart(
            "humidityChart",
            "%",
            "#6ebce4"
        );


    vpdChart =
        makeChart(
            "vpdChart",
            "kPa",
            "#e8bd6c"
        );


    luxChart =
        makeChart(
            "luxChart",
            "Lux",
            "#f1dc78"
        );
}


// =====================================================
// ZEITACHSE
// =====================================================

function formatTime(
    timestamp
) {

    const date =
        new Date(
            timestamp
            * 1000
        );


    if (
        historyRange
        === "24h"
    ) {

        return date
            .toLocaleTimeString(
                "de-CH",
                {
                    hour:
                        "2-digit",

                    minute:
                        "2-digit"
                }
            );
    }


    return date
        .toLocaleDateString(
            "de-CH",
            {
                day:
                    "2-digit",

                month:
                    "2-digit"
            }
        );
}


// =====================================================
// HISTORY
// =====================================================

async function loadHistory() {

    try {

        const response =
            await fetch(

                "/api/history?range="
                + historyRange,

                {
                    cache:
                        "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                "HTTP "
                + response.status
            );
        }


        const result =
            await response.json();


        const points =
            result.points || [];


        const labels =
            points.map(
                function(point) {

                    return formatTime(
                        point.timestamp
                    );
                }
            );


        temperatureChart
            .data
            .labels =
                labels;


        temperatureChart
            .data
            .datasets[0]
            .data =
                points.map(
                    function(point) {

                        return (
                            point.temperature
                        );
                    }
                );


        humidityChart
            .data
            .labels =
                labels;


        humidityChart
            .data
            .datasets[0]
            .data =
                points.map(
                    function(point) {

                        return (
                            point.humidity
                        );
                    }
                );


        vpdChart
            .data
            .labels =
                labels;


        vpdChart
            .data
            .datasets[0]
            .data =
                points.map(
                    function(point) {

                        return (
                            point.vpd
                        );
                    }
                );


        luxChart
            .data
            .labels =
                labels;


        luxChart
            .data
            .datasets[0]
            .data =
                points.map(
                    function(point) {

                        return (
                            point.lux
                        );
                    }
                );


        temperatureChart.update();

        humidityChart.update();

        vpdChart.update();

        luxChart.update();


    } catch (error) {

        console.error(
            "History API error:",
            error
        );
    }
}


// =====================================================
// ZEITRAUM BUTTONS
// =====================================================

function setupRangeButtons() {

    document
        .querySelectorAll(
            ".range"
        )
        .forEach(
            function(button) {


                button.addEventListener(
                    "click",
                    function() {


                        document
                            .querySelectorAll(
                                ".range"
                            )
                            .forEach(
                                function(item) {

                                    item.classList.remove(
                                        "active"
                                    );
                                }
                            );


                        button.classList.add(
                            "active"
                        );


                        const value =
                            button
                            .textContent
                            .trim();


                        if (
                            value === "24h"
                        ) {

                            historyRange =
                                "24h";

                        } else if (
                            value ===
                            "7 Tage"
                        ) {

                            historyRange =
                                "7d";

                        } else if (
                            value ===
                            "30 Tage"
                        ) {

                            historyRange =
                                "30d";

                        } else {

                            historyRange =
                                "1y";
                        }


                        loadHistory();
                    }
                );
            }
        );
}


// =====================================================
// KAMERA
// =====================================================

function showCameraStream() {

    const image =
        $("cameraImage");

    const empty =
        $("cameraEmpty");

    image.src =
        "/api/camera/stream?t="
        + Date.now();

    image.hidden =
        false;

    empty.hidden =
        true;

    $("fullscreenButton").disabled =
        false;
}


async function loadCameraStatus() {

    try {

        const response = await fetch(
            "/api/camera/status",
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                "HTTP "
                + response.status
            );
        }

        const data =
            await response.json();

        if (!data.available) {

            $("captureButton").disabled =
                true;

            $("cameraMessage").textContent =
                "Keine Kamera erkannt.";

            $("cameraMeta").textContent =
                "Kamera offline";

            return;
        }

        $("captureButton").disabled =
            false;

        const camera =
            (
                data.cameras
                && data.cameras.length
            )
                ? data.cameras[0]
                : null;

        $("cameraMeta").textContent =
            camera
                ? (
                    "LIVE · "
                    + (
                        camera.Model
                        || "Kamera"
                    )
                    + " · 1280×720 · 15 fps"
                )
                : "LIVE";

        showCameraStream();

    } catch (error) {

        console.error(
            "Camera status error:",
            error
        );

        $("captureButton").disabled =
            true;

        $("cameraMessage").textContent =
            "Kamerastatus konnte nicht geladen werden.";

        $("cameraMeta").textContent =
            "Kamera offline";
    }
}


async function capturePhoto() {

    const button =
        $("captureButton");

    button.disabled =
        true;

    button.textContent =
        "⏳ Speichern …";

    $("cameraMeta").textContent =
        "Aktuellen Frame speichern …";

    try {

        const response = await fetch(
            "/api/camera/capture",
            {
                method: "POST",
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                "HTTP "
                + response.status
            );
        }

        const data =
            await response.json();

        $("cameraMeta").textContent =
            "LIVE · Foto gespeichert "
            + new Date(
                data.captured_at
            )
            .toLocaleTimeString(
                "de-CH",
                {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                }
            );

    } catch (error) {

        console.error(
            "Camera capture error:",
            error
        );

        $("cameraMeta").textContent =
            "Aufnahme fehlgeschlagen";

    } finally {

        button.disabled =
            false;

        button.textContent =
            "📷 Foto aufnehmen";
    }
}


function setupCamera() {

    $("captureButton")
        .addEventListener(
            "click",
            capturePhoto
        );

    $("fullscreenButton")
        .addEventListener(
            "click",
            function() {

                const image =
                    $("cameraImage");

                if (
                    image
                    && image.requestFullscreen
                ) {
                    image.requestFullscreen();
                }
            }
        );

    loadCameraStatus();
}


// =====================================================
// FOTO-HISTORY / ZEITRAFFER
// =====================================================

function formatPhotoDate(
    value
) {

    return new Date(
        value
    ).toLocaleString(
        "de-CH",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


async function loadPhotoHistory() {

    try {

        const response = await fetch(
            "/api/camera/photos?limit=200",
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                "HTTP "
                + response.status
            );
        }

        const data =
            await response.json();

        photoHistory =
            data.photos || [];

        const grid =
            $("photoGrid");

        grid.innerHTML =
            "";

        $("photoHistoryEmpty").hidden =
            photoHistory.length > 0;


        photoHistory.forEach(
            function(photo) {

                const item =
                    document.createElement(
                        "button"
                    );

                item.className =
                    "photo-thumb";

                item.innerHTML =
                    '<img loading="lazy" src="'
                    + photo.url
                    + '" alt="Pflanzenfoto">'
                    + '<span>'
                    + formatPhotoDate(
                        photo.captured_at
                    )
                    + '</span>';

                item.addEventListener(
                    "click",
                    function() {

                        window.open(
                            photo.url,
                            "_blank"
                        );
                    }
                );

                grid.appendChild(
                    item
                );
            }
        );

    } catch (error) {

        console.error(
            "Photo history error:",
            error
        );
    }
}


async function loadTimelapseStatus() {

    try {

        const response = await fetch(
            "/api/camera/timelapse",
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                "HTTP "
                + response.status
            );
        }

        const data =
            await response.json();

        $("timelapseInterval").value =
            String(
                data.interval_minutes
                || 30
            );

        $("timelapseToggleButton").textContent =
            data.enabled
                ? "Zeitraffer stoppen"
                : "Zeitraffer starten";

        $("timelapseStatus").textContent =
            data.enabled
                ? (
                    "Aktiv · alle "
                    + data.interval_minutes
                    + " min · "
                    + data.photo_count
                    + " Bilder"
                )
                : (
                    "Aus · "
                    + data.photo_count
                    + " Bilder gespeichert"
                );

    } catch (error) {

        console.error(
            "Timelapse status error:",
            error
        );
    }
}


async function toggleTimelapse() {

    const statusResponse =
        await fetch(
            "/api/camera/timelapse",
            {
                cache: "no-store"
            }
        );

    const status =
        await statusResponse.json();

    const enabled =
        !status.enabled;

    const interval =
        Number(
            $("timelapseInterval").value
        );

    const response = await fetch(
        "/api/camera/timelapse",
        {
            method: "POST",
            headers: {
                "Content-Type":
                    "application/json"
            },
            body: JSON.stringify({
                enabled:
                    enabled,

                interval_minutes:
                    interval
            })
        }
    );

    if (!response.ok) {
        throw new Error(
            "HTTP "
            + response.status
        );
    }

    await loadTimelapseStatus();
}


function stopTimelapsePlayback() {

    timelapsePlaying =
        false;

    if (timelapseTimer) {

        clearInterval(
            timelapseTimer
        );

        timelapseTimer =
            null;
    }

    $("timelapsePlayer").hidden =
        true;
}


function playTimelapse() {

    if (
        !photoHistory
        || photoHistory.length < 2
    ) {

        $("timelapseStatus").textContent =
            "Für die Wiedergabe werden mindestens 2 Bilder benötigt.";

        return;
    }


    stopTimelapsePlayback();

    const frames =
        [...photoHistory].reverse();

    timelapsePlaying =
        true;

    timelapseIndex =
        0;

    $("timelapsePlayer").hidden =
        false;


    function showFrame() {

        const photo =
            frames[
                timelapseIndex
            ];

        $("timelapseImage").src =
            photo.url;

        $("timelapsePlayerDate").textContent =
            formatPhotoDate(
                photo.captured_at
            );

        timelapseIndex +=
            1;

        if (
            timelapseIndex
            >= frames.length
        ) {
            timelapseIndex =
                0;
        }
    }


    showFrame();

    timelapseTimer =
        setInterval(
            showFrame,
            350
        );
}


function openPhotoHistory() {

    $("photoHistoryPanel").hidden =
        false;

    loadPhotoHistory();

    loadTimelapseStatus();

    $("photoHistoryPanel")
        .scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
}


function setupPhotoHistory() {

    $("galleryButton")
        .addEventListener(
            "click",
            openPhotoHistory
        );

    $("timelapseButton")
        .addEventListener(
            "click",
            openPhotoHistory
        );

    $("closePhotoHistoryButton")
        .addEventListener(
            "click",
            function() {

                stopTimelapsePlayback();

                $("photoHistoryPanel").hidden =
                    true;
            }
        );

    $("timelapseToggleButton")
        .addEventListener(
            "click",
            async function() {

                try {

                    await toggleTimelapse();

                } catch (error) {

                    console.error(
                        "Timelapse toggle error:",
                        error
                    );

                    $("timelapseStatus").textContent =
                        "Zeitraffer konnte nicht geändert werden.";
                }
            }
        );

    $("timelapseInterval")
        .addEventListener(
            "change",
            async function() {

                const response = await fetch(
                    "/api/camera/timelapse",
                    {
                        cache: "no-store"
                    }
                );

                const status =
                    await response.json();

                if (!status.enabled) {
                    return;
                }

                await fetch(
                    "/api/camera/timelapse",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json"
                        },
                        body: JSON.stringify({
                            enabled:
                                true,

                            interval_minutes:
                                Number(
                                    $("timelapseInterval").value
                                )
                        })
                    }
                );

                loadTimelapseStatus();
            }
        );

    $("timelapsePlayButton")
        .addEventListener(
            "click",
            async function() {

                await loadPhotoHistory();

                playTimelapse();
            }
        );

    $("timelapseStopButton")
        .addEventListener(
            "click",
            stopTimelapsePlayback
        );
}


// =====================================================
// START
// =====================================================

document.addEventListener(

    "DOMContentLoaded",

    function() {

        console.log(
            "Plant Monitor JS gestartet"
        );


        loadCurrent();

        loadLightToday();

        setupCamera();

        setupPhotoHistory();


        createCharts();

        setupRangeButtons();

        loadHistory();


        // Livewerte alle 5 Sekunden
        setInterval(
            loadCurrent,
            5000
        );


        // Tageslichtdaten jede Minute
        setInterval(
            loadLightToday,
            60000
        );


        // Charts jede Minute
        setInterval(
            loadHistory,
            60000
        );
    }
);
