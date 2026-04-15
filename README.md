# Airvery — Mood-first Travel Discovery

Airvery is a mood-first travel discovery web app built with Next.js that helps users find places and experiences tailored to their current mood and the selected city.

Key features

- Mood-driven place suggestions (AI-assisted with a deterministic fallback)
- City weather lookup
- Curated and Foursquare-powered place suggestions
- Docker-ready for local and production deployments

Tech stack

- Next.js (app router)
- Node.js serverless functions (under `functions/`)
- Firebase (optional integrations)
- Tailwind CSS

Quickstart (local development)

1. Install dependencies:

```bash
npm install
```

2. Copy environment template and set required keys (create `.env.local` in the project root):

```env
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini
WEATHER_API_KEY=your_weatherapi_key
FOURSQUARE_API_KEY=your_foursquare_key_optional
```

3. Run the development server:

```bash
npm run dev
```

4. Open http://localhost:3000/av to try the mood-driven experience.

Project layout (high level)

- `src/app/` — Next.js routes and pages (including `av` section)
- `components/` — UI components used by pages
- `lib/` — helper modules (CityWeather, Firebase, rate limiter, etc.)
- `functions/` — Cloud Functions code (server-side endpoints)
- `public/` — static assets and badges

API endpoints

- `POST /api/mood-flow` — advances the mood flow; input `city` + `answers`.
- `GET /api/cityweather?city=...` — returns current weather for a city (requires `WEATHER_API_KEY`).
- `POST /api/place-suggestions` — accepts `city`, `country`, `mood`, `moodTone` and returns place suggestions (uses Foursquare when configured; falls back to curated suggestions).

Docker

Build image:

```bash
docker build -t airvery:latest .
```

Run with `.env.local`:

```bash
docker run --rm -p 3000:3000 --env-file .env.local airvery:latest
```

Or with Docker Compose:

```bash
docker compose up --build -d
```

Deployment notes

- Ensure production environment contains required API keys and secrets.
- Configure your hosting (Vercel, Docker host, or a VM) to run the Next.js app and any serverless functions.

Contributing

1. Fork the repo and create a feature branch.
2. Open a PR describing your change.

Helpful commands

- `npm run dev` — start Next.js dev server
- `npm run build` — build for production
- `npm start` — run production build

License

This repository does not include a license file. Add a `LICENSE` if you want to specify terms.

—
If you want, I can also add a short `CONTRIBUTING.md`, badges, or a demo GIF. Tell me which you prefer.
