// Summary views consume existing polling events; they never control devices.
(() => {
    const el = id => document.getElementById(id);
    const valid = value => typeof value === 'number' && Number.isFinite(value);
    const text = (value, digits = 1) => valid(value) ? value.toLocaleString('de-CH', {maximumFractionDigits: digits}) : '—';
    let climate, light;
    let hasHistory = false;
    const ranges = {'24h':'24 Stunden', '7d':'7 Tage', '30d':'30 Tage', '1y':'1 Jahr'};
    function options(palette, lightOnly) {
        const axis = title => ({title: {display: true, text: title, color: palette.tick}, ticks: {color: palette.tick}, grid: {color: palette.grid}});
        const scales = {x: {ticks: {color: palette.tick, maxTicksLimit: 7, maxRotation: 0}, grid: {color: palette.grid}}, y: axis(lightOnly ? 'Lux (lx)' : 'Temperatur (°C)')};
        if (!lightOnly) scales.yHumidity = {...axis('Feuchtigkeit (%)'), position: 'right', min: 0, max: 100, grid: {drawOnChartArea: false}};
        return {responsive: true, maintainAspectRatio: false, animation: false, interaction: {mode: 'index', intersect: false}, scales,
            plugins: {legend: {display: !lightOnly, position: 'bottom', labels: {color: palette.tick, boxWidth: 18}},
                tooltip: {callbacks: {label: context => context.dataset.label + ': ' + text(context.parsed.y, 2)}}}};
    }
    function dataset(label, key, color, points, axis = 'y') {
        return {label, data: points.map(point => valid(point[key]) ? point[key] : null), yAxisID: axis,
            borderColor: color, backgroundColor: color, borderWidth: 2, pointRadius: 0, pointHitRadius: 10, tension: .2, spanGaps: false};
    }
    function update(chart, id, data, palette, lightOnly) {
        if (!chart) return new Chart(el(id), {type: 'line', data, options: options(palette, lightOnly)});
        chart.data = data;
        chart.update('none');
        return chart;
    }
    window.addEventListener('plant:history', event => {
        const {points, labels, range} = event.detail;
        const palette = window.plantTheme.palette();
        climate = update(climate, 'overviewClimateChart', {labels, datasets: [
            dataset('Temperatur (°C)', 'temperature', palette.series.temperatureChart, points),
            {...dataset('Feuchtigkeit (%)', 'humidity', palette.series.humidityChart, points, 'yHumidity'), borderDash: [5, 4]}
        ]}, palette, false);
        light = update(light, 'overviewLuxChart', {labels, datasets: [dataset('Licht (lx)', 'lux', palette.series.luxChart, points)]}, palette, true);
        hasHistory = points.length > 0;
        el('dashboardHistoryState').textContent = hasHistory ? ranges[range] + ' · Temperatur und relative Feuchtigkeit' : 'Für diesen Zeitraum sind noch keine Messwerte vorhanden.';
    });
    window.addEventListener('plant:history-loading', () => {
        el('dashboardHistoryState').textContent = 'Verlauf wird geladen …';
        // Do not display previous-range points beneath a newly selected range.
        for (const chart of [climate, light]) if (chart) { chart.data.labels = []; chart.data.datasets.forEach(series => series.data = []); chart.update('none'); }
        hasHistory = false;
    });
    window.addEventListener('plant:history-error', () => {
        el('dashboardHistoryState').textContent = hasHistory ? 'Aktualisierung fehlgeschlagen · zuletzt geladener Verlauf' : 'Verlauf nicht verfügbar · Verbindung prüfen';
    });
    window.addEventListener('plant:current', event => {
        const data = event.detail;
        el('dashboardPpfd').textContent = text(data.ppfd_center);
        el('dashboardUv').textContent = valid(data.uv_mw_cm2) ? data.uv_mw_cm2.toLocaleString('de-CH', {minimumFractionDigits: 4, maximumFractionDigits: 4}) : data.uv_saturated ? 'Bereich überschritten' : '—';
    });
    window.addEventListener('plant:offline', () => {
        el('dashboardPpfd').textContent = el('dashboardUv').textContent = '—';
    });
    window.addEventListener('plant:light-today', event => {
        const data = event.detail;
        const seconds = data.light_on_seconds;
        el('dashboardLightDuration').textContent = valid(seconds) ? Math.floor(seconds / 3600) + ' h ' + Math.floor(seconds % 3600 / 60) + ' min' : '—';
        el('dashboardDli').textContent = text(data.dli_center, 2);
    });
    window.addEventListener('plant:light-today-error', () => {
        el('dashboardLightDuration').textContent = el('dashboardDli').textContent = '—';
    });
})();
