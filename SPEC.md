# BUILD SPEC — Israeli "Code Red" (Tzeva Adom) Historical Alert Atlas

> **This document is the authoritative build specification.** It lives in the repo. Claude Code: build the application according to this spec. Where an endpoint is marked **(VERIFY LIVE)**, confirm it actually works (curl / browser DevTools) before depending on it, because these are unofficial/undocumented and can change. If a data source is unreachable, fall back per the alternatives listed and leave a clear `TODO` + console warning rather than failing silently. Ask the user before adding any paid service.

---

## 0. What we are building (one paragraph)

A **minimal, aesthetic, interactive map of Israel** that visualizes the **density of "Code Red" (צבע אדום) rocket/missile alerts** as a single-color intensity heatmap, **fatalities as points**, over a **light beige base map whose only other feature is subtle population shading**. A **linear timeline starting 7 October 2023** lets the user pick any date range (and jump to auto-detected news events). The user can press **"Add Comparison"** to split the screen into two independent map+stats panels with independently adjustable date ranges. **Data is historical only** — it covers up to the **end of yesterday** (Israel time); the current day is intentionally excluded to avoid real-time load. This is **not real-time and not an official alerting tool.**

---

## 1. Locked product decisions (do NOT re-litigate these)

These were decided by the product owner. Implement them as written.

1. **Alerts = one color + intensity.** Threat *type* is irrelevant — the mere existence of an alert is the signal. A single-hue intensity heatmap (no categorical colors, no per-type layers). Do not build a multi-color/per-threat visualization.
2. **Fatalities = points on the map.** Plotted as discrete markers, sized by the number of fatalities in the event.
3. **Map aesthetic = minimal & monochromatic-warm.** The base map must be **as uniform as possible in a very light beige / light-brown tone**. **Population concentrations** appear **on the same map as a slightly darker brown**. No busy street tiles, no labels clutter, no satellite. Think "quiet beige canvas."
4. **Timeline starts 2023-10-07.** No data or UI before that date. The timeline/end bound is **the end of yesterday** (Israel local time) at any given moment. **The current day is never included.** A persistent, visible notice must state that the data does not include today. (This deliberately removes the need for real-time polling and saves load.)
5. **Comparison = split screen.** An "Add Comparison" button splits the view into two independent panels (A and B), each with its own date range, map, and statistics. Both ranges are independently adjustable.
6. **Hosting = GitHub Pages, fully static.** No server, no REST API, no runtime database. See §2.
7. **Datastore = SQLite only** (no Postgres). It is a build-time store inside the daily job; the frontend reads static JSON exported from it. See §2 and §3.5.
8. **Updates = a daily GitHub Actions workflow** (cron), which ingests, exports JSON, and deploys to Pages. See §2.
9. **City aggregation = coarse union with the MAX rule.** Sub-areas collapse to a base city; a city's value over a range is the **max** among its sub-areas, not the sum. See §3.1.

---

## 2. Architecture — STATIC SITE on GitHub Pages, SQLite-only, updated by GitHub Actions

**This is locked.** There is **no server, no REST API, and no runtime database.** The site served to users is **100% static and hosted on GitHub Pages.** A **scheduled GitHub Actions workflow** runs once a day: it ingests the sources into a **SQLite** database (the single canonical datastore — **no Postgres**), **exports compact pre-aggregated JSON**, builds the frontend, and deploys to Pages. The browser only ever fetches the app's own static JSON from the Pages origin — so **the browser never calls tzevaadom / ACLED / GDELT directly, which eliminates all CORS and geo-block issues** (the CI runner does that fetching server-side).

