# CodeRed — Israeli "Code Red" (Tzeva Adom) Historical Alert Atlas

A minimal, **historical** (not real-time) interactive map of Israel showing **"Code Red"
rocket/missile alert density** as a heatmap, with a **news timeline** and **split-screen
comparison** — in Hebrew or English. Data covers **2023-10-07 → end of yesterday
(Asia/Jerusalem)**; the current day is intentionally excluded.

**Live site:** https://hrsi56.github.io/CodeRed/

> ⚠️ Unofficial and informational/historical only. **Not an alerting tool** — do not rely
> on it for safety. Coordinates are alert-area centroids, not impact points; alert counts
> are sirens, not confirmed strikes. See the in-app "גילוי נאות ומקורות" / "Disclosure &
> sources" panel and `SPEC.md` §9.

---

## Why this exists

My wife and I wanted to plan a vacation somewhere in Israel and tried to figure out which
areas had actually been quiet lately versus which had seen a lot of "Code Red" alerts.
There was no easy way to just look at the plain numbers — where, what time of day, how it
adds up over a date range — every source out there is built for real-time alerting, not
for looking back. So I built this: a simple historical atlas of alert data that you can
filter by date range and compare side by side.

---

## How it works

100% static site on **GitHub Pages**. A daily **GitHub Actions** job ingests the sources
into a build-time **SQLite** DB, exports compact JSON to `frontend/public/data/`, builds
the Vite app, and deploys to Pages. The browser only ever fetches that static JSON — it
never calls tzevaadom / GDELT / Wikipedia directly (no CORS / geo-block issues). All
date-range filtering, the MAX-per-city union, and every statistic are computed
client-side. Full design rationale is in [`SPEC.md`](SPEC.md); working rules in
[`CLAUDE.md`](CLAUDE.md).

```
ingestion/  (Python)  → tzevaadom alerts + GDELT/Wikipedia news
                      → data/atlas.sqlite → frontend/public/data/*.json
frontend/   (React + Vite + TS, Hebrew/English, RTL/LTR)
                      → react-leaflet + a custom max-reduce heat layer (CARTO basemap),
                        Recharts, react-day-picker, timeline, split-screen comparison
.github/workflows/daily.yml  → runs the above daily + on manual dispatch, deploys to Pages
```

### Data sources
- **Alerts:** tzevaadom historical bulk + recent top-up (geocoded via `cities.json`).
- **News:** GDELT 2.0 DOC API (Israel + security keywords, primary) + Wikipedia's
  "Current events" portal (fallback — fills the historical gaps GDELT's rate-limiting
  leaves behind), capped/deduped per day.
- **Basemap:** CARTO Voyager raster tiles (© OpenStreetMap, © CARTO).
- **Heatmap:** a custom max-reduce layer (`frontend/src/leaflet/maxHeatLayer.ts`), not
  `leaflet.heat` — overlapping localities are never additively blended, so a pixel's
  colour always reflects the single strongest point under it (keeps the "one color +
  intensity" signal from `SPEC.md` §1 honest).

> **No fatalities layer.** `SPEC.md` originally called for ACLED conflict-fatality
> points, and that layer was built (`ingestion/ingest_fatalities.py`). It was removed
> from the live app because the only available ACLED account is under a rolling
> 12-month embargo — it can never return complete, current data — and this project's
> hard rule is real data or none, never partial data (`CLAUDE.md` Hard Rule #1). The
> ingestion code is kept for a one-line re-enable if full ACLED access is obtained.

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
No credentials needed — alerts (tzevaadom) and news (GDELT/Wikipedia) are both keyless:
```bash
python3 -m venv .venv
.venv/bin/pip install -r ingestion/requirements.txt

# Full daily pipeline (alerts + news → SQLite → JSON exports):
.venv/bin/python -m ingestion.run

# One-time full backfills (paced; can take minutes):
.venv/bin/python -m ingestion.ingest_news --full              # GDELT
.venv/bin/python -m ingestion.ingest_news_wikipedia --full    # Wikipedia Current Events
```
ACLED fatality ingestion (`ingestion/ingest_fatalities.py`, OAuth via `ACLED_EMAIL` /
`ACLED_PASSWORD` in a `.env` copied from `.env.example`) still exists but is **disabled**
in `run.py` — see "No fatalities layer" above.

---

## Deployment (GitHub Actions → Pages)

`.github/workflows/daily.yml` runs on a daily `cron` plus `workflow_dispatch`. It computes
"yesterday" in Asia/Jerusalem, ingests, commits the refreshed `data/atlas.sqlite` +
`frontend/public/data/*.json` back to `main`, builds, and deploys to Pages.

**Required GitHub repo secrets:** none — alert and news ingestion are both keyless.
`ACLED_EMAIL` / `ACLED_PASSWORD` (Settings → Secrets and variables → Actions) are still
wired into the workflow env for an easy fatality-ingestion re-enable, but the build and
deploy succeed without them.

Trigger manually with:
```bash
gh workflow run daily.yml
```

> GitHub Pages requires a **public** repo (or a paid plan for private). News ingestion is
> best-effort: GDELT rate-limits (HTTP 429) are caught and skipped, and Wikipedia's
> Current Events portal fills gaps GDELT misses; older news persists in the committed DB
> and recent days fill in over subsequent runs.
