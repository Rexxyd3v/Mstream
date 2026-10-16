const baseUrl = "https://api.themoviedb.org/3";

async function request(path, params, signal) {
    const response = await fetch(`${baseUrl}/${path}?${new URLSearchParams({ api_key: import.meta.env.VITE_TMDB_API_KEY, language: "en-US", ...params })}`, { signal });
    if (!response.ok) throw new Error("Catalog request failed");
    return response.json();
}

export async function fetchGenres() {
    const lists = await Promise.all(["movie", "tv"].map(type => request(`genre/${type}/list`, {})));
    return { movie: lists[0].genres, tv: lists[1].genres };
}

export async function fetchCatalogPage({ query, category, genre, page, signal }) {
    const types = category === "all" ? ["movie", "tv"] : [category];
    const pages = await Promise.all(types.map(async type => {
        const data = await request(`${query ? "search" : "discover"}/${type}`, {
            page: String(page), include_adult: "false",
            ...(query ? { query } : { sort_by: "popularity.desc", ...(genre ? { with_genres: genre } : {}) }),
        }, signal);
        return {
            more: page < Math.min(data.total_pages || 1, 500),
            results: (data.results || []).filter(item => item.poster_path && (!genre || item.genre_ids?.includes(Number(genre)))).map(item => ({ ...item, media_type: type })),
        };
    }));
    return { results: pages.flatMap(data => data.results).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)), more: pages.some(data => data.more) };
}
