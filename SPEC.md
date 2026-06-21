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

---

## 2. Architecture (simplified: batch, not real-time)

Because the data only ever needs to be current through *yesterday*, **there is no websocket / SSE / live poller and no need for an Israeli-IP server.** All chosen sources (tzevaadom, ACLED, GDELT, Kontur/WorldPop) are reachable from anywhere, so the whole thing can run on **free hosting**.

```
                ┌─────────────────────────────────────────────┐
                │   DAILY BATCH JOB (cron / scheduled fn)      │
                │   runs ~03:00 Asia/Jerusalem                 │
                │   computes "yesterday" boundary in IL TZ     │
                │   1. fetch alert history  → upsert           │
                │   2. fetch ACLED fatalities (Israel) → upsert│
                │   3. fetch GDELT news events → upsert        │
                └───────────────────────┬─────────────────────┘
                                        ▼
                          ┌───────────────────────────┐
                          │  DB (SQLite → Postgres)   │
                          │  alerts / fatalities /    │
                          │  news  (+ static pop,     │
                          │  cities geo assets)       │
                          └─────────────┬─────────────┘
                                        ▼
                 REST API (Node/Express OR Python/FastAPI)
                 GET /api/alerts?from=&to=
                 GET /api/fatalities?from=&to=
                 GET /api/stats?from=&to=
                 GET /api/news?from=&to=
                 GET /api/meta            → {dataThroughDate, lastUpdated}
                                        ▼
                          React + Vite frontend (Hebrew, RTL)
                          Leaflet map · Recharts · timeline · split-screen
```

**Stack (recommended):**
- **Backend:** Node.js + Express **or** Python + FastAPI. Pick one; both are fine. The daily job can be a separate script invoked by the host's scheduler (Railway/Render cron, Fly machines scheduled, or GitHub Actions on a schedule writing to the DB/storage).
- **Database:** **SQLite** to start (single file, trivial). Migrate to **Postgres** only if you deploy somewhere with an ephemeral filesystem. One row per (alert_id, locality) and per fatality event.
- **Frontend:** **React + Vite**, **react-leaflet**, **Leaflet.heat**, **Leaflet.markercluster** (optional), **Recharts**, **react-day-picker**.
- **Hosting (all free tiers):** backend on Railway / Render / Fly.io; frontend on Vercel / Netlify / Cloudflare Pages.

**Lighter alternative (consider, optional):** since the dataset is bounded and changes once a day, the daily job can **pre-compute static JSON** (e.g., per-day aggregates + a fatalities file + a news file) and the frontend can do range filtering/aggregation client-side. This removes the live backend entirely (host static files on object storage / Pages). Use this if you want zero running servers. Default to the small-backend approach for cleaner stats queries unless the user prefers static.

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
- **Access:** requires a **free myACLED account / API credentials** — register at `https://acleddata.com/register/`. API docs: `https://acleddata.com/api-documentation/acled-endpoint`. **Store the API key/credentials in an env var (`ACLED_KEY` / `ACLED_EMAIL`), never in the repo.** A Python wrapper exists (`acled` on PyPI) if using FastAPI.
- **Query:** `country=Israel`, `event_date >= 2023-10-07` and `<= yesterday`, `fatalities > 0` (use `fatalities_where=>`). Request only needed fields: `event_id_cnty|event_date|latitude|longitude|fatalities|event_type|location|notes|source`. Paginate (`limit`/`page`; API default page size is large).
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

**Heatmap details:** aggregate alerts in the selected range to **one weighted point per locality** (`[lat, lng, count]`); feed to `L.heatLayer` with a fixed `max`/`radius`/`gradient`. Keep the gradient a single hue family so it stays "one color + intensity." Recompute on range change.

**Layer toggles:** allow toggling population, heatmap, and fatality points independently. Default: all on.

---

## 5. Timeline & date-range UX

