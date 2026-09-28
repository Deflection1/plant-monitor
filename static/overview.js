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
    el('overviewGalleryButton').addEventListener('click', () => {
        el('galleryButton').click();
    });
    window.addEventListener('plant:current', event => {
        const data = event.detail;
        el('ovTemperature').textContent = valueText(data.temperature);
        el('ovHumidity').textContent = valueText(data.humidity);
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
        for (const id of ['ovTemperature', 'ovHumidity', 'ovLux', 'ovLight', 'ovSoil1', 'ovSoil2']) el(id).textContent = '—';
        for (const i of [1, 2]) { el('ovProgress' + i).hidden = true; el('ovSoilNote' + i).textContent = 'Messwerte nicht verfügbar'; }
    });
    window.addEventListener('plant:pots', event => event.detail.slice(0, 2).forEach((pot, index) => {
        el('ovName' + (index + 1)).textContent = pot.name;
        el('ovProgress' + (index + 1)).setAttribute('aria-label', 'Bodenfeuchtigkeit ' + pot.name);
    }));
    let photoSignature = null;
    const dateText = value => new Date(value).toLocaleString('de-CH', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'});
    el('overviewPhoto').addEventListener('error', () => {
        el('overviewPhoto').hidden = true; el('overviewPhotoEmpty').hidden = false;
        el('overviewPhotoDate').textContent = 'Bild konnte nicht geladen werden'; photoSignature = null;
        el('overviewPhotoLink').removeAttribute('href');
    });
    async function refreshPhotos() {
        try {
            const response = await fetch('/api/camera/photos?limit=6', {cache: 'no-store'});
            if (!response.ok) throw new Error('Photos unavailable');
            const data = await response.json();
            const photos = data.photos || [];
            el('overviewJournalNote').textContent = photos.length ? 'Die letzten Aufnahmen · Bild öffnen für volle Auflösung' : 'Mit deinem ersten Foto beginnt die Chronik.';
            const signature = JSON.stringify(photos);
            if (signature === photoSignature) return;
            photoSignature = signature;
            el('overviewThumbnails').replaceChildren();
            el('overviewPhoto').hidden = !photos.length; el('overviewPhotoEmpty').hidden = !!photos.length;
            if (!photos.length) { el('overviewPhotoLink').removeAttribute('href'); el('overviewPhotoDate').textContent = 'Noch keine Aufnahme'; return; }
            el('overviewPhotoLink').href = photos[0].url;
            el('overviewPhoto').src = photos[0].url;
            el('overviewPhotoDate').textContent = 'Aufnahme · ' + dateText(photos[0].captured_at);
            for (const photo of photos) {
                const link = document.createElement('a'); link.href = photo.url; link.target = '_blank'; link.rel = 'noopener';
                const image = document.createElement('img'); image.src = photo.url; image.loading = 'lazy'; image.alt = 'Pflanzenaufnahme ' + dateText(photo.captured_at);
                const caption = document.createElement('span'); caption.textContent = dateText(photo.captured_at);
                link.append(image, caption); el('overviewThumbnails').append(link);
            }
        } catch { el('overviewJournalNote').textContent = 'Fotochronik momentan nicht erreichbar.'; }
    }
    refreshPhotos();
    setInterval(refreshPhotos, 60000);
})();
