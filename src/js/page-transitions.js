const transitionDuration = 260;

function getTransitionOverlay() {
    let overlay = document.querySelector(".page-transition-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "page-transition-overlay";
        overlay.setAttribute("aria-hidden", "true");
        document.body.appendChild(overlay);
    }
    return overlay;
}

document.addEventListener("DOMContentLoaded", () => {
    const overlay = getTransitionOverlay();
    requestAnimationFrame(() => overlay.classList.add("page-transition-ready"));

    document.addEventListener("click", event => {
        const link = event.target instanceof Element
            ? event.target.closest("a[href]")
            : null;
        if (!link || event.defaultPrevented || event.button !== 0
            || link.target === "_blank" || link.hasAttribute("download")
            || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        const destination = new URL(link.href, window.location.href);
        if (destination.origin !== window.location.origin
            || destination.pathname === window.location.pathname
            && destination.search === window.location.search
            && destination.hash === window.location.hash) {
            return;
        }

        event.preventDefault();
        getTransitionOverlay().classList.remove("page-transition-ready");
        window.setTimeout(() => {
            window.location.href = destination.href;
        }, transitionDuration);
    });
});

window.addEventListener("pageshow", () => {
    const overlay = getTransitionOverlay();
    overlay.classList.add("page-transition-ready");
});
