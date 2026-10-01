// Navigation and disclosure behavior only; no device or configuration changes.
(() => {
    const sidebar = document.getElementById('appSidebar');
    const toggle = document.getElementById('navigationToggle');
    function menu(open) {
        if (!sidebar || !toggle) return;
        sidebar.dataset.open = String(open);
        toggle.setAttribute('aria-expanded', String(open));
        toggle.setAttribute('aria-label', open ? 'Navigation schließen' : 'Navigation öffnen');
    }
    toggle?.addEventListener('click', () => menu(sidebar.dataset.open !== 'true'));
    document.querySelectorAll('[data-route]').forEach(link => link.addEventListener('click', () => {
        menu(false);
        // Move keyboard focus out of the collapsed mobile navigation.
        requestAnimationFrame(() => {
            const targetIds = {licht: 'lampControlSection', bewaesserung: 'irrigationControlSection', lueftung: 'fanControlSection', system: 'systemDiagnostics', kamera: 'sharedCameraPanel'};
            const view = ['overviewView', 'historyView', 'controlsView'].map(id => document.getElementById(id)).find(element => element && !element.hidden);
            const target = document.getElementById(targetIds[link.dataset.route]) || view;
            const heading = target?.querySelector('h2, summary');
            if (!targetIds[link.dataset.route]) target?.scrollIntoView({block: 'start'});
            if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({preventScroll: true}); }
        });
    }));
    window.addEventListener('hashchange', () => menu(false));
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && sidebar?.dataset.open === 'true') { menu(false); toggle.focus(); }
    });
    document.querySelectorAll("[data-jump]").forEach(button => {
        button.addEventListener("click", () => {
            const target = document.getElementById(button.dataset.jump);
            if (!target) return;
            if (target.tagName === "DETAILS") target.open = true;
            target.scrollIntoView({block:"start", behavior:"auto"});
            const heading = target.querySelector("h2, summary");
            if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus({preventScroll:true}); }
        });
    });
    // Reveal a collapsed technical field before native form validation focuses it.
    document.addEventListener("invalid", event => {
        let parent = event.target.parentElement;
        while (parent) {
            if (parent.tagName === "DETAILS") parent.open = true;
            parent = parent.parentElement;
        }
    }, true);
})();
