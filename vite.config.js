const { defineConfig } = require("vite");
const { globSync } = require("node:fs");
const { resolve } = require("node:path");

const htmlEntries = Object.fromEntries(
    globSync("**/*.html", {
        cwd: __dirname,
        exclude: ["node_modules/**", "dist/**"],
    }).map(file => [file.replace(/\.html$/, ""), resolve(__dirname, file)])
);

module.exports = defineConfig({
    build: {
        rollupOptions: {
            input: htmlEntries,
        },
    },
});
