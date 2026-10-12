const pointerFine = window.matchMedia("(hover: hover) and (pointer: fine)");

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("header nav").forEach((nav, index) => {
        nav.classList.add("responsive-nav");
        const headerContent = nav.parentElement;
        if (!headerContent || headerContent.querySelector(".mobile-menu-toggle")) return;

        const toggle = document.createElement("button");
        toggle.className = "mobile-menu-toggle";
        toggle.type = "button";
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open navigation menu");
        toggle.innerHTML = '<span></span><span></span><span></span>';
        nav.id = nav.id || `main-navigation-${index}`;
        toggle.setAttribute("aria-controls", nav.id);
        headerContent.insertBefore(toggle, nav);

        toggle.addEventListener("click", () => {
            const isOpen = nav.classList.toggle("mobile-nav-open");
            toggle.classList.toggle("is-open", isOpen);
            toggle.setAttribute("aria-expanded", String(isOpen));
            toggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
        });

        nav.addEventListener("click", event => {
            if (event.target.closest("a")) {
                nav.classList.remove("mobile-nav-open");
                toggle.classList.remove("is-open");
                toggle.setAttribute("aria-expanded", "false");
            }
        });
    });
});

if (pointerFine.matches) {
    const glow = document.createElement("div");
    glow.className = "cursor-glow";
    document.body.appendChild(glow);

    document.addEventListener("pointermove", (event) => {
        glow.style.left = `${event.clientX}px`;
        glow.style.top = `${event.clientY}px`;
    });

    document.addEventListener("pointerover", (event) => {
        if (event.target instanceof Element && event.target.closest("a, button, input, article")) {
            glow.classList.add("is-hovering");
        }
    });

    document.addEventListener("pointerout", (event) => {
        if (event.target instanceof Element && event.target.closest("a, button, input, article")) {
            glow.classList.remove("is-hovering");
        }
    });
}
