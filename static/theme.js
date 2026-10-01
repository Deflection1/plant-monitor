/* Browser-local appearance only. No device settings or API writes. */
(() => {
    "use strict";
    const key = "plant-monitor.design";
    const valid = value => ["glass", "windows-2000", "botanical"].includes(value) ? value : "glass";
    let current = "glass";
    try { current = valid(localStorage.getItem(key)); } catch { /* Storage is optional. */ }
    const palettes = {
        glass: {
            tick: "#89988e", grid: "rgba(255,255,255,0.05)", barRadius: 3,
            water: ["#68d7ba", "#71b9ee"],
            series: {temperatureChart:"#67d391", humidityChart:"#6ebce4", vpdChart:"#e8bd6c", luxChart:"#f1dc78", uvChart:"#c59bff", soilMoisture1Chart:"#74c69d", soilMoisture2Chart:"#95d5b2"}
        },
        botanical: {
            tick: "#626e60", grid: "#e3e5d9", barRadius: 4,
            water: ["#526d50", "#b9654b"],
            series: {temperatureChart:"#b75d43", humidityChart:"#4e756e", vpdChart:"#78804c", luxChart:"#a87623", uvChart:"#876080", soilMoisture1Chart:"#526d50", soilMoisture2Chart:"#8b774a"}
        },
        "windows-2000": {
            tick: "#404040", grid: "#d4d0c8", barRadius: 0,
            water: ["#000080", "#008000"],
            series: {temperatureChart:"#b02020", humidityChart:"#000080", vpdChart:"#008000", luxChart:"#a08000", uvChart:"#800080", soilMoisture1Chart:"#000080", soilMoisture2Chart:"#008000"}
        }
    };
    const profileIcon = profile => {
        if (!["growth", "flower"].includes(profile)) return undefined;
        return "/static/" + (current === "windows-2000" ? "windows-2000/" : current === "botanical" ? "botanical/" : "") + "profile-" + profile + ".svg?v=themes-1";
    };
    function updateCharts() {
        if (!window.Chart?.getChart) return;
        const palette = palettes[current];
        const ids = [...Object.keys(palette.series), "ovWaterChart"];
        ids.forEach(id => {
            const chart = window.Chart.getChart(id);
            if (!chart) return;
            for (const axis of ["x", "y"]) {
                const scale = chart.options.scales?.[axis];
                if (scale?.ticks) scale.ticks.color = palette.tick;
                if (scale?.grid) scale.grid.color = palette.grid;
            }
            chart.data.datasets.forEach((dataset, i) => {
                dataset.backgroundColor = id === "ovWaterChart" ? palette.water[i] : palette.series[id];
                if (id === "ovWaterChart") dataset.borderRadius = palette.barRadius;
                else dataset.borderColor = palette.series[id];
            });
            chart.update("none");
            chart.resize();
        });
    }
    function apply(value) {
        current = valid(value);
        document.documentElement.dataset.theme = current;
        document.querySelectorAll("[data-theme-stylesheet]").forEach(link => {
            // Botanical builds on the existing responsive layout and overrides its appearance.
            const theme = link.dataset.themeStylesheet;
            link.disabled = theme !== current && !(current === "botanical" && theme === "glass");
        });
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = current === "botanical" ? "#f6f3ea" : current === "glass" ? "#102c2b" : "#3a6ea5";
        const select = document.getElementById("themeSelect");
        if (select) select.value = current;
        document.querySelectorAll("#lampProfileImage, #ovLampProfileIcon").forEach(img => {
            const match = img.getAttribute("src")?.match(/profile-(growth|flower)\.svg/);
            if (match) img.setAttribute("src", profileIcon(match[1]));
        });
        updateCharts();
        window.dispatchEvent(new Event("resize"));
    }
    window.plantTheme = {palette: () => palettes[current], profileIcon};
    // Runs in the head, before the body is painted.
    apply(current);
    document.addEventListener("DOMContentLoaded", () => {
        const select = document.getElementById("themeSelect");
        if (!select) return;
        select.value = current;
        select.addEventListener("change", () => {
            apply(select.value);
            const note = document.getElementById("themePreferenceNote");
            try {
                localStorage.setItem(key, current);
                if (note) note.textContent = "Wird in diesem Browser gespeichert.";
            } catch {
                if (note) note.textContent = "Design aktiv · Speichern im Browser nicht möglich.";
            }
        });
    });
    window.addEventListener("storage", event => {
        if (event.key === key || event.key === null) {
            let value = "glass";
            try { value = localStorage.getItem(key); } catch { /* Keep the default. */ }
            apply(value);
        }
    });
})();

