import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "atlas.sqlite"

SCHEMA = """
CREATE TABLE IF NOT EXISTS areas (
    area_code INTEGER PRIMARY KEY,
    zone_he TEXT NOT NULL,
    zone_en TEXT
);

CREATE TABLE IF NOT EXISTS cities (
    city_id TEXT PRIMARY KEY,
    he TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    area_code INTEGER REFERENCES areas(area_code)
);

CREATE TABLE IF NOT EXISTS subareas (
    subarea_he TEXT PRIMARY KEY,
    source_id INTEGER,
    base_city_id TEXT NOT NULL REFERENCES cities(city_id),
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    area_code INTEGER REFERENCES areas(area_code)
);

CREATE TABLE IF NOT EXISTS alerts (
    alert_id TEXT PRIMARY KEY,
    ts_utc TEXT NOT NULL,
    ts_israel TEXT NOT NULL,
    day_index INTEGER NOT NULL,
    hour_israel INTEGER NOT NULL,
    locality_he TEXT NOT NULL,
    threat INTEGER,
    source TEXT NOT NULL,
    is_drill INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_alerts_day ON alerts(day_index);
CREATE INDEX IF NOT EXISTS idx_alerts_locality ON alerts(locality_he);

CREATE TABLE IF NOT EXISTS unmatched_localities (
    locality_he TEXT PRIMARY KEY,
    occurrences INTEGER NOT NULL DEFAULT 1,
    first_seen_ts TEXT NOT NULL
);
"""


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)
    return conn
