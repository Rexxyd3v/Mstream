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
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".page-transition-overlay")).visibility === "hidden");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: require("node:path").join(require("node:os").tmpdir(), "mstream-phone.png"), fullPage: true, animations: "disabled" });
    console.log("PASS: eight viewport sizes, mobile menu, TV category, genre discovery, pagination, reset, empty/error recovery, Enter submit, clearing, and cross-page search.");
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); server.kill(); });
