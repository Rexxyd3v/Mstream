import { recordWatchSelection } from "./watch-history.js";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

const SERVERS = [
    {
        key: "vidsrcme",
        movie: id => `https://vidsrc.me/embed/movie?tmdb=${id}`,
        tv: (id, season, episode) => `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`,
    },
    {
        key: "vidsrcxyz",
        movie: id => `https://vidsrc.xyz/embed/movie/${id}`,
        tv: (id, season, episode) => `https://vidsrc.xyz/embed/tv/${id}?s=${season}&e=${episode}`,
    },
    {
        key: "vidsrccc",
        movie: id => `https://vidsrc.cc/v2/embed/movie/${id}`,
        tv: (id, season, episode) => `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}`,
    },
    {
        key: "moviesapi",
        movie: id => `https://moviesapi.club/movie/${id}`,
        tv: (id, season, episode) => `https://moviesapi.club/tv/${id}-${season}-${episode}`,
    },
    {
        key: "smashy",
        movie: id => `https://player.smashy.stream/movie/${id}`,
        tv: (id, season, episode) => `https://player.smashy.stream/tv/${id}?s=${season}&e=${episode}`,
    },
    {
        key: "111movies",
        movie: id => `https://111movies.com/movie/${id}`,
        tv: (id, season, episode) => `https://111movies.com/tv/${id}/${season}/${episode}`,
    },
];

let overlay;
let iframe;
let loadingEl;
let episodeList;
let seasonSelect;
let current = {
    id: null,
    type: "movie",
    title: "",
    season: 1,
    episode: 1,
    server: SERVERS[0],
};
let loadingTimer;
let autoHideTimer;
let loadCycle = 0;
let attemptedSources = new Set();
let previousFocus;

