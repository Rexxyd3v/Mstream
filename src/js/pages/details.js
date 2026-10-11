import { openPlayer } from "../player.js";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase.js";
import { isUserFavorite, removeUserFavorite, saveUserFavorite } from "../favorites-store.js";

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;

if (!TMDB_API_KEY) {
    throw new Error("Missing VITE_TMDB_API_KEY in .env");
}

const urlParams = new URLSearchParams(window.location.search);
const mediaType = urlParams.get("type") || "movie";
const mediaId = urlParams.get("id");

async function renderFavoriteButton(media, user) {
    const favoriteButton = document.getElementById("favoriteButton");

    if (!favoriteButton) {
        return;
    }

    if (!user) {
        favoriteButton.textContent = "Log in to favorite";
        favoriteButton.onclick = () => document.getElementById("authUserButton")?.click();
        return;
    }

    const favorite = await isUserFavorite(user.uid, media);
    favoriteButton.textContent = favorite ? "Remove Favorite" : "Add to Favorites";

    favoriteButton.onclick = async () => {
        favoriteButton.disabled = true;
        try {
            if (favoriteButton.textContent === "Remove Favorite") {
                await removeUserFavorite(user.uid, media);
                alert("Removed from favorites.");
            } else {
                await saveUserFavorite(user.uid, media);
                alert("Added to favorites.");
            }
            await renderFavoriteButton(media, user);
        } catch (error) {
            console.error(error);
            alert("Could not update favorites. Check your Firestore rules.");
        } finally {
            favoriteButton.disabled = false;
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

        if (auth) {
            onAuthStateChanged(auth, (user) => {
                renderFavoriteButton(item, user).catch((error) => {
                    console.error("Could not load favorite state.", error);
                });
            });
        } else {
            renderFavoriteButton(item, null);
        }

        if (watchButton) {
            watchButton.onclick = () => {
                openPlayer(media.id, mediaType, item.title, media.seasons);
            };
        }
    } catch (error) {
        console.error(error);
    }
});
