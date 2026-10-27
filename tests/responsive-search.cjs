const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

// Exercise the real app with deterministic catalog data and no account sign-in.
const server = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5177", "--strictPort"], { cwd: require("node:path").resolve(__dirname, ".."), stdio: ["ignore", "pipe", "pipe"] });
const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Dev server did not start")), 30000);
    server.stdout.on("data", data => { if (data.toString().includes("127.0.0.1:5177")) { clearTimeout(timeout); resolve(); } });
    server.on("exit", code => { clearTimeout(timeout); reject(new Error(`Dev server exited: ${code}`)); });
});

let browser;
const title = (id, type, genre = 28) => ({ id, title: type === "movie" ? `Movie ${id}` : undefined, name: type === "tv" ? `Series ${id}` : undefined, poster_path: "/poster.jpg", backdrop_path: "/backdrop.jpg", genre_ids: [genre], popularity: 10, vote_average: 8.1, release_date: "2026-01-01", overview: "A story for a beautiful movie night." });

(async () => {
    await ready;
    browser = await chromium.launch({ channel: "chrome", headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);
    await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, route => route.fulfill({ contentType: "text/css", body: "" }));
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/src/js/auth.js", route => route.fulfill({ contentType: "application/javascript", body: `document.addEventListener('DOMContentLoaded',()=>{const controls=document.createElement('div');controls.className='auth-controls';controls.innerHTML='<button class="auth-user-button">Log in</button>';document.querySelector('.site-nav').append(controls);});` }));
    await page.route("https://image.tmdb.org/**", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#263334"/><circle cx="300" cy="300" r="180" fill="#485653"/></svg>' }));
    await page.route("https://api.themoviedb.org/**", async route => {
        const url = new URL(route.request().url());
        if (url.pathname.includes("/genre/")) return route.fulfill({ json: { genres: [{ id: 28, name: "Action" }, { id: 35, name: "Comedy" }] } });
        if (url.searchParams.get("query") === "failure") return route.fulfill({ status: 503, json: {} });
        const type = url.pathname.includes("/tv") ? "tv" : "movie";
        const offset = Number(url.searchParams.get("page") || 1) * 100;
        const empty = url.searchParams.get("query") === "no matches";
        const genre = Number(url.searchParams.get("with_genres") || 28);
        return route.fulfill({ json: { results: empty ? [] : Array.from({ length: 6 }, (_, i) => title(offset + i, type, genre)), total_pages: empty ? 1 : 2 } });
    });

    for (const width of [320, 390, 600, 768, 900, 1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("http://127.0.0.1:5177/pages/home.html");
        await page.locator(".spotlight-slide.is-active").waitFor();
        const metrics = await page.evaluate(() => {
            const input = document.querySelector('#searchInput').getBoundingClientRect();
            const form = document.querySelector('.nav-search').getBoundingClientRect();
            const auth = document.querySelector('.auth-controls').getBoundingClientRect();
            const toggle = document.querySelector('.mobile-menu-toggle').getBoundingClientRect();
            return { page: document.documentElement.scrollWidth, viewport: innerWidth, input: input.width, formRight: form.right, formLeft: form.left, overlap: toggle.width > 0 && auth.right > toggle.left + 1 };
        });
        assert(metrics.page <= width + 1, `Page overflow at ${width}: ${JSON.stringify(metrics)}`);
        assert(metrics.input > 110, `Search input too narrow at ${width}`);
        assert(metrics.formLeft >= 0 && metrics.formRight <= width, `Search clipped at ${width}`);
        assert(!metrics.overlap, `Account and menu overlap at ${width}`);
        if (width <= 900) {
            await page.getByRole("button", { name: "Open navigation menu" }).click();
            await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "TV Series" }).waitFor({ state: "visible" });
        }
        if ([768, 1280].includes(width)) await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), `mstream-${width}.png`), fullPage: true, animations: "disabled" });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://127.0.0.1:5177/pages/home.html");
    await page.locator("#genreFilter option[value='35']").waitFor({ state: "attached" });
    await page.locator("#categoryFilter").selectOption("tv");
    await page.locator("#searchStatus").filter({ hasText: "6 matching" }).waitFor();
    assert.equal(await page.locator("#movieGrid article").count(), 6);
    assert((await page.locator("#movieGrid article a").first().getAttribute("href")).includes("type=tv"));
    await page.locator("#genreFilter").selectOption("35");
    await page.waitForURL("**/*genre=35");
    await page.locator("#searchStatus").filter({ hasText: "6 matching" }).waitFor();
    await page.locator("#loadMoreResults").click();
    await page.locator("#searchStatus").filter({ hasText: "12 matching" }).waitFor();
    assert.equal(await page.locator("#movieGrid article").count(), 12);
    await page.locator("#loadMoreResults").waitFor({ state: "hidden" });
    await page.locator("#resetFilters").click();
    await page.locator(".movie-spotlight").waitFor({ state: "visible" });
    await page.locator("#searchInput").fill("no matches");
    await page.locator("#searchInput").press("Enter");
    await page.locator("#searchStatus").filter({ hasText: "No matches" }).waitFor();
    assert.equal(await page.locator("#movieGrid article").count(), 0);
    await page.locator("#searchInput").fill("failure");
    await page.locator("#searchInput").press("Enter");
    await page.locator("#searchStatus").filter({ hasText: "Could not load" }).waitFor();
    await page.locator("#searchInput").fill("movie");
    await page.locator("#searchInput").press("Enter");
    await page.locator("#searchStatus").filter({ hasText: "12 matching" }).waitFor();
    await page.locator("#searchInput").fill("");
    await page.locator(".movie-spotlight").waitFor({ state: "visible" });
    await page.goto("http://127.0.0.1:5177/pages/tv-series.html");
    await page.locator("#searchInput").fill("story");
    await page.locator("#searchInput").press("Enter");
    await page.waitForURL("**/home.html?q=story&category=tv");
    await page.locator("#searchStatus").filter({ hasText: "6 matching" }).waitFor();
    assert.equal(await page.locator("#categoryFilter").inputValue(), "tv");
    // Suggestions appear while typing and dismiss without a submission.
    await page.locator("#searchInput").fill("space");
    await page.getByRole("option", { name: /Series 100/ }).waitFor();
    assert.equal(await page.locator("#searchInput").getAttribute("aria-expanded"), "true");
    await page.locator("#searchInput").press("ArrowDown");
    assert.equal(await page.locator("#searchInput").getAttribute("aria-activedescendant"), "suggestion-0");
    await page.locator("#searchInput").press("Escape");
    await page.locator("#searchSuggestionsPanel").waitFor({ state: "hidden" });
    await page.locator("#searchInput").fill("no matches");
    await page.locator(".suggestions-status").filter({ hasText: "No titles found" }).waitFor();
    await page.locator("#searchInput").fill("failure");
    await page.locator(".suggestions-status").filter({ hasText: "unavailable" }).waitFor();
    await page.locator("#searchInput").fill("space");
    await page.getByRole("option", { name: /Series 100/ }).waitFor();
    await page.locator("#searchInput").press("ArrowDown");
    await page.locator("#searchInput").press("Enter");
    await page.waitForURL("**/details.html?id=100&type=tv");

    // Both catalog tabs append new pages and stop at the end.
    for (const [path, grid] of [["movies", "movieGrid"], ["tv-series", "seriesGrid"]]) {
        await page.goto(`http://127.0.0.1:5177/pages/${path}.html`);
        await page.locator(".catalog-count").filter({ hasText: "6 " }).waitFor();
        await page.locator(".catalog-pagination button").click();
        await page.locator(".catalog-count").filter({ hasText: "12 " }).waitFor();
        assert.equal(await page.locator(`#${grid} article`).count(), 12);
        await page.locator(".catalog-pagination button").waitFor({ state: "hidden" });
    }

    // Provider content is mocked; these checks verify our player shell and failover.
    await page.route(/^https:\/\/(vidsrc\.(me|xyz|cc)|moviesapi\.club|player\.smashy\.stream|111movies\.com)\//, route => route.fulfill({ contentType: "text/html", body: '<html style="background:#111;color:#fff"><body>Video canvas</body></html>' }));
    await page.evaluate(async () => {
        const player = await import("/src/js/player.js");
        player.openPlayer(100, "movie", "A movie night");
    });
    await page.locator("#cv-loading").waitFor({ state: "hidden" });
    assert.equal(await page.locator(".cv-server-tabs, .cv-player-notice, .cv-player-topbar, #cv-player-title, #cv-topbar-skip, #cv-topbar-next-ep, #cv-topbar-fullscreen").count(), 0);
    const video = await page.locator("#cv-player-iframe").boundingBox();
    assert(video.height >= 840, "Mobile movie should fill the player, without a banner");
    await page.locator("#cv-player-iframe").dispatchEvent("error");
    await page.waitForFunction(() => document.querySelector("#cv-player-iframe").src.includes("vidsrc.xyz"));
    await page.locator("#cv-loading").waitFor({ state: "hidden" });
    assert.equal(await page.locator("#cv-player-iframe").getAttribute("sandbox"), null);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector("#cv-player-iframe").src === "about:blank");
    await page.evaluate(() => window.openPlayer(100, "tv", "Series night", [{ season_number: 1 }]));
    await page.locator("#cv-topbar-episodes").click();
    await page.locator("#cv-episode-panel").waitFor({ state: "visible" });
    await page.locator("#cv-topbar-episodes").click();
    await page.locator("#cv-episode-panel").waitFor({ state: "hidden" });
    await page.evaluate(() => {
        for (let i = 0; i < 6; i++) document.querySelector("#cv-player-iframe").dispatchEvent(new Event("error"));
    });
    await page.locator("#cv-retry-stream").waitFor({ state: "visible" });
    await page.locator("#cv-retry-stream").click();
    await page.locator("#cv-loading").waitFor({ state: "hidden" });
    await page.keyboard.press("Escape");

    // Title-specific discovery: collection first, then related titles and cast.
    const wick = { ...title(100, "movie"), title: "John Wick", belongs_to_collection: { id: 7 }, credits: { cast: [
        { id: 1, name: "Keanu Reeves", character: "John Wick", profile_path: "/actor.jpg" },
        { id: 2, name: "Supporting Actor", character: "A friend", profile_path: null },
    ] }, recommendations: { results: [title(101, "movie"), { ...title(200, "movie"), title: "Speed" }, title(100, "movie")] }, similar: { results: [title(200, "movie"), { ...title(201, "movie"), title: "The Equalizer" }] } };
    await page.route("https://api.themoviedb.org/**", async route => {
        const url = new URL(route.request().url());
        if (url.pathname === "/3/movie/100") return route.fulfill({ json: wick });
        if (url.pathname === "/3/collection/7") return route.fulfill({ json: { name: "John Wick Collection", parts: [
            { ...title(103, "movie"), title: "John Wick: Chapter 4", release_date: "2023-03-22" },
            { ...title(100, "movie"), title: "John Wick", release_date: "2014-10-22" },
            { ...title(102, "movie"), title: "John Wick: Chapter 3", release_date: "2019-05-15", poster_path: null },
            { ...title(101, "movie"), title: "John Wick: Chapter 2", release_date: "2017-02-08" },
        ] } });
        if (url.pathname.includes("/person/")) return route.fulfill({ json: { cast: [
            { ...title(300, "movie"), title: "The Matrix", media_type: "movie", character: "Neo" },
            { ...title(300, "movie"), title: "Duplicate credit", media_type: "movie", character: "Neo" },
            { ...title(200, "movie"), title: "Speed", media_type: "movie", character: "Jack" },
            { ...title(102, "movie"), title: "John Wick: Chapter 3", media_type: "movie", character: "John Wick" },
            { ...title(100, "movie"), media_type: "movie" },
            { ...title(301, "movie"), media_type: "movie", adult: true },
            { ...title(302, "movie"), media_type: "movie", character: "Self" },
            { ...title(501, "tv"), media_type: "tv", character: "A character" },
        ] } });
        if (url.pathname === "/3/tv/500") return route.fulfill({ json: { ...title(500, "tv"), name: "A featured series", credits: wick.credits, recommendations: { results: [] }, similar: { results: [] } } });
        if (url.pathname === "/3/movie/900") return route.fulfill({ json: { ...title(900, "movie"), title: "Standalone movie" } });
        if (/\/movie\/900\//.test(url.pathname)) return route.fulfill({ status: 503, json: {} });
        return route.fallback();
    });
    await page.goto("http://127.0.0.1:5177/pages/details.html?id=100&type=movie");
    await page.locator("#castRecommendations").getByRole("heading", { name: "The Matrix" }).waitFor();
    assert.equal(await page.locator("#detailCastList button").count(), 2);
    assert.deepEqual(await page.locator("#collectionRecommendations h4").allTextContents(), ["John Wick: Chapter 2", "John Wick: Chapter 3", "John Wick: Chapter 4"]);
    assert.equal(await page.locator("#relatedRecommendations .discovery-title").count(), 2);
    assert.equal(await page.locator("#castRecommendations .discovery-title").count(), 1);
    assert.equal(await page.locator("#detailRecommendations a[href*='id=100&']").count(), 0);
    for (const width of [320, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Detail discovery overflow at ${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "mstream-detail-discovery.png"), fullPage: true, animations: "disabled" });
    const keanu = page.getByRole("button", { name: "Explore titles with Keanu Reeves" });
    await keanu.click();
    await page.locator("#castRecommendations").getByRole("heading", { name: "More with Keanu Reeves" }).waitFor();
    assert.equal(await keanu.getAttribute("aria-pressed"), "true");
    assert.equal(await page.locator("#castRecommendations .discovery-title").count(), 3);
    await keanu.click();
    await page.locator("#castRecommendations").getByRole("heading", { name: "More with familiar faces" }).waitFor();
    await page.goto("http://127.0.0.1:5177/pages/details.html?id=500&type=tv");
    await page.locator("#castRecommendations a[href*='id=501&type=tv']").waitFor();
    assert.equal(await page.locator("#castRecommendations a[href*='type=movie']").count(), 0);
    await page.goto("http://127.0.0.1:5177/pages/details.html?id=900&type=movie");
    await page.locator("#detailCastStatus").filter({ hasText: "couldn’t load" }).waitFor();
    assert.equal(await page.locator("#detailTitle").textContent(), "Standalone movie");
    await page.locator("#detailRecommendationsStatus").filter({ hasText: "No recommendations" }).waitFor();

    await page.goto("http://127.0.0.1:5177/pages/movies.html");
    await page.locator(".catalog-count").filter({ hasText: "6 " }).waitFor();
    await page.locator("#searchInput").fill("space");
    await page.getByRole("option", { name: /Movie 100/ }).waitFor();
    assert(await page.evaluate(() => {
        const item = document.querySelector(".suggestion-item");
        const rect = item.getBoundingClientRect();
        return Boolean(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest(".suggestion-item"));
    }), "Suggestions must appear above page content and accept pointer clicks");
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".page-transition-overlay")).visibility === "hidden");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "mstream-phone.png"), fullPage: true, animations: "disabled" });
    console.log("PASS: responsive layouts; search and pagination; automatic player; cast portraits; chronological collection sequels; deduplicated related/cast recommendations; actor selection; TV discovery; graceful metadata failures.");
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); server.kill(); });