- **Linear timeline** spanning **2023-10-07 → yesterday (Israel TZ)**. Horizontal, scrubbable.
- **News markers** (from GDELT) sit on the timeline; **clicking one sets the active range** (provide presets like "day of", "week after", "±3 days"). This directly enables the owner's example ("the week after the Iran agreement").
- **Range picker:** `react-day-picker` (range mode). **Max selectable date = yesterday**; disable today and future.
- **Persistent data-freshness notice (required):** a visible banner/chip, e.g. (Hebrew) "הנתונים מעודכנים עד סוף יום אתמול ({yesterday date}). היום הנוכחי אינו כלול." Drive the date from `GET /api/meta.dataThroughDate`.

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

| purpose | endpoint / source | notes |
|---|---|---|
| alert history (bulk) | `https://www.tzevaadom.co.il/static/historical/all.json` | filter ≥ 2023-10-07 |
| alert history (CSV) | `github.com/dleshem/israel-alerts-data` → `israel-alerts.csv` raw | gap-fill / cross-check |
| alert recent top-up | `https://api.tzevaadom.co.il/alerts-history` | extend to yesterday |
| city geocoding | `https://www.tzevaadom.co.il/static/cities.json` (confirm path) | Hebrew name → lat/lng/zone |
| fatalities | ACLED API, `acleddata.com/api-documentation/acled-endpoint` | needs free key; `country=Israel`, `fatalities>0` |
| news timeline | `https://api.gdeltproject.org/api/v2/doc/doc` | no key; Israel + security query |
| population | Kontur Israel H3 (HDX) `data.humdata.org/dataset/kontur-population-israel` | CC-BY, vector |
| outline | simplemaps Israel GeoJSON `simplemaps.com/gis/country/il` | minimal borders |

---

## 11. Build stages (with acceptance checks)

**Stage 1 — Data pipeline.** Daily job ingests tzevaadom historical (≥2023-10-07) + dleshem into SQLite; builds the Hebrew geocoder; computes `dataThroughDate` = yesterday (IL TZ).
*Done when:* `GET /api/alerts?from=&to=` returns geocoded alerts for any range in scope, and `/api/meta` reports yesterday correctly.

**Stage 2 — Map MVP.** React + react-leaflet; beige minimal base + region outline + population choropleth; single-hue alert heatmap for a selected range; range picker capped at yesterday; freshness banner.
*Done when:* a single panel renders the correct heatmap for a chosen range, looks minimal/beige, and shows the "excludes today" notice.

**Stage 3 — Fatalities + stats.** ACLED ingestion → fatality points (sized by count) with tooltips; Recharts hour-of-day histogram + top localities + fatalities total.
*Done when:* points and stats match the selected range and update on range change.

**Stage 4 — Timeline + news.** GDELT ingestion → clickable timeline markers with presets that set the range.
*Done when:* news markers populate automatically and clicking sets the range (the "week after event X" flow works).

**Stage 5 — Comparison.** Refactor panel into a component; "Add Comparison" mounts panel B; shared/locked scales; delta strip.
*Done when:* two independent ranges render side-by-side with honest shared scales and delta metrics.

**Stage 6 — Polish.** Hebrew/RTL pass, disclaimers/attribution, layer toggles, responsive stacking, performance (simplify population hexagons, debounce range changes).

---

## 12. Caveats / known volatility

- **Unofficial endpoints can change without notice** (tzevaadom paths, the cities JSON URL, the dleshem raw path). Verify each at build time; centralize them in one config module so they're easy to fix.
- **Source coverage differs** by channel/period; counts won't perfectly match between tzevaadom and dleshem. Pick one canonical source per period and document it.
- **Coordinates are approximate** (centroids).
- **ACLED requires a key and forbids commercial use;** its conflict-fatality coding is contested — present figures as *reported*.
- **GDELT can be noisy;** tune the query and cap markers, or fall back to the Wikipedia current-events track.
- **No real-time:** by design, nothing newer than end-of-yesterday is shown; make this explicit in the UI (already required in §5).
