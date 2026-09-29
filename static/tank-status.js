// Shared tank indicators use the existing irrigation-status poll.
window.renderTankStatus = function(status) {
    const raw = status?.tank_state;
    const state = raw === "empty" ? "empty" : (raw === "ok" || raw === "full") ? "ok" : "unknown";
    const label = state === "empty" ? "Tank leer" :
        state === "ok" ? "Wasser vorhanden" : "Tankstatus unbekannt";
    document.querySelectorAll(".tank-symbol").forEach(icon => {
        icon.dataset.tankState = state;
        icon.setAttribute("aria-label", label);
    });
    const text = document.getElementById("irrigationTankState");
    if (text) text.textContent = label;
};
