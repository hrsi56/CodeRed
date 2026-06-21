"""One-time bake of the aesthetic, non-alert map layers (SPEC.md §3.3, §4).

Unlike run.py, this is NOT part of the daily pipeline — these sources don't
change day to day, so this is run manually whenever the assets need refreshing:

    python -m ingestion.bake_static_layers

Population (Kontur, via HDX): distributed as a gzipped GeoPackage of 400m H3
hexagons in EPSG:3857. There's no Python geo stack here (avoiding a heavy
GDAL/geopandas dependency per CLAUDE.md's "ask before adding heavy deps") — a
GeoPackage is just SQLite, so we read it with the stdlib sqlite3 module and
decode the WKB polygon blobs by hand to get each hexagon's centroid, then
inverse-project Web Mercator -> WGS84 with the standard closed-form formula.
Verified empirically: the highest-population hexagons land in Jerusalem, the
lowest in the Negev — matches reality.

Outline (region borders): SPEC.md suggested simplemaps, but that's behind a
Cloudflare bot challenge and can't be fetched non-interactively. Substituted
geoBoundaries.org (public domain / ODbL, same "thin minimal border" purpose) —
documented here since it's a deviation from the spec's named source.
"""

import gzip
import json
import math
import sqlite3
import struct
import tempfile
from pathlib import Path

import requests

KONTUR_GPKG_GZ_URL = (
    "https://geodata-eu-central-1-kontur-public.s3.amazonaws.com/"
    "kontur_datasets/kontur_population_IL_20231101.gpkg.gz"
)
GEOBOUNDARIES_ADM0_URL = (
    "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/"
    "ISR/ADM0/geoBoundaries-ISR-ADM0_simplified.geojson"
)
GEOBOUNDARIES_ADM1_URL = (
    "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/"
    "ISR/ADM1/geoBoundaries-ISR-ADM1_simplified.geojson"
)

DATA_DIR = Path(__file__).resolve().parent.parent / "frontend" / "public" / "data"

_EARTH_RADIUS_M = 6378137.0
_ENVELOPE_SIZE_BY_CODE = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}


def _web_mercator_to_lnglat(x: float, y: float) -> tuple[float, float]:
    lng = math.degrees(x / _EARTH_RADIUS_M)
    lat = math.degrees(2 * math.atan(math.exp(y / _EARTH_RADIUS_M)) - math.pi / 2)
    return lng, lat


def _parse_gpkg_polygon_centroid(blob: bytes) -> tuple[float, float]:
    """Decode a GeoPackage binary header + WKB Polygon, return its (x, y) centroid
    in the geometry's native CRS (here EPSG:3857)."""
    flags = blob[3]
    envelope_size = _ENVELOPE_SIZE_BY_CODE[(flags >> 1) & 0x07]
    offset = 8 + envelope_size

    byte_order = "<" if blob[offset] == 1 else ">"
    geom_type = struct.unpack_from(byte_order + "I", blob, offset + 1)[0]
    if geom_type != 3:
        raise ValueError(f"expected WKB Polygon (type 3), got {geom_type}")

    pos = offset + 9  # skip byte-order(1) + geom_type(4) + numRings(4)
    num_points = struct.unpack_from(byte_order + "I", blob, pos)[0]
    pos += 4
    xs = ys = 0.0
    for _ in range(num_points):
        x, y = struct.unpack_from(byte_order + "dd", blob, pos)
        xs += x
        ys += y
        pos += 16
    return xs / num_points, ys / num_points


def bake_population() -> None:
    gz_bytes = requests.get(KONTUR_GPKG_GZ_URL, timeout=60).content
    gpkg_bytes = gzip.decompress(gz_bytes)

    with tempfile.NamedTemporaryFile(suffix=".gpkg") as tmp:
        tmp.write(gpkg_bytes)
        tmp.flush()
        conn = sqlite3.connect(tmp.name)
        rows = conn.execute("SELECT geom, population FROM population").fetchall()
        conn.close()

    points = []
    for geom_blob, population in rows:
        merc_x, merc_y = _parse_gpkg_polygon_centroid(geom_blob)
        lng, lat = _web_mercator_to_lnglat(merc_x, merc_y)
        points.append([round(lat, 5), round(lng, 5), round(population)])

    _write_json("population.json", points)
    print(f"[bake_population] wrote {len(points)} hexagon centroids")


def bake_outline() -> None:
    country = requests.get(GEOBOUNDARIES_ADM0_URL, timeout=30).json()
    districts = requests.get(GEOBOUNDARIES_ADM1_URL, timeout=30).json()
    _write_json("outline.json", {"country": country, "districts": districts})
    print(
        f"[bake_outline] wrote country ({len(country['features'])} feature) + "
        f"districts ({len(districts['features'])} features)"
    )


def _write_json(filename: str, payload) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / filename
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, separators=(",", ":"))
    print(f"  -> {path} ({path.stat().st_size} bytes)")


def main() -> None:
    bake_population()
    bake_outline()


if __name__ == "__main__":
    main()
