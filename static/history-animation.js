// Replay the detailed history animation when previously hidden canvases appear.
(() => {
    const ids = ["temperatureChart", "humidityChart", "vpdChart", "luxChart",
        "uvChart", "soilMoisture1Chart", "soilMoisture2Chart"];
    const visible = new Set();
    function animate(id) {
        if (document.hidden) return;
        const canvas = document.getElementById(id);
        const chart = window.Chart?.getChart(id);
        if (!canvas?.getClientRects().length || !chart?.data.labels.length) return;
        chart.resize();
        chart.reset();
        chart.update();
    }
    document.addEventListener("DOMContentLoaded", () => {
        if (typeof IntersectionObserver === "undefined") return;
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                const id = entry.target.id;
                if (!entry.isIntersecting) { visible.delete(id); return; }
                if (!visible.has(id)) animate(id);
                visible.add(id);
            });
        });
        ids.forEach(id => {
            const canvas = document.getElementById(id);
            if (canvas) observer.observe(canvas);
        });
    });
})();
