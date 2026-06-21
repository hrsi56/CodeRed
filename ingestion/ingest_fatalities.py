import sqlite3
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import requests

from .constants import DATA_START_DATE, TIMEZONE_NAME
from .sources import ACLED_OAUTH_URL, ACLED_READ_URL, REQUEST_HEADERS

ISRAEL_TZ = ZoneInfo(TIMEZONE_NAME)
PAGE_SIZE = 5000
FIELDS = "event_id_cnty|event_date|latitude|longitude|fatalities|event_type|location|notes|source"


def _yesterday_israel() -> date:
    return (datetime.now(ISRAEL_TZ) - timedelta(days=1)).date()


# ACLED's auth endpoint sits behind a CDN that, from datacenter IPs (e.g. GitHub
# Actions runners), returns 415 unless the request matches the documented curl exactly
# — explicit form Content-Type, an Accept header, and a non-empty User-Agent. The same
# call succeeds from a residential IP without these, which is what masked it locally.
_OAUTH_HEADERS = {
    **REQUEST_HEADERS,
    "Content-Type": "application/x-www-form-urlencoded",
    "Accept": "application/json",
}


def _get_access_token(email: str, password: str) -> str:
    resp = requests.post(
        ACLED_OAUTH_URL,
        headers=_OAUTH_HEADERS,
        data={
            "username": email,
            "password": password,
            "grant_type": "password",
            "client_id": "acled",
            "scope": "authenticated",
        },
        timeout=30,
    )
    if not resp.ok:
        raise RuntimeError(f"ACLED OAuth failed: {resp.status_code} {resp.text[:300]}")
    return resp.json()["access_token"]


def fetch_fatality_rows(email: str, password: str) -> list[dict]:
    token = _get_access_token(email, password)
    headers = {**REQUEST_HEADERS, "Accept": "application/json", "Authorization": f"Bearer {token}"}
    through = _yesterday_israel().isoformat()

    rows: list[dict] = []
    page = 1
    while True:
        resp = requests.get(
            ACLED_READ_URL,
            headers=headers,
            params={
                "_format": "json",
                "country": "Israel",
                "event_date": f"{DATA_START_DATE.isoformat()}|{through}",
                "event_date_where": "BETWEEN",
                "fields": FIELDS,
                "limit": PAGE_SIZE,
                "page": page,
            },
            timeout=60,
        )
        resp.raise_for_status()
        batch = resp.json()["data"]
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        page += 1

    # Filter fatalities>0 in code rather than via a server-side query param, per
    # SPEC.md §3.2 ("robust; avoids depending on operator syntax").
    return [r for r in rows if int(r["fatalities"]) > 0]


def load_fatalities(conn: sqlite3.Connection, email: str, password: str) -> None:
    rows = fetch_fatality_rows(email, password)
    records = [
        {
            "event_id": r["event_id_cnty"],
            "event_date": r["event_date"],
            "lat": float(r["latitude"]),
            "lng": float(r["longitude"]),
            "fatalities": int(r["fatalities"]),
            "event_type": r["event_type"],
            "location": r["location"],
            "source_text": r.get("source"),
            "notes": r.get("notes"),
        }
        for r in rows
    ]
    conn.executemany(
        "INSERT OR REPLACE INTO fatalities "
        "(event_id, event_date, lat, lng, fatalities, event_type, location, source_text, notes) "
        "VALUES (:event_id, :event_date, :lat, :lng, :fatalities, :event_type, :location, :source_text, :notes)",
        records,
    )
    conn.commit()
    total = sum(r["fatalities"] for r in records)
    print(f"[ingest_fatalities] fetched {len(records)} fatal events, {total} total fatalities")
