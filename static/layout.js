// Navigation and disclosure behavior only; no device or configuration changes.
(() => {
    const resize = () => requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
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
    document.getElementById("overviewAnalysis").addEventListener("toggle", resize);
    // Reveal a collapsed technical field before native form validation focuses it.
    document.addEventListener("invalid", event => {
        let parent = event.target.parentElement;
        while (parent) {
            if (parent.tagName === "DETAILS") parent.open = true;
            parent = parent.parentElement;
        }
    }, true);
})();
