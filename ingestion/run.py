from . import db, export, geocode, ingest_alerts, ingest_news, ingest_news_wikipedia


def main() -> None:
    conn = db.connect()
    try:
        geocode.load_geocoding(conn)
        ingest_alerts.load_alerts(conn)

        # Fatalities (ACLED) are intentionally NOT ingested or displayed: the only
        # available ACLED account is under a rolling 12-month embargo, so it can never
        # provide complete, current data — and this project does not show partial data.
        # ingestion/ingest_fatalities.py is kept intact for an easy re-enable if full
        # (non-embargoed) ACLED access is ever obtained.

        # News refresh is best-effort (GDELT is flaky/rate-limited); never let it
        # break the daily build. Older months persist in the committed DB.
        try:
            ingest_news.load_news(conn, full=False)
        except Exception as exc:  # noqa: BLE001
            print(f"[run] GDELT news ingestion failed ({exc}); keeping existing news")

        # Fallback track (SPEC.md §3.4): fill timeline days GDELT left empty from
        # Wikipedia's curated Current-events pages. Also best-effort.
        try:
            ingest_news_wikipedia.load_news_wikipedia(conn, full=False)
        except Exception as exc:  # noqa: BLE001
            print(f"[run] Wikipedia news ingestion failed ({exc}); keeping existing news")

        export.export_all(conn)
        conn.execute("VACUUM")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
