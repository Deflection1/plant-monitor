(() => {
    const el = id => document.getElementById(id);
    const valid = value => typeof value === 'number' && Number.isFinite(value);
    const valueText = value => valid(value) ? value.toLocaleString('de-CH', {maximumFractionDigits: 1}) : '—';
    function selectView(view) {
        const controls = view === 'controls';
        el('overviewView').hidden = controls;
        el('controlsView').hidden = !controls;
        el(controls ? 'controlsCameraSlot' : 'overviewCameraSlot').append(el('sharedCameraPanel'));
        el(controls ? 'controlsHistorySlot' : 'overviewHistorySlot').append(el('photoHistoryPanel'));
        document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
        if (controls) requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
    function route() { selectView(location.hash === '#steuerung' ? 'controls' : 'overview'); }
    document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
        location.hash = button.dataset.view === 'controls' ? 'steuerung' : 'uebersicht';
        route();
    }));
    window.addEventListener('hashchange', route);
    route();
    window.addEventListener('plant:current', event => {
        const data = event.detail;
        el('ovTemperature').textContent = valueText(data.temperature);
        el('ovHumidity').textContent = valueText(data.humidity);
        el('ovVpd').textContent = valid(data.vpd) ? data.vpd.toLocaleString('de-CH', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '—';
        el('ovLight').textContent = data.light_on === true ? 'An' : data.light_on === false ? 'Aus' : '—';
        el('ovLux').textContent = valueText(data.lux);
        el('overviewFreshness').textContent = 'Verbunden · letzte Messung ' + new Date().toLocaleTimeString('de-CH');
        for (const i of [1, 2]) {
            const moisture = data['soil_moisture_' + i];
            el('ovSoil' + i).textContent = valueText(moisture) + (valid(moisture) ? ' %' : '');
            el('ovSoilNote' + i).textContent = valid(moisture) ? 'Bodenfeuchtigkeit' : valid(data['soil_raw_' + i]) ? 'Kalibrierung ausstehend' : 'Sensor noch nicht verbunden';
            el('ovProgress' + i).hidden = !valid(moisture);
            el('ovProgress' + i).value = valid(moisture) ? moisture : 0;
        }
    });
    window.addEventListener('plant:offline', () => {
        el('overviewFreshness').textContent = 'Keine aktuellen Messwerte · Verbindung prüfen';
        for (const id of ['ovTemperature', 'ovHumidity', 'ovVpd', 'ovLux', 'ovLight', 'ovSoil1', 'ovSoil2']) el(id).textContent = '—';
        for (const i of [1, 2]) { el('ovProgress' + i).hidden = true; el('ovSoilNote' + i).textContent = 'Messwerte nicht verfügbar'; }
    });
    window.addEventListener('plant:pots', event => event.detail.slice(0, 2).forEach((pot, index) => {
        el('ovName' + (index + 1)).textContent = pot.name;
        el('ovProgress' + (index + 1)).setAttribute('aria-label', 'Bodenfeuchtigkeit ' + pot.name);
    }));
})();
