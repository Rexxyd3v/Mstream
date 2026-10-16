import { renderSpotlight, initializeMovieRail } from "../movie-slides.js";
import { getMoviePreferences, recordMovieInterest } from "../recommendations.js";
import { initializeHistoryView } from "../history-view.js";
import { fetchCatalogPage, fetchGenres } from "../catalog.js";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
let catalogRequest;
let resultPage = 1;
let loadedTitles = [];
let currentQuery = "";
let genreLists;

function updateGenres() {
    if (!genreLists) return;
    const select = document.getElementById("genreFilter");
    const selected = select.value;
    const category = document.getElementById("categoryFilter").value;
    const genres = category === "all" ? [...genreLists.movie, ...genreLists.tv] : genreLists[category];
    select.replaceChildren(new Option("All genres", ""));
    [...new Map(genres.map(genre => [genre.id, genre])).values()].sort((a, b) => a.name.localeCompare(b.name)).forEach(genre => select.add(new Option(genre.name, genre.id)));
    if ([...select.options].some(option => option.value === selected)) select.value = selected;
}

if (!TMDB_API_KEY) {
    throw new Error("Missing VITE_TMDB_API_KEY in .env");
}

document.addEventListener("DOMContentLoaded", () => {
    initializeHistoryView();
    document.addEventListener("catalog-search", event => searchMovies(event.detail));
    const params = new URLSearchParams(window.location.search);
    const category = document.getElementById("categoryFilter");
    category.value = ["movie", "tv"].includes(params.get("category")) ? params.get("category") : "all";
    category.addEventListener("change", () => { updateGenres(); searchMovies(currentQuery); });
    document.getElementById("genreFilter").addEventListener("change", () => searchMovies(currentQuery));
    document.getElementById("resetFilters").addEventListener("click", () => {
        category.value = "all";
        updateGenres();
        document.getElementById("genreFilter").value = "";
        document.getElementById("searchInput").value = "";
        searchMovies("");
    });
    document.getElementById("loadMoreResults").addEventListener("click", () => searchMovies(currentQuery, true));
    const query = params.get("q")?.trim() || "";
    const savedGenre = params.get("genre");
    if (/^\d+$/.test(savedGenre || "")) document.getElementById("genreFilter").add(new Option("Selected genre", savedGenre, true, true));
    fetchGenres().then(lists => {
        genreLists = lists;
        const selected = document.getElementById("genreFilter").value;
        updateGenres();
        if (selected !== document.getElementById("genreFilter").value) searchMovies(currentQuery);
    }).catch(() => {
        document.getElementById("genreFilter").disabled = true;
        document.getElementById("searchStatus").textContent = "Genres are unavailable. You can still search by title or category.";
    });
    if (query || category.value !== "all" || savedGenre) {
        searchMovies(query);
        loadRecommendations();
    } else loadPopularMovies();
});

async function loadPopularMovies() {
    catalogRequest?.abort();
    const request = catalogRequest = new AbortController();
    const grid = document.getElementById("movieGrid");
    grid.setAttribute("aria-busy", "true");
    const url = `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=en-US`;

    try {
        const response = await fetch(url, { signal: request.signal });

        if (!response.ok) {
            throw new Error("TMDB request failed");
        }

        const data = await response.json();
        if (request.signal.aborted) return;
        displayMovies(data.results);
        renderSpotlight(data.results || [], document.getElementById("movieSpotlight"));
        loadRecommendations();
    } catch (error) {
        if (request.signal.aborted) return;
        console.error(error);

        const grid = document.getElementById("movieGrid");
        if (grid) {
            grid.innerHTML = "<p>Unable to load movies.</p>";
        }

    } finally {
        if (catalogRequest === request) grid.removeAttribute("aria-busy");
    }
}

async function loadRecommendations() {
    const preferences = getMoviePreferences();
    const section = document.getElementById("recommendationsSection");
    if (!section || !preferences.genres.length) return;

    const url = `${TMDB_BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&language=en-US&sort_by=popularity.desc&with_genres=${preferences.genres.join("|")}`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Recommendation request failed");
        const data = await response.json();
        const recommendations = data.results.filter(movie => !preferences.watchedIds.includes(String(movie.id))).slice(0, 8);
        if (!recommendations.length) return;
        section.hidden = false;
        displayMovies(recommendations, document.getElementById("recommendationGrid"));
    } catch (error) {
        console.error("Could not load recommendations.", error);
    }
}

