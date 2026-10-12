import { recordMovieInterest } from "../recommendations.js";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

if (!TMDB_API_KEY) {
    throw new Error("Missing VITE_TMDB_API_KEY in .env");
}

document.addEventListener("DOMContentLoaded", async () => {
    const grid = document.getElementById("seriesGrid");

    if (!grid) {
        return;
    }

    try {
        const response = await fetch(`${TMDB_BASE_URL}/tv/popular?api_key=${TMDB_API_KEY}&language=en-US`);

        if (!response.ok) {
            throw new Error("TMDB request failed");
        }

        const data = await response.json();
        renderSeries(data.results, grid);
    } catch (error) {
        console.error(error);
        grid.innerHTML = "<p>Unable to load TV series.</p>";
    }
});

function renderSeries(series, grid) {
    grid.innerHTML = "";

    if (!series.length) {
        grid.innerHTML = "<p>No TV series found.</p>";
        return;
    }

    series.forEach((show, index) => {
        if (!show.poster_path) {
            return;
        }

        const article = document.createElement("article");
        article.className = "group overflow-hidden";
        article.style.animation = `cardFadeIn 0.6s ease-out backwards ${(index * 0.05)}s`;
        article.innerHTML = `
            <a href="./details.html?id=${show.id}&type=tv" class="block">
                <div class="relative overflow-hidden">
                    <img src="${IMAGE_BASE_URL}${show.poster_path}" alt="${show.name}" class="h-72 w-full object-cover transition duration-300 group-hover:scale-105">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <div class="absolute bottom-0 left-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <h3 class="line-clamp-2 text-sm font-semibold text-white">${show.name}</h3>
                        <p class="mt-1.5 text-xs text-neutral-400">${show.first_air_date || "Unknown"}</p>
                    </div>
                </div>
            </a>
        `;
        article.addEventListener("click", () => recordMovieInterest(show));
        grid.appendChild(article);
    });
}
