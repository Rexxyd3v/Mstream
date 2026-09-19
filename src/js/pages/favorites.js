const FAVORITES_STORAGE_KEY = "freeMoviesFavorites";

function getFavorites() {
    try {
        return JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) || "[]");
    } catch {
        return [];
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const grid = document.getElementById("favoritesGrid");

    if (!grid) {
        return;
    }

    const favorites = getFavorites();

    if (!favorites.length) {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center gap-4 rounded-3xl border border-white/6 bg-neutral-900/50 py-20 text-center card-inner-glow">
                <div class="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/8 bg-white/5">
                    <svg class="h-8 w-8 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                </div>
                <div>
                    <p class="text-base font-semibold text-white">No favorites yet</p>
                    <p class="mt-1 text-sm text-neutral-500">Browse movies and TV series and add them to your watchlist.</p>
                </div>
                <a href="./home.html" class="mt-2 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-neutral-200 active:scale-95">
                    Browse Content
                </a>
            </div>
        `;
        return;
    }

    grid.innerHTML = "";

    favorites.forEach((item) => {
        const article = document.createElement("article");
        const poster = item.posterPath ? `https://image.tmdb.org/t/p/w500${item.posterPath}` : "";

        article.className = "group overflow-hidden rounded-3xl border border-white/6 bg-neutral-900/80 shadow-[0_18px_40px_rgba(0,0,0,0.5)] card-hover card-inner-glow";
        article.innerHTML = `
            <a href="./details.html?id=${item.id}&type=${item.type}" class="block">
                <div class="relative overflow-hidden">
                    <img src="${poster}" alt="${item.title}" class="h-72 w-full object-cover transition duration-500 group-hover:scale-105">
                    <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                    <span class="absolute left-3 top-3 flex items-center gap-1 rounded-full border border-rose-500/20 bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-rose-400 backdrop-blur-sm">
                        <svg class="h-3 w-3" fill="currentColor" viewBox="0 0 20 20"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"/></svg>
                        Saved
                    </span>
                </div>
                <div class="p-4">
                    <h3 class="line-clamp-2 text-sm font-semibold text-white">${item.title}</h3>
                    <p class="mt-1.5 text-xs text-neutral-500">${item.releaseDate || "Unknown"}</p>
                </div>
            </a>
        `;

        grid.appendChild(article);
    });
});