async function searchMovies(query, append = false) {
    currentQuery = query;
    const category = document.getElementById("categoryFilter").value;
    const genre = document.getElementById("genreFilter").value;
    const filtered = Boolean(query || genre || category !== "all");
    document.querySelector("main").classList.toggle("is-searching", filtered);
    const urlState = new URL(window.location.href);
    for (const [key, value] of Object.entries({ q: query, category: category === "all" ? "" : category, genre })) {
        if (value) urlState.searchParams.set(key, value);
        else urlState.searchParams.delete(key);
    }
    window.history.replaceState(null, "", urlState);
    const sectionTitle = document.getElementById("sectionTitle");
    const grid = document.getElementById("movieGrid");
    const status = document.getElementById("searchStatus");
    const more = document.getElementById("loadMoreResults");
    document.getElementById("movieSpotlight").hidden = filtered;
    sectionTitle.textContent = query ? `Results for “${query}”` : filtered ? "Discover your next favorite" : "Popular Movies";
    grid.classList.toggle("search-results", filtered);
    grid.closest(".movie-rail-shell")?.classList.toggle("has-search-results", filtered);
    more.hidden = true;
    if (!filtered) {
        status.textContent = "";
        loadPopularMovies();
        return;
    }
    catalogRequest?.abort();
    const request = catalogRequest = new AbortController();
    if (!append) { resultPage = 1; loadedTitles = []; grid.replaceChildren(); }
    const page = append ? resultPage + 1 : 1;
    grid.setAttribute("aria-busy", "true");
    status.textContent = "Finding your next watch…";
    try {
        const data = await fetchCatalogPage({ query, category, genre, page, signal: request.signal });
        if (request.signal.aborted) return;
        resultPage = page;
        loadedTitles = [...new Map([...loadedTitles, ...data.results].map(item => [`${item.media_type}:${item.id}`, item])).values()];
        displayMovies(loadedTitles);
        more.hidden = !data.more;
        status.textContent = loadedTitles.length
            ? `${loadedTitles.length} matching ${loadedTitles.length === 1 ? "title" : "titles"} loaded${data.more ? " · More available below" : ""}`
            : data.more ? "No matches on these pages. Load more titles or adjust your filters." : "No matches. Try a different title or genre.";
        if (!append) sectionTitle.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    } catch (error) {
        if (request.signal.aborted) return;
        console.error(error);
        status.textContent = "Could not load titles. Please try again.";
        if (append) more.hidden = false;
    } finally {
        if (catalogRequest === request) grid.removeAttribute("aria-busy");
    }
}

function displayMovies(movies, targetGrid = document.getElementById("movieGrid")) {
    const grid = targetGrid;

    if (!grid) {
        return;
    }

    grid.innerHTML = "";
    grid.scrollLeft = 0;
    if (!grid.classList.contains("search-results") && !movies.some(movie => movie.poster_path)) {
        const empty = document.createElement("p");
        empty.textContent = "No titles found. Try another search.";
        grid.append(empty);
    }

    movies.forEach((movie, index) => {
        if (!movie.poster_path) {
            return;
        }

        const card = document.createElement("article");
        const title = movie.title || movie.name || "Untitled";
        const type = movie.media_type === "tv" ? "tv" : "movie";
        const date = movie.release_date || movie.first_air_date || "Unknown";
        card.className = "cursor-pointer overflow-hidden";
        card.style.animation = `cardFadeIn 0.6s ease-out backwards ${(Math.min(index, 7) * 0.05)}s`;
        card.innerHTML = `
            <a href="./details.html?id=${movie.id}&type=${type}" class="block">
                <img src="${IMAGE_BASE_URL}${movie.poster_path}" alt="" loading="lazy" class="h-64 w-full object-cover">
                <div class="p-4">
                    <h3 class="text-sm font-semibold text-white"></h3>
                    <div class="mt-2 flex items-center justify-between text-xs text-neutral-500">
                        <span>${date.slice(0, 4)} · ${type === "tv" ? "Series" : "Movie"}</span>
                        <span>${movie.vote_average?.toFixed(1) || "N/A"}</span>
                    </div>
                </div>
            </a>
        `;
        card.querySelector("h3").textContent = title;
        card.querySelector("img").alt = title;

        card.querySelector("a")?.addEventListener("click", () => {
            recordMovieInterest(movie);
        });
        grid.appendChild(card);
    });
    initializeMovieRail(grid);
    grid.closest(".movie-rail-shell")?.classList.toggle("has-search-results", grid.classList.contains("search-results"));
}
