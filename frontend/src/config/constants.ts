// Locked product decision (SPEC.md §1.4): timeline starts 2023-10-07, no data before it.
// Mirrors ingestion/constants.py — keep both in sync if this ever changes.
export const DATA_START_DATE = '2023-10-07';

export const TIMEZONE = 'Asia/Jerusalem';

// Roughly Eilat to northern Galilee, with a little padding — used to lock the map view.
export const ISRAEL_BOUNDS: [[number, number], [number, number]] = [
  [29.3, 34.0],
  [33.5, 36.0],
];

export const ISRAEL_CENTER: [number, number] = [31.4, 35.0];