```
   GitHub Actions  (scheduled cron, ~daily)  ── runs on GitHub's runners (US IPs; fine for all sources)
   ┌──────────────────────────────────────────────────────────────┐
   │ 1. compute "yesterday" boundary in Asia/Jerusalem            │
   │ 2. ingest → SQLite (data/atlas.sqlite) — the ONLY datastore: │
   │      • alert history (tzevaadom historical + dleshem + topup) │
   │      • ACLED fatalities (country=Israel) — creds from secrets │
   │      • GDELT news events                                      │
   │      • geocode + coarse city-union (see §3.1)                 │
   │ 3. EXPORT compact static JSON  →  frontend/public/data/*.json │
   │ 4. vite build  →  static site                                │
   │ 5. deploy to GitHub Pages (actions/deploy-pages)             │
   └──────────────────────────────┬───────────────────────────────┘
                                  ▼
                 GitHub Pages (static files only)
                 /data/subarea_daily.json   (day × sub-area counts)
                 /data/hour_daily.json       (day × hour counts)
                 /data/event_times.json      (distinct alert event times)
                 /data/fatalities.json
                 /data/news.json
                 /data/cities.json           (geo + sub-area→city map)
                 /data/population.json        (Kontur hexes, simplified)
                 /data/meta.json              ({dataThroughDate, generatedAt})
                                  ▼
        React + Vite SPA (Hebrew, RTL)  — fetches the JSON above, then does
        ALL date-range filtering, aggregation & stats CLIENT-SIDE.
        Leaflet map · Recharts · timeline · split-screen comparison
```

**Stack (locked):**
- **Datastore: SQLite only.** Lives at `data/atlas.sqlite`, built/updated by the Actions job. No Postgres, no other DB. It is a **build-time** store; it is *not* queried at runtime by the browser.
- **Frontend: React + Vite + TypeScript**, **react-leaflet**, **Leaflet.heat**, **Recharts**, **react-day-picker**. Fully static output.
- **Ingestion/export script:** Python *or* Node (pick one) — runs only inside GitHub Actions. It owns SQLite and writes the JSON exports.
- **Hosting: GitHub Pages** (project site). Set Vite `base: '/<repo-name>/'` so asset paths resolve. Deploy via the official Pages Actions (`actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`).

**Why static JSON instead of querying SQLite in the browser:** the dataset is bounded and read-only, and the required views aggregate cleanly to small daily buckets, so shipping a few compact JSON files is simpler and faster than running a DB in the browser. *(Optional alternative, only if you prefer real SQL in the browser: ship the `.sqlite` to Pages and query it client-side with `sql.js-httpvfs` over HTTP range requests. Not the default — adds WASM complexity. SQLite remains the only datastore either way.)*

**The daily GitHub Actions workflow (`.github/workflows/daily.yml`):**
- **Trigger:** `schedule: cron` once a day **plus** `workflow_dispatch` (manual). Use a UTC time that lands a few hours after Israel midnight so "yesterday (Israel)" is fully complete and sources have caught up — e.g. `cron: "0 2 * * *"` (02:00 UTC ≈ 04:00–05:00 Israel). Note GitHub cron runs in **UTC** and may be delayed under load; the job must recompute "yesterday" itself, never assume the trigger time.
- **Secrets:** `ACLED_EMAIL`, `ACLED_PASSWORD` come from **GitHub repo secrets** (Settings → Secrets and variables → Actions), injected as env. They are **never** committed. A local `.env` is only for running the script on your own machine.
- **Persistence of SQLite across runs:** either (a) commit `data/atlas.sqlite` back to the repo at the end of each run (simple history; uses an incremental upsert so each day only adds the newest rows), or (b) cache it with `actions/cache`. Prefer (a) for a hobby project — it's debuggable and the file stays small. Incremental: only fetch/append alerts newer than the max timestamp already stored, then re-export.
- **Output:** the built static site (with `public/data/*.json`) deployed to Pages.

**Client-side data sizes:** integer-heavy JSON gzips extremely well and Pages serves compressed. Keep exports as packed arrays (not arrays of verbose objects) — see §3.5.

---

## 3. Data sources & schema

### 3.1 Alerts — history from 2023-10-07 to yesterday

**Primary backfill (bulk, one-time + refreshed daily):**
- **`https://www.tzevaadom.co.il/static/historical/all.json`** **(VERIFY LIVE)** — canonical historical alert dataset (timestamped per-locality alerts, since 2022). Filter to `>= 2023-10-07`.
- **`dleshem/israel-alerts-data`** (GitHub) — `israel-alerts.csv` (~38 MB), normalized Home Front Command alerts. Raw: `https://github.com/dleshem/israel-alerts-data/raw/refs/heads/main/israel-alerts.csv` **(VERIFY LIVE)**. Columns include `data` (single area name), `alertDate` (Israel TZ), `category`, `category_desc`, `channel`. Use this to cross-check / fill gaps.

