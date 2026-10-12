const { defineConfig } = require("vite");
const { resolve } = require("node:path");
const { loadEnv } = require("vite");
const movieAssistant = require("./api/movie-assistant");

const htmlEntries = {
    index: resolve(__dirname, "index.html"),
    home: resolve(__dirname, "pages/home.html"),
    movies: resolve(__dirname, "pages/movies.html"),
    "tv-series": resolve(__dirname, "pages/tv-series.html"),
    favorites: resolve(__dirname, "pages/favorites.html"),
    details: resolve(__dirname, "pages/details.html"),
};

module.exports = defineConfig(({ mode }) => {
    const env = loadEnv(mode, __dirname, "");

    return {
        plugins: [
            {
                name: "compile-tailwind",
                buildStart() {
                    const { execSync } = require("node:child_process");
                    try {
                        execSync("npx @tailwindcss/cli -i ./src/styles/input.css -o ./dist/output.css", { stdio: "inherit" });
                    } catch (e) {
                        console.error("Failed to compile Tailwind CSS:", e);
                    }
                },
            },
            {
                name: "local-movie-assistant-api",
            configureServer(server) {
                server.middlewares.use("/api/movie-assistant", async (request, response, next) => {
                    if (request.method !== "POST") {
                        next();
                        return;
                    }

                    let body = "";
                    request.on("data", chunk => {
                        body += chunk;
                    });
                    request.on("end", async () => {
                        try {
                            request.body = JSON.parse(body || "{}");
                        } catch {
                            response.statusCode = 400;
                            response.setHeader("Content-Type", "application/json");
                            response.end(JSON.stringify({ error: "Invalid JSON request." }));
                            return;
                        }

                        const originalKey = process.env.GEMINI_API_KEY;
                        process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
                        try {
                            await movieAssistant(request, {
                                status(code) {
                                    response.statusCode = code;
                                    return this;
                                },
                                json(data) {
                                    response.setHeader("Content-Type", "application/json");
                                    response.end(JSON.stringify(data));
                                },
                            });
                        } finally {
                            if (originalKey === undefined) {
                                delete process.env.GEMINI_API_KEY;
                            } else {
                                process.env.GEMINI_API_KEY = originalKey;
                            }
                        }
                    });
                });
            },
        }],
        build: {
            rollupOptions: {
                input: htmlEntries,
            },
        },
    };
});
