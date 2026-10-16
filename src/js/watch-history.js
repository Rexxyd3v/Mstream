import { auth } from "./firebase.js";

const PREFIX = "mstream-watch-history:v1:";
const SERVERS = ["vidsrcme", "vidsrcxyz", "vidsrccc", "moviesapi", "smashy", "111movies"];
const key = () => PREFIX + (auth?.currentUser?.uid || "guest");

function valid(item) {
    return item && Number.isSafeInteger(item.id) && item.id > 0
        && ["movie", "tv"].includes(item.type) && typeof item.title === "string"
        && SERVERS.includes(item.serverKey)
        && Number.isInteger(item.season) && item.season > 0 && item.season <= 10000
        && Number.isInteger(item.episode) && item.episode > 0 && item.episode <= 10000
        && Number.isFinite(item.openedAt) && item.openedAt > 0 && item.openedAt <= 8640000000000000;
}

export function getWatchHistory() {
    try {
        const items = JSON.parse(localStorage.getItem(key()) || "[]");
        return Array.isArray(items) ? items.filter(valid).sort((a, b) => b.openedAt - a.openedAt).slice(0, 50) : [];
    } catch { return []; }
}

export function getLastSelection(id, type) {
    return getWatchHistory().find(item => item.id === Number(id) && item.type === type);
}

function write(items) {
    try {
        localStorage.setItem(key(), JSON.stringify(items));
        window.dispatchEvent(new Event("mstream:history-changed"));
        return true;
    } catch { return false; }
}

export async function recordWatchSelection(selection) {
    if (auth) await auth.authStateReady();
    const item = {
        id: Number(selection.id), type: selection.type,
        title: String(selection.title || "Untitled").slice(0, 200),
        posterPath: typeof selection.posterPath === "string" && /^\/[\w./-]+$/.test(selection.posterPath) ? selection.posterPath : null,
        serverKey: selection.serverKey, season: selection.season, episode: selection.episode,
        openedAt: Date.now(),
    };
    if (!valid(item)) return false;
    return write([item, ...getWatchHistory().filter(old => old.id !== item.id || old.type !== item.type)].slice(0, 50));
}

export function removeWatchHistory(id, type) {
    return write(getWatchHistory().filter(item => item.id !== id || item.type !== type));
}

export function clearWatchHistory() { return write([]); }
