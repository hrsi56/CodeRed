"""GDELT news ingestion → daily timeline markers (SPEC.md §3.4).

GDELT is noisy and rate-limited (~1 req/5s), so we query one month at a time,
take the top hybrid-relevance English articles, then bucket to days and keep only
a few deduped markers per day. The news layer is feature-flagged: any failure logs
a warning and skips rather than failing the pipeline or fabricating events.

Incremental by default: run.py fetches only a trailing window each day (the
committed atlas.sqlite already holds older months). Full backfill:

    python -m ingestion.ingest_news --full
"""

import re
import sqlite3
import sys
import time
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import requests

from .constants import DATA_START_DATE, TIMEZONE_NAME
from .sources import GDELT_DOC_URL, GDELT_MIN_INTERVAL_SECONDS, REQUEST_HEADERS

ISRAEL_TZ = ZoneInfo(TIMEZONE_NAME)
QUERY = "israel (rocket OR missile OR ceasefire OR iran OR hezbollah OR houthi OR gaza OR hamas) sourcelang:english"
MAX_RECORDS_PER_MONTH = 75
MARKERS_PER_DAY = 3
TRAILING_MONTHS = 2

_norm_re = re.compile(r"[^a-z0-9 ]+")


def _normalize_title(title: str) -> str:
    return _norm_re.sub("", title.lower()).strip()[:60]


def _month_starts(full: bool) -> list[date]:
    today = datetime.now(ISRAEL_TZ).date()
    first = DATA_START_DATE.replace(day=1)
    months: list[date] = []
    cur = first
    while cur <= today:
        months.append(cur)
        cur = (cur + timedelta(days=32)).replace(day=1)
    return months if full else months[-TRAILING_MONTHS:]


def _fetch_month(start: date) -> list[dict]:
    end = (start + timedelta(days=32)).replace(day=1)
    resp = requests.get(
        GDELT_DOC_URL,
        headers=REQUEST_HEADERS,
        params={
            "query": QUERY,
            "mode": "artlist",
            "maxrecords": MAX_RECORDS_PER_MONTH,
            "sort": "hybridrel",
            "format": "json",
            "startdatetime": start.strftime("%Y%m%d000000"),
            "enddatetime": end.strftime("%Y%m%d000000"),
        },
        timeout=40,
    )
    if not resp.ok or "application/json" not in resp.headers.get("content-type", ""):
        print(f"[ingest_news] {start:%Y-%m}: non-JSON/HTTP {resp.status_code}, skipping")
        return []
    try:
        return resp.json().get("articles", [])
    except ValueError:
        print(f"[ingest_news] {start:%Y-%m}: bad JSON, skipping")
        return []


def _to_rows(articles: list[dict]) -> list[dict]:
    """Bucket a month's articles to days, dedupe by normalized title, keep the top
    few per day (GDELT already returned them in relevance order)."""
    per_day: dict[str, list[dict]] = {}
    seen_per_day: dict[str, set[str]] = {}
    for art in articles:
        seen = art.get("seendate", "")
        title = (art.get("title") or "").strip()
        if len(seen) < 8 or not title:
            continue
        ts = datetime.strptime(seen[:8], "%Y%m%d").replace(tzinfo=timezone.utc)
        day = ts.astimezone(ISRAEL_TZ).date()
        if day < DATA_START_DATE:
            continue
        day_iso = day.isoformat()
        norm = _normalize_title(title)
        bucket_seen = seen_per_day.setdefault(day_iso, set())
        if norm in bucket_seen:
            continue
        bucket = per_day.setdefault(day_iso, [])
        if len(bucket) >= MARKERS_PER_DAY:
            continue
        bucket_seen.add(norm)
        bucket.append(
            {
                "event_date": day_iso,
                "title": title,
                "url": art.get("url"),
                "domain": art.get("domain"),
                "source_country": art.get("sourcecountry"),
            }
        )
    return [row for rows in per_day.values() for row in rows]


def load_news(conn: sqlite3.Connection, full: bool = False) -> None:
    months = _month_starts(full)
    total = 0
    for i, start in enumerate(months):
        if i > 0:
            time.sleep(GDELT_MIN_INTERVAL_SECONDS)
        rows = _to_rows(_fetch_month(start))
        if rows:
            conn.executemany(
                "INSERT OR IGNORE INTO news (event_date, title, url, domain, source_country) "
                "VALUES (:event_date, :title, :url, :domain, :source_country)",
                rows,
            )
            total += len(rows)
    conn.commit()
    print(f"[ingest_news] fetched {len(months)} month(s), upserted up to {total} markers")


if __name__ == "__main__":
    from . import db, export

    full = "--full" in sys.argv
    conn = db.connect()
    try:
        load_news(conn, full=full)
        export.export_news(conn)
    finally:
        conn.close()
