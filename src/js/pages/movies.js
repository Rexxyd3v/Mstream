const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

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

    movies.forEach((movie) => {
        if (!movie.poster_path) {
            return;
        }

        const article = document.createElement("article");
        article.className = "group overflow-hidden rounded-3xl border border-white/6 bg-neutral-900/80 shadow-[0_18px_40px_rgba(0,0,0,0.5)] card-hover card-inner-glow";
        article.innerHTML = `
            <a href="./details.html?id=${movie.id}&type=movie" class="block">
                <div class="relative overflow-hidden">
                    <img src="${IMAGE_BASE_URL}${movie.poster_path}" alt="${movie.title}" class="h-72 w-full object-cover transition duration-500 group-hover:scale-105">
                    <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                    <span class="absolute bottom-3 right-3 flex items-center gap-1 rounded-full border border-amber-400/20 bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-amber-400 backdrop-blur-sm">
                        <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                        ${movie.vote_average?.toFixed(1) || "N/A"}
                    </span>
                </div>
                <div class="p-4">
                    <h3 class="line-clamp-2 text-sm font-semibold text-white">${movie.title}</h3>
                    <p class="mt-1.5 text-xs text-neutral-500">${movie.release_date || "Unknown"}</p>
                </div>
            </a>
        `;
        grid.appendChild(article);
    });
}

