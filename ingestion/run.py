from . import db, export, geocode, ingest_alerts


def main() -> None:
    conn = db.connect()
    try:
        geocode.load_geocoding(conn)
        ingest_alerts.load_alerts(conn)
        export.export_all(conn)
        conn.execute("VACUUM")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
