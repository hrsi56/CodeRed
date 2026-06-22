"""Wikipedia "Current events" portal → news markers (SPEC.md §3.4 fallback track).

GDELT (ingest_news.py) is the *primary* news source, but it is unreliable for
historical date-range queries — it rate-limits hard and, from some networks/CI
runners, times out entirely — which leaves multi-month holes in the timeline
(e.g. the whole of October 2023, the April 2024 Iran exchange, the September 2024
Hezbollah escalation). Wikipedia's daily ``Portal:Current events`` pages are a
stable, low-noise, human-curated alternative that SPEC.md §3.4 explicitly names as
the secondary track.

We use it ONLY to fill days that have no marker yet: GDELT stays canonical wherever
it already produced one (see the ``existing`` guard in ``load_news_wikipedia``).

Real curated data only (CLAUDE.md Hard Rule #1): every marker is an actual
Current-events entry extracted from the live page. Days Wikipedia has no
Israel-relevant entry for simply stay empty — nothing is synthesized.

Incremental by default (run.py fetches a trailing window + a few un-swept months
each day so historical gaps self-heal). Full backfill:

    python -m ingestion.ingest_news_wikipedia --full
"""

import re
import sqlite3
import sys
from calendar import monthrange
from datetime import date, datetime
from zoneinfo import ZoneInfo

import requests

from .constants import DATA_START_DATE, TIMEZONE_NAME
from .sources import REQUEST_HEADERS, WIKIPEDIA_API_URL

ISRAEL_TZ = ZoneInfo(TIMEZONE_NAME)
WIKI_DOMAIN = "en.wikipedia.org"

MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

BATCH_SIZE = 50  # MediaWiki allows up to 50 page titles per query
MARKERS_PER_DAY = 3
TRAILING_MONTHS = 2  # always re-check recent months (catch days GDELT missed)
MAX_MONTHS_PER_RUN = 4  # back-fill this many not-yet-swept historical months per run

# Strong, unambiguous Israel-conflict tokens. Deliberately excludes bare
# "missile"/"rocket"/"drone" — on their own those pull in the Russia–Ukraine war,
# which dominates the same Current-events pages and is out of scope for this map.
_STRONG = re.compile(
    r"\b(israel|israeli|gaza|gazan|hamas|hezbollah|hizbullah|hizballah|nasrallah|idf|sderot|ashkelon|"
    r"ashdod|beersheba|be'?er sheva|netanyahu|west bank|rafah|khan\s?y(?:ou|u)nis|houthi|kfar aza|nir oz|"
    r"be'?eri|netiv ha|jenin|nablus|tubas|eilat|tel aviv|haifa|jerusalem|hostage|unifil|sinwar|golan|"
    r"kiryat shmona|metula|tiberias|kerem shalom|nahal oz|tzeva)\b",
    re.I,
)
# A real Current-events entry ends with a "(Source)" citation; cross-reference
# header lines (e.g. "International reactions to the Israel–Hamas war") do not.
_CITE = re.compile(r"\([A-Z][^)]{1,40}\)\s*$")

_LINK_PIPE = re.compile(r"\[\[[^\]|]*\|([^\]]*)\]\]")
_LINK_PLAIN = re.compile(r"\[\[([^\]]*)\]\]")
_EXT_LINK = re.compile(r"\[https?://\S+\s+([^\]]*)\]")
_EXT_BARE = re.compile(r"\[https?://\S+\]")
_REF_BLOCK = re.compile(r"<ref[^>]*>.*?</ref>", re.S)
_TAG = re.compile(r"<[^>]+>")
_TEMPLATE = re.compile(r"\{\{[^}]*\}\}")
_TRAILING_CITE = re.compile(r"\s*\([A-Z][^)]{1,40}\)\s*$")


def _clean(line: str) -> str:
    s = _LINK_PIPE.sub(r"\1", line)
    s = _LINK_PLAIN.sub(r"\1", s)
    s = _EXT_LINK.sub(r"\1", s)
    s = _EXT_BARE.sub("", s)
    s = _REF_BLOCK.sub("", s)
    s = _TAG.sub("", s)
    s = _TEMPLATE.sub("", s)
    s = s.replace("'''", "").replace("''", "")
    s = s.strip().lstrip("*").strip()
    return re.sub(r"\s+", " ", s)


def _to_title(text: str) -> str:
    """Drop the trailing '(Source)' citation for a cleaner marker title; cap length."""
    return _TRAILING_CITE.sub("", text).strip().rstrip(".")[:180]


