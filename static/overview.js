(() => {
    const el = id => document.getElementById(id);
    const valid = value => typeof value === 'number' && Number.isFinite(value);
    const valueText = value => valid(value) ? value.toLocaleString('de-CH', {maximumFractionDigits: 1}) : '—';
    function selectView(view) {
        el('overviewView').hidden = view !== 'overview';
        el('controlsView').hidden = view !== 'controls';
        if (el('historyView')) el('historyView').hidden = view !== 'history';
        document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
    const targets = {licht: 'lampControlSection', bewaesserung: 'irrigationControlSection', lueftung: 'fanControlSection', system: 'systemDiagnostics', kamera: 'sharedCameraPanel'};
    function route() {
        const hash = location.hash.slice(1);
        const view = hash === 'klimaverlauf' ? 'history' : hash === 'steuerung' || (targets[hash] && hash !== 'kamera') ? 'controls' : 'overview';
        selectView(view);
        const activeRoute = hash === 'steuerung' ? 'system' : (targets[hash] || hash === 'klimaverlauf') ? hash : 'uebersicht';
        document.querySelectorAll('[data-route]').forEach(link => {
            const active = link.dataset.route === activeRoute;
            if (active) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
        if (targets[hash]) requestAnimationFrame(() => {
            const target = el(targets[hash]);
            if (!target) return;
            if (target.tagName === 'DETAILS') target.open = true;
            target.scrollIntoView({block: 'start'});
            const heading = target.querySelector('h2, summary');
            if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({preventScroll: true}); }
        });
    }
    document.querySelectorAll('[data-route]').forEach(link => link.addEventListener('click', () => {
        if (location.hash === '#' + link.dataset.route) route();
    }));
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
        el('ovUv').textContent = valid(data.uv_mw_cm2)
            ? data.uv_mw_cm2.toLocaleString('de-CH', {minimumFractionDigits: 4, maximumFractionDigits: 4})
            : data.uv_saturated ? 'Bereich überschritten' : '—';
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
        for (const id of ['ovTemperature', 'ovHumidity', 'ovVpd', 'ovLux', 'ovUv', 'ovLight', 'ovSoil1', 'ovSoil2']) el(id).textContent = '—';
        for (const i of [1, 2]) { el('ovProgress' + i).hidden = true; el('ovSoilNote' + i).textContent = 'Messwerte nicht verfügbar'; }
    });
    window.addEventListener('plant:pots', event => event.detail.slice(0, 2).forEach((pot, index) => {
        el('ovName' + (index + 1)).textContent = pot.name;
        el('ovProgress' + (index + 1)).setAttribute('aria-label', 'Bodenfeuchtigkeit ' + pot.name);
    }));
})();
