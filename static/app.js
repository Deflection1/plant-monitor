const $ = (id) =>
    document.getElementById(id);


let historyRange = "24h";


let photoHistory = [];
let photoTotal = 0;
let photoHistoryLoading = false;
let photoHistoryGeneration = 0;
let timelapseGeneration = 0;
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


        $("uvIntensity").textContent = data.uv_saturated
            ? "Bereich überschritten" : number(data.uv_mw_cm2, 4);
        $("uvRaw").textContent = number(data.uv_raw, 0);

        $("cpuTemperature").textContent =
            number(
                data.cpu_temperature
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
        $("uvIntensity").textContent = "--";
        $("uvRaw").textContent = "--";

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


        window.dispatchEvent(new CustomEvent("plant:light-today", {detail: data}));
    } catch (error) {
        window.dispatchEvent(new Event("plant:light-today-error"));

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
        animation: false,
        resizeDelay: 120,
        devicePixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),

        interaction: { mode: "nearest", axis: "x", intersect: false },


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
                        window.plantTheme.palette().tick,

                    sampleSize: 12,
                    maxTicksLimit: 6,
                    autoSkip: true,
                    maxRotation: 0,
                    minRotation: 0
                },


                grid: {

                    color:
                        window.plantTheme.palette().grid
                }
            },


            y: {

                ticks: {

                    color:
                        window.plantTheme.palette().tick
                },


                grid: {

                    color:
                        window.plantTheme.palette().grid
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

    color = window.plantTheme.palette().series[id] || color;
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

                    borderWidth: 1.5,

                    pointRadius: 0,

                    pointHitRadius: 10,

                    pointHoverRadius: 4,

                    tension: 0,

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


const historyChartSpecs = [
    ["temperatureChart", "temperature", "°C", "#b02020"],
    ["humidityChart", "humidity", "%", "#000080"],
    ["vpdChart", "vpd", "kPa", "#008000"],
    ["luxChart", "lux", "Lux", "#a08000"],
    ["uvChart", "uv_mw_cm2", "mW/cm²", "#8050b0"],
    ["soilMoisture1Chart", "soil_moisture_1", "%", "#000080"],
    ["soilMoisture2Chart", "soil_moisture_2", "%", "#008000"]
];
const historyCharts = new Map();
const historyChartVisible = new Set();
let historySnapshot = null;
let historyRevision = 0;
let historyObserver = null;

function refreshHistoryCharts() {
    if (document.hidden || !historySnapshot) return;
    historyChartSpecs.forEach(([id, key, unit, color]) => {
        const canvas = $(id);
        if (!canvas || !canvas.getClientRects().length ||
            (historyObserver && !historyChartVisible.has(id))) return;
        let state = historyCharts.get(id);
        if (!state) {
            state = {chart: makeChart(id, unit, color), revision: -1};
            historyCharts.set(id, state);
        }
        if (state.revision === historyRevision) return;
        const {points, labels} = historySnapshot;
        state.chart.data.labels = labels;
        state.chart.data.datasets[0].data = points.map(point => point[key] ?? null);
        state.chart.update("none");
        state.revision = historyRevision;
    });
}

function renderHistoryCharts(points, labels) {
    historySnapshot = {points, labels};
    ++historyRevision;
    refreshHistoryCharts();
}

function createCharts() {
    if (typeof IntersectionObserver !== "undefined") {
        historyObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) historyChartVisible.add(entry.target.id);
                else historyChartVisible.delete(entry.target.id);
            });
            refreshHistoryCharts();
        }, {rootMargin: "100px 0px"});
        historyChartSpecs.forEach(([id]) => historyObserver.observe($(id)));
    }
    const refresh = () => requestAnimationFrame(refreshHistoryCharts);
    window.addEventListener("hashchange", refresh);
    window.addEventListener("plant:layout", refresh);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("plant:history-loading", () => {
        renderHistoryCharts([], []);
    });
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

    const requestedRange = historyRange;
    try {

        const response =
            await fetch(

                "/api/history?range="
                + requestedRange,

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


        if (requestedRange !== historyRange) return;

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


        renderHistoryCharts(points, labels);

        window.dispatchEvent(new CustomEvent("plant:history", {detail: {range: requestedRange, points, labels}}));
    } catch (error) {
        if (requestedRange === historyRange) window.dispatchEvent(new Event("plant:history-error"));

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
    const buttons = document.querySelectorAll(".range");
    const rangeOf = button => button.dataset.range || ({"24h":"24h", "7 Tage":"7d", "30 Tage":"30d", "1 Jahr":"1y"}[button.textContent.trim()]);
    buttons.forEach(button => button.addEventListener("click", () => {
        const range = rangeOf(button);
        if (!["24h", "7d", "30d", "1y"].includes(range)) return;
        historyRange = range;
        buttons.forEach(item => {
            const active = rangeOf(item) === range;
            item.classList.toggle("active", active);
            item.setAttribute("aria-pressed", String(active));
        });
        window.dispatchEvent(new CustomEvent("plant:history-loading", {detail: {range}}));
        loadHistory();
    }));
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
        : duration === 0 ? "Gleiche Schaltzeiten · Lampe bleibt aus"
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

    if (profile === "flower" || profile === "growth") {
        const iconPath = window.plantTheme.profileIcon(profile);
        if (profileImage.getAttribute("src") !== iconPath) {
            profileImage.setAttribute("src", iconPath);
        }
        profileImage.hidden = false;
        profilePlaceholder.hidden = true;
    } else {
        profileImage.hidden = true;
        profilePlaceholder.hidden = false;
    }
}


let lampProfiles = {};
let lampDrafts = {};
let currentLampProfile = "custom";
const lampFieldIds = ["lampControlEnabled", "lampNameInput", "lampProfileInput", "lampPowerInput", "lampScheduleEnabled", "lampOnTime", "lampOffTime", "saveLampConfigButton"];

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
        $("lampControlEnabled").checked = data.control_enabled === true;
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

        $("lampControlStatus").textContent = data.message || "Status unbekannt";
        $("lampOutputStatus").textContent = data.output_available
            ? "Gesendet: " + data.output_percent + " % · " + data.output_voltage + " V (Sollwert)"
            : "Ausgang unbekannt · keine bestätigte Ausgabe";

    } catch (error) {

        console.error(
            "Lamp status error:",
            error
        );

        $("lampControlStatus").textContent =
            "Status unbekannt";
        $("lampOutputStatus").textContent = "Ausgang unbekannt · Status nicht erreichbar";
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
            body: JSON.stringify({name: $("lampNameInput").value.trim() || "Pflanzenlampe", profile,
                control_enabled: $("lampControlEnabled").checked, ...draft})
        });
        const data = await response.json();
        if (!response.ok || data.status === "error") {
            throw new Error(typeof data.detail === "string" ? data.detail : data.message || "Speichern fehlgeschlagen");
        }
        lampProfiles = data.profiles;
        delete lampDrafts[profile];
        showLampProfile(profile);
        $("lampConfigMessage").textContent = lampProfileLabel(profile) + " gespeichert · bleibt nach Neustart erhalten";
        if (data.output_state?.error) $("lampConfigMessage").textContent = "Gespeichert, aber Ausgabe fehlgeschlagen: " + data.output_state.error;
        await loadLampStatus();
    } catch (error) {
        $("lampConfigMessage").textContent = error.message || "Speichern fehlgeschlagen";
    } finally {
        lockLampForm(false);
    }
}