def _month_starts() -> list[tuple[int, int]]:
    today = datetime.now(ISRAEL_TZ).date()
    out: list[tuple[int, int]] = []
    y, m = DATA_START_DATE.year, DATA_START_DATE.month
    while (y, m) <= (today.year, today.month):
        out.append((y, m))
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def _day_titles(year: int, month: int) -> list[str]:
    n = monthrange(year, month)[1]
    return [f"Portal:Current events/{year} {MONTH_NAMES[month - 1]} {d}" for d in range(1, n + 1)]


def _day_from_title(title: str) -> date | None:
    m = re.search(r"/(\d{4}) (\w+) (\d+)$", title)
    if not m or m.group(2) not in MONTH_NAMES:
        return None
    return date(int(m.group(1)), MONTH_NAMES.index(m.group(2)) + 1, int(m.group(3)))


def _fetch_pages(titles: list[str]) -> dict[str, str]:
    resp = requests.get(
        WIKIPEDIA_API_URL,
        headers=REQUEST_HEADERS,
        params={
            "action": "query",
            "prop": "revisions",
            "rvprop": "content",
            "rvslots": "main",
            "titles": "|".join(titles),
            "format": "json",
            "formatversion": "2",
        },
        timeout=60,
    )
    resp.raise_for_status()
    out: dict[str, str] = {}
    for page in resp.json().get("query", {}).get("pages", []):
        revs = page.get("revisions")
        if revs:  # missing/future day-pages have no revisions
            out[page["title"]] = revs[0]["slots"]["main"]["content"]
    return out


def _events_for_page(wikitext: str) -> list[str]:
    titles: list[str] = []
    seen: set[str] = set()
    for raw in wikitext.splitlines():
        if not raw.lstrip().startswith("*"):
            continue
        cleaned = _clean(raw)
        if len(cleaned) <= 40 or not _STRONG.search(cleaned) or not _CITE.search(cleaned):
            continue
        title = _to_title(cleaned)
        key = title.lower()[:50]
        if not title or key in seen:
            continue
        seen.add(key)
        titles.append(title)
        if len(titles) >= MARKERS_PER_DAY:
            break
    return titles


def _months_to_fetch(conn: sqlite3.Connection, full: bool) -> list[tuple[int, int]]:
    all_months = _month_starts()
    if full:
        return all_months
    swept = {
        row[0]
        for row in conn.execute(
            "SELECT DISTINCT substr(event_date, 1, 7) FROM news WHERE domain = ?", (WIKI_DOMAIN,)
        )
    }
    not_swept = [m for m in all_months if f"{m[0]:04d}-{m[1]:02d}" not in swept]
    wanted = set(all_months[-TRAILING_MONTHS:]) | set(not_swept[:MAX_MONTHS_PER_RUN])
    return sorted(wanted)


def load_news_wikipedia(conn: sqlite3.Connection, full: bool = False) -> None:
    # GDELT stays canonical: only fill days that currently have no marker at all.
    existing = {row[0] for row in conn.execute("SELECT DISTINCT event_date FROM news")}
    months = _months_to_fetch(conn, full)
    inserted = 0
    for year, month in months:
        titles = _day_titles(year, month)
        pages: dict[str, str] = {}
        for i in range(0, len(titles), BATCH_SIZE):
            try:
                pages.update(_fetch_pages(titles[i : i + BATCH_SIZE]))
            except requests.RequestException as exc:
                print(f"[ingest_news_wikipedia] {year}-{month:02d}: fetch failed ({exc}); skipping batch")
        rows = []
        for title, wikitext in pages.items():
            day = _day_from_title(title)
            if day is None or day < DATA_START_DATE or day.isoformat() in existing:
                continue
            url = f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}"
            for event_title in _events_for_page(wikitext):
                rows.append(
                    {
                        "event_date": day.isoformat(),
                        "title": event_title,
                        "url": url,
                        "domain": WIKI_DOMAIN,
                        "source_country": "",
                    }
                )
        if rows:
            conn.executemany(
                "INSERT OR IGNORE INTO news (event_date, title, url, domain, source_country) "
                "VALUES (:event_date, :title, :url, :domain, :source_country)",
                rows,
            )
            inserted += len(rows)
    conn.commit()
    print(f"[ingest_news_wikipedia] swept {len(months)} month(s), filled up to {inserted} markers")


if __name__ == "__main__":
    from . import db, export

    full = "--full" in sys.argv
    conn = db.connect()
    try:
        load_news_wikipedia(conn, full=full)
        export.export_news(conn)
    finally:
        conn.close()
