import os

from . import db, export, geocode, ingest_alerts, ingest_fatalities, ingest_news


def main() -> None:
    conn = db.connect()
    try:
        geocode.load_geocoding(conn)
        ingest_alerts.load_alerts(conn)

        acled_email = os.environ.get("ACLED_EMAIL")
        acled_password = os.environ.get("ACLED_PASSWORD")
        if acled_email and acled_password:
            ingest_fatalities.load_fatalities(conn, acled_email, acled_password)
        else:
            # Feature-flag, not a crash (SPEC.md §3.2) — never fabricate fatality data.
            print("[run] ACLED_EMAIL/ACLED_PASSWORD not set — skipping fatalities ingestion")

        # News refresh is best-effort (GDELT is flaky/rate-limited); never let it
        # break the daily build. Older months persist in the committed DB.
        try:
            ingest_news.load_news(conn, full=False)
        except Exception as exc:  # noqa: BLE001
            print(f"[run] news ingestion failed ({exc}); keeping existing news")

        export.export_all(conn)
        conn.execute("VACUUM")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
