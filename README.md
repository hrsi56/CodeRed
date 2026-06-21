# CodeRed — Israeli "Code Red" (Tzeva Adom) Historical Alert Atlas

A minimal, **historical** (not real-time) interactive map of Israel showing **"Code Red"
rocket/missile alert density** as a heatmap, **conflict fatalities** as points, with a
**news timeline** and **split-screen comparison**. Data covers **2023-10-07 → end of
yesterday (Asia/Jerusalem)**; the current day is intentionally excluded.

**Live site:** https://hrsi56.github.io/CodeRed/

> ⚠️ Unofficial and informational/historical only. **Not an alerting tool** — do not rely
> on it for safety. Coordinates are alert-area centroids, not impact points; alert counts
> are sirens, not confirmed strikes; fatalities are *reported* event-level estimates from
> ACLED. See the in-app "גילוי נאות ומקורות" panel and `SPEC.md` §9.

---

## How it works

100% static site on **GitHub Pages**. A daily **GitHub Actions** job ingests the sources
into a build-time **SQLite** DB, exports compact JSON to `frontend/public/data/`, builds
the Vite app, and deploys to Pages. The browser only ever fetches that static JSON — it
never calls tzevaadom / ACLED / GDELT directly (no CORS / geo-block issues). All
date-range filtering, the MAX-per-city union, and every statistic are computed
client-side. Full design rationale is in [`SPEC.md`](SPEC.md); working rules in
[`CLAUDE.md`](CLAUDE.md).

```
ingestion/  (Python)  → tzevaadom alerts + ACLED fatalities + GDELT news
                      → data/atlas.sqlite → frontend/public/data/*.json
frontend/   (React + Vite + TS, Hebrew/RTL)
                      → react-leaflet + leaflet.heat (CARTO basemap), Recharts,
                        react-day-picker, timeline, split-screen comparison
.github/workflows/daily.yml  → runs the above daily + on manual dispatch, deploys to Pages
```

### Data sources
- **Alerts:** tzevaadom historical bulk + recent top-up (geocoded via `cities.json`).
- **Fatalities:** ACLED (`country=Israel`, `fatalities>0`) — OAuth, requires a myACLED
  account **with API access** (a plain free account may lack it; an academic account worked).
- **News:** GDELT 2.0 DOC API (Israel + security keywords), capped/deduped per day.
- **Basemap:** CARTO Voyager raster tiles (© OpenStreetMap, © CARTO).

---

## Local development

### Prerequisites
Node 20+ (or 22), Python 3.12+.

### Frontend (no ingestion needed — data JSON is committed)
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173/CodeRed/
npm run build    # type-check + production build to dist/
```

### Ingestion (optional — only to regenerate data locally)
ACLED uses OAuth (email + password), **not** a static key. Copy `.env.example` to `.env`
and fill in your myACLED credentials (`.env` is git-ignored — never commit it):
```bash
cp .env.example .env      # then edit ACLED_EMAIL / ACLED_PASSWORD

python3 -m venv .venv
.venv/bin/pip install -r ingestion/requirements.txt

# Full daily pipeline (alerts + fatalities + trailing-window news → SQLite → JSON):
set -a && source .env && set +a
.venv/bin/python -m ingestion.run

# One-time full GDELT news backfill (paced ~6s/request; minutes):
.venv/bin/python -m ingestion.ingest_news --full
```
Without `ACLED_*` set, the fatalities step is skipped (feature-flagged, never faked).

---

## Deployment (GitHub Actions → Pages)

`.github/workflows/daily.yml` runs on a daily `cron` plus `workflow_dispatch`. It computes
"yesterday" in Asia/Jerusalem, ingests, commits the refreshed `data/atlas.sqlite` +
`frontend/public/data/*.json` back to `main`, builds, and deploys to Pages.

**Required GitHub repo secrets** (Settings → Secrets and variables → Actions):
`ACLED_EMAIL`, `ACLED_PASSWORD`.

Trigger manually with:
```bash
gh workflow run daily.yml
```

> GitHub Pages requires a **public** repo (or a paid plan for private). News ingestion is
> best-effort: GDELT rate-limits (HTTP 429) are caught and skipped; older news persists in
> the committed DB and recent days fill in over subsequent runs.
