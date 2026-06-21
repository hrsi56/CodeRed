import re
import sqlite3

import requests

from .sources import REQUEST_HEADERS, TZEVAADOM_CITIES_URL

# A locality name like "אשדוד - א,ב,ד,ה" or "אשדוד -יא,יב,טו,יז,מרינה,סיט" is a
# sub-area of base city "אשדוד". The dash that separates city from sub-area always
# has whitespace on at least one side; dashes with no surrounding whitespace (e.g.
# inside "לי-און") are part of the name itself and must not be split on.
_SEPARATOR_RE = re.compile(r"(?<=\s)-|-(?=\s)")


def _base_name_of(locality_he: str) -> str:
    parts = _SEPARATOR_RE.split(locality_he, maxsplit=1)
    return parts[0].strip() if len(parts) == 2 else locality_he.strip()


def fetch_cities_raw() -> dict:
    resp = requests.get(TZEVAADOM_CITIES_URL, headers=REQUEST_HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()


def build_city_union(raw: dict) -> tuple[list[dict], list[dict], list[dict]]:
    """Group tzevaadom's sub-areas into base cities using the MAX-rule union
    (SPEC.md §3.1). Most sub-area base names (e.g. "אשדוד", "חיפה") have no
    standalone entry in cities.json, so their base city's coordinates are
    synthesized as the centroid of their sub-areas, per the spec's explicit
    fallback ("pick the largest sub-area's coords or the official city centroid").
    """
    raw_cities: dict = raw["cities"]
    raw_areas: dict = raw.get("areas", {})

    groups: dict[str, list[tuple[str, dict]]] = {}
    for name, info in raw_cities.items():
        groups.setdefault(_base_name_of(name), []).append((name, info))

    cities: list[dict] = []
    subareas: list[dict] = []

    for base, members in groups.items():
        if base in raw_cities:
            canonical = raw_cities[base]
            city_id = str(canonical["id"])
            lat, lng, area_code = canonical["lat"], canonical["lng"], canonical["area"]
            label = base
        elif len(members) == 1:
            name, info = members[0]
            city_id = str(info["id"])
            lat, lng, area_code = info["lat"], info["lng"], info["area"]
            label = name
        else:
            ids = sorted(str(info["id"]) for _, info in members)
            city_id = f"u{ids[0]}"
            lat = sum(info["lat"] for _, info in members) / len(members)
            lng = sum(info["lng"] for _, info in members) / len(members)
            area_code = members[0][1]["area"]
            label = base

        cities.append({"city_id": city_id, "he": label, "lat": lat, "lng": lng, "area_code": area_code})
        for name, info in members:
            subareas.append(
                {
                    "subarea_he": name,
                    "source_id": info["id"],
                    "base_city_id": city_id,
                    "lat": info["lat"],
                    "lng": info["lng"],
                    "area_code": info["area"],
                }
            )

    areas = [
        {"area_code": int(code), "zone_he": info["he"], "zone_en": info.get("en")}
        for code, info in raw_areas.items()
    ]

    return areas, cities, subareas


def load_geocoding(conn: sqlite3.Connection) -> None:
    raw = fetch_cities_raw()
    areas, cities, subareas = build_city_union(raw)

    conn.executemany(
        "INSERT OR REPLACE INTO areas (area_code, zone_he, zone_en) VALUES (:area_code, :zone_he, :zone_en)",
        areas,
    )
    conn.executemany(
        "INSERT OR REPLACE INTO cities (city_id, he, lat, lng, area_code) "
        "VALUES (:city_id, :he, :lat, :lng, :area_code)",
        cities,
    )
    conn.executemany(
        "INSERT OR REPLACE INTO subareas (subarea_he, source_id, base_city_id, lat, lng, area_code) "
        "VALUES (:subarea_he, :source_id, :base_city_id, :lat, :lng, :area_code)",
        subareas,
    )
    conn.commit()
    print(
        f"[geocode] loaded {len(areas)} areas, {len(cities)} base cities, "
        f"{len(subareas)} sub-areas"
    )
