import { recordMovieInterest } from "./recommendations.js";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

export function renderSpotlight(items, container, type = "movie") {
    if (!container) return;
    const movies = items.filter(item => item.backdrop_path && item.id).slice(0, 6);
    if (!movies.length) return;
    container.replaceChildren();
    container.className = "movie-spotlight";
    container.setAttribute("aria-roledescription", "carousel");
    container.setAttribute("aria-label", type === "tv" ? "Featured series" : "Featured movies");
    const track = document.createElement("div");
    track.className = "spotlight-track";
    const dots = document.createElement("div");
    dots.className = "spotlight-dots";
    dots.setAttribute("aria-label", "Choose featured title");
    const slides = [];
    const dotButtons = [];
    const status = document.createElement("span");
    status.className = "slides-sr-only";
    status.setAttribute("aria-live", "polite");
    movies.forEach((movie, index) => {
        const title = movie.title || movie.name || "Untitled";
        const slide = document.createElement("article");
        slide.className = "spotlight-slide";
        slide.setAttribute("aria-roledescription", "slide");
        slide.setAttribute("aria-label", `${index + 1} of ${movies.length}: ${title}`);
        const image = document.createElement("img");
        image.className = "spotlight-backdrop";
        image.src = `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`;
        image.alt = "";
        image.loading = index === 0 ? "eager" : "lazy";
        if (index === 0) image.fetchPriority = "high";
        const copy = document.createElement("div");
        copy.className = "spotlight-copy";
        const eyebrow = document.createElement("p");
        eyebrow.className = "spotlight-eyebrow";
        eyebrow.textContent = `${type === "tv" ? "SERIES" : "MOVIE"} SPOTLIGHT`;
        const heading = document.createElement(index === 0 ? "h1" : "h2");
        heading.textContent = title;
        const meta = document.createElement("p");
        meta.className = "spotlight-meta";
        const year = (movie.release_date || movie.first_air_date || "").slice(0, 4);
        meta.textContent = [year, movie.vote_average ? `★ ${movie.vote_average.toFixed(1)}` : "", type === "tv" ? "TV Series" : "Movie"].filter(Boolean).join("   ·   ");
        const overview = document.createElement("p");
        overview.className = "spotlight-overview";
        overview.textContent = movie.overview || "Discover your next favorite story.";
        const link = document.createElement("a");
        link.className = "spotlight-watch";
        link.href = `./details.html?id=${movie.id}&type=${type}`;
        link.textContent = "Explore title ↗";
        link.addEventListener("click", () => recordMovieInterest(movie));
        copy.append(eyebrow, heading, meta, overview, link);
        slide.append(image, copy);
        track.append(slide);
        slides.push(slide);
        const dot = document.createElement("button");
        dot.type = "button";
        dot.setAttribute("aria-label", `Show ${title}`);
        dot.addEventListener("click", () => go(index, true));
        dots.append(dot);
        dotButtons.push(dot);
    });
    let active = 0;
    let timer;
    let paused = reducedMotion.matches;
    let hovering = false;
    let focused = false;
    const controls = document.createElement("div");
    controls.className = "spotlight-controls";
    function button(label, text, handler) {
        const element = document.createElement("button");
        element.type = "button";
        element.setAttribute("aria-label", label);
        element.textContent = text;
        element.addEventListener("click", handler);
        return element;
    }
    const previous = button("Previous featured title", "←", () => go(active - 1, true));
    const next = button("Next featured title", "→", () => go(active + 1, true));
    const pause = button("Pause slideshow", "Pause", () => {
        paused = !paused;
        updatePause();
        schedule();
    });
    function updatePause() {
        pause.disabled = reducedMotion.matches;
        pause.textContent = reducedMotion.matches ? "Motion off" : paused ? "Play slides" : "Pause";
        pause.setAttribute("aria-label", reducedMotion.matches ? "Automatic slides disabled by reduced motion preference" : paused ? "Play slideshow" : "Pause slideshow");
    }
    function schedule() {
        window.clearTimeout(timer);
        if (!paused && !reducedMotion.matches && !hovering && !focused && !document.hidden && movies.length > 1) {
            timer = window.setTimeout(() => go(active + 1), 7000);
        }
    }
    function go(index, manual = false) {
        const previousActive = active;
        const direction = index < active ? -1 : 1;
        active = (index + movies.length) % movies.length;
        container.style.setProperty("--reveal-from", direction < 0 ? "0 0 0 100%" : "0 100% 0 0");
        container.style.setProperty("--reveal-drift", direction < 0 ? "-3%" : "3%");
        slides.forEach(slide => slide.classList.remove("is-departing"));
        if (active !== previousActive) slides[previousActive].classList.add("is-departing");
        slides.forEach((slide, i) => {
            slide.inert = i !== active;
            slide.setAttribute("aria-hidden", String(i !== active));
            slide.classList.toggle("is-active", i === active);
            dotButtons[i].setAttribute("aria-current", String(i === active));
        });
        if (manual) status.textContent = slides[active].getAttribute("aria-label");
        schedule();
    }
    controls.append(dots, pause, previous, next);
    if (movies.length < 2) controls.hidden = true;
    container.append(track, controls, status);
    container.addEventListener("mouseenter", () => { hovering = true; schedule(); });
    container.addEventListener("mouseleave", () => { hovering = false; schedule(); });
    container.addEventListener("focusin", () => { focused = true; schedule(); });
    container.addEventListener("focusout", event => {
        focused = container.contains(event.relatedTarget);
        schedule();
    });
    container.addEventListener("keydown", event => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
            go(active + (event.key === "ArrowRight" ? 1 : -1), true);
        }
    });
    let touch;
    container.addEventListener("touchstart", event => {
        touch = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        window.clearTimeout(timer);
    }, { passive: true });
    container.addEventListener("touchend", event => {
        if (!touch) return;
        const dx = event.changedTouches[0].clientX - touch.x;
        const dy = event.changedTouches[0].clientY - touch.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(active + (dx < 0 ? 1 : -1), true);
        touch = null;
        schedule();
    }, { passive: true });
    container.addEventListener("touchcancel", () => { touch = null; schedule(); }, { passive: true });
    document.addEventListener("visibilitychange", schedule);
    reducedMotion.addEventListener("change", () => { if (reducedMotion.matches) paused = true; updatePause(); schedule(); });
    updatePause();
    go(0);
}