**Daily top-up (recent days only):**
- `GET https://api.tzevaadom.co.il/alerts-history` **(VERIFY LIVE)** for recent alerts to extend coverage to end of yesterday.

**Reconciliation:** different sources won't match exactly (different channels: website / mobile / tzevaadom). Choose tzevaadom historical as the **canonical** source; use dleshem only to fill missing days. Dedupe on (timestamp rounded to minute + locality). Document the blend in a code comment.

**Geocoding Hebrew locality names → lat/lng** (critical):
- **tzevaadom cities dataset** **(VERIFY LIVE URL — likely `https://www.tzevaadom.co.il/static/cities.json`)**. Verified field shape:
  ```json
  {"value":"אשקלון","name":"אשקלון","name_en":"Ashkelon","zone":"מערב לכיש",
   "zone_en":"Western Lakhish","countdown":30,"lat":31.6688,"lng":34.5743}
  ```
- Fallback geocoders: `eladnava/redalert-android` (≈1,500 localities w/ coords + polygons), `idodov/RedAlert` `cities_name.md`.
- **Matching caveat:** Oref/tzevaadom names are exact & sub-divided (e.g. `תל אביב - מרכז העיר`, `אשדוד - א,ב,ד,ה`). Build a normalization layer keyed on the Hebrew `name`; use exact match first, then fuzzy/substring fallback. Log unmatched names to an `unmatched_localities` table so coverage can be improved.

**Coarse city-union with the MAX rule (locked design decision).** We do **not** need sub-area precision. Each alert sub-area is collapsed to a **base city**, and the heatmap intensity for a base city over a selected range is the **MAXIMUM count among its sub-areas — not the sum.**
- *Example:* in the selected range, "באר שבע - מערב" had 6 alerts and "באר שבע - מזרח" had 3 → the value for **באר שבע** is **6**.
- **Deriving the base city:** strip the qualifier after the separator. Sub-area names are typically `"<city> - <part>"`; take the text before `" - "` (the hyphen-with-spaces separator) and trim. Maintain a small **manual override map** for irregular cases (kibbutzim, regional councils, names without a separator) so each sub-area reliably maps to one `city_id`. Store the mapping `sub_area → {city_id, city_name_he, lat, lng, zone}` in `cities.json`; the base city's coordinates = a representative/centroid point (pick the largest sub-area's coords or the official city centroid).
- **Where MAX is applied:** the export keeps **per-(day, sub-area) counts** (`subarea_daily`). The **frontend**, for the active date range, sums each sub-area's counts across the range, groups sub-areas by `city_id`, and takes the **max** per city → that is the heatmap weight and the "top cities" value. Keeping sub-area granularity in the export (not pre-collapsing) is what makes the MAX-over-range correct for *any* range the user picks.

**`alerts` table schema:**

| column | type | notes |
|---|---|---|
| alert_id | TEXT | source alert id / generated |
| ts_utc | DATETIME | UTC |
| ts_israel | DATETIME | Asia/Jerusalem (for hour-of-day stats) |
| locality_he | TEXT | Hebrew name |
| locality_en | TEXT | |
| zone | TEXT | region |
| lat | REAL | |
| lng | REAL | |
| source | TEXT | tzevaadom / dleshem |
| is_drill | BOOLEAN | exclude drills from stats by default |

Index `ts_utc`, `zone`, `locality_he`.

