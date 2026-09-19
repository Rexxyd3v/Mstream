const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const FAVORITES_STORAGE_KEY = "freeMoviesFavorites";
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

if (!TMDB_API_KEY) {
    throw new Error("Missing VITE_TMDB_API_KEY in .env");
}

const urlParams = new URLSearchParams(window.location.search);
const mediaType = urlParams.get("type") || "movie";
const mediaId = urlParams.get("id");

function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
    } catch {
        return [];
    }
}

function saveFavorites(favorites) {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
}

function isFavorite(id, type) {
    return getFavorites().some((item) => item.id === Number(id) && item.type === type);
}

function toggleFavorite(item) {
    const favorites = getFavorites();
    const exists = favorites.some((favorite) => favorite.id === item.id && favorite.type === item.type);

    if (exists) {
        const updatedFavorites = favorites.filter((favorite) => !(favorite.id === item.id && favorite.type === item.type));
        saveFavorites(updatedFavorites);
        return false;
    }

    favorites.push(item);
    saveFavorites(favorites);
    return true;
}

function renderFavoriteButton(media) {
    const favoriteButton = document.getElementById("favoriteButton");

    if (!favoriteButton) {
        return;
    }

    const favorite = isFavorite(media.id, media.type);
    favoriteButton.textContent = favorite ? "Remove Favorite" : "Add to Favorites";

    favoriteButton.onclick = () => {
        const saved = toggleFavorite(media);
        renderFavoriteButton(media);
        if (saved) {
            alert("Added to favorites.");
        } else {
            alert("Removed from favorites.");
        }
    };
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!mediaId) {
        return;
    }

    try {
        const response = await fetch(
            `${TMDB_BASE_URL}/${mediaType}/${mediaId}?api_key=${TMDB_API_KEY}&language=en-US`
        );

        if (!response.ok) {
            throw new Error("TMDB request failed");
        }

        const media = await response.json();
        const poster = document.getElementById("detailPoster");
        const title = document.getElementById("detailTitle");
        const overview = document.getElementById("detailOverview");
        const date = document.getElementById("detailDate");
        const rating = document.getElementById("detailRating");
        const watchButton = document.getElementById("watchButton");

        const item = {
            id: media.id,
            type: mediaType,
            title: media.title || media.name,
            overview: media.overview,
            posterPath: media.poster_path,
            releaseDate: media.release_date || media.first_air_date,
            voteAverage: media.vote_average,
        };

        if (poster) poster.src = media.poster_path ? IMAGE_BASE_URL + media.poster_path : "";
        if (title) title.textContent = item.title || "Untitled";
        if (overview) overview.textContent = item.overview || "No description available.";
        if (date) date.textContent = item.releaseDate || "Unknown";
        if (rating) rating.textContent = item.voteAverage ? item.voteAverage.toFixed(1) : "N/A";

        renderFavoriteButton(item);

        if (watchButton) {
            watchButton.onclick = () => {
                window.open(`https://cinemaos.tech/player/${mediaId}`, "_blank", "noopener,noreferrer");
            };
        }
    } catch (error) {
        console.error(error);
    }
});

