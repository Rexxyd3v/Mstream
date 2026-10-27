import { fetchCatalogPage } from "./catalog.js";

export function initializeSearch(header) {
    if (!header) return;
    let form = header.querySelector(".nav-search");
    if (!form) {
        form = document.createElement("form");
        form.className = "nav-search";
        header.append(form);
    }
    form.setAttribute("role", "search");
    form.setAttribute("aria-label", "Search movies and series");
    form.action = "./home.html";
    form.innerHTML = `
        <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
        <label class="slides-sr-only" for="searchInput">Search movies and TV series</label>
        <input id="searchInput" name="q" type="search" placeholder="Search titles…" autocomplete="off" enterkeyhint="search" maxlength="150" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="searchSuggestions">
        <button id="searchButton" type="submit">Search <span aria-hidden="true">↗</span></button>
        <div class="search-suggestions" id="searchSuggestionsPanel" hidden>
            <div class="suggestions-heading"><span>QUICK SEARCH</span><span>Movies &amp; series</span></div>
            <p class="suggestions-status" role="status" aria-live="polite"></p>
            <div id="searchSuggestions" role="listbox" aria-label="Suggested titles"></div>
            <button class="suggestions-all" type="submit">See all results <span aria-hidden="true">↗</span></button>
        </div>`;
    const input = form.querySelector("input");
    const category = window.location.pathname.endsWith("/tv-series.html") ? "tv" : window.location.pathname.endsWith("/movies.html") ? "movie" : "";
    if (category) {
        const field = document.createElement("input");
        field.type = "hidden";
        field.name = "category";
        field.value = category;
        form.append(field);
    }
    input.value = new URLSearchParams(window.location.search).get("q") || "";
    const panel = form.querySelector(".search-suggestions");
    const list = form.querySelector("[role=listbox]");
    const status = form.querySelector(".suggestions-status");
    let timer;
    let request;
    let active = -1;
    let composing = false;
    const cache = new Map();
    function close() {
        clearTimeout(timer);
        request?.abort();
        panel.hidden = true;
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
        active = -1;
    }
    function render(items) {
        list.replaceChildren();
        active = -1;
        input.removeAttribute("aria-activedescendant");
        status.textContent = items.length ? "" : "No titles found. Try another name.";
        items.slice(0, 6).forEach((item, index) => {
            const link = document.createElement("a");
            link.className = "suggestion-item";
            link.id = `suggestion-${index}`;
            link.href = `./details.html?id=${item.id}&type=${item.media_type}`;
            link.setAttribute("role", "option");
            link.setAttribute("aria-selected", "false");
            link.tabIndex = -1;
            const image = document.createElement("img");
            image.src = `https://image.tmdb.org/t/p/w92${item.poster_path}`;
            image.alt = "";
            const copy = document.createElement("span");
            const title = document.createElement("strong");
            title.textContent = item.title || item.name || "Untitled";
            const meta = document.createElement("small");
            meta.textContent = [item.media_type === "tv" ? "TV series" : "Movie", (item.release_date || item.first_air_date || "").slice(0, 4), item.vote_average ? `★ ${item.vote_average.toFixed(1)}` : ""].filter(Boolean).join(" · ");
            copy.append(title, meta);
            link.append(image, copy);
            list.append(link);
        });
    }
    function suggest() {
        clearTimeout(timer);
        request?.abort();
        if (composing) return;
        const query = input.value.trim();
        if (query.length < 2) return close();
        panel.hidden = false;
        input.setAttribute("aria-expanded", "true");
        input.removeAttribute("aria-activedescendant");
        active = -1;
        list.replaceChildren();
        status.textContent = "Searching for a good story…";
        const suggestionCategory = document.getElementById("categoryFilter")?.value || category || "all";
        const genre = document.getElementById("genreFilter")?.value || "";
        const key = `${suggestionCategory}:${genre}:${query.toLowerCase()}`;
        if (cache.has(key)) return render(cache.get(key));
        timer = window.setTimeout(async () => {
            const pending = request = new AbortController();
            try {
                const data = await fetchCatalogPage({ query, category: suggestionCategory, genre, page: 1, signal: pending.signal });
                if (pending.signal.aborted || input.value.trim() !== query) return;
                if (cache.size >= 20) cache.delete(cache.keys().next().value);
                cache.set(key, data.results);
                render(data.results);
            } catch {
                if (!pending.signal.aborted) status.textContent = "Suggestions are unavailable. Press Search to try again.";
            }
        }, 250);
    }
    form.addEventListener("submit", event => {
        close();
        input.value = input.value.trim();
        if (window.location.pathname.endsWith("/home.html")) {
            event.preventDefault();
            document.dispatchEvent(new CustomEvent("catalog-search", { detail: input.value }));
        } else if (!input.value) {
            event.preventDefault();
            input.focus();
        }
    });
    input.addEventListener("input", () => {
        suggest();
        if (!input.value && window.location.pathname.endsWith("/home.html") && new URLSearchParams(window.location.search).has("q")) {
            document.dispatchEvent(new CustomEvent("catalog-search", { detail: "" }));
        }
    });
    input.addEventListener("compositionstart", () => { composing = true; close(); });
    input.addEventListener("compositionend", () => { composing = false; suggest(); });
    input.addEventListener("focus", () => { if (input.value.trim().length >= 2) suggest(); });
    input.addEventListener("keydown", event => {
        if (event.isComposing) return;
        if (event.key === "Escape") { close(); return; }
        if (panel.hidden) return;
        const options = [...list.querySelectorAll("[role=option]")];
        if (["ArrowDown", "ArrowUp"].includes(event.key) && options.length) {
            event.preventDefault();
            active = (active + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
            options.forEach((option, index) => option.setAttribute("aria-selected", String(index === active)));
            input.setAttribute("aria-activedescendant", options[active].id);
            options[active].scrollIntoView({ block: "nearest" });
        } else if (event.key === "Enter" && active >= 0 && options[active]) {
            event.preventDefault();
            options[active].click();
            close();
        }
    });
    form.addEventListener("focusout", event => { if (!form.contains(event.relatedTarget)) close(); });
    document.addEventListener("pointerdown", event => { if (!form.contains(event.target)) close(); });
}
