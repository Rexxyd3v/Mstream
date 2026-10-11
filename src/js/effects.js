const pointerFine = window.matchMedia("(hover: hover) and (pointer: fine)");

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
