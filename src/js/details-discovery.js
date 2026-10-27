import { createMediaCard } from "./media-card.js";

const API = "https://api.themoviedb.org/3";
const IMAGE = "https://image.tmdb.org/t/p/";

async function request(path) {
    const response = await fetch(`${API}/${path}?${new URLSearchParams({ api_key: import.meta.env.VITE_TMDB_API_KEY, language: "en-US" })}`);
    if (!response.ok) throw new Error("Could not load discovery data");
    return response.json();
}

function titleKey(item, type) { return `${item.media_type || type}:${item.id}`; }
function sortByPopularity(items) { return [...items].sort((a, b) => (b.popularity || 0) - (a.popularity || 0)); }

export function uniqueTitles(items, currentId, type, excluded = new Set()) {
    const seen = new Set(excluded);
    seen.add(`${type}:${currentId}`);
    return items.filter(item => {
        const key = titleKey(item, type);
        if (!item.id || item.adult || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function renderTitles(container, heading, note, items, type, label) {
    container.replaceChildren();
    container.hidden = false;
    const intro = document.createElement("div");
    intro.className = "discovery-group-heading";
    const title = document.createElement("h3");
    title.textContent = heading;
    const description = document.createElement("p");
    description.textContent = note;
    intro.append(title, description);
    const grid = document.createElement("div");
    grid.className = "detail-title-grid";
    items.forEach(item => {
        const itemType = item.media_type || type;
        const card = createMediaCard(item, { type: itemType, headingLevel: 4, linkClass: "discovery-title" });
        if (label) card.querySelector("a").title = typeof label === "function" ? label(item) : label;
        grid.append(card);
    });
    container.append(intro, grid);
    return grid;
}

export async function initializeDetailsDiscovery(media, type) {
    const castSection = document.getElementById("detailCast");
    const section = document.getElementById("detailRecommendations");
    if (!castSection || !section) return;
    section.hidden = false;
    const status = document.getElementById("detailRecommendationsStatus");
    status.textContent = "Finding the next chapter and familiar faces…";
    section.setAttribute("aria-busy", "true");
    const collectionGroup = document.getElementById("collectionRecommendations");
    const relatedGroup = document.getElementById("relatedRecommendations");
    const castGroup = document.getElementById("castRecommendations");
    const castStatus = document.getElementById("detailCastStatus");
    const creditsCache = new Map();
    const used = new Set();
    let selectedActor = null;
    let actorVersion = 0;

    function creditsFor(actor) {
        if (!creditsCache.has(actor.id)) {
            const pending = request(`person/${actor.id}/combined_credits`).catch(error => { creditsCache.delete(actor.id); throw error; });
            creditsCache.set(actor.id, pending);
        }
        return creditsCache.get(actor.id);
    }

    async function showActorTitles(actors, selected = false) {
        const version = ++actorVersion;
        castGroup.hidden = false;
        castGroup.setAttribute("aria-busy", "true");
        castStatus.textContent = selected ? `Finding more with ${actors[0].name}…` : "";
        const results = await Promise.allSettled(actors.map(actor => creditsFor(actor)));
        if (version !== actorVersion) return;
        const names = new Map();
        const items = [];
        results.forEach((result, index) => {
            if (result.status !== "fulfilled") return;
            for (const item of result.value.cast || []) {
                if ((item.media_type || type) !== type || item.adult || /\b(self|himself|herself|themselves|archive footage)\b/i.test(item.character || "")) continue;
                const key = titleKey(item, type);
                if (!names.has(key)) names.set(key, actors[index].name);
                items.push(item);
            }
        });
        const titles = uniqueTitles(sortByPopularity(items), media.id, type, selected ? new Set() : used).slice(0, 12);
        const heading = selected ? `More with ${actors[0].name}` : "More with familiar faces";
        renderTitles(castGroup, heading, selected ? "Explore more performances from this actor." : "Other stories starring the cast you just discovered.", titles, type, item => `With ${names.get(titleKey(item, type))}`);
        castGroup.removeAttribute("aria-busy");
        if (!titles.length) {
            const empty = document.createElement("p");
            empty.className = "discovery-status";
            empty.textContent = results.every(result => result.status === "rejected") ? "Actor titles couldn’t load. Tap an actor to try again." : "No other titles are available for this selection yet.";
            castGroup.append(empty);
        }
        castStatus.textContent = selected ? `${titles.length} other ${type === "tv" ? "series" : "movies"} with ${actors[0].name}. Tap again to show the main cast’s picks.` : "";
    }

    // Optional sections can fail independently without affecting the detail card.
    const [creditResult, collectionResult, recommendedResult, similarResult] = await Promise.allSettled([
        media.credits?.cast ? Promise.resolve(media.credits) : request(`${type}/${media.id}/credits`),
        type === "movie" && media.belongs_to_collection?.id ? request(`collection/${media.belongs_to_collection.id}`) : Promise.resolve(null),
        media.recommendations?.results ? Promise.resolve(media.recommendations) : request(`${type}/${media.id}/recommendations`),
        media.similar?.results ? Promise.resolve(media.similar) : request(`${type}/${media.id}/similar`),
    ]);
    const collection = collectionResult.status === "fulfilled" ? collectionResult.value : null;
    const parts = uniqueTitles([...(collection?.parts || [])].sort((a, b) => (a.release_date || "9999").localeCompare(b.release_date || "9999")), media.id, type);
    if (parts.length) {
        renderTitles(collectionGroup, "Continue the story", collection.name || "More from the same collection.", parts, "movie", "Same collection");
        parts.forEach(item => used.add(titleKey(item, "movie")));
    }
    const related = uniqueTitles([
        ...(recommendedResult.status === "fulfilled" ? recommendedResult.value.results || [] : []),
        ...(similarResult.status === "fulfilled" ? similarResult.value.results || [] : []),
    ].filter(item => item.poster_path), media.id, type, used).slice(0, 10);
    if (related.length) {
        renderTitles(relatedGroup, "A similar kind of story", `If you enjoyed ${media.title || media.name || "this title"}, try these next.`, related, type);
        related.forEach(item => used.add(titleKey(item, type)));
    }
    const cast = creditResult.status === "fulfilled" ? [...new Map((creditResult.value.cast || []).filter(actor => actor.id && actor.name).map(actor => [actor.id, actor])).values()].slice(0, 16) : [];
    castSection.hidden = false;
    const list = document.getElementById("detailCastList");
    list.replaceChildren();
    cast.forEach(actor => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "detail-cast-card";
        button.setAttribute("aria-pressed", "false");
        button.setAttribute("aria-label", `Explore titles with ${actor.name}`);
        button.title = `${actor.name}${actor.character ? ` · ${actor.character}` : ""}`;
        const portrait = document.createElement("span");
        portrait.className = "cast-portrait";
        portrait.textContent = actor.name.split(/\s+/).slice(0, 2).map(word => word[0]).join("");
        if (actor.profile_path) {
            const image = document.createElement("img");
            image.src = `${IMAGE}w185${actor.profile_path}`;
            image.alt = "";
            image.loading = "lazy";
            image.addEventListener("error", () => image.remove(), { once: true });
            portrait.append(image);
        }
        button.append(portrait);
        button.addEventListener("click", () => {
            selectedActor = selectedActor === actor.id ? null : actor.id;
            list.querySelectorAll("button").forEach(item => item.setAttribute("aria-pressed", String(item === button && selectedActor !== null)));
            showActorTitles(selectedActor ? [actor] : cast.slice(0, 3), Boolean(selectedActor));
        });
        list.append(button);
    });
    if (!cast.length) castStatus.textContent = creditResult.status === "rejected" ? "The cast couldn’t load right now. Please try again later." : "Cast information is not available for this title yet.";
    status.textContent = parts.length || related.length || cast.length ? "" : "No recommendations are available for this title right now.";
    section.removeAttribute("aria-busy");
    if (cast.length) await showActorTitles(cast.slice(0, 3));
}
