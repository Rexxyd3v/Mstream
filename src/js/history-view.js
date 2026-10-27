import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase.js";
import { clearWatchHistory, getWatchHistory, removeWatchHistory } from "./watch-history.js";
import { initializeMovieRail } from "./movie-slides.js";

export function initializeHistoryView() {
    const grid = document.getElementById("historyGrid");
    if (!grid) return;
    const status = document.getElementById("historyStatus");
    const clear = document.getElementById("clearHistory");
    function render() {
        const history = getWatchHistory();
        grid.replaceChildren();
        clear.hidden = !history.length;
        document.getElementById("historyEmpty").hidden = Boolean(history.length);
        for (const item of history) {
            const card = document.createElement("article");
            card.className = "history-card";
            const link = document.createElement("a");
            link.href = `./details.html?id=${item.id}&type=${item.type}`;
            const artwork = document.createElement("div");
            artwork.className = "history-artwork";
            if (typeof item.posterPath === "string" && /^\/[\w./-]+$/.test(item.posterPath)) {
                const image = document.createElement("img");
                image.src = `https://image.tmdb.org/t/p/w500${item.posterPath}`;
                image.alt = "";
                image.loading = "lazy";
                artwork.append(image);
            } else artwork.textContent = item.type === "tv" ? "TV SERIES" : "MOVIE";
            const title = document.createElement("h3");
            title.textContent = item.title;
            const selection = document.createElement("p");
            selection.textContent = item.type === "tv" ? `Season ${item.season} · Episode ${item.episode}` : "Ready to watch";
            const date = document.createElement("time");
            date.dateTime = new Date(item.openedAt).toISOString();
            date.textContent = `Opened ${new Date(item.openedAt).toLocaleDateString()}`;
            const cta = document.createElement("span");
            cta.className = "history-continue";
            cta.textContent = "Continue →";
            link.append(artwork, title, selection, date, cta);
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "history-remove";
            remove.textContent = "Remove";
            remove.setAttribute("aria-label", `Remove ${item.title} from history`);
            remove.addEventListener("click", () => {
                if (!removeWatchHistory(item.id, item.type)) status.textContent = "Could not update history. Allow browser storage and try again.";
                else status.textContent = "Removed from history.";
            });
            card.append(link, remove);
            grid.append(card);
        }
        initializeMovieRail(grid);
    }
    clear.addEventListener("click", () => {
        if (!window.confirm("Clear your watch history in this browser?")) return;
        status.textContent = clearWatchHistory() ? "Watch history cleared." : "Could not clear history. Allow browser storage and try again.";
    });
    window.addEventListener("mstream:history-changed", render);
    window.addEventListener("storage", render);
    if (auth) onAuthStateChanged(auth, () => { status.textContent = ""; render(); });
    else render();
}
