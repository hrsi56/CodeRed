import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import type { DateRange } from 'react-day-picker';
import type { NewsEvent } from '../data/types';
import { KEY_EVENTS } from '../data/keyEvents';
import { useLanguage } from '../i18n/useLanguage';
import { localeOf } from '../i18n/strings';

interface TimelineProps {
  minDate: Date;
  maxDate: Date;
  news: NewsEvent[];
  range: DateRange;
  onPickRange: (range: DateRange) => void;
}

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 30; // ~1 month visible at a time in the zoomed track
const WINDOW_MS = WINDOW_DAYS * DAY_MS;
const DRAG_THRESHOLD_PX = 4;

const dayUTC = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const dayFloor = (ms: number) => dayUTC(toIso(ms)).getTime();
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);

export function Timeline({ minDate, maxDate, news, range, onPickRange }: TimelineProps) {
  const { lang, t } = useLanguage();
  const locale = localeOf(lang);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);

  const minDateMs = minDate.getTime();
  const maxDateMs = maxDate.getTime();
  const maxViewStart = Math.max(minDateMs, maxDateMs - WINDOW_MS);
  // Default to the most recent month — scrolling/dragging goes back toward minDate.
  const [viewStart, setViewStart] = useState<number>(maxViewStart);
  const viewEnd = viewStart + WINDOW_MS;
  const clampView = useCallback((v: number) => clamp(v, minDateMs, maxViewStart), [minDateMs, maxViewStart]);

  // Live selection band while dragging on the track (committed to onPickRange on
  // release, so the heavy per-range recompute runs once, not on every pointermove).
  const [dragSel, setDragSel] = useState<{ from: number; to: number } | null>(null);
  const selDragRef = useRef<{ startTime: number; startX: number; moved: boolean } | null>(null);
  const panDragRef = useRef<boolean>(false);

  // Physical "left%" for a timestamp. We bake the RTL/LTR flip into the percentage
  // itself (old→new always follows reading direction), so every element below uses
  // plain physical `left` + translateX(-50%) — no direction-conditional CSS needed.
  const pctIn = useCallback(
    (time: number, base: number, span: number) => {
      const f = (time - base) / span;
      return (lang === 'he' ? 1 - f : f) * 100;
    },
    [lang],
  );
  const leftPctInWindow = useCallback((time: number) => pctIn(time, viewStart, WINDOW_MS), [pctIn, viewStart]);
  const fullSpan = Math.max(1, maxDateMs - minDateMs);
  const leftPctFull = useCallback((time: number) => pctIn(time, minDateMs, fullSpan), [pctIn, minDateMs, fullSpan]);

  // Invert the above: clientX on an element → a (clamped) timestamp.
  const timeFromX = (clientX: number, rect: DOMRect, base: number, span: number) => {
    const p = (clientX - rect.left) / rect.width;
    const f = lang === 'he' ? 1 - p : p;
    return clamp(base + clamp(f, 0, 1) * span, minDateMs, maxDateMs);
  };

  const byDay = useMemo(() => {
    const m = new Map<string, NewsEvent[]>();
    for (const n of news) {
      if (!m.has(n.d)) m.set(n.d, []);
      m.get(n.d)!.push(n);
    }
    return m;
  }, [news]);

  const keyEventByDay = useMemo(() => {
    const m = new Map<string, (typeof KEY_EVENTS)[number]>();
    for (const ev of KEY_EVENTS) m.set(ev.date, ev);
    return m;
  }, []);

  const visibleDays = useMemo(() => {
    const days: string[] = [];
    let cur = addDays(new Date(viewStart), -1);
    const end = addDays(new Date(viewEnd), 1);
    while (cur <= end) {
      days.push(cur.toISOString().slice(0, 10));
      cur = addDays(cur, 1);
    }
    return days;
  }, [viewStart, viewEnd]);

  const monthLabel = useMemo(() => {
    const a = new Date(viewStart).toLocaleDateString(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
    const b = new Date(viewEnd - DAY_MS).toLocaleDateString(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' });
    return a === b ? a : `${a} – ${b}`;
  }, [viewStart, viewEnd, locale]);

  // Year boundaries for the full-span minimap, so click-to-navigate isn't blind.
  const yearTicks = useMemo(() => {
    const ticks: { year: number; left: number }[] = [];
    for (let y = minDate.getUTCFullYear(); y <= maxDate.getUTCFullYear(); y++) {
      const t0 = Date.UTC(y, 0, 1);
      if (t0 >= minDateMs && t0 <= maxDateMs) ticks.push({ year: y, left: leftPctFull(t0) });
    }
    return ticks;
  }, [minDate, maxDate, minDateMs, maxDateMs, leftPctFull]);

  const shiftView = (deltaDays: number) => setViewStart((v) => clampView(v + deltaDays * DAY_MS));

  // Keep the zoomed view in step with the selected range: when the selection changes
  // to something outside the current window (e.g. picked on the calendar), scroll to
  // it. Guarded by a ref so manual panning (range unchanged) never yanks the view.
  const rangeFromMs = range.from ? clamp(range.from.getTime(), minDateMs, maxDateMs) : null;
  const rangeToMs = range.to ? clamp(range.to.getTime(), minDateMs, maxDateMs) : rangeFromMs;
  const [lastRangeFrom, setLastRangeFrom] = useState<number | null>(rangeFromMs);
  if (rangeFromMs !== null && lastRangeFrom !== rangeFromMs) {
    setLastRangeFrom(rangeFromMs);
    if (rangeFromMs < viewStart || rangeFromMs > viewEnd) {
      const mid = rangeToMs !== null ? (rangeFromMs + rangeToMs) / 2 : rangeFromMs;
      setViewStart(clampView(mid - WINDOW_MS / 2));
    }
  }

  // Also resync to the latest window if maxDate's value changes after mount.
  const seenMaxDate = useRef(maxDateMs);
  useEffect(() => {
    if (seenMaxDate.current !== maxDateMs) {
      seenMaxDate.current = maxDateMs;
      setViewStart(clampView(maxDateMs - WINDOW_MS));
    }
  }, [maxDateMs, clampView]);

  // --- Track interaction: drag = select a range, click = select a single day ---
  const onTrackPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const startTime = timeFromX(e.clientX, rect, viewStart, WINDOW_MS);
    selDragRef.current = { startTime, startX: e.clientX, moved: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* non-capturable pointer — drag still works without capture */
    }
  };
  const onTrackPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = selDragRef.current;
    if (!drag || !trackRef.current) return;
    if (!drag.moved && Math.abs(e.clientX - drag.startX) < DRAG_THRESHOLD_PX) return;
    drag.moved = true;
    const rect = trackRef.current.getBoundingClientRect();
    const cur = timeFromX(e.clientX, rect, viewStart, WINDOW_MS);
    setDragSel({ from: Math.min(drag.startTime, cur), to: Math.max(drag.startTime, cur) });
  };
  const onTrackPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = selDragRef.current;
    selDragRef.current = null;
    if (drag?.moved && dragSel) {
      onPickRange({ from: new Date(dayFloor(dragSel.from)), to: new Date(dayFloor(dragSel.to)) });
    } else if (drag) {
      const day = new Date(dayFloor(drag.startTime));
      onPickRange({ from: day, to: day });
    }
    setDragSel(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* capture may have been released already */
    }
  };

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (delta === 0) return;
    e.preventDefault();
    const dir = lang === 'he' ? -1 : 1;
    setViewStart((v) => clampView(v + dir * delta * DAY_MS * 0.15));
  };

  // --- Minimap interaction: click / drag the viewport to navigate the big picture ---
  const minimapCenterTo = (clientX: number) => {
    if (!minimapRef.current) return;
    const rect = minimapRef.current.getBoundingClientRect();
    const center = timeFromX(clientX, rect, minDateMs, fullSpan);
    setViewStart(clampView(center - WINDOW_MS / 2));
  };
  const onMinimapPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    panDragRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* non-capturable pointer — pan still works without capture */
    }
    minimapCenterTo(e.clientX);
  };
  const onMinimapPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (panDragRef.current) minimapCenterTo(e.clientX);
  };
  const onMinimapPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    panDragRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const pick = (dayIso: string, mode: 'day' | 'week' | 'around') => {
    const d = dayUTC(dayIso);
    let from = d;
    let to = d;
    if (mode === 'week') to = addDays(d, 6);
    if (mode === 'around') {
      from = addDays(d, -3);
      to = addDays(d, 3);
    }
    onPickRange({
      from: new Date(clamp(from.getTime(), minDateMs, maxDateMs)),
      to: new Date(clamp(to.getTime(), minDateMs, maxDateMs)),
    });
    setOpenDay(null);
  };

  // Stop a press on a marker from also starting a track drag-select (and from the
  // pointer-capture that would otherwise swallow the marker's own click).
  const stopMarkerPointer = (e: ReactPointerEvent<HTMLButtonElement>) => e.stopPropagation();

  const band = dragSel ?? (rangeFromMs !== null && rangeToMs !== null ? { from: rangeFromMs, to: rangeToMs } : null);
  const bandStyle = band
    ? (() => {
        const a = leftPctInWindow(band.from);
        const b = leftPctInWindow(band.to);
        return { left: `${Math.min(a, b)}%`, width: `${Math.max(0.6, Math.abs(b - a))}%` };
      })()
    : null;

  const openEvents = openDay ? byDay.get(openDay) ?? [] : [];
  const openKeyEvent = openDay ? keyEventByDay.get(openDay) : undefined;

  return (
    <div className="timeline">
      <div className="timeline-zoom-head">
        <button type="button" className="timeline-nav" onClick={() => shiftView(-WINDOW_DAYS)}>
          {t('prevMonth')}
        </button>
        <strong className="timeline-month-label">{monthLabel}</strong>
        <button type="button" className="timeline-nav" onClick={() => shiftView(WINDOW_DAYS)}>
          {t('nextMonth')}
        </button>
        {viewStart < maxViewStart - DAY_MS && (
          <button type="button" className="timeline-jump-latest" onClick={() => setViewStart(maxViewStart)}>
            {t('jumpToLatest')}
          </button>
        )}
      </div>

      <div
        ref={trackRef}
        className="timeline-zoom-track"
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={onTrackPointerUp}
        onPointerCancel={onTrackPointerUp}
        onWheel={onWheel}
      >
        {bandStyle && <div className="timeline-range" style={bandStyle} />}

        {visibleDays.map((iso) => {
          const d = dayUTC(iso);
          if (d.getUTCDay() !== 0) return null;
          const left = leftPctInWindow(d.getTime());
          if (left < -5 || left > 105) return null;
          return (
            <div key={`grid-${iso}`} className="timeline-week-grid" style={{ left: `${left}%` }}>
              <span>
                {d.toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })}
              </span>
            </div>
          );
        })}

        {visibleDays.map((iso) => {
          const dayNews = byDay.get(iso);
          if (!dayNews || dayNews.length === 0) return null;
          const left = leftPctInWindow(dayUTC(iso).getTime());
          if (left < -3 || left > 103) return null;
          return (
            <button
              key={`dot-${iso}`}
              type="button"
              className={`timeline-dot${openDay === iso ? ' open' : ''}`}
              style={{ left: `${left}%` }}
              title={iso}
              onPointerDown={stopMarkerPointer}
              onClick={() => setOpenDay(openDay === iso ? null : iso)}
              aria-label={iso}
            />
          );
        })}

        {visibleDays.map((iso) => {
          const ev = keyEventByDay.get(iso);
          if (!ev) return null;
          const left = leftPctInWindow(dayUTC(iso).getTime());
          if (left < -3 || left > 103) return null;
          return (
            <button
              key={`key-${iso}`}
              type="button"
              className={`timeline-key-event${openDay === iso ? ' open' : ''}`}
              style={{ left: `${left}%` }}
              onPointerDown={stopMarkerPointer}
              onClick={() => setOpenDay(openDay === iso ? null : iso)}
            >
              <span className="timeline-key-event-label">{lang === 'he' ? ev.he : ev.en}</span>
            </button>
          );
        })}
      </div>

      {openDay && (
        <div className="timeline-popover">
          <div className="timeline-popover-head">
            <strong>
              {openKeyEvent ? `${lang === 'he' ? openKeyEvent.he : openKeyEvent.en} · ` : ''}
              {dayUTC(openDay).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </strong>
            <button type="button" className="timeline-close" onClick={() => setOpenDay(null)} aria-label={t('timelineCloseAria')}>
              ×
            </button>
          </div>
          {openEvents.length > 0 && (
            <>
              <div className="timeline-raw-label">{t('rawHeadlinesLabel')}</div>
              <ul className="timeline-headlines">
                {openEvents.map((n, i) => (
                  <li key={i}>
                    {n.url ? (
                      <a href={n.url} target="_blank" rel="noopener noreferrer">
                        {n.title}
                      </a>
                    ) : (
                      n.title
                    )}
                    {n.domain && <span className="timeline-domain"> · {n.domain}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="timeline-presets">
            <button type="button" onClick={() => pick(openDay, 'day')}>
              {t('presetDayOf')}
            </button>
            <button type="button" onClick={() => pick(openDay, 'week')}>
              {t('presetWeekAfter')}
            </button>
            <button type="button" onClick={() => pick(openDay, 'around')}>
              {t('presetAroundDays')}
            </button>
          </div>
        </div>
      )}

      <div
        ref={minimapRef}
        className="timeline-minimap"
        onPointerDown={onMinimapPointerDown}
        onPointerMove={onMinimapPointerMove}
        onPointerUp={onMinimapPointerUp}
        onPointerCancel={onMinimapPointerUp}
      >
        {yearTicks.map((tick) => (
          <div key={tick.year} className="timeline-minimap-year" style={{ left: `${tick.left}%` }}>
            <span>{tick.year}</span>
          </div>
        ))}
        {band && (
          <div
            className="timeline-minimap-range"
            style={(() => {
              const a = leftPctFull(band.from);
              const b = leftPctFull(band.to);
              return { left: `${Math.min(a, b)}%`, width: `${Math.max(0.3, Math.abs(b - a))}%` };
            })()}
          />
        )}
        {KEY_EVENTS.map((ev) => (
          <div
            key={ev.date}
            className="timeline-minimap-key"
            style={{ left: `${leftPctFull(dayUTC(ev.date).getTime())}%` }}
            title={lang === 'he' ? ev.he : ev.en}
          />
        ))}
        <div
          className="timeline-minimap-viewport"
          style={(() => {
            const a = leftPctFull(viewStart);
            const b = leftPctFull(viewEnd);
            return { left: `${Math.min(a, b)}%`, width: `${Math.max(1, Math.abs(b - a))}%` };
          })()}
        />
      </div>
    </div>
  );
}
