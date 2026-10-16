import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase.js";
import { getUserFavorites } from "../favorites-store.js";

function renderEmptyState(message, showBrowseLink = true) {
    const browseLink = showBrowseLink
        ? `<a href="./home.html" class="mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200">Browse Content</a>`
        : "";

    return `
        <div class="col-span-full flex flex-col items-center justify-center gap-4 py-20 text-center">
            <p class="text-base font-semibold text-white">${message}</p>
            ${browseLink}
        </div>
    `;
}

function renderFavorites(grid, favorites) {
    if (!favorites.length) {
        grid.innerHTML = renderEmptyState("No favorites yet.");
        return;
    }

    grid.innerHTML = "";

    favorites.forEach((item, index) => {
        const article = document.createElement("article");
        const poster = item.posterPath ? `https://image.tmdb.org/t/p/w500${item.posterPath}` : "";

        article.className = "group overflow-hidden";
        article.style.animation = `cardFadeIn 0.6s ease-out backwards ${(index * 0.05)}s`;
        article.innerHTML = `
            <a href="./details.html?id=${item.id}&type=${item.type}" class="block">
                <div class="relative overflow-hidden">
                    <img src="${poster}" alt="${item.title}" class="h-72 w-full object-cover transition duration-300 group-hover:scale-105">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
                    <div class="catalog-card-copy">
                        <h3 class="line-clamp-2 text-sm font-semibold text-white">${item.title}</h3>
                        <p class="mt-1.5 text-xs text-neutral-400">${item.releaseDate || "Unknown"}</p>
                    </div>
            </a>
        `;

        grid.appendChild(article);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById("favoritesGrid");
    if (!grid) return;

    if (!auth) {
        grid.innerHTML = renderEmptyState("Configure Firebase and log in to see your favorites.", false);
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            grid.innerHTML = renderEmptyState("Log in to see your favorites.", false);
            return;
        }

        try {
            const favorites = await getUserFavorites(user.uid);
            renderFavorites(grid, favorites);
        } catch (error) {
            console.error("Could not load favorites.", error);
            grid.innerHTML = renderEmptyState("Could not load favorites.");
        }
    });
});
