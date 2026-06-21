import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import type { NewsEvent } from '../data/types';

interface TimelineProps {
  minDate: Date;
  maxDate: Date;
  news: NewsEvent[];
  range: DateRange;
  onPickRange: (range: DateRange) => void;
}

const DAY_MS = 86_400_000;
const dayUTC = (iso: string) => new Date(`${iso}T00:00:00Z`);
const clamp = (d: Date, lo: Date, hi: Date) => new Date(Math.min(Math.max(d.getTime(), lo.getTime()), hi.getTime()));

export function Timeline({ minDate, maxDate, news, range, onPickRange }: TimelineProps) {
  const [openDay, setOpenDay] = useState<string | null>(null);
  const span = Math.max(1, maxDate.getTime() - minDate.getTime());
  const frac = (d: Date) => ((d.getTime() - minDate.getTime()) / span) * 100;

  const byDay = useMemo(() => {
    const m = new Map<string, NewsEvent[]>();
    for (const n of news) {
      if (!m.has(n.d)) m.set(n.d, []);
      m.get(n.d)!.push(n);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [news]);

  // Year gridlines for orientation.
  const yearTicks = useMemo(() => {
    const ticks: { year: number; left: number }[] = [];
    for (let y = minDate.getUTCFullYear(); y <= maxDate.getUTCFullYear(); y++) {
      const d = new Date(`${y}-01-01T00:00:00Z`);
      if (d >= minDate && d <= maxDate) ticks.push({ year: y, left: frac(d) });
    }
    return ticks;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minDate, maxDate]);

  const rangeFrom = range.from ? clamp(range.from, minDate, maxDate) : minDate;
  const rangeTo = range.to ? clamp(range.to, minDate, maxDate) : rangeFrom;

  const pick = (dayIso: string, mode: 'day' | 'week' | 'around') => {
    const d = dayUTC(dayIso);
    let from = d;
    let to = d;
    if (mode === 'week') to = new Date(d.getTime() + 6 * DAY_MS);
    if (mode === 'around') {
      from = new Date(d.getTime() - 3 * DAY_MS);
      to = new Date(d.getTime() + 3 * DAY_MS);
    }
    onPickRange({ from: clamp(from, minDate, maxDate), to: clamp(to, minDate, maxDate) });
    setOpenDay(null);
  };

  return (
    <div className="timeline">
      <div className="timeline-track">
        <div
          className="timeline-range"
          style={{ right: `${frac(rangeFrom)}%`, width: `${Math.max(0.4, frac(rangeTo) - frac(rangeFrom))}%` }}
        />
        {yearTicks.map((t) => (
          <div key={t.year} className="timeline-year" style={{ right: `${t.left}%` }}>
            <span>{t.year}</span>
          </div>
        ))}
        {byDay.map(([dayIso]) => (
          <button
            key={dayIso}
            type="button"
            className={`timeline-dot${openDay === dayIso ? ' open' : ''}`}
            style={{ right: `${frac(dayUTC(dayIso))}%` }}
            title={dayIso}
            onClick={() => setOpenDay(openDay === dayIso ? null : dayIso)}
            aria-label={`חדשות ${dayIso}`}
          />
        ))}
      </div>

      {openDay && (
        <div className="timeline-popover">
          <div className="timeline-popover-head">
            <strong>{dayUTC(openDay).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</strong>
            <button type="button" className="timeline-close" onClick={() => setOpenDay(null)} aria-label="סגור">
              ×
            </button>
          </div>
          <ul className="timeline-headlines">
            {(byDay.find(([d]) => d === openDay)?.[1] ?? []).map((n, i) => (
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
          <div className="timeline-presets">
            <button type="button" onClick={() => pick(openDay, 'day')}>
              יום האירוע
            </button>
            <button type="button" onClick={() => pick(openDay, 'week')}>
              שבוע אחרי
            </button>
            <button type="button" onClick={() => pick(openDay, 'around')}>
              ±3 ימים
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