function setupLampControl() {
    ["lampControlEnabled", "lampPowerInput", "lampScheduleEnabled", "lampOnTime", "lampOffTime"].forEach(id => {
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
    setInterval(loadLampStatus, 5000);
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


function openPhotoViewer(photo) {
    stopTimelapsePlayback();
    const dialog = $("photoViewer");
    const image = $("photoViewerImage");
    $("photoViewerDate").textContent = formatPhotoDate(photo.captured_at);
    $("photoViewerStatus").textContent = "Original wird geladen …";
    image.hidden = true;
    image.onload = () => {
        image.hidden = false;
        $("photoViewerStatus").textContent = "";
    };
    image.onerror = () => {
        $("photoViewerStatus").textContent = "Bild konnte nicht geladen werden.";
    };
    image.src = photo.url;
    if (!dialog.open) dialog.showModal();
}

async function loadPhotoHistory(append = false) {
    if (photoHistoryLoading && append) return;
    const generation = ++photoHistoryGeneration;
    photoHistoryLoading = true;
    const more = $("photoHistoryMore");
    more.disabled = true;
    if (!append) {
        photoHistory = [];
        $("photoGrid").replaceChildren();
        more.hidden = true;
    }
    $("photoHistoryMessage").textContent = "Bilder werden geladen …";
    try {
        const response = await fetch(
            "/api/camera/photos?limit=12&offset=" + photoHistory.length,
            {cache: "no-store"}
        );
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        if (generation !== photoHistoryGeneration) return;
        photoTotal = data.count;
        const photos = data.photos || [];
        photoHistory.push(...photos);
        $("photoHistoryEmpty").hidden = photoTotal > 0;
        photos.forEach(photo => {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "photo-thumb";
            const image = document.createElement("img");
            image.loading = "lazy";
            image.decoding = "async";
            image.src = photo.thumbnail_url;
            image.alt = "Pflanzenfoto vom " + formatPhotoDate(photo.captured_at);
            const date = document.createElement("span");
            date.textContent = formatPhotoDate(photo.captured_at);
            item.append(image, date);
            item.addEventListener("click", () => openPhotoViewer(photo));
            $("photoGrid").appendChild(item);
        });
        more.hidden = photoHistory.length >= photoTotal;
        $("photoHistoryMessage").textContent = photoTotal
            ? photoHistory.length + " von " + photoTotal + " Bildern" : "";
    } catch (error) {
        if (generation !== photoHistoryGeneration) return;
        $("photoHistoryMessage").textContent = "Bilder konnten nicht geladen werden. Bitte erneut versuchen.";
        more.hidden = false;
        console.error("Photo history error:", error);
    } finally {
        if (generation === photoHistoryGeneration) {
            photoHistoryLoading = false;
            more.disabled = false;
        }
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
    timelapsePlaying = false;
    ++timelapseGeneration;
    if (timelapseTimer) clearTimeout(timelapseTimer);
    timelapseTimer = null;
    const image = $("timelapseImage");
    image.onload = image.onerror = null;
    image.removeAttribute("src");
    $("timelapsePlayer").hidden = true;
}

async function playTimelapse() {
    stopTimelapsePlayback();
    const generation = timelapseGeneration;
    $("timelapseStatus").textContent = "Zeitraffer wird geladen …";
    try {
        // Metadata only: images are fetched one at a time during playback.
        const response = await fetch("/api/camera/photos?limit=1000", {cache: "no-store"});
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        if (generation !== timelapseGeneration) return;
        const frames = (data.photos || []).reverse();
        if (frames.length < 2) {
            $("timelapseStatus").textContent = "Für die Wiedergabe werden mindestens 2 Bilder benötigt.";
            return;
        }
        timelapsePlaying = true;
        timelapseIndex = 0;
        $("timelapsePlayer").hidden = false;
        $("timelapseStatus").textContent = frames.length + " Bilder im Zeitraffer";
        const image = $("timelapseImage");
        function showFrame() {
            if (!timelapsePlaying || generation !== timelapseGeneration) return;
            const photo = frames[timelapseIndex];
            let completed = false;
            function nextFrame(failed) {
                if (completed || generation !== timelapseGeneration) return;
                completed = true;
                clearTimeout(timelapseTimer);
                image.onload = image.onerror = null;
                if (failed) $("timelapseStatus").textContent = "Ein Bild konnte nicht geladen werden; Wiedergabe läuft weiter.";
                else $("timelapsePlayerDate").textContent = formatPhotoDate(photo.captured_at);
                timelapseIndex = (timelapseIndex + 1) % frames.length;
                timelapseTimer = setTimeout(showFrame, 500);
            }
            image.onload = () => nextFrame(false);
            image.onerror = () => nextFrame(true);
            timelapseTimer = setTimeout(() => nextFrame(true), 15000);
            image.src = photo.preview_url;
        }
        showFrame();
    } catch (error) {
        if (generation === timelapseGeneration)
            $("timelapseStatus").textContent = "Zeitraffer konnte nicht geladen werden.";
        console.error("Timelapse playback error:", error);
    }
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
    $("photoHistoryMore").addEventListener("click", () => loadPhotoHistory(true));
    const viewer = $("photoViewer");
    $("photoViewerClose").addEventListener("click", () => viewer.close());
    viewer.addEventListener("click", event => {
        if (event.target === viewer) {
            const bounds = viewer.getBoundingClientRect();
            if (event.clientX < bounds.left || event.clientX > bounds.right ||
                event.clientY < bounds.top || event.clientY > bounds.bottom) viewer.close();
        }
    });
    viewer.addEventListener("close", () => {
        const image = $("photoViewerImage");
        image.onload = image.onerror = null;
        image.removeAttribute("src");
    });
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopTimelapsePlayback();
    });
    window.addEventListener("hashchange", stopTimelapsePlayback);

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

                await playTimelapse();
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

        setupIrrigation();


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



// Display-only irrigation setup: no start/stop requests or hardware commands.
function setupIrrigation() {
    const form = $("irrigationForm");
    const fields = $("irrigationFields");
    const message = $("irrigationMessage");
    const retry = $("irrigationRetry");

    const waterFields = ["threshold_percent", "dose_ml", "pause_minutes",
        "daily_limit_ml", "max_run_seconds", "calibration_ml", "calibration_seconds"];
    function updateWaterSummary(id) {
        const value = key => Number($("water_" + key + "_" + id).value);
        const ml = value("calibration_ml"), seconds = value("calibration_seconds");
        const dose = value("dose_ml");
        const valid = ml > 0 && seconds > 0;
        $("waterSummary" + id).textContent = valid
            ? "Fördermenge: " + (ml / seconds).toFixed(2) + " ml/s"
              + (dose > 0 ? " · berechnete Laufzeit: " + (dose * seconds / ml).toFixed(1) + " s" : "")
              + " · Hardwareausgabe gesperrt"
            : "Pumpenkalibrierung ausstehend · Hardwareausgabe gesperrt";
    }

    function showConfig(config) {
        if (typeof config.tank_name !== "string" || !Array.isArray(config.pumps)
                || config.pumps.length !== 2 || config.pumps.some((p, i) =>
                    p.id !== i + 1 || typeof p.name !== "string")) {
            throw new Error("Ungültige Antwort");
        }
        $("irrigationTankInput").value = config.tank_name;
        $("irrigationTankName").textContent = config.tank_name;
        config.pumps.forEach((pump) => {
            $("irrigationPumpInput" + pump.id).value = pump.name;
            $("irrigationPumpName" + pump.id).textContent = pump.name;
            $("waterEnabled" + pump.id).checked = pump.enabled === true;
            waterFields.forEach(key => {
                $("water_" + key + "_" + pump.id).value = pump[key] ?? "";
            });
            updateWaterSummary(pump.id);
        });
    }

    async function load() {
        fields.disabled = true;
        retry.hidden = true;
        message.textContent = "Einstellungen werden geladen …";
        try {
            const response = await fetch("/api/irrigation/config", {cache: "no-store"});
            if (!response.ok) throw new Error("Laden fehlgeschlagen");
            showConfig(await response.json());
            fields.disabled = false;
            message.textContent = "Einstellungen können gespeichert werden. Hardwareausgabe bleibt gesperrt.";
        } catch (error) {
            message.textContent = "Einstellungen konnten nicht geladen werden.";
            retry.hidden = false;
        }
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (fields.disabled) return;
        const payload = {
            tank_name: $("irrigationTankInput").value.trim(),
            pumps: [1, 2].map(id => ({
                id, name: $("irrigationPumpInput" + id).value.trim(),
                enabled: $("waterEnabled" + id).checked,
                ...Object.fromEntries(waterFields.map(key => {
                    const raw = $("water_" + key + "_" + id).value;
                    return [key, raw === "" ? null : Number(raw)];
                }))
            }))
        };
        if (!payload.tank_name || payload.pumps.some(p => !p.name)) {
            message.textContent = "Bitte alle Namen ausfüllen.";
            return;
        }
        fields.disabled = true;
        message.textContent = "Wird gespeichert …";
        try {
            const response = await fetch("/api/irrigation/config", {
                method: "POST", headers: {"Content-Type": "application/json"},
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(typeof body.detail === "string" ? body.detail : "Speichern fehlgeschlagen.");
            }
            showConfig(await response.json());
            message.textContent = "Gespeichert. Hardware bleibt deaktiviert.";
        } catch (error) {
            message.textContent = error.message || "Speichern fehlgeschlagen. Bitte erneut versuchen.";
        } finally {
            fields.disabled = false;
        }
    });
    [1, 2].forEach(id => waterFields.forEach(key =>
        $("water_" + key + "_" + id).addEventListener("input", () => updateWaterSummary(id))));
    retry.addEventListener("click", load);
    load();
}

