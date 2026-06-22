# Centralized external source URLs (CLAUDE.md Hard Rule #2).
# All of these are unofficial/undocumented and were verified live on 2026-06-21 — see
# memory notes; re-verify here if ingestion starts failing.

TZEVAADOM_HISTORICAL_URL = "https://www.tzevaadom.co.il/static/historical/all.json"
TZEVAADOM_TOPUP_URL = "https://api.tzevaadom.co.il/alerts-history"
TZEVAADOM_CITIES_URL = "https://www.tzevaadom.co.il/static/cities.json"

# Gap-fill source — not yet ingested (see ingest_alerts.py TODO). Kept here so the
# URL is pinned and ready when that piece is built.
DLESHEM_CSV_URL = (
    "https://raw.githubusercontent.com/dleshem/israel-alerts-data/refs/heads/main/israel-alerts.csv"
)

ACLED_OAUTH_URL = "https://acleddata.com/oauth/token"
ACLED_READ_URL = "https://acleddata.com/api/acled/read"

GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc"
# GDELT throttles to ~1 request / 5 s; pace a little slower to be safe.
GDELT_MIN_INTERVAL_SECONDS = 6

# Fallback news track (SPEC.md §3.4) — Wikipedia "Current events" daily portal pages,
# used to fill timeline days GDELT couldn't reach. MediaWiki action API, no key.
WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php"

REQUEST_HEADERS = {"User-Agent": "code-red-atlas-ingestion/1 (+https://github.com/hrsi56/CodeRed)"}