> **Note:** threat type is captured if available but is **not used** in the visualization (per locked decision #1). It's fine to store it; do not surface it as colors/layers.

### 3.2 Fatalities — points (ACLED)

- **Source: ACLED (Armed Conflict Location & Event Data).** Geolocated events with `latitude`, `longitude`, `event_date`, `event_type`, `fatalities`, `location`, `notes`, `source`. Covers **Israel from 2020-present**.
- **Access — OAuth, NOT a static key.** Register a **free myACLED account** at `https://acleddata.com/register/`. The API authenticates via OAuth: POST `username` (email), `password`, `grant_type=password`, `client_id=acled`, `scope=authenticated` to **`https://acleddata.com/oauth/token`** → returns an `access_token` (valid 24 h) + `refresh_token` (valid 14 d). Send `Authorization: Bearer <access_token>` on every data request.
  - **Env vars (never commit):** `ACLED_EMAIL`, `ACLED_PASSWORD`. The daily job requests a fresh token at the start of each run (token lifetime 24 h ≫ job duration, so no token persistence is needed). Provide `.env.example`; add `.env` to `.gitignore`. On a host, set these as platform secrets.
- **Data endpoint:** `GET https://acleddata.com/api/acled/read` with `_format=json` (or `csv`). Base URL: `https://acleddata.com/api/`.
- **Query:** `country=Israel` (events located in Israel; Gaza events are `country=Palestine` and are deliberately out of scope for this map), `event_date=2023-10-07|<yesterday>` with `event_date_where=BETWEEN`, `fields=event_id_cnty|event_date|latitude|longitude|fatalities|event_type|location|notes|source`. **Filter `fatalities > 0` in code** after fetching (robust; avoids depending on operator syntax) — the server-side `fatalities_where` filter is an optional optimization. Default row cap is 5000; **paginate with `page=1,2,…`** (pagination does not count against rate limits). Israel-country fatality events in this window are modest in number, so a few pages suffice.
- **Plot:** one marker per event with `fatalities > 0`, at its lat/lng, **radius ∝ √(fatalities)**. Tooltip: date, location, fatalities, event_type, source.
- **Honesty framing (must surface in UI):** ACLED fatalities are **event-level estimates**, located at an event centroid, compiled from reporting — not a verified named-victim registry. ACLED's Israel/Gaza fatality coding is methodologically contested; present as *reported* figures. **ACLED requires attribution and restricts commercial use** — show attribution and keep the app non-commercial.

**`fatalities` table:** `event_id, event_date, lat, lng, fatalities, event_type, location, source_text, source_url`.

> If ACLED access is blocked/undesirable, leave the fatalities layer behind a feature flag and surface a clear "fatalities source not configured" note rather than fabricating data. **Never invent fatality records.**

### 3.3 Population — subtle base shading (NOT a separate analytic layer)

This is purely an **aesthetic context layer** (slightly darker brown where people live), under everything else.

- **Primary: Kontur Population — Israel, 400 m H3 hexagons** (HDX, **CC-BY**): `https://data.humdata.org/dataset/kontur-population-israel`. Vector hexagons with population counts → renders as a clean, smooth choropleth. Ideal for the "subtle darker-brown density" look. Simplify/aggregate hexagons for performance.
- **Country/region outline (minimal): simplemaps Israel GeoJSON** — `https://simplemaps.com/gis/country/il` (lightweight ~45–128 KB, commercial use allowed). Use for thin region borders on the beige canvas.
- **Alternative: WorldPop Israel** 1 km density raster GeoTIFF (HDX) — only if you prefer a raster; needs a tiling step, more work. Prefer Kontur vector.

Bake population into a **static asset** processed once (not queried per request). Render with a **sequential tan→brown ramp**, low opacity, no sharp edges.

### 3.4 News events on the timeline (automatic)

- **GDELT 2.0 DOC API** — free, **no key**, date-range queryable. `https://api.gdeltproject.org/api/v2/doc/doc?query=<q>&mode=artlist&format=json&startdatetime=YYYYMMDDHHMMSS&enddatetime=YYYYMMDDHHMMSS`. Returns title, url, domain, sourcecountry, seendate.
- **Query filters:** Israel-relevant security events — combine country (Israel) with keywords like `ceasefire OR Iran OR rocket OR missile OR Gaza OR Hezbollah OR Houthi` and a negative-tone threshold to surface salient escalation coverage. Cache results in the `news` table keyed by date.
- **Optional curated track:** Wikipedia "Current events" / portal via the MediaWiki API for low-noise, human-curated major-event markers. Use as a secondary, sparser timeline track if GDELT is too noisy.
- **Timeline use:** cluster news into daily markers; clicking a marker sets the active date range (e.g. "the week after this event"). De-duplicate aggressively; cap markers per day.

**`news` table:** `event_date, title, url, domain, source_country, score/tone`.

### 3.5 Static JSON exports (what the daily job writes for the static frontend)

The Actions job queries SQLite and writes these to `frontend/public/data/`. Use **packed arrays / index maps**, not arrays of verbose objects, so they gzip small. `dayIndex` is days since `2023-10-07` (day 0). All counts exclude drills.

| file | shape | drives |
|---|---|---|
| `meta.json` | `{dataStartDate:"2023-10-07", dataThroughDate:"YYYY-MM-DD", generatedAt:ISO}` | freshness banner, timeline bounds |
| `cities.json` | `{ subAreas: { "<he name>": {ci:<cityId>} }, cities: [ {id, he, lat, lng, zone} ] }` | geocoding + sub-area→city union map |
| `subarea_daily.json` | packed rows `[dayIndex, subAreaId, count]` (or `{cols, rows}`) | **map heatmap** & top-cities (client applies MAX-per-city over the range) |
| `hour_daily.json` | `[dayIndex][0..23]` counts of distinct alert events per hour (Israel TZ) | **hour-of-day histogram** (sum over range) |
| `event_times.json` | sorted distinct alert-event unix minutes, **delta-encoded** | inter-alert gap stats (optional; can defer) |
| `fatalities.json` | `[ {d:"YYYY-MM-DD", lat, lng, f:<count>, t:<type>, loc} ]` | fatality points |
| `news.json` | `[ {d:"YYYY-MM-DD", title, url, domain} ]` (deduped, capped/day) | timeline markers |
| `population.json` | simplified Kontur hexes as GeoJSON or `[lat,lng,weight]` | population shading |

The frontend loads these once on startup (show a small loading state), then **all date-range filtering, the MAX-per-city union, and every statistic are computed in the browser** from these arrays. No network calls except fetching these files from the same Pages origin.

---

## 4. Map & visualization spec

**Library:** **Leaflet + Leaflet.heat** via **react-leaflet**. Rationale: tiny footprint, simplest API, best plugin ecosystem; our point volumes (hundreds–low thousands per range) are far below where WebGL wins. *Alternative:* MapLibre GL + a custom minimal style JSON if you want pixel-perfect control of the beige base and labels — acceptable, but only if it doesn't slow delivery.

**Base map — minimal & beige (priority):**
- Do **not** use standard busy raster tiles. Two acceptable routes:
  1. **No basemap tiles at all** — beige page/canvas background + the simplemaps GeoJSON region outline drawn in a thin, slightly-darker taupe. Most minimal, full color control. **Preferred for the look the owner wants.**
  2. **MapLibre with a custom style** — land filled beige, water a touch lighter/greyer, **no POI labels**, minimal/no road network, optional faint place labels only at high zoom.
- Disable/limit zoom-control styling to stay minimal; lock to Israel's bounds.

**Color system (starting palette — tune for taste):**

| element | role | suggestion |
|---|---|---|
| land / canvas | base | very light warm beige, e.g. `#F4EEE2` |
| region outline | structure | thin taupe, low contrast, e.g. `#D8CDBA` |
| population | subtle context | sequential tan→brown, low opacity, e.g. `#E7D6BE → #B89A6E` |
| **alert heatmap** | the data | **single warm ramp, transparent→hot**, e.g. transparent → `#F2A65A` → `#D7263D` (red reads as "alert" and pops over beige/brown) |
| **fatality points** | the data | solid **near-black / deep maroon** dots, e.g. `#2B0A0A`, white 1px stroke, radius ∝ √fatalities |

**Layer order (bottom → top):** beige base → population choropleth → region outline → **alert heatmap** → **fatality points**.

**Heatmap details:** for the selected range, compute per **base city** a weight = **MAX of its sub-areas' alert counts over the range** (see §3.1 union rule), then feed `[city.lat, city.lng, weight]` to `L.heatLayer` with a fixed `max`/`radius`/`gradient`. One weighted point per base city. Keep the gradient a single hue family so it stays "one color + intensity." All of this is computed client-side from `subarea_daily.json` + `cities.json`; recompute on range change.

**Layer toggles:** allow toggling population, heatmap, and fatality points independently. Default: all on.

---

## 5. Timeline & date-range UX

- **Linear timeline** spanning **2023-10-07 → yesterday (Israel TZ)**. Horizontal, scrubbable.
- **News markers** (from GDELT) sit on the timeline; **clicking one sets the active range** (provide presets like "day of", "week after", "±3 days"). This directly enables the owner's example ("the week after the Iran agreement").
- **Range picker:** `react-day-picker` (range mode). **Max selectable date = yesterday**; disable today and future.
- **Persistent data-freshness notice (required):** a visible banner/chip, e.g. (Hebrew) "הנתונים מעודכנים עד סוף יום אתמול ({yesterday date}). היום הנוכחי אינו כלול." Drive the date from `meta.json.dataThroughDate` (loaded from `/data/meta.json`). Also set the timeline's max bound from the same value.

---

## 6. Comparison feature (split screen)

- A panel is a self-contained component: **{ date range state → map + heatmap + fatality points + stats }**.
- **"Add Comparison"** mounts a **second independent panel** side-by-side (responsive: stack vertically on narrow screens). Each panel has its own range picker and timeline cursor.
- **Shared scales for fair comparison:** use the **same heatmap intensity max and the same fatality radius scale** across both panels (compute a common max across both ranges) so A vs B is visually honest. Make this toggleable ("lock scales").
- **Delta strip** between/above the panels: % change in total alerts, shift in peak hour-of-day, change in top-targeted localities, change in mean inter-alert gap, change in total fatalities.
- Allow removing the comparison to return to single view.

---

## 7. Statistics & analysis spec

Compute per active range (exclude drills by default):
- **Totals:** total alerts, alerts/day, distinct localities hit, distinct zones, **total fatalities**.
- **Hour-of-day histogram** (using `ts_israel`) — a key requested view ("firing times").
- **Top-N targeted localities** (bar chart) — and top-N by fatalities.
- **Inter-alert gaps:** mean/median time between alerts, longest quiet stretch.
- **Geographic spread:** count of zones, simple concentration metric.
- **"Adaptive risk" (descriptive only):** per-locality **percentile intensity within the selected window** (e.g., a locality in its own 95th-percentile alert rate). Frame strictly as descriptive history, **never predictive or safety guidance.**
- **Comparison metrics:** the deltas in §6.

**Charts:** **Recharts** (histogram/bar/line). Keep chart palette consistent with the warm/earthy map palette.

---

## 8. UI / localization

- **Hebrew UI, full RTL.** All labels, tooltips, legends, and the freshness banner in Hebrew.
- **Timezone: Asia/Jerusalem** for all date math, "yesterday" computation, and hour-of-day stats. Be careful with DST.
- Hebrew/locale number and date formatting.
- Keep the chrome minimal and quiet to match the map aesthetic (lots of whitespace, restrained type).

---

## 9. Legal / ethical / disclaimers (must appear in the UI)

- **Prominent, persistent disclaimer:** unofficial, **informational/historical only, NOT an official alerting tool, not authoritative**, do not rely on for safety. (Every serious project in this space ships this.)
- **Coordinates are locality/area centroids**, not impact points. Alert counts reflect **sirens/warnings**, not confirmed strikes.
- **Fatalities are reported event-level estimates from ACLED**, methodologically contested for this conflict — label as *reported*.
- **Attribution block:** Tzofar / tzevaadom (alerts), ACLED (fatalities — note non-commercial terms & attribution policy), GDELT (news), Kontur/WorldPop & simplemaps (population/boundaries), `dleshem/israel-alerts-data`. Respect each license (MIT/GPL/CC-BY vary).
- **No targeting framing.** Present as descriptive history of civilian-warning patterns; avoid anything that reads as operational/targeting information.

---

## 10. Endpoints quick-reference (all **VERIFY LIVE** before depending)

**These are fetched only by the GitHub Actions ingestion job (server-side), never by the browser.** The browser only fetches `/data/*.json` from the Pages origin. Centralize these URLs in one config module in the ingestion script.

| purpose | endpoint / source | notes |
|---|---|---|
| alert history (bulk) | `https://www.tzevaadom.co.il/static/historical/all.json` | filter ≥ 2023-10-07 |
| alert history (CSV) | `github.com/dleshem/israel-alerts-data` → `israel-alerts.csv` raw | gap-fill / cross-check |
| alert recent top-up | `https://api.tzevaadom.co.il/alerts-history` | extend to yesterday |
| city geocoding | `https://www.tzevaadom.co.il/static/cities.json` (confirm path) | Hebrew name → lat/lng/zone |
| fatalities | ACLED `https://acleddata.com/api/acled/read` (OAuth token from `https://acleddata.com/oauth/token`) | free myACLED account; `country=Israel`, filter `fatalities>0`, paginate |
| news timeline | `https://api.gdeltproject.org/api/v2/doc/doc` | no key; Israel + security query |
| population | Kontur Israel H3 (HDX) `data.humdata.org/dataset/kontur-population-israel` | CC-BY, vector |
| outline | simplemaps Israel GeoJSON `simplemaps.com/gis/country/il` | minimal borders |

---

## 11. Build stages (with acceptance checks)

**Stage 0 — Repo & Pages skeleton.** Vite + React + TS scaffold with `base:'/<repo>/'`; a placeholder `/data/meta.json`; the `.github/workflows/daily.yml` workflow (with `schedule` + `workflow_dispatch`) wired to build and deploy to GitHub Pages; `.env.example`; `.gitignore` (incl. `.env`). Add `ACLED_EMAIL`/`ACLED_PASSWORD` as repo secrets.
*Done when:* the empty app deploys to Pages automatically and the workflow runs green on manual dispatch.

**Stage 1 — Ingestion → SQLite → JSON exports.** The ingestion script (run inside the Action) builds `data/atlas.sqlite` from tzevaadom historical (≥2023-10-07) + dleshem + top-up; builds the Hebrew geocoder + sub-area→city union map; computes `dataThroughDate` = yesterday (Israel TZ); writes all `public/data/*.json` per §3.5.
*Done when:* running the job produces valid, non-empty `subarea_daily.json`, `cities.json`, `hour_daily.json`, and `meta.json`, and re-running is incremental (only appends new days).

**Stage 2 — Map MVP (client-side).** App loads `/data/*.json`; beige minimal base + region outline + population choropleth; single-hue alert heatmap for a selected range using the **MAX-per-city** union; `react-day-picker` capped at yesterday; freshness banner from `meta.json`.
*Done when:* a single panel renders the correct heatmap for a chosen range entirely client-side, looks minimal/beige, and shows the "excludes today" notice.

**Stage 3 — Fatalities + stats.** ACLED ingestion → `fatalities.json` → fatality points (sized by count) with tooltips; Recharts hour-of-day histogram (from `hour_daily.json`) + top cities + fatalities total, all computed client-side for the active range.
*Done when:* points and stats match the selected range and update on range change.

**Stage 4 — Timeline + news.** GDELT ingestion → `news.json` → clickable timeline markers with presets that set the range.
*Done when:* news markers populate automatically and clicking sets the range (the "week after event X" flow works).

**Stage 5 — Comparison.** Refactor panel into a component; "Add Comparison" mounts panel B; shared/locked scales; delta strip. All client-side.
*Done when:* two independent ranges render side-by-side with honest shared scales and delta metrics.

**Stage 6 — Polish.** Hebrew/RTL pass, disclaimers/attribution, layer toggles, responsive stacking, performance (simplify population hexagons, packed arrays, debounce range changes).

---

## 12. Caveats / known volatility

- **Unofficial endpoints can change without notice** (tzevaadom paths, the cities JSON URL, the dleshem raw path). Verify each at build time; centralize them in one config module so they're easy to fix.
- **Source coverage differs** by channel/period; counts won't perfectly match between tzevaadom and dleshem. Pick one canonical source per period and document it.
- **Coordinates are approximate** (centroids).
- **ACLED requires a key and forbids commercial use;** its conflict-fatality coding is contested — present figures as *reported*.
- **GDELT can be noisy;** tune the query and cap markers, or fall back to the Wikipedia current-events track.
- **No real-time:** by design, nothing newer than end-of-yesterday is shown; make this explicit in the UI (already required in §5).
