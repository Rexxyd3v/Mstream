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
        <input id="searchInput" name="q" type="search" placeholder="Search titles…" autocomplete="off" enterkeyhint="search" maxlength="150">
        <button id="searchButton" type="submit">Search <span aria-hidden="true">↗</span></button>`;
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
    form.addEventListener("submit", event => {
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
        if (!input.value && window.location.pathname.endsWith("/home.html") && new URLSearchParams(window.location.search).has("q")) {
            document.dispatchEvent(new CustomEvent("catalog-search", { detail: "" }));
        }
    });
}
