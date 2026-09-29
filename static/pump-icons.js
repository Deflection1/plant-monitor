// Decorative status only. This file never sends pump commands.
(() => {
    const symbols = [1, 2].map(id => document.getElementById("pumpSymbol" + id));
    if (symbols.some(symbol => !symbol)) return;

    document.querySelectorAll("[data-pump-preview]").forEach(button => {
        button.addEventListener("click", () => {
            const id = Number(button.dataset.pumpPreview);
            const symbol = symbols[id - 1];
            const note = document.getElementById("pumpPreviewNote" + id);
            symbol.dataset.preview = "true";
            button.disabled = true;
            note.textContent = "Animationsvorschau · keine Pumpenansteuerung";
            setTimeout(() => {
                symbol.dataset.preview = "false";
                button.disabled = false;
                note.textContent = "Symbolvorschau ohne Pumpenansteuerung";
            }, 3600);
        });
    });

    function render(status) {
        const connected = status?.hardware_connected === true;
        const available = connected && status?.output_available === true;
        for (const id of [1, 2]) {
            const pump = status?.pumps?.find(p => p.id === id);
            const running = available && pump?.state === "running";
            symbols[id - 1].dataset.running = String(running);
            document.getElementById("pumpState" + id).textContent =
                !status ? "Status nicht erreichbar" :
                !connected ? "Nicht verbunden" :
                running ? "Pumpe läuft" :
                pump?.state === "idle" ? "Bereit" :
                pump?.state === "error" ? "Pumpenfehler" : "Nicht verfügbar";
        }
    }

    async function refresh() {
        if (document.hidden) {
            render(null);
            setTimeout(refresh, 5000);
            return;
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        try {
            const response = await fetch("/api/irrigation/status", {
                cache: "no-store", signal: controller.signal
            });
            if (!response.ok) throw new Error("Status unavailable");
            const status = await response.json();
            if (!Array.isArray(status?.pumps)) throw new Error("Invalid status");
            render(status);
        } catch {
            render(null);
        } finally {
            clearTimeout(timeout);
            setTimeout(refresh, 5000);
        }
    }
    refresh();
})();
