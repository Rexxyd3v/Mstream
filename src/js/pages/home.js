import { getMoviePreferences, recordMovieInterest } from "../recommendations.js";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

if (!TMDB_API_KEY) {
    throw new Error("Missing VITE_TMDB_API_KEY in .env");
}

document.addEventListener("DOMContentLoaded", () => {
    const searchButton = document.getElementById("searchButton");
    const searchInput = document.getElementById("searchInput");

    if (searchButton) {
        searchButton.addEventListener("click", searchMovies);
    }

    if (searchInput) {
        searchInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                searchMovies();
            }
        });
    }

    loadPopularMovies();
});

async function loadPopularMovies() {
    const url = `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=en-US`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("TMDB request failed");
        }

        const data = await response.json();
        displayMovies(data.results);
        loadRecommendations();
    } catch (error) {
        console.error(error);

        const grid = document.getElementById("movieGrid");
        if (grid) {
            grid.innerHTML = "<p>Unable to load movies.</p>";
        }

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

async function searchMovies() {
    const input = document.getElementById("searchInput");
    const query = input ? input.value.trim() : "";

    if (!query) {
        return;
    }

    const url = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("TMDB request failed");
        }

        const data = await response.json();
        const sectionTitle = document.getElementById("sectionTitle");
        if (sectionTitle) {
            sectionTitle.textContent = `Search Results for "${query}"`;
        }

        displayMovies(data.results);
    } catch (error) {
        console.error(error);

        const grid = document.getElementById("movieGrid");
        if (grid) {
            grid.innerHTML = "<p>Unable to load movies.</p>";
        }
    }
}

function displayMovies(movies, targetGrid = document.getElementById("movieGrid")) {
    const grid = targetGrid;

    if (!grid) {
        return;
    }

    grid.innerHTML = "";

    movies.forEach((movie, index) => {
        if (!movie.poster_path) {
            return;
        }

        const card = document.createElement("article");
        card.className = "cursor-pointer overflow-hidden";
        card.style.animation = `cardFadeIn 0.6s ease-out backwards ${(index * 0.05)}s`;
        card.innerHTML = `
            <a href="./details.html?id=${movie.id}&type=movie" class="block">
                <img src="${IMAGE_BASE_URL}${movie.poster_path}" alt="${movie.title}" class="h-64 w-full object-cover">
                <div class="p-4">
                    <h3 class="text-sm font-semibold text-white">${movie.title}</h3>
                    <div class="mt-2 flex items-center justify-between text-xs text-neutral-500">
                        <span>${movie.release_date || "Unknown"}</span>
                        <span>${movie.vote_average?.toFixed(1) || "N/A"}</span>
                    </div>
                </div>
            </a>
        `;

        card.querySelector("a")?.addEventListener("click", () => {
            recordMovieInterest(movie);
        });
        grid.appendChild(card);
    });
}
