import { renderSpotlight } from "./movie-slides.js";
import { recordMovieInterest } from "./recommendations.js";

export function initializeCatalogPage(type, gridId) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    const heading = document.createElement("div");
    heading.className = "catalog-collection-heading";
    heading.innerHTML = `<div><p class="eyebrow">THE COLLECTION</p><h2>${type === "tv" ? "Series worth staying in for" : "Your next great movie night"}</h2></div><span>Popular right now <span aria-hidden="true">↗</span></span>`;
    grid.before(heading);
    const footer = document.createElement("div");
    footer.className = "catalog-pagination";
    footer.innerHTML = '<p class="catalog-count" role="status" aria-live="polite"></p><button class="load-more-results" type="button">Load more titles <span aria-hidden="true">↓</span></button>';
    grid.after(footer);
    const button = footer.querySelector("button");
    const status = footer.querySelector("p");
    const seen = new Set();
    let page = 0;
    let busy = false;
    let totalPages = 1;

    async function load() {
        if (busy) return;
        busy = true;
        button.disabled = true;
        button.textContent = "Loading titles…";
        grid.setAttribute("aria-busy", "true");
        status.textContent = page ? "Finding more stories for you…" : "Loading the collection…";
        try {
            const response = await fetch(`https://api.themoviedb.org/3/${type}/popular?${new URLSearchParams({ api_key: import.meta.env.VITE_TMDB_API_KEY, language: "en-US", page: String(page + 1) })}`);
            if (!response.ok) throw new Error("Catalog request failed");
            const data = await response.json();
            const items = data.results || [];
            if (page === 0) {
                const spotlight = document.getElementById("movieSpotlight");
                renderSpotlight(items, spotlight, type);
                if (spotlight) spotlight.hidden = !spotlight.children.length;
            }
            let firstNewLink;
            items.forEach((item, index) => {
                if (!item.id || !item.poster_path || seen.has(item.id)) return;
                seen.add(item.id);
                const article = document.createElement("article");
                article.className = "catalog-poster-card group";
                article.style.setProperty("--card-delay", `${Math.min(index, 5) * 45}ms`);
                const link = document.createElement("a");
                link.href = `./details.html?id=${item.id}&type=${type}`;
                const artwork = document.createElement("div");
                artwork.className = "catalog-artwork";
                const image = document.createElement("img");
                image.src = `https://image.tmdb.org/t/p/w500${item.poster_path}`;
                image.alt = "";
                image.loading = "lazy";
                const rating = document.createElement("span");
                rating.className = "poster-rating";
                rating.textContent = item.vote_average ? `★ ${item.vote_average.toFixed(1)}` : "New";
                artwork.append(image, rating);
                const copy = document.createElement("div");
                copy.className = "catalog-card-copy";
                const title = document.createElement("h3");
                title.textContent = item.title || item.name || "Untitled";
                const meta = document.createElement("p");
                meta.textContent = `${(item.release_date || item.first_air_date || "").slice(0, 4) || "Coming soon"} · ${type === "tv" ? "Series" : "Movie"}`;
                copy.append(title, meta);
                link.append(artwork, copy);
                link.addEventListener("click", () => recordMovieInterest(item));
                article.append(link);
                grid.append(article);
                firstNewLink ||= link;
            });
            if (page && firstNewLink) firstNewLink.focus({ preventScroll: true });
            page += 1;
            totalPages = Math.min(data.total_pages || 1, 500);
            status.textContent = `${seen.size} ${type === "tv" ? "series" : "movies"} to explore${page >= totalPages ? " · You’re all caught up" : ""}`;
            button.hidden = page >= totalPages;
            button.textContent = "Load more titles ↓";
        } catch {
            status.textContent = page ? "Couldn’t load more titles. Your collection is still here." : "Couldn’t load the collection. Please try again.";
            button.textContent = "Try again ↻";
        } finally {
            busy = false;
            button.disabled = false;
            grid.removeAttribute("aria-busy");
        }
    }
    button.addEventListener("click", load);
    load();
}
