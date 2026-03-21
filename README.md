# Airvery

Airvery is a mood-first travel discovery experience built with Next.js.
Users select a city, complete a short mood flow, and receive place suggestions aligned with their vibe.

## Run Locally

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` in the project root:

```env
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini
WEATHER_API_KEY=your_weatherapi_key
FOURSQUARE_API_KEY=your_foursquare_key_optional
```

3. Start development server:

```bash
npm run dev
```

4. Open http://localhost:3000/av

## API Routes

- `POST /api/mood-flow`
  - Input: `city`, `answers`
  - Output: next mood question/options or final summary
  - Uses OpenAI when configured, with deterministic fallback

- `GET /api/cityweather?city=...`
  - Returns current weather for selected city
  - Requires `WEATHER_API_KEY`

- `POST /api/place-suggestions`
  - Input: `city`, `country`, `mood`, `moodTone`
  - Output: mood keywords + suggested places
  - Uses Foursquare Places when `FOURSQUARE_API_KEY` is present
  - Falls back to curated keyword-based local suggestions if key is missing

## Notes

- If weather fails, check `WEATHER_API_KEY` and API quota.
- If place suggestions return `source: "fallback"`, set `FOURSQUARE_API_KEY` for live place data.

## Containerize And Deploy

### Build And Run With Docker

1. Build image:

```bash
docker build -t vcdn:latest .
```

2. Run container with env file:

```bash
docker run --rm -p 3000:3000 --env-file .env.local vcdn:latest
```

3. Open http://localhost:3000/av

### Run With Docker Compose

```bash
docker compose up --build -d
```

To stop:

```bash
docker compose down
```

### Push To GitHub And Pull On Web Server

1. Commit and push your app repo:

```bash
git add .
git commit -m "Add Docker containerization"
git push origin main
```

2. On your web server:

```bash
git clone <your-repo-url>
cd <repo-name>
```

3. Create server env file (recommended: `.env.local`) with your production keys.

4. Start app on server:

```bash
docker compose up --build -d
```

5. Update after new pushes:

```bash
git pull
docker compose up --build -d
```
