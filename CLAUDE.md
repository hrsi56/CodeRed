# CLAUDE.md

Working rules for this repo. **`SPEC.md` is the single source of truth for *what* to build — read it fully before doing anything.** This file is the *rules of engagement* for *how* to build it.

---

## Project in one line

A minimal, historical (not real-time) interactive map of Israel showing "Code Red" (Tzeva Adom) alert density as a single-color heatmap, fatalities as points, over a beige map with subtle population shading, with a linear timeline from 2023-10-07 and a split-screen comparison mode. Full details in `SPEC.md`.

---

## Hard rules (do not break)

1. **Never invent data.** Do not fabricate, mock, estimate, or "fill in" alerts, fatalities, news events, or coordinates. If a source is unavailable or returns nothing, put the affected layer behind a feature flag, log a clear console warning, show a neutral "data unavailable" state in the UI, and leave a `TODO`. Real data or no data — never fake data.
2. **Verify unofficial endpoints before depending on them.** Everything marked **VERIFY LIVE** in `SPEC.md` (tzevaadom paths, the cities JSON URL, the dleshem raw path) must be confirmed live (curl / fetch) before you build on it. Put *all* external URLs in one config module (`src/config/sources.*`) so they're trivial to fix when they change.
3. **Don't re-litigate the locked product decisions** in `SPEC.md` §1 (single-color intensity heatmap, fatalities as points, minimal beige map, timeline from 2023-10-07 through *yesterday only*, split-screen comparison). If you think one is wrong, raise it with the user — don't silently change it.
4. **No real-time.** Data is current only through the **end of yesterday (Asia/Jerusalem)**. No websockets, no live polling of the current day. The "data excludes today" notice is required, not optional.
5. **Secrets live in env vars, never in git.** ACLED uses OAuth (email + password → bearer token), not a static key: store `ACLED_EMAIL` / `ACLED_PASSWORD`. Provide a `.env.example`; add `.env` to `.gitignore`. Never print secrets in logs.
6. **Ask before spending money or adding heavy deps.** No paid services, no paid API tiers, no large/native dependencies without asking the user first. Default to the free stack in `SPEC.md`.
7. **Keep the ethical framing.** This is unofficial and informational/historical. The disclaimer, attribution block, "fatalities are *reported* estimates," and "coordinates are centroids" notes (SPEC §9) must be present in the UI. No targeting/operational framing.

---

## Tech stack (don't drift)

- Frontend: **React + Vite**, **react-leaflet + Leaflet.heat**, **Recharts**, **react-day-picker**. Hebrew, **RTL**.
- Backend: **Node/Express** *or* **Python/FastAPI** (pick one, stay consistent). **SQLite** to start.
- Data refresh: one **daily batch job**, not a live server loop.
- All date math in **Asia/Jerusalem**; mind DST.

If you want to deviate from the stack, ask first and say why.

---

## How to work

- **Follow the staged build plan in `SPEC.md` §11.** Finish and self-verify each stage (against its "Done when" check) before starting the next. Keep each stage shippable.
- **Commit in small, logical units** with clear messages (e.g. `feat(map): single-hue alert heatmap`). One concern per commit.
- **Centralize config:** external URLs in one module; the color palette (SPEC §4) in one theme file; the `2023-10-07` start date and TZ in one constants file.
- **Write a real `README.md`** as you go: how to install, set env vars, run the daily job, run dev, and build.
- **Prefer clarity over cleverness.** This is a hobby project meant to be readable and maintainable.

## When you're blocked

- If an endpoint is dead or its schema differs from `SPEC.md`: stop, report exactly what you found (status code / sample payload), propose the fallback from the spec, and ask before improvising a data source.
- If a product decision seems to conflict with reality: surface it to the user rather than guessing.
- Don't paper over a broken data source with placeholder data (see Hard Rule #1).

---

## Definition of done (MVP)

A user can pick a date range between 2023-10-07 and yesterday, see a correct single-color alert heatmap + fatality points on the minimal beige map, read descriptive stats (hour-of-day, top localities, totals), click a news marker on the timeline to set the range, and press "Add Comparison" to view a second independent range side-by-side — with the disclaimer and "excludes today" notice visible throughout.
