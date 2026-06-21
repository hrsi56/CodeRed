import sqlite3
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import requests

from .constants import DATA_START_DATE, TIMEZONE_NAME
from .sources import REQUEST_HEADERS, TZEVAADOM_HISTORICAL_URL, TZEVAADOM_TOPUP_URL

ISRAEL_TZ = ZoneInfo(TIMEZONE_NAME)

# TODO(stage-1+): dleshem/israel-alerts-data is meant to gap-fill whole days missing
# from tzevaadom (SPEC.md §3.1), but its sub-area naming scheme ("<city> <digits>")
# is unrelated to tzevaadom's cities.json keys and would need its own geocoding pass.
# Deferred until a real gap is observed; tzevaadom historical alone currently covers
# 2021-05-20 through ~yesterday (see ingestion run log / memory notes).


def _row_for(unix_ts: int, city: str, threat: int | None, source: str, is_drill: bool) -> dict | None:
    ts_utc = datetime.fromtimestamp(unix_ts, tz=timezone.utc)
    ts_israel = ts_utc.astimezone(ISRAEL_TZ)
    day_index = (ts_israel.date() - DATA_START_DATE).days
    if day_index < 0:
        return None
    return {
        "alert_id": f"{unix_ts}:{city}",
        "ts_utc": ts_utc.isoformat(),
        "ts_israel": ts_israel.isoformat(),
        "day_index": day_index,
        "hour_israel": ts_israel.hour,
        "locality_he": city,
        "threat": threat,
        "source": source,
        "is_drill": int(is_drill),
    }


def fetch_historical_rows() -> list[dict]:
    resp = requests.get(TZEVAADOM_HISTORICAL_URL, headers=REQUEST_HEADERS, timeout=60)
    resp.raise_for_status()
    rows = []
    # The historical bulk dump has no drill flag at all; treat as non-drill. This is a
    # known gap (documented in SPEC.md-adjacent memory notes), not a fabrication — we
    # simply can't exclude historical drills from stats until tzevaadom exposes one.
    for _event_id, threat, cities, unix_ts in resp.json():
        for city in cities:
            row = _row_for(unix_ts, city, threat, "tzevaadom_historical", is_drill=False)
            if row:
                rows.append(row)
    return rows


def fetch_topup_rows() -> list[dict]:
    resp = requests.get(TZEVAADOM_TOPUP_URL, headers=REQUEST_HEADERS, timeout=30)
    resp.raise_for_status()
    rows = []
    for event in resp.json():
        for alert in event.get("alerts", []):
            for city in alert.get("cities", []):
                row = _row_for(
                    alert["time"],
                    city,
                    alert.get("threat"),
                    "tzevaadom_topup",
                    is_drill=bool(alert.get("isDrill", False)),
                )
                if row:
                    rows.append(row)
    return rows


def load_alerts(conn: sqlite3.Connection) -> None:
    known_subareas = {row[0] for row in conn.execute("SELECT subarea_he FROM subareas")}

    rows = fetch_historical_rows() + fetch_topup_rows()
    if not rows:
        print("[ingest_alerts] WARNING: fetched zero rows from tzevaadom — check endpoints")
        return

    conn.executemany(
        "INSERT OR IGNORE INTO alerts "
        "(alert_id, ts_utc, ts_israel, day_index, hour_israel, locality_he, threat, source, is_drill) "
        "VALUES (:alert_id, :ts_utc, :ts_israel, :day_index, :hour_israel, :locality_he, :threat, :source, :is_drill)",
        rows,
    )

    unmatched: dict[str, int] = {}
    for row in rows:
        loc = row["locality_he"]
        if loc not in known_subareas:
            unmatched[loc] = unmatched.get(loc, 0) + 1

    for loc, count in unmatched.items():
        conn.execute(
            "INSERT INTO unmatched_localities (locality_he, occurrences, first_seen_ts) "
            "VALUES (?, ?, datetime('now')) "
            "ON CONFLICT(locality_he) DO UPDATE SET occurrences = occurrences + ?",
            (loc, count, count),
        )

    conn.commit()
    print(
        f"[ingest_alerts] fetched {len(rows)} alert rows "
        f"({len(unmatched)} distinct unmatched localities)"
    )
