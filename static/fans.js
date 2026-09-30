// Configuration and decorative previews only; no hardware commands.
(() => {
    const $ = id => document.getElementById(id);
    const ids = ["intake", "exhaust"];
    const form = $("fanForm");
    if (!form) return;
    const fields = $("fanFields"), message = $("fanMessage"), retry = $("fanRetry");
    const target = fan => fan.mode === "off" || fan.power_percent === 0
        ? 0 : Math.max(fan.power_percent, fan.minimum_percent);
    const read = id => ({
        id, name: $("fanName-" + id).value.trim(),
        mode: $("fanMode-" + id).value,
        power_percent: $("fanPower-" + id).value === "" ? null : Number($("fanPower-" + id).value),
        minimum_percent: $("fanMinimum-" + id).value === "" ? null : Number($("fanMinimum-" + id).value)
    });
    function preview(id) {
        const fan = read(id);
        for (const prefix of ["fanPower", "fanMinimum"]) {
            const number = $(prefix + "-" + id);
            const slider = $(prefix + "Slider-" + id);
            if (slider && number.value !== "" && number.validity.valid) {
                slider.value = number.value;
                slider.setAttribute("aria-valuetext", number.value + " Prozent");
            }
        }
        $("fanDraft-" + id).textContent =
            fan.power_percent === null || fan.minimum_percent === null
            ? "Bitte beide Prozentwerte ausfüllen."
            : "Vorgemerkter Sollwert: " + target(fan) + " % · Hardwareausgabe gesperrt";
    }
    function render(config) {
        if (!Array.isArray(config.fans) || config.fans.length !== 2 ||
            config.fans.some((fan, i) => fan.id !== ids[i] || typeof fan.name !== "string" ||
                !["off", "manual"].includes(fan.mode) ||
                !Number.isInteger(fan.power_percent) || fan.power_percent < 0 || fan.power_percent > 100 ||
                !Number.isInteger(fan.minimum_percent) || fan.minimum_percent < 0 || fan.minimum_percent > 100)) {
            throw new Error("Ungültige Lüfterkonfiguration.");
        }
        config.fans.forEach(fan => {
            $("fanName-" + fan.id).value = fan.name;
            $("fanMode-" + fan.id).value = fan.mode;
            $("fanPower-" + fan.id).value = fan.power_percent;
            $("fanMinimum-" + fan.id).value = fan.minimum_percent;
            $("fanTitle-" + fan.id).textContent = fan.name;
            $("fanSaved-" + fan.id).textContent = "Gespeichert: " +
                (fan.mode === "off" ? "AUS" : "MANUELL") + " · Sollwert " + target(fan) + " %";
            preview(fan.id);
        });
    }
    async function request(options = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch("/api/fans/config", {
                cache: "no-store", ...options, signal: controller.signal
            });
            const body = await response.json();
            if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "Anfrage fehlgeschlagen.");
            return body;
        } finally { clearTimeout(timer); }
    }
    async function load() {
        fields.disabled = true;
        retry.hidden = true;
        message.textContent = "Einstellungen werden geladen …";
        try {
            render(await request());
            fields.disabled = false;
            message.textContent = "Konfiguration geladen. Keine PWM-Ausgabe.";
        } catch {
            message.textContent = "Lüftereinstellungen konnten nicht geladen werden.";
            retry.hidden = false;
        }
    }
    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (fields.disabled || !form.reportValidity()) return;
        const config = {fans: ids.map(read)};
        if (config.fans.some(fan => !fan.name)) {
            message.textContent = "Bitte beide Lüfternamen ausfüllen.";
            return;
        }
        fields.disabled = true;
        message.textContent = "Wird gespeichert …";
        try {
            render(await request({method: "POST", headers: {"Content-Type": "application/json"},
                body: JSON.stringify(config)}));
            message.textContent = "Gespeichert. Hardwareausgabe bleibt deaktiviert.";
        } catch (error) {
            message.textContent = "Speichern fehlgeschlagen: " + error.message;
        } finally { fields.disabled = false; }
    });
    ids.forEach(id => ["fanMode-", "fanPower-", "fanMinimum-"].forEach(prefix =>
        $(prefix + id).addEventListener("input", () => preview(id))));
    ids.forEach(id => ["fanPower", "fanMinimum"].forEach(prefix => {
        const slider = $(prefix + "Slider-" + id);
        if (!slider) return;
        slider.addEventListener("input", () => {
            $(prefix + "-" + id).value = slider.value;
            preview(id);
        });
    }));
    document.querySelectorAll("[data-fan]").forEach(button => {
        button.addEventListener("click", () => {
            const id = button.dataset.fan;
            $("fanIcon-" + id).dataset.preview = "true";
            $("fanPreviewNote-" + id).textContent = "Animationsvorschau · kein Lüfterbefehl";
            button.disabled = true;
            setTimeout(() => {
                $("fanIcon-" + id).dataset.preview = "false";
                $("fanPreviewNote-" + id).textContent = "Symbolvorschau ohne Lüfteransteuerung";
                button.disabled = false;
            }, 3000);
        });
    });
    retry.addEventListener("click", load);
    load();
})();