function isFullscreen() {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

function toggleFullscreen() {
    if (!overlay) return;

    if (isFullscreen()) {
        (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
        return;
    }

    const request = overlay.requestFullscreen || overlay.webkitRequestFullscreen;
    request?.call(overlay).catch(() => {});
}

function showToast(message) {
    const toast = document.getElementById("cv-player-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 2500);
}

function skipIntro() {
    if (!iframe?.contentWindow) return;
    const messages = [
        { type: "seek", time: 85 },
        { type: "forward", seconds: 85 },
        { event: "command", func: "seekTo", args: [85, true] },
        { action: "seek", offset: 85 },
        "seek:85",
    ];

    messages.forEach(message => {
        try {
            iframe.contentWindow.postMessage(message, "*");
            iframe.contentWindow.postMessage(typeof message === "string" ? message : JSON.stringify(message), "*");
        } catch {
            // Cross-origin players may reject messaging; the server remains usable.
        }
    });
    showToast("Skipped intro (+85s)");
    document.getElementById("cv-skip-intro")?.classList.add("hidden");
}

function buildOverlay() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.id = "cv-player-overlay";
    overlay.tabIndex = -1;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Video player");
    overlay.innerHTML = `
        <div class="cv-player-controls" id="cv-player-topbar">
            <button class="cv-player-close" id="cv-player-close" type="button" aria-label="Close player">&times;</button>
            <button class="cv-episodes-toggle hidden" id="cv-topbar-episodes" type="button" aria-expanded="false" aria-controls="cv-episode-panel">Episodes</button>
        </div>
        <div class="cv-player-main">
            <div class="cv-player-iframe-wrap">
                <div class="cv-player-loading" id="cv-loading"><div class="cv-spinner"></div><span id="cv-loading-status" role="status">Finding your stream…</span><button class="cv-retry-stream hidden" id="cv-retry-stream" type="button">Try again</button></div>
                <div class="cv-player-toast" id="cv-player-toast"></div>
                <button class="cv-skip-intro-btn hidden" id="cv-skip-intro" type="button">Skip Intro <span>S</span></button>
                <iframe title="Video player" id="cv-player-iframe" allowfullscreen allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *" referrerpolicy="no-referrer-when-downgrade"></iframe>
            </div>
            <div class="cv-episode-panel hidden" id="cv-episode-panel">
                <div class="cv-ep-panel-header"><h3>Episodes</h3><select class="cv-season-select" id="cv-season-select"></select></div>
                <div class="cv-episode-list" id="cv-episode-list"></div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    iframe = overlay.querySelector("#cv-player-iframe");
    loadingEl = overlay.querySelector("#cv-loading");
    episodeList = overlay.querySelector("#cv-episode-list");
    seasonSelect = overlay.querySelector("#cv-season-select");

    overlay.querySelector("#cv-player-close").addEventListener("click", closePlayer);
    overlay.querySelector("#cv-retry-stream").addEventListener("click", () => loadIframe());
    overlay.querySelector("#cv-topbar-episodes").addEventListener("click", event => {
        const expanded = event.currentTarget.getAttribute("aria-expanded") !== "true";
        event.currentTarget.setAttribute("aria-expanded", String(expanded));
        overlay.querySelector("#cv-episode-panel").classList.toggle("hidden", !expanded);
        overlay.classList.toggle("has-episodes", expanded);
        showTopbar();
    });
    overlay.querySelector("#cv-skip-intro").addEventListener("click", skipIntro);
    seasonSelect.addEventListener("change", () => {
        current.season = Number(seasonSelect.value);
        current.episode = 1;
        loadIframe();
        loadEpisodes();
    });
    overlay.addEventListener("pointermove", showTopbar);
    overlay.addEventListener("touchstart", showTopbar, { passive: true });
    overlay.addEventListener("focusin", showTopbar);
    overlay.addEventListener("click", event => {
        if (event.target === overlay) closePlayer();
    });
}

function showTopbar() {
    const topbar = document.getElementById("cv-player-topbar");
    topbar?.classList.remove("is-idle");
    window.clearTimeout(autoHideTimer);
    autoHideTimer = window.setTimeout(() => {
        if (!topbar?.contains(document.activeElement) && !overlay?.classList.contains("has-episodes")) topbar?.classList.add("is-idle");
    }, 3500);
}

function loadIframe(fallback = false) {
    if (!iframe || !loadingEl || !overlay.classList.contains("open")) return;
    const cycle = ++loadCycle;
    if (!fallback) attemptedSources = new Set();
    attemptedSources.add(current.server.key);
    window.clearTimeout(loadingTimer);
    document.getElementById("cv-retry-stream").classList.add("hidden");
    document.getElementById("cv-loading-status").textContent = fallback ? "Trying another connection…" : "Finding your stream…";
    loadingEl.classList.remove("hidden");
    const source = current.type === "movie"
        ? current.server.movie(current.id)
        : current.server.tv(current.id, current.season, current.episode);
    const nextFrame = iframe.cloneNode(false);
    function advance() {
        if (cycle !== loadCycle || !overlay.classList.contains("open")) return;
        window.clearTimeout(loadingTimer);
        const next = SERVERS.find(server => !attemptedSources.has(server.key));
        if (next) {
            current.server = next;
            loadIframe(true);
        } else {
            ++loadCycle;
            nextFrame.src = "about:blank";
            loadingEl.querySelector(".cv-spinner").classList.add("hidden");
            document.getElementById("cv-loading-status").textContent = "We couldn’t connect. Please try again in a moment.";
            document.getElementById("cv-retry-stream").classList.remove("hidden");
        }
    }
    nextFrame.addEventListener("load", () => {
        if (cycle !== loadCycle || !overlay.classList.contains("open")) return;
        window.clearTimeout(loadingTimer);
        loadingEl.classList.add("hidden");
        recordWatchSelection({ ...current, serverKey: current.server.key }).catch(() => {});
    }, { once: true });
    nextFrame.addEventListener("error", advance, { once: true });
    loadingEl.querySelector(".cv-spinner").classList.remove("hidden");
    nextFrame.src = source;
    iframe.replaceWith(nextFrame);
    iframe = nextFrame;
    // Cross-origin frames expose navigation events, not playback state.
    // Only retry startup failures; never interrupt a frame that has loaded.
    loadingTimer = window.setTimeout(advance, 18000);
}

async function loadEpisodes() {
    const requestedId = current.id;
    const requestedSeason = current.season;
    episodeList.innerHTML = '<div class="cv-ep-loading">Loading episodes...</div>';
    try {
        const response = await fetch(`${TMDB_BASE_URL}/tv/${current.id}/season/${current.season}?api_key=${TMDB_API_KEY}&language=en-US`);
        if (!response.ok) throw new Error("Episode request failed");
        const data = await response.json();
        if (current.id !== requestedId || current.season !== requestedSeason) return;
        const episodes = data.episodes || [];
        episodeList.innerHTML = episodes.length
            ? episodes.map(episode => `<button class="cv-ep-item${episode.episode_number === current.episode ? " playing" : ""}" type="button" data-episode="${episode.episode_number}"><span class="cv-ep-num">E${episode.episode_number}</span><span class="cv-ep-info"><strong>${escapeHtml(episode.name || `Episode ${episode.episode_number}`)}</strong><small>${escapeHtml(episode.overview || "No synopsis available.")}</small></span></button>`).join("")
            : '<div class="cv-ep-loading">No episodes found.</div>';
        episodeList.querySelectorAll("[data-episode]").forEach(button => button.addEventListener("click", () => {
            current.episode = Number(button.dataset.episode);
            episodeList.querySelectorAll(".cv-ep-item").forEach(item => item.classList.remove("playing"));
            button.classList.add("playing");
            loadIframe();
        }));
    } catch (error) {
        episodeList.innerHTML = '<div class="cv-ep-loading">Could not load episodes.</div>';
        console.error("[MStream Player] Episode load failed:", error);
    }
}

function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function populateSeasons(seasons) {
    const validSeasons = (seasons || []).filter(season => season.season_number > 0);
    seasonSelect.innerHTML = validSeasons.map(season => `<option value="${season.season_number}">Season ${season.season_number}</option>`).join("");
    seasonSelect.value = String(current.season);
}

function playNextEpisode() {
    const nextEpisode = episodeList?.querySelector(`[data-episode="${current.episode + 1}"]`);
    if (!nextEpisode) {
        showToast(`End of Season ${current.season}`);
        return;
    }
    nextEpisode.click();
}

export function openPlayer(id, mediaType, title, seasons = [], options = {}) {
    previousFocus = document.activeElement;
    buildOverlay();
    const playerServer = SERVERS.find(server => server.key === options.serverKey) || SERVERS[0];
    current = { id, type: mediaType, title, posterPath: options.posterPath || null,
        season: Number.isInteger(options.season) && options.season > 0 ? options.season : 1,
        episode: Number.isInteger(options.episode) && options.episode > 0 ? options.episode : 1,
        server: playerServer };
    overlay.querySelector("#cv-episode-panel").classList.add("hidden");
    overlay.classList.remove("has-episodes");
    const episodesToggle = overlay.querySelector("#cv-topbar-episodes");
    episodesToggle.classList.toggle("hidden", mediaType !== "tv");
    episodesToggle.setAttribute("aria-expanded", "false");
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    overlay.focus({ preventScroll: true });
    showTopbar();
    loadIframe();
    if (mediaType === "tv") {
        if (seasons.length) {
            populateSeasons(seasons);
            loadEpisodes();
        } else {
            fetch(`${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}&language=en-US`)
                .then(response => response.json())
                .then(show => { populateSeasons(show.seasons); loadEpisodes(); })
                .catch(() => { episodeList.innerHTML = '<div class="cv-ep-loading">Could not load seasons.</div>'; });
        }
    }
}

export function closePlayer() {
    if (!overlay) return;
    ++loadCycle;
    overlay.classList.remove("open");
    iframe.src = "about:blank";
    previousFocus?.focus?.({ preventScroll: true });
    document.body.style.overflow = "";
    window.clearTimeout(loadingTimer);
    window.clearTimeout(autoHideTimer);
    if (isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    window.setTimeout(() => { if (iframe && !overlay.classList.contains("open")) iframe.src = "about:blank"; }, 250);
}

document.addEventListener("keydown", event => {
    if (!overlay?.classList.contains("open")) return;
    if (event.key === "Escape") return isFullscreen() ? toggleFullscreen() : closePlayer();
    if (event.target.isContentEditable
        || ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(event.target.tagName)) return;
    if (event.key.toLowerCase() === "f") return toggleFullscreen();
    if (event.key.toLowerCase() === "s") return skipIntro();
    if (event.key.toLowerCase() === "n" && current.type === "tv") return playNextEpisode();
});

window.openPlayer = openPlayer;
window.closePlayer = closePlayer;
