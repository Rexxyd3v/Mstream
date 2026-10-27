import { recordMovieInterest } from "./recommendations.js";

// Home and title recommendations share the same poster card.
export function createMediaCard(item, { type = item.media_type === "tv" ? "tv" : "movie", headingLevel = 3, linkClass = "" } = {}) {
    const card = document.createElement("article");
    card.className = "media-card cursor-pointer overflow-hidden";
    const link = document.createElement("a");
    link.className = `block ${linkClass}`.trim();
    link.href = `./details.html?id=${item.id}&type=${type}`;
    const name = item.title || item.name || "Untitled";
    const placeholder = () => {
        const element = document.createElement("div");
        element.className = "media-card-placeholder";
        element.setAttribute("aria-hidden", "true");
        element.textContent = "M";
        return element;
    };
    if (item.poster_path) {
        const image = document.createElement("img");
        image.src = `https://image.tmdb.org/t/p/w500${item.poster_path}`;
        image.alt = name;
        image.loading = "lazy";
        image.className = "h-64 w-full object-cover";
        image.addEventListener("error", () => image.replaceWith(placeholder()), { once: true });
        link.append(image);
    } else link.append(placeholder());
    const copy = document.createElement("div");
    copy.className = "media-card-copy p-4";
    const title = document.createElement(`h${headingLevel}`);
    title.className = "text-sm font-semibold text-white";
    title.textContent = name;
    const meta = document.createElement("div");
    meta.className = "media-card-meta mt-2 flex items-center justify-between text-xs text-neutral-500";
    const date = document.createElement("span");
    date.textContent = `${(item.release_date || item.first_air_date || "").slice(0, 4) || "—"} · ${type === "tv" ? "Series" : "Movie"}`;
    const rating = document.createElement("span");
    rating.textContent = item.vote_average?.toFixed(1) || "N/A";
    meta.append(date, rating);
    copy.append(title, meta);
    link.append(copy);
    card.append(link);
    link.addEventListener("click", () => recordMovieInterest(item));
    return card;
}