export function initializeMovieRail(track) {
    if (!track) return;
    if (track._refreshRail) { track._refreshRail(); return; }
    track.classList.add("movie-rail");
    track.tabIndex = 0;
    track.setAttribute("aria-label", track.getAttribute("aria-label") || "Browse titles. Use arrow keys or swipe to slide.");
    const shell = document.createElement("div");
    shell.className = "movie-rail-shell";
    track.before(shell);
    shell.append(track);
    const controls = document.createElement("div");
    controls.className = "rail-controls";
    const buttons = [-1, 1].map(direction => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = direction < 0 ? "←" : "→";
        button.setAttribute("aria-label", direction < 0 ? "Previous titles" : "Next titles");
        button.setAttribute("aria-controls", track.id);
        button.addEventListener("click", () => move(direction));
        controls.append(button);
        return button;
    });
    shell.prepend(controls);
    function move(direction) {
        track.scrollBy({ left: direction * track.clientWidth * .85, behavior: reducedMotion.matches ? "instant" : "smooth" });
    }
    function refresh() {
        const max = track.scrollWidth - track.clientWidth;
        controls.hidden = max < 2;
        buttons[0].disabled = track.scrollLeft < 2;
        buttons[1].disabled = track.scrollLeft >= max - 2;
    }
    track.addEventListener("scroll", refresh, { passive: true });
    track.addEventListener("keydown", event => {
        if (event.target !== track || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        move(event.key === "ArrowLeft" ? -1 : 1);
    });
    new ResizeObserver(refresh).observe(track);
    track._refreshRail = () => { track.scrollLeft = 0; requestAnimationFrame(refresh); };
    track._refreshRail();
}
