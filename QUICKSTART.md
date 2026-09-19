# FreeMovies Quick Start

## For A Collaborator After Git Clone

Run these commands from PowerShell:

```powershell
git clone <repository-url>
cd FreeMovies
npm install
Copy-Item .env.example .env
```

Open `.env` and add the collaborator's own TMDB API key:

```env
VITE_TMDB_API_KEY=their_tmdb_api_key_here
```

Then start the project:

```powershell
npm run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173/`.

`npm install` reads `package.json` and `package-lock.json`, then creates the local `node_modules/` folder. The `node_modules/` folder and `.env` file are intentionally not included in Git, so every collaborator creates their own copy locally.

## 1. Install dependencies

From the project folder:

```bash
npm install
```

## 2. Add the TMDB API key

In PowerShell, create `.env` from the template:

```powershell
Copy-Item .env.example .env
```

Open `.env` and set your key:

```env
VITE_TMDB_API_KEY=your_tmdb_api_key_here
```

## 3. Start the app

```bash
npm run dev
```

Open the Vite URL, normally:

```text
http://127.0.0.1:5173/
```

Do not double-click `index.html`. Vite is needed for the `.env` variable and JavaScript modules.

## 4. Build the project

```bash
npm run build
```

This builds the home page and all files inside `pages/` into `dist/`.

## Pages

The current HTML pages are:

```text
index.html
pages/movies.html
pages/tv-series.html
pages/favorites.html
pages/details.html
```

Page-specific JavaScript belongs in:

```text
src/js/pages/
```

For example:

```text
pages/movies.html
src/js/pages/movies.js
```

Use this script path inside `pages/movies.html`:

```html
<script type="module" src="../src/js/pages/movies.js"></script>
```

## Folder guide

| Folder | Purpose |
|---|---|
| `pages/` | HTML pages such as Movies and TV Series |
| `src/js/` | Shared and page-specific JavaScript |
| `src/components/` | Reusable HTML or JavaScript components |
| `src/styles/` | Tailwind source CSS for future styling |
| `public/assets/` | Images and static assets |
| `dist/` | Generated build files |

## Current design status

The pages intentionally have no visual design yet. They contain only the HTML backbone and movie image elements. Tailwind is installed and ready for the next styling phase.

## Common problems

**No movies appear:** check the API key in `.env`, then restart the Vite server.

**Page is unstyled:** this is expected for the current backbone stage.

**Port is busy:** use another port:

```bash
npm run dev -- --port 5174
```
