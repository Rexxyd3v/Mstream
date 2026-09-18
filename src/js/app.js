const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

if (!TMDB_API_KEY) {
    throw new Error("Missing VITE_TMDB_API_KEY in .env");
}

// Load popular movies on page load
document.addEventListener("DOMContentLoaded", () => {
    document
        .getElementById("searchButton")
        .addEventListener("click", searchMovies);

    document
        .getElementById("searchInput")
        .addEventListener("keydown", event => {
            if (event.key === "Enter") {
                searchMovies();
            }
        });

    loadPopularMovies();
});

async function loadPopularMovies() {
    const url =
        `${TMDB_BASE_URL}/movie/popular` +
        `?api_key=${TMDB_API_KEY}` +
        `&language=en-US`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("TMDB request failed");
        }

        const data = await response.json();

        displayMovies(data.results);

    } catch (error) {
        console.error(error);

        document.getElementById("movieGrid").innerHTML =
            "<p>Unable to load movies.</p>";
    }
}

async function searchMovies() {

    const query = document
        .getElementById("searchInput")
        .value
        .trim();

    if (!query) {
        return;
    }

    const url =
        `${TMDB_BASE_URL}/search/movie` +
        `?api_key=${TMDB_API_KEY}` +
        `&query=${encodeURIComponent(query)}` +
        `&language=en-US`;

    try {

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("TMDB request failed");
        }

        const data = await response.json();

        document.getElementById("sectionTitle").textContent = `Search Results for "${query}"`;

        displayMovies(data.results);

    } catch (error) {

        console.error(error);

        document.getElementById("movieGrid").innerHTML =
            "<p>Unable to load movies.</p>";
    }
}


function displayMovies(movies) {

    const grid = document.getElementById("movieGrid");

    grid.innerHTML = "";

    movies.forEach(movie => {

        if (!movie.poster_path) {
            return;
        }

        const card = document.createElement("div");

        card.className = "movie-card";

        card.innerHTML = `
            <img
                src="${IMAGE_BASE_URL}${movie.poster_path}"
                alt="${movie.title}"
                class="w-full h-64 object-cover"
            >

            <div class="movie-info">

                <h3 class="text-lg font-bold mb-2">${movie.title}</h3>

                <p class="text-sm text-gray-400 mb-1">
                    ${movie.release_date || "Unknown"}
                </p>

                <p class="text-sm">
                    Rating: ${movie.vote_average?.toFixed(1) || "N/A"}
                </p>

            </div>
        `;

        card.addEventListener("click", () => {
            showMovieDetails(movie.id);
        });

        grid.appendChild(card);
    });
}


async function showMovieDetails(movieId) {

    const url =
        `${TMDB_BASE_URL}/movie/${movieId}` +
        `?api_key=${TMDB_API_KEY}` +
        `&language=en-US`;

    try {

        const response = await fetch(url);

        const movie = await response.json();

        document.getElementById("detailPoster").src =
            movie.poster_path
                ? IMAGE_BASE_URL + movie.poster_path
                : "";

        document.getElementById("detailTitle").textContent =
            movie.title;

        document.getElementById("detailOverview").textContent =
            movie.overview || "No description available.";

        document.getElementById("detailDate").textContent =
            movie.release_date || "Unknown";

        document.getElementById("detailRating").textContent =
            movie.vote_average
                ? movie.vote_average.toFixed(1)
                : "N/A";

        /*
         * This demonstrates how the TMDB ID maps
         * to the URL pattern you provided.
         *
         * Do not automatically embed third-party
         * streaming content unless you have permission
         * to use that service.
         */
        const cinemaOSUrl =
            `https://cinemaos.tech/player/${movieId}`;

        document.getElementById("watchButton").onclick = () => {

            window.open(
                cinemaOSUrl,
                "_blank",
                "noopener,noreferrer"
            );

        };

        document.getElementById("details").hidden = false;

        document
            .getElementById("details")
            .scrollIntoView({
                behavior: "smooth"
            });

    } catch (error) {

        console.error(error);

    }
}
