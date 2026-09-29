// Light detected by the existing lux sensor, not inferred from the saved dimmer setting.
(() => {
    const icons = document.querySelectorAll(".live-lamp-icon");
    const label = document.getElementById("ovLampLiveState");
    const note = document.getElementById("ovLampLiveNote");
    if (!note) return;
    let receivedAt = null;
    function render(state, lux) {
        const text = state === "on" ? "Licht erkannt" :
            state === "off" ? "Kein Licht erkannt" : "Status unbekannt";
        icons.forEach(icon => {
            icon.dataset.state = state;
            icon.setAttribute("aria-label", text);
        });
        if (label) label.textContent = text;
        note.textContent = state === "unknown" ? "— Lux" :
            lux.toLocaleString("de-CH", {maximumFractionDigits:1}) + " Lux";
    }
    window.addEventListener("plant:current", event => {
        const data = event.detail;
        const valid = typeof data?.lux === "number" && Number.isFinite(data.lux) && data.lux >= 0
            && typeof data.light_on === "boolean";
        receivedAt = valid ? Date.now() : null;
        render(valid ? (data.light_on ? "on" : "off") : "unknown", data?.lux);
    });
    window.addEventListener("plant:offline", () => {
        receivedAt = null;
        render("unknown");
    });
    function checkFreshness() {
        if (receivedAt === null || Date.now() - receivedAt > 20000) render("unknown");
    }
    document.addEventListener("visibilitychange", checkFreshness);
    setInterval(checkFreshness, 5000);
})();
