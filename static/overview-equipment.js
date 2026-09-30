// Read-only dashboard summaries. No device commands or configuration writes.
(() => {
    const $ = id => document.getElementById(id);
    if (!$("ovEquipmentHeading")) return;
    const set = (id, value) => { $(id).textContent = value; };
    const number = value => typeof value === "number" && Number.isFinite(value);
    const fmt = value => number(value) ? value.toLocaleString("de-CH", {maximumFractionDigits: 1}) : "—";
    const percent = value => number(value) ? fmt(value) + " %" : "—";
    const available = status => status?.hardware_connected === true && status?.output_available === true;
    function hardware(status) {
        if (available(status)) return "Hardware verbunden";
        if (status?.hardware_connected === false) return "Hardware nicht verbunden · vorbereitet";
        return "Ausgabe nicht verfügbar";
    }
    const fields = {
        lamp: ["ovLampProfile", "ovLampPower", "ovLampSchedule", "ovLampActual"],
        water: ["ovWaterTank", "ovWaterPot1", "ovWaterPot2"],
        fan: ["ovFanIntake", "ovFanExhaust", "ovFanActual"]
    };
    function failed(group) {
        fields[group].forEach(id => set(id, "—"));
        set({lamp:"ovLampStatus",water:"ovWaterStatus",fan:"ovFanStatus"}[group], "Daten nicht erreichbar");
        if (group === "lamp") {
            $("ovLampProfileIcon").hidden = true;
            $("ovLampFallback").hidden = false;
            set("ovLampTitle", "Pflanzenlampe");
        }
    }
    function lamp(status) {
        const c = status?.config;
        if (!c || typeof c.profile !== "string") throw new Error("Invalid lamp configuration");
        set("ovLampTitle", c.name || "Pflanzenlampe");
        set("ovLampStatus", hardware(status));
        set("ovLampProfile", {growth:"Wachstum",flower:"Blüte",custom:"Benutzerdefiniert"}[c.profile] || "—");
        set("ovLampPower", percent(c.power_percent) + " Sollwert");
        const scheduled = c.schedule_enabled === true;
        set("ovLampSchedule", scheduled ? "Vorgemerkt" : "Deaktiviert");
        set("ovLampActual", available(status) ? percent(status.output_percent) : "Nicht verfügbar");
        const path = {growth:"/static/profile-growth.svg?v=1",flower:"/static/profile-flower.svg?v=2"}[c.profile];
        $("ovLampProfileIcon").hidden = !path;
        $("ovLampFallback").hidden = !!path;
        if (path && $("ovLampProfileIcon").getAttribute("src") !== path) $("ovLampProfileIcon").setAttribute("src", path);
    }
    function water(config, status) {
        if (!Array.isArray(config?.pumps) || config.pumps.length !== 2 || !Array.isArray(status?.pumps)) throw new Error("Invalid water configuration");
        set("ovWaterStatus", hardware(status));
        // Only explicitly known tank values are represented as known.
        const tank = {empty:"Leer",ok:"Wasser vorhanden",full:"Wasser vorhanden",unknown:"Unbekannt"}[status.tank_state] || "Unbekannt";
        set("ovWaterTank", (config.tank_name || "Tank") + " · " + tank);
        for (const id of [1, 2]) {
            const p = config.pumps.find(p => p.id === id);
            if (!p) throw new Error("Missing pump");
            const dose = number(p.dose_ml) ? fmt(p.dose_ml) + " ml je Gabe" : "Menge offen";
            set("ovWaterPot" + id, (p.enabled === true ? "Automatik vorgemerkt" : "Automatik aus") + " · " + dose);
        }

    }
    function fans(config, status) {
        if (!Array.isArray(config?.fans) || !Array.isArray(status?.fans)) throw new Error("Invalid fan configuration");
        set("ovFanStatus", hardware(status));
        const outputs = [];
        for (const [id, field] of [["intake","ovFanIntake"],["exhaust","ovFanExhaust"]]) {
            const f = config.fans.find(f => f.id === id);
            const actual = status.fans.find(f => f.id === id);
            if (!f || !["manual","off"].includes(f.mode)) throw new Error("Missing fan");
            const target = f.mode === "off" || f.power_percent === 0 ? 0 :
                number(f.power_percent) && number(f.minimum_percent) ? Math.max(f.power_percent, f.minimum_percent) : null;
            set(field, f.name + " · " + (f.mode === "off" ? "AUS" : "MANUELL") + " · " + percent(target) + " Sollwert");
            outputs.push((id === "intake" ? "Zu " : "Ab ") + percent(actual?.output_percent));
        }
        set("ovFanActual", available(status) ? outputs.join(" / ") : "Nicht verfügbar");
    }

    let waterChart = null;
    const waterNumber = value => typeof value === "number" && Number.isFinite(value) && value >= 0;
    function historyUnavailable() {
        if (waterChart) { waterChart.destroy(); waterChart = null; }
        $("ovWaterChart").hidden = true;
        $("ovWaterEmpty").hidden = false;
        $("ovWaterEmpty").textContent = "Bewässerungsverlauf nicht erreichbar";
        set("ovWaterToday", "—");
        set("ovWaterLast", "Nicht erreichbar");
    }
    function wateringHistory(data) {
        if (!Array.isArray(data?.days) || data.days.length !== 7 ||
            !Array.isArray(data.today_ml) || data.today_ml.length !== 2 || !data.today_ml.every(waterNumber) ||
            !data.days.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date) &&
                Array.isArray(d.ml) && d.ml.length === 2 && d.ml.every(waterNumber) &&
                Array.isArray(d.counts) && d.counts.length === 2 && d.counts.every(v => Number.isInteger(v) && v >= 0))) {
            throw new Error("Invalid watering history");
        }
        const last = data.last;
        if (last && (!waterNumber(last.timestamp) || ![1,2].includes(last.pot_id) || !waterNumber(last.ml))) {
            throw new Error("Invalid last watering");
        }
        const stamp = ts => new Date(ts * 1000).toLocaleString("de-CH", {
            timeZone:"Europe/Zurich", day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"
        });
        set("ovWaterLast", last ? stamp(last.timestamp) + " · Topf " + last.pot_id + " · " + fmt(last.ml) + " ml" : "Noch keine aufgezeichnet");
        set("ovWaterToday", "Topf 1: " + fmt(data.today_ml[0]) + " ml · Topf 2: " + fmt(data.today_ml[1]) + " ml");
        const any = data.days.some(d => d.counts.some(v => v > 0));
        $("ovWaterEmpty").hidden = any;
        $("ovWaterEmpty").textContent = last ? "Keine Bewässerung in den letzten 7 Tagen" : "Noch keine Bewässerungen aufgezeichnet";
        const canvas = $("ovWaterChart");
        canvas.hidden = !any;
        if (!any) {
            if (waterChart) { waterChart.destroy(); waterChart = null; }
            return;
        }
        const chartData = {
            labels:data.days.map(d => d.date.slice(8,10) + "." + d.date.slice(5,7)),
            datasets:[0,1].map(i => ({
                label:"Topf " + (i+1), data:data.days.map(d => d.ml[i]),
                backgroundColor:i === 0 ? "#000080" : "#008000",
                borderRadius:0, maxBarThickness:12
            }))
        };
        const summary = data.days.map(d => d.date + ": Topf 1 " + fmt(d.ml[0]) + " ml, Topf 2 " + fmt(d.ml[1]) + " ml").join("; ");
        canvas.setAttribute("aria-label", summary);
        const tooltip = context => {
            const count = data.days[context.dataIndex].counts[context.datasetIndex];
            return context.dataset.label + ": " + fmt(context.parsed.y) + " ml · " + count + " Vorgänge";
        };
        if (waterChart) {
            waterChart.data = chartData;
            waterChart.options.plugins.tooltip.callbacks.label = tooltip;
            waterChart.update("none");
        } else {
            waterChart = new Chart(canvas, {
                type:"bar", data:chartData,
                options:{
                    responsive:true, maintainAspectRatio:false, animation:false,
                    plugins:{legend:{display:false},tooltip:{callbacks:{label:tooltip}}},
                    scales:{
                        x:{grid:{display:false},ticks:{color:"#404040",font:{size:10},maxRotation:0}},
                        y:{beginAtZero:true,grid:{color:"#d4d0c8"},ticks:{color:"#404040",maxTicksLimit:3,font:{size:9}}}
                    }
                }
            });
        }
    }

    async function get(path) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
            const r = await fetch(path, {cache:"no-store", signal:controller.signal});
            if (!r.ok) throw new Error("Fetch failed");
            return await r.json();
        } finally { clearTimeout(timer); }
    }
    let busy = false, again = false;
    async function refresh() {
        if (document.hidden || $("overviewView").hidden) return;
        if (busy) { again = true; return; }
        busy = true;
        const results = await Promise.allSettled([
            get("/api/irrigation/history").then(wateringHistory).catch(error => {historyUnavailable(); throw error;}),
            get("/api/light/status").then(lamp).catch(error => {failed("lamp"); throw error;}),
            Promise.all([get("/api/irrigation/config"),get("/api/irrigation/status")])
                .then(([c,s]) => water(c,s)).catch(error => {failed("water"); throw error;}),
            Promise.all([get("/api/fans/config"),get("/api/fans/status")])
                .then(([c,s]) => fans(c,s)).catch(error => {failed("fan"); throw error;})
        ]);
        const errors = results.filter(r => r.status === "rejected").length;
        set("ovEquipmentUpdated", errors ? "Status teilweise oder nicht erreichbar" :
            "Aktualisiert " + new Date().toLocaleTimeString("de-CH"));
        busy = false;
        if (again) { again = false; refresh(); }
    }
    document.querySelectorAll("[data-control-target]").forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();
            const controls = document.querySelector('[data-view="controls"]');
            if (controls) controls.click();
            requestAnimationFrame(() => {
                const target = $(link.dataset.controlTarget);
                if (target) target.scrollIntoView({block:"start", behavior:"auto"});
            });
        });
    });
    window.addEventListener("hashchange", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    setInterval(refresh, 15000);
    refresh();
})();

