import json
import sqlite3
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from .constants import DATA_START_DATE, TIMEZONE_NAME

FRONTEND_DATA_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public" / "data"
ISRAEL_TZ = ZoneInfo(TIMEZONE_NAME)


def _yesterday_israel() -> date:
    return (datetime.now(ISRAEL_TZ) - timedelta(days=1)).date()


def export_all(conn: sqlite3.Connection) -> None:
    FRONTEND_DATA_DIR.mkdir(parents=True, exist_ok=True)

    max_ingested_day = conn.execute("SELECT MAX(day_index) FROM alerts").fetchone()[0]
    yesterday_day_index = (_yesterday_israel() - DATA_START_DATE).days

    # Never claim coverage past yesterday (Hard Rule #4) even if a source leaks a
    # same-day row in; never claim more than we actually ingested either (Hard Rule #1)
    # — tzevaadom's own feeds can lag a day or two behind real time.
    through_day_index = -1 if max_ingested_day is None else min(max_ingested_day, yesterday_day_index)
    data_through_date = (
        (DATA_START_DATE + timedelta(days=through_day_index)).isoformat() if through_day_index >= 0 else None
    )

    _export_meta(data_through_date)
    _export_cities(conn)
    _export_subarea_daily(conn, through_day_index)
    _export_hour_daily(conn, through_day_index)
    _export_fatalities(conn, data_through_date)
    export_news(conn, data_through_date)


def _export_meta(data_through_date: str | None) -> None:
    meta = {
        "dataStartDate": DATA_START_DATE.isoformat(),
        "dataThroughDate": data_through_date,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }
    _write_json("meta.json", meta)


def _export_cities(conn: sqlite3.Connection) -> None:
    cities = [
        {"id": city_id, "he": he, "en": en, "lat": lat, "lng": lng, "zone": zone_he, "zoneEn": zone_en}
        for city_id, he, en, lat, lng, zone_he, zone_en in conn.execute(
            "SELECT c.city_id, c.he, c.en, c.lat, c.lng, a.zone_he, a.zone_en "
            "FROM cities c LEFT JOIN areas a ON a.area_code = c.area_code"
        )
    ]
    # Keyed by the numeric sub-area source_id (as a string — JSON keys are always
    # strings) so the frontend can join subarea_daily.json rows (which carry that same
    # subAreaId) straight to a base city for the MAX-per-city union (SPEC.md §3.1/§4).
    sub_areas = {
        str(source_id): {"ci": base_city_id}
        for source_id, base_city_id in conn.execute("SELECT source_id, base_city_id FROM subareas")
    }
    _write_json("cities.json", {"subAreas": sub_areas, "cities": cities})


def _export_subarea_daily(conn: sqlite3.Connection, through_day_index: int) -> None:
    rows = conn.execute(
        "SELECT a.day_index, s.source_id, COUNT(*) "
        "FROM alerts a JOIN subareas s ON s.subarea_he = a.locality_he "
        "WHERE a.is_drill = 0 AND a.day_index <= ? "
        "GROUP BY a.day_index, s.source_id "
        "ORDER BY a.day_index",
        (through_day_index,),
    ).fetchall()
    _write_json("subarea_daily.json", [[d, sid, c] for d, sid, c in rows])


def _export_hour_daily(conn: sqlite3.Connection, through_day_index: int) -> None:
    n_days = through_day_index + 1 if through_day_index >= 0 else 0
    table = [[0] * 24 for _ in range(n_days)]
    rows = conn.execute(
        "SELECT day_index, hour_israel, COUNT(*) FROM alerts "
        "WHERE is_drill = 0 AND day_index <= ? "
        "GROUP BY day_index, hour_israel",
        (through_day_index,),
    ).fetchall()
    for day_index, hour, count in rows:
        table[day_index][hour] = count
    _write_json("hour_daily.json", table)


def _export_fatalities(conn: sqlite3.Connection, data_through_date: str | None) -> None:
    # Keep one unified freshness promise for the whole site: never show a fatality
    # point dated past meta.json's dataThroughDate, even if ACLED happens to have
    # newer rows than tzevaadom does for alerts.
    if data_through_date is None:
        _write_json("fatalities.json", [])
        return
    rows = conn.execute(
        "SELECT event_date, lat, lng, fatalities, event_type, location, source_text "
        "FROM fatalities WHERE event_date <= ? ORDER BY event_date",
        (data_through_date,),
    ).fetchall()
    _write_json(
        "fatalities.json",
        [
            {"d": d, "lat": lat, "lng": lng, "f": f, "t": t, "loc": loc, "src": src}
            for d, lat, lng, f, t, loc, src in rows
        ],
    )


def export_news(conn: sqlite3.Connection, data_through_date: str | None = None) -> None:
    # Cap at 3 markers/day at export too (incremental fetches can accumulate more over
    # time) and never show news past the site's freshness date.
    through = data_through_date or "9999-12-31"
    rows = conn.execute(
        """
        SELECT event_date, title, url, domain FROM (
            SELECT event_date, title, url, domain,
                   ROW_NUMBER() OVER (PARTITION BY event_date ORDER BY title) AS rn
            FROM news WHERE event_date <= ?
        ) WHERE rn <= 3
        ORDER BY event_date
        """,
        (through,),
    ).fetchall()
    _write_json(
        "news.json",
        [{"d": d, "title": t, "url": u, "domain": dom} for d, t, u, dom in rows],
    )


def _write_json(filename: str, payload) -> None:
    path = FRONTEND_DATA_DIR / filename
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"[export] wrote {path} ({path.stat().st_size} bytes)")
