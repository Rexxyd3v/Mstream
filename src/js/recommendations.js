const STORAGE_KEY = "mstream-movie-preferences";

function readPreferences() {
    try {
        const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
        return {
            watchedIds: Array.isArray(value.watchedIds) ? value.watchedIds : [],
            genres: Array.isArray(value.genres) ? value.genres : [],
        };
    } catch {
        return { watchedIds: [], genres: [] };
    }
}

export function recordMovieInterest(movie) {
    if (!movie?.id) return;
    const preferences = readPreferences();
    preferences.watchedIds = [String(movie.id), ...preferences.watchedIds.filter(id => id !== String(movie.id))].slice(0, 50);
    preferences.genres = [...new Set([
        ...preferences.genres,
        ...(Array.isArray(movie.genre_ids) ? movie.genre_ids : []),
    ])].slice(0, 10);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}

export function getMoviePreferences() {
    return readPreferences();
}
