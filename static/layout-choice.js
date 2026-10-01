// Browser-local layout preference, independent of appearance and device settings.
(() => {
    const key = 'plant-monitor.layout';
    const valid = value => ['classic', 'sidebar'].includes(value) ? value : 'sidebar';
    let current = 'sidebar';
    try { current = valid(localStorage.getItem(key)); } catch { /* Storage is optional. */ }
    function apply(value) {
        current = valid(value);
        document.documentElement.dataset.layout = current;
        const stylesheet = document.getElementById('sidebarLayoutStylesheet');
        if (stylesheet) stylesheet.disabled = current === 'classic';
        const analysis = document.getElementById('overviewAnalysis');
        const destination = document.getElementById(current === 'classic' ? 'classicHistorySlot' : 'historyView');
        // Move the same chart nodes; keep readings, device forms and chart instances.
        if (analysis && destination && analysis.parentElement !== destination) destination.append(analysis);
        const select = document.getElementById('layoutSelect');
        if (select) select.value = current;
        window.dispatchEvent(new Event('plant:layout'));
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
    window.plantLayout = {current: () => current};
    apply(current);
    document.addEventListener('DOMContentLoaded', () => {
        apply(current);
        const select = document.getElementById('layoutSelect');
        if (!select) return;
        select.addEventListener('change', () => {
            apply(select.value);
            const note = document.getElementById('layoutPreferenceNote');
            try {
                localStorage.setItem(key, current);
                if (note) note.textContent = '';
            } catch {
                if (note) note.textContent = 'Layout aktiv · Speichern im Browser nicht möglich.';
            }
        });
    });
    window.addEventListener('storage', event => {
        if (event.key !== key && event.key !== null) return;
        let value;
        try { value = localStorage.getItem(key); } catch { /* Fall back to sidebar. */ }
        apply(value);
    });
})();
