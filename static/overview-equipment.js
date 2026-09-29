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
        water: ["ovWaterTank", "ovWaterPot1", "ovWaterPot2", "ovWaterLast"],
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
        // Backend does not yet record events. Do not infer watering from settings.
        set("ovWaterLast", "Noch nicht protokolliert");
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
