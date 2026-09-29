const $ = (id) =>
    document.getElementById(id);


let historyRange = "24h";


let temperatureChart;
let humidityChart;
let vpdChart;
let luxChart;
let soilMoisture1Chart;
let soilMoisture2Chart;

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
// LICHTSTATUS ICONS
// =====================================================

function setLightStateIcons(
    isOn
) {

    document
        .querySelectorAll(
            ".js-light-state-icon"
        )
        .forEach(
            function(icon) {

                icon.dataset.state =
                    isOn
                        ? "on"
                        : "off";
            }
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


        $("soilMoisture1").textContent =
            number(
                data.soil_moisture_1,
                1
            );

        $("soilMoisture2").textContent =
            number(
                data.soil_moisture_2,
                1
            );

        $("soilRaw1").textContent =
            data.soil_raw_1 === null
            || data.soil_raw_1 === undefined
                ? "--"
                : number(
                    data.soil_raw_1,
                    0
                );

        $("soilRaw2").textContent =
            data.soil_raw_2 === null
            || data.soil_raw_2 === undefined
                ? "--"
                : number(
                    data.soil_raw_2,
                    0
                );

        $("soilStatus").textContent =
            (
                data.soil_raw_1 !== null
                && data.soil_raw_1 !== undefined
            )
            || (
                data.soil_raw_2 !== null
                && data.soil_raw_2 !== undefined
            )
                ? "Sensoren verbunden"
                : "Hardware ausstehend";


        $("lastUpdate").textContent =
            new Date()
            .toLocaleTimeString(
                "de-CH"
            );


        window.dispatchEvent(new CustomEvent("plant:current", {detail: data}));

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


            setLightStateIcons(
                true
            );

        } else {

            $("lightStatus").textContent =
                "Beleuchtung aus";


            $("lightText").textContent =
                "Aus";


            setLightStateIcons(
                false
            );
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


        window.dispatchEvent(new Event("plant:offline"));

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


    soilMoisture1Chart =
        makeChart(
            "soilMoisture1Chart",
            "%",
            "#74c69d"
        );


    soilMoisture2Chart =
        makeChart(
            "soilMoisture2Chart",
            "%",
            "#95d5b2"
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


        soilMoisture1Chart
            .data
            .labels =
                labels;

        soilMoisture1Chart
            .data
            .datasets[0]
            .data =
                points.map(
                    function(point) {

                        return (
                            point.soil_moisture_1
                        );
                    }
                );


        soilMoisture2Chart
            .data
            .labels =
                labels;

        soilMoisture2Chart
            .data
            .datasets[0]
            .data =
                points.map(
                    function(point) {

                        return (
                            point.soil_moisture_2
                        );
                    }
                );


        temperatureChart.update();

        humidityChart.update();

        vpdChart.update();

        luxChart.update();

        soilMoisture1Chart.update();

        soilMoisture2Chart.update();


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
// BODENFEUCHTE
// =====================================================

function soilInputValue(
    value
) {

    return (
        value === null
        || value === undefined
    )
        ? ""
        : String(value);
}


async function loadSoilConfig() {

    try {

        const response = await fetch(
            "/api/soil/config",
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

        const pots =
            data.pots || [];

        window.dispatchEvent(new CustomEvent("plant:pots", {detail: pots}));

        if (pots.length !== 2) {
            return;
        }


        $("soilName1").textContent =
            pots[0].name;

        $("soilName2").textContent =
            pots[1].name;

        $("soilNameInput1").value =
            pots[0].name;

        $("soilNameInput2").value =
            pots[1].name;

        $("soilDry1").value =
            soilInputValue(
                pots[0].dry_raw
            );

        $("soilWet1").value =
            soilInputValue(
                pots[0].wet_raw
            );

        $("soilDry2").value =
            soilInputValue(
                pots[1].dry_raw
            );

        $("soilWet2").value =
            soilInputValue(
                pots[1].wet_raw
            );


        const calibrated =
            pots.every(
                function(pot) {

                    return (
                        Number.isFinite(pot.dry_raw)
                        && Number.isFinite(pot.wet_raw)
                        && pot.dry_raw !== pot.wet_raw
                    );
                }
            );

        $("soilConfigMessage").textContent =
            calibrated
                ? "Kalibrierung gespeichert"
                : "Kalibrierung noch unvollständig";

    } catch (error) {

        console.error(
            "Soil config error:",
            error
        );

        $("soilConfigMessage").textContent =
            "Konfiguration konnte nicht geladen werden.";
    }
}


function nullableNumberFromInput(
    id
) {

    const value =
        $(id).value.trim();

    if (value === "") {
        return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error("Bitte einen gültigen Kalibrierwert eingeben.");
    }
    return parsed;
}


async function saveSoilConfig() {

    const button =
        $("saveSoilConfigButton");

    button.disabled =
        true;

    $("soilConfigMessage").textContent =
        "Speichere …";

    try {

        const payload = {
            pots: [
                {
                    name:
                        $("soilNameInput1").value.trim()
                        || "Topf 1",

                    dry_raw:
                        nullableNumberFromInput(
                            "soilDry1"
                        ),

                    wet_raw:
                        nullableNumberFromInput(
                            "soilWet1"
                        )
                },
                {
                    name:
                        $("soilNameInput2").value.trim()
                        || "Topf 2",

                    dry_raw:
                        nullableNumberFromInput(
                            "soilDry2"
                        ),

                    wet_raw:
                        nullableNumberFromInput(
                            "soilWet2"
                        )
                }
            ]
        };


        const response = await fetch(
            "/api/soil/config",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body:
                    JSON.stringify(
                        payload
                    )
            }
        );

        if (!response.ok) {
            const failure = await response.json().catch(() => ({}));
            throw new Error(typeof failure.detail === "string" ? failure.detail : "Speichern fehlgeschlagen (HTTP " + response.status + ")");
        }

        const data =
            await response.json();

        if (data.status === "error") {
            throw new Error(
                data.message
                || "Konfigurationsfehler"
            );
        }

        await loadSoilConfig();

        $("soilConfigMessage").textContent =
            "Gespeichert · bleibt nach Neustart erhalten";

        await loadCurrent();

    } catch (error) {

        console.error(
            "Soil config save error:",
            error
        );

        $("soilConfigMessage").textContent =
            error.message || "Speichern fehlgeschlagen";

    } finally {

        button.disabled =
            false;
    }
}


function setupSoilMoisture() {

    $("saveSoilConfigButton")
        .addEventListener(
            "click",
            saveSoilConfig
        );

    loadSoilConfig();
}


// =====================================================
// LAMPENSTEUERUNG
// =====================================================

function lampProfileLabel(
    profile
) {

    if (profile === "growth") {
        return "Wachstum";
    }

    if (profile === "flower") {
        return "Blüte";
    }

    return "Benutzerdefiniert";
}


function updateLampControlPreview() {

    const power = Number(
        $("lampPowerInput").value
        || 0
    );

    const enabled =
        $("lampScheduleEnabled").checked;

    const onTime =
        $("lampOnTime").value
        || "--:--";

    const offTime =
        $("lampOffTime").value
        || "--:--";

    const profile =
        $("lampProfileInput").value;


    $("lampPowerOutput").textContent =
        power
        + " %";

    $("lampPowerPreview").textContent =
        power
        + " %";

    $("lampSchedulePreview").textContent =
        enabled
            ? "Aktiv"
            : "Aus";

    $("lampScheduleTimes").textContent =
        onTime
        + " – "
        + offTime;

    const toMinutes = value => /^\d{2}:\d{2}$/.test(value) ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null;
    const start = toMinutes(onTime), end = toMinutes(offTime);
    const duration = start === null || end === null ? null : (end - start + 1440) % 1440;
    $("lampDurationPreview").textContent = duration === null ? "Dauer nicht verfügbar"
        : duration === 0 ? "Gleiche Schaltzeiten · Dauer nicht eindeutig"
        : Math.floor(duration / 60) + " h " + String(duration % 60).padStart(2, "0") + " min Einschaltzeit";

    $("lampProfilePreview").textContent =
        lampProfileLabel(
            profile
        );


    const profileCard =
        $("lampProfileCard");

    const profileImage =
        $("lampProfileImage");

    const profilePlaceholder =
        $("lampProfilePlaceholder");


    profileCard.dataset.profile =
        profile;

    if (profile === "flower") {

        profileImage.hidden =
            false;

        profilePlaceholder.hidden =
            true;

    } else {

        profileImage.hidden =
            true;

        profilePlaceholder.hidden =
            false;
    }
}


let lampProfiles = {};
let lampDrafts = {};
let currentLampProfile = "custom";
const lampFieldIds = ["lampNameInput", "lampProfileInput", "lampPowerInput", "lampScheduleEnabled", "lampOnTime", "lampOffTime", "saveLampConfigButton"];

function lockLampForm(locked) {
    lampFieldIds.forEach(id => { $(id).disabled = locked; });
}

function readLampDraft() {
    return {schedule_enabled: $("lampScheduleEnabled").checked,
        on_time: $("lampOnTime").value, off_time: $("lampOffTime").value,
        power_percent: Number($("lampPowerInput").value)};
}

function showLampProfile(profile) {
    const config = lampDrafts[profile] || lampProfiles[profile];
    if (!config) return;
    currentLampProfile = profile;
    $("lampProfileInput").value = profile;
    $("lampScheduleEnabled").checked = config.schedule_enabled;
    $("lampOnTime").value = config.on_time;
    $("lampOffTime").value = config.off_time;
    $("lampPowerInput").value = String(config.power_percent);
    updateLampControlPreview();
}

async function loadLampConfig() {
    lockLampForm(true);
    try {
        const response = await fetch("/api/light/config", {cache: "no-store"});
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        if (!data.profiles) throw new Error("Bitte den Dienst plant-monitor neu starten.");
        lampProfiles = data.profiles;
        lampDrafts = {};
        $("lampNameInput").value = data.name;
        $("lampControlName").textContent = data.name;
        showLampProfile(data.profile);
        $("lampConfigMessage").textContent = "Profil geladen · Änderungen mit Speichern übernehmen";
        lockLampForm(false);
    } catch (error) {
        $("lampConfigMessage").textContent = "Konfiguration konnte nicht geladen werden: " + error.message;
    }
}

async function loadLampStatus() {

    try {

        const response = await fetch(
            "/api/light/status",
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

        $("lampControlStatus").textContent =
            data.hardware_connected
                ? "GP8600 verbunden"
                : "Hardware ausstehend";

    } catch (error) {

        console.error(
            "Lamp status error:",
            error
        );

        $("lampControlStatus").textContent =
            "Status unbekannt";
    }
}


async function saveLampConfig() {
    lockLampForm(true);
    const profile = currentLampProfile;
    const draft = readLampDraft();
    $("lampConfigMessage").textContent = "Speichere Profil …";
    try {
        const response = await fetch("/api/light/config", {
            method: "POST", headers: {"Content-Type": "application/json"},
            body: JSON.stringify({name: $("lampNameInput").value.trim() || "Pflanzenlampe", profile, ...draft})
        });
        const data = await response.json();
        if (!response.ok || data.status === "error") {
            throw new Error(typeof data.detail === "string" ? data.detail : data.message || "Speichern fehlgeschlagen");
        }
        lampProfiles = data.profiles;
        delete lampDrafts[profile];
        showLampProfile(profile);
        $("lampConfigMessage").textContent = lampProfileLabel(profile) + " gespeichert · bleibt nach Neustart erhalten";
    } catch (error) {
        $("lampConfigMessage").textContent = error.message || "Speichern fehlgeschlagen";
    } finally {
        lockLampForm(false);
    }
}

function setupLampControl() {
    ["lampPowerInput", "lampScheduleEnabled", "lampOnTime", "lampOffTime"].forEach(id => {
        $(id).addEventListener("input", () => {
            updateLampControlPreview();
            $("lampConfigMessage").textContent = "Ungespeicherte Änderungen · Profil speichern";
        });
    });
    $("lampProfileInput").addEventListener("change", () => {
        lampDrafts[currentLampProfile] = readLampDraft();
        const selected = $("lampProfileInput").value;
        showLampProfile(selected);
        $("lampConfigMessage").textContent = "Profilvorschau · mit Speichern als aktives Profil übernehmen";
    });
    $("lampNameInput").addEventListener("input", () => {
        $("lampControlName").textContent = $("lampNameInput").value.trim() || "Pflanzenlampe";
        $("lampConfigMessage").textContent = "Ungespeicherte Änderungen · Profil speichern";
    });
    $("saveLampConfigButton").addEventListener("click", saveLampConfig);
    loadLampConfig();
    loadLampStatus();
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

    $("timelapseInterval").addEventListener("change", async function() {
        const input = $("timelapseInterval");
        const interval = Number(input.value);
        input.disabled = true;
        try {
            const response = await fetch("/api/camera/timelapse", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({interval_minutes: interval})
            });
            if (!response.ok) {
                const failure = await response.json().catch(() => ({}));
                throw new Error(typeof failure.detail === "string" ? failure.detail : "Intervall konnte nicht gespeichert werden.");
            }
            await loadTimelapseStatus();
        } catch (error) {
            await loadTimelapseStatus();
            $("timelapseStatus").textContent = error.message;
        } finally {
            input.disabled = false;
        }
    });

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

        setupSoilMoisture();

        setupLampControl();


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

