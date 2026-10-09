// Pump status, decorative preview and bounded manual tests.
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
        if (window.renderTankStatus) window.renderTankStatus(status);
        const connected = status?.hardware_connected === true;
        const available = connected && status?.output_available === true;
        document.querySelectorAll("[data-pump-test]").forEach(button => {
            button.disabled = !available || !status?.tank_ok || status?.active_pump != null;
        });
        document.getElementById("pumpTestMessage").textContent =
            status ? (status.error || status.message) : "Pumpenstatus nicht erreichbar";
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
    async function command(path, payload) {
        document.querySelectorAll("[data-pump-test]").forEach(button => { button.disabled = true; });
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        try {
            const response = await fetch(path, {method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(payload), signal: controller.signal});
            const result = await response.json();
            if (!response.ok) throw new Error(result.detail || "Pumpenbefehl fehlgeschlagen");
            const statusResponse = await fetch("/api/irrigation/status", {cache: "no-store", signal: controller.signal});
            if (!statusResponse.ok) throw new Error("Status nicht erreichbar");
            render(await statusResponse.json());
        } catch (error) {
            document.getElementById("pumpTestMessage").textContent = error.message;
        } finally {
            clearTimeout(timeout);
        }
    }
    document.querySelectorAll("[data-pump-test]").forEach(button => {
        button.addEventListener("click", () => command("/api/irrigation/test",
            {pump_id: Number(button.dataset.pumpTest), seconds: 5}));
    });
    document.getElementById("pumpStop").addEventListener("click",
        () => command("/api/irrigation/stop", {}));
    refresh();
})();
