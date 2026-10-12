const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
import { recordMovieInterest } from "../recommendations.js";

if (!TMDB_API_KEY) {
    throw new Error("Missing VITE_TMDB_API_KEY in .env");
}

document.addEventListener("DOMContentLoaded", async () => {
    const grid = document.getElementById("movieGrid");

    if (!grid) {
        return;
    }

    try {
        const response = await fetch(`${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=en-US`);

        if (!response.ok) {
            throw new Error("TMDB request failed");
        }

        const data = await response.json();
        renderMovies(data.results, grid);
    } catch (error) {
        console.error(error);
        grid.innerHTML = "<p>Unable to load movies.</p>";
    }
});

function renderMovies(movies, grid) {
    grid.innerHTML = "";

    if (!movies.length) {
        grid.innerHTML = "<p>No movies found.</p>";
        return;
    }

    movies.forEach((movie, index) => {
        if (!movie.poster_path) {
            return;
        }

        const article = document.createElement("article");
        article.className = "group overflow-hidden";
        article.style.animation = `cardFadeIn 0.6s ease-out backwards ${(index * 0.05)}s`;
        article.innerHTML = `
            <div class="relative overflow-hidden">
                <a href="./details.html?id=${movie.id}&type=movie" class="block">
                <div class="relative overflow-hidden">
                    <img src="${IMAGE_BASE_URL}${movie.poster_path}" alt="${movie.title}" class="h-72 w-full object-cover transition duration-300 group-hover:scale-105">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
                </a>
                <div class="movie-card-actions">
                    <h3 class="line-clamp-2 text-sm font-semibold text-white">${movie.title}</h3>
                    <div class="movie-card-buttons">
                        <button type="button" class="movie-watch-button">Watch</button>
                    </div>
                    <p class="mt-1.5 text-xs text-neutral-400">${movie.release_date || "Unknown"}</p>
                </div>
            </div>
        `;
        article.querySelector(".movie-watch-button").addEventListener("click", () => {
            recordMovieInterest(movie);
            window.openPlayer(movie.id, "movie", movie.title);
        });
        grid.appendChild(article);
    });
}
