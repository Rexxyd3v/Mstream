# FreeMovies

FreeMovies is a vanilla JavaScript movie application powered by the TMDB API. The project currently contains a plain HTML backbone for the home page, movies, TV series, favorites, and details pages. Visual design can be added later with Tailwind CSS.

## Project Structure

```text
FreeMovies/
├── index.html                  # Home page
├── pages/
│   ├── movies.html             # Movies page
│   ├── tv-series.html          # TV series page
│   ├── favorites.html          # Favorites page
│   └── details.html            # Movie details page
├── src/
│   ├── components/             # Shared UI components
│   ├── js/
│   │   ├── app.js              # Home page and shared movie logic
│   │   └── pages/              # Page-specific JavaScript
│   │       ├── movies.js
│   │       ├── tv-series.js
│   │       ├── favorites.js
│   │       └── details.js
│   └── styles/
│       └── input.css            # Tailwind entry file for future styling
├── public/assets/              # Images and other static assets
├── dist/                       # Generated build output
├── .env                        # Local API credentials, not committed
├── .env.example                # Environment variable template
├── package.json
├── tailwind.config.js
├── vite.config.js
├── QUICKSTART.md
└── README.md
```

## Requirements

- Node.js 18 or newer
- npm
- A TMDB API key

## Setup

Install the dependencies:

```bash
npm install
```

Create a local environment file from the template. On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Then edit `.env`:

```env
VITE_TMDB_API_KEY=your_tmdb_api_key_here
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-firebase-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

The `VITE_` prefix is required because Vite exposes only variables with that prefix to browser code. Never commit `.env`, `.env.local`, or other local environment files. They are ignored by Git; only `.env.example` with placeholders should be committed.

Important: `VITE_*` values are bundled into the browser application and can be seen by users. Firebase Web API keys are client identifiers, not admin secrets. Restrict the Firebase key in Google Cloud Console and use Firebase Authentication and Firestore Security Rules. Keep TMDB keys behind a server-side proxy if they must remain private.

## Collaborator Setup After Clone

After cloning the repository, a collaborator should run:

```powershell
git clone <repository-url>
cd FreeMovies
npm install
Copy-Item .env.example .env
npm run dev
```

They must then add their own TMDB key to `.env`:

```env
VITE_TMDB_API_KEY=their_tmdb_api_key_here
```

`npm install` uses `package.json` and `package-lock.json` to create `node_modules/` locally. `node_modules/` and local `.env*` files are intentionally ignored by Git, so they are not downloaded during `git clone` and should not be committed.

## Development

Start the Vite development server:

```bash
npm run dev
```

Open the URL printed by Vite, normally:

```text
http://127.0.0.1:5173/
```

Do not open `index.html` directly from File Explorer. The Vite server is required for `.env` variables and JavaScript modules to work correctly.

## Build

Build Tailwind and all HTML pages:

```bash
npm run build
```

The generated files are placed in `dist/`.

## Movie Assistant

The Home page includes a Gemini-powered movie assistant through the
`api/movie-assistant.js` Vercel serverless function. The Gemini key is never
bundled into the browser application.

Deploy the project to Vercel, then add `GEMINI_API_KEY` in:

```text
Vercel dashboard -> Project -> Settings -> Environment Variables
```

Enable it for Production, Preview, and Development as needed. Redeploy after
adding or changing the variable. The local `.env` file is for local
development only and must not be committed.

For a CLI deployment:

```powershell
npm install -g vercel
vercel login
vercel
vercel env add GEMINI_API_KEY
vercel --prod
```

Also add the existing `VITE_*` variables from `.env` to Vercel so TMDB and
Firebase features continue working in the deployed frontend.

## Adding A Page

Create the HTML file in `pages/`:

```text
pages/profile.html
```

Create its page-specific JavaScript file in `src/js/pages/`:

```text
src/js/pages/profile.js
```

Connect the JavaScript from the page:

```html
<script type="module" src="../src/js/pages/profile.js"></script>
```

The Vite configuration automatically discovers HTML files when building.

## Adding Assets

Place static files in `public/assets/`:

```text
public/assets/logo.png
```

Reference them from a page with:

```html
<img src="/assets/logo.png" alt="FreeMovies logo">
```

## Tailwind CSS

Tailwind is installed, but the current pages intentionally use plain HTML without visual styling. When styling begins, edit `src/styles/input.css` and add Tailwind classes to the HTML files, then run:

```bash
npm run build
```

## TMDB API

The application uses these TMDB API endpoints:

- `/movie/popular`
- `/search/movie`
- `/movie/{id}`

API documentation: <https://developer.themoviedb.org/docs/getting-started>

## Troubleshooting

**Movies do not appear**

- Confirm `.env` contains a valid `VITE_TMDB_API_KEY`.
- Restart `npm run dev` after changing `.env`.
- Check the browser console for API errors.

**The page looks unstyled**

That is currently intentional. The project is using a plain HTML backbone while the page structure is being built.

**The port is already in use**

Stop the other Vite process or start Vite on another port:

```bash
npm run dev -- --port 5174
```

## License

ISC
