const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

const SERVERS = [
    {
        key: "vidsrcme",
        label: "Server 1",
        movie: id => `https://vidsrc.me/embed/movie?tmdb=${id}`,
        tv: (id, season, episode) => `https://vidsrc.me/embed/tv?tmdb=${id}&season=${season}&episode=${episode}`,
    },
    {
        key: "vidsrcxyz",
        label: "Server 2",
        movie: id => `https://vidsrc.xyz/embed/movie/${id}`,
        tv: (id, season, episode) => `https://vidsrc.xyz/embed/tv/${id}?s=${season}&e=${episode}`,
    },
    {
        key: "vidsrccc",
        label: "Server 3",
        movie: id => `https://vidsrc.cc/v2/embed/movie/${id}`,
        tv: (id, season, episode) => `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}`,
    },
    {
        key: "moviesapi",
        label: "Server 4",
        movie: id => `https://moviesapi.club/movie/${id}`,
        tv: (id, season, episode) => `https://moviesapi.club/tv/${id}-${season}-${episode}`,
    },
    {
        key: "smashy",
        label: "Server 5",
        movie: id => `https://player.smashy.stream/movie/${id}`,
        tv: (id, season, episode) => `https://player.smashy.stream/tv/${id}?s=${season}&e=${episode}`,
    },
    {
        key: "111movies",
        label: "Server 6",
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

function updateFullscreenUI() {
    const button = document.getElementById("cv-topbar-fullscreen");
    if (!button) return;
    button.querySelector(".cv-fullscreen-icon").textContent = isFullscreen() ? "[ ]" : "[+]";
    button.querySelector(".cv-btn-text").textContent = isFullscreen() ? "Exit" : "Fullscreen";
}

function showToast(message) {
    const toast = document.getElementById("cv-player-toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    window.setTimeout(() => toast.classList.remove("show"), 2500);
}

function showSkipButton() {
    document.getElementById("cv-skip-intro")?.classList.remove("hidden");
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
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Video player");
    overlay.innerHTML = `
        <div class="cv-player-topbar" id="cv-player-topbar">
            <div class="cv-player-meta">
                <span class="cv-player-title" id="cv-player-title"></span>
                <span class="cv-player-ep-tag hidden" id="cv-player-ep-tag"></span>
            </div>
            <div class="cv-server-tabs" id="cv-server-tabs">
                <span class="cv-server-label">Source</span>
                ${SERVERS.map(server => `<button class="cv-server-btn${server === SERVERS[0] ? " active" : ""}" data-server="${server.key}">${server.label}</button>`).join("")}
            </div>
            <div class="cv-player-actions">
                <button class="cv-topbar-btn" id="cv-topbar-skip" type="button">Skip Intro</button>
                <button class="cv-topbar-btn hidden" id="cv-topbar-next-ep" type="button">Next Ep</button>
                <span class="cv-room-controls hidden" id="cv-room-controls">
                    <button class="cv-topbar-btn" id="cv-room-play" type="button">Play</button>
                    <button class="cv-topbar-btn" id="cv-room-pause" type="button">Pause</button>
                    <button class="cv-topbar-btn" id="cv-room-stop" type="button">Stop</button>
                </span>
                <button class="cv-topbar-btn" id="cv-topbar-fullscreen" type="button"><span class="cv-fullscreen-icon">[+]</span> <span class="cv-btn-text">Fullscreen</span></button>
                <button class="cv-player-close" id="cv-player-close" type="button" aria-label="Close player">&times;</button>
            </div>
        </div>
        <div class="cv-player-main">
            <div class="cv-player-iframe-wrap">
                <div class="cv-player-loading" id="cv-loading"><div class="cv-spinner"></div><span>Loading stream...</span></div>
                <div class="cv-player-toast" id="cv-player-toast"></div>
                <button class="cv-skip-intro-btn hidden" id="cv-skip-intro" type="button">Skip Intro <span>S</span></button>
                <iframe id="cv-player-iframe" allowfullscreen allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *" referrerpolicy="no-referrer-when-downgrade"></iframe>
                <div class="cv-player-guest-lock hidden" id="cv-player-guest-lock" role="status"><span>The host controls playback</span></div>
            </div>
            <div class="cv-episode-panel hidden" id="cv-episode-panel">
                <div class="cv-ep-panel-header"><h3>Episodes</h3><select class="cv-season-select" id="cv-season-select"></select></div>
                <div class="cv-episode-list" id="cv-episode-list"></div>
            </div>
            <aside class="cv-chat-panel hidden" id="cv-chat-panel" aria-label="Watch Together chat">
                <div class="cv-chat-header">Room chat</div>
                <div class="cv-chat-messages" id="cv-chat-messages"></div>
                <form class="cv-chat-form" id="cv-chat-form">
                    <input id="cv-chat-input" maxlength="300" placeholder="Message..." autocomplete="off">
                    <button type="submit">Send</button>
                </form>
            </aside>
        </div>
        <div class="cv-player-notice">Streams are sourced from third-party providers. If a source does not load, try another server. <a href="https://www.themoviedb.org" target="_blank" rel="noopener">Metadata by TMDB</a></div>
    `;
    document.body.appendChild(overlay);

    iframe = overlay.querySelector("#cv-player-iframe");
    loadingEl = overlay.querySelector("#cv-loading");
    episodeList = overlay.querySelector("#cv-episode-list");
    seasonSelect = overlay.querySelector("#cv-season-select");

    overlay.querySelector("#cv-player-close").addEventListener("click", closePlayer);
    ["play", "pause", "stop"].forEach(action => {
        overlay.querySelector(`#cv-room-${action}`).addEventListener("click", () => {
            window.dispatchEvent(new CustomEvent("watch-room-command", {
                detail: { roomId: current.roomId, action },
            }));
        });
    });
    overlay.querySelector("#cv-chat-form").addEventListener("submit", event => {
        event.preventDefault();
        const input = overlay.querySelector("#cv-chat-input");
        if (input?.value.trim()) {
            window.dispatchEvent(new CustomEvent("watch-room-chat-send", {
                detail: { text: input.value.trim(), roomId: current.roomId },
            }));
            input.value = "";
        }
    });
    overlay.querySelector("#cv-server-tabs").addEventListener("click", event => {
        const button = event.target.closest("[data-server]");
        if (!button) return;
        current.server = SERVERS.find(server => server.key === button.dataset.server) || SERVERS[0];
        overlay.querySelectorAll(".cv-server-btn").forEach(item => item.classList.toggle("active", item === button));
        loadIframe();
        window.dispatchEvent(new CustomEvent("player-server-change", {
            detail: { roomId: current.roomId, serverKey: current.server.key },
        }));
    });
    overlay.querySelector("#cv-topbar-fullscreen").addEventListener("click", toggleFullscreen);
    overlay.querySelector("#cv-topbar-skip").addEventListener("click", skipIntro);
    overlay.querySelector("#cv-skip-intro").addEventListener("click", skipIntro);
    overlay.querySelector("#cv-topbar-next-ep").addEventListener("click", playNextEpisode);
    seasonSelect.addEventListener("change", () => {
        current.season = Number(seasonSelect.value);
        current.episode = 1;
        loadIframe();
        loadEpisodes();
    });
    overlay.addEventListener("mousemove", showTopbar);
    overlay.addEventListener("click", event => {
        if (event.target === overlay) closePlayer();
    });
    ["fullscreenchange", "webkitfullscreenchange"].forEach(eventName => document.addEventListener(eventName, updateFullscreenUI));
}

window.addEventListener("player-playback-command", (event) => {
    if (!current.roomId || event.detail?.action === undefined) return;
    const action = event.detail.action;
    const messages = {
        play: [{ event: "command", func: "playVideo" }, { type: "play" }, "play"],
        pause: [{ event: "command", func: "pauseVideo" }, { type: "pause" }, "pause"],
        stop: [{ event: "command", func: "stopVideo" }, { type: "stop" }, "stop"],
    }[action] || [];
    messages.forEach(message => {
        try {
            iframe?.contentWindow?.postMessage(message, "*");
            iframe?.contentWindow?.postMessage(JSON.stringify(message), "*");
        } catch (error) {
            console.warn("The stream provider rejected the playback command.", error);
        }
    });
});

function showTopbar() {
    const topbar = document.getElementById("cv-player-topbar");
    topbar?.classList.remove("hidden");
    window.clearTimeout(autoHideTimer);
    autoHideTimer = window.setTimeout(() => topbar?.classList.add("hidden"), 3500);
}

function loadIframe() {
    if (!iframe || !loadingEl) return;
    loadingEl.classList.remove("hidden");
    window.clearTimeout(loadingTimer);
    iframe.src = "about:blank";

    const source = current.type === "movie"
        ? current.server.movie(current.id)
        : current.server.tv(current.id, current.season, current.episode);
    const episodeTag = document.getElementById("cv-player-ep-tag");
    const nextButton = document.getElementById("cv-topbar-next-ep");
    if (current.type === "tv") {
        episodeTag.textContent = `S${current.season} - E${current.episode}`;
        episodeTag.classList.remove("hidden");
        nextButton.classList.remove("hidden");
    } else {
        episodeTag.classList.add("hidden");
        nextButton.classList.add("hidden");
    }

    window.setTimeout(() => {
        if (!overlay?.classList.contains("open")) return;
        iframe.onload = () => loadingEl.classList.add("hidden");
        iframe.src = source;
        loadingTimer = window.setTimeout(() => {
            loadingEl.classList.add("hidden");
            showSkipButton();
        }, 3500);
    }, 150);
}

async function loadEpisodes() {
    episodeList.innerHTML = '<div class="cv-ep-loading">Loading episodes...</div>';
    try {
        const response = await fetch(`${TMDB_BASE_URL}/tv/${current.id}/season/${current.season}?api_key=${TMDB_API_KEY}&language=en-US`);
        if (!response.ok) throw new Error("Episode request failed");
        const data = await response.json();
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
    buildOverlay();
    const roomServer = SERVERS.find(server => server.key === options.serverKey) || SERVERS[0];
    current = { id, type: mediaType, title, season: 1, episode: 1, server: roomServer, roomId: options.roomId || null, isHost: options.isHost === true };
    overlay.querySelector("#cv-player-title").textContent = title || "Now Playing";
    overlay.querySelectorAll(".cv-server-btn").forEach(button => button.classList.toggle("active", button.dataset.server === roomServer.key));
    overlay.querySelector("#cv-episode-panel").classList.toggle("hidden", mediaType !== "tv");
    overlay.querySelector("#cv-chat-panel").classList.toggle("hidden", !current.roomId);
    overlay.querySelector("#cv-room-controls").classList.toggle("hidden", !current.roomId || !current.isHost);
    const guestMode = Boolean(current.roomId && !current.isHost);
    overlay.classList.toggle("cv-player-guest-mode", guestMode);
    overlay.querySelector("#cv-player-guest-lock").classList.toggle("hidden", !guestMode);
    iframe.inert = guestMode;
    iframe.tabIndex = guestMode ? -1 : 0;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
    showTopbar();
    loadIframe();
    window.dispatchEvent(new CustomEvent("watch-room-player-open", {
        detail: { roomId: current.roomId },
    }));

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
    overlay.classList.remove("open");
    document.body.style.overflow = "";
    window.clearTimeout(loadingTimer);
    window.clearTimeout(autoHideTimer);
    if (isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    window.setTimeout(() => { if (iframe && !overlay.classList.contains("open")) iframe.src = "about:blank"; }, 250);
}

document.addEventListener("keydown", event => {
    if (!overlay?.classList.contains("open") || ["INPUT", "SELECT"].includes(event.target.tagName)) return;
    if (event.key === "Escape") return isFullscreen() ? toggleFullscreen() : closePlayer();
    if (event.key.toLowerCase() === "f") return toggleFullscreen();
    if (event.key.toLowerCase() === "s") return skipIntro();
    if (event.key.toLowerCase() === "n" && current.type === "tv") return playNextEpisode();
});

window.openPlayer = openPlayer;
window.closePlayer = closePlayer;
