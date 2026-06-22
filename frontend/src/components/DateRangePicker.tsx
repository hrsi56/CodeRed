import { useMemo, useState } from 'react';
import { DayPicker, type DateRange } from 'react-day-picker';
import { he, enUS } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import type { NewsEvent } from '../data/types';
import { KEY_EVENTS } from '../data/keyEvents';
import { useLanguage } from '../i18n/useLanguage';

interface DateRangePickerProps {
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  minDate: Date;
  maxDate: Date;
  news: NewsEvent[];
  /** How many months to lay out side by side (responsive — computed by App). */
  numberOfMonths?: number;
  /** 'a' = primary range, 'b' = comparison range — drives the calendar's tint/label. */
  variant?: 'a' | 'b';
  /** Shown as a small badge above the calendar so it's clear which range this is. */
  label?: string;
  /** Fires on every day click (independent of range selection) with that day's ISO
   *  date, so clicking a date opens "what happened" the same way a timeline point
   *  click does — see App's shared `openDay` state. */
  onDayClick?: (iso: string) => void;
}

const dayUTC = (iso: string) => new Date(`${iso}T00:00:00Z`);
const pad2 = (n: number) => String(n).padStart(2, '0');
// DayPicker hands back a local-midnight Date; its Y/M/D match the original UTC ISO
// day 1:1 (see the toLocal() below), so re-stringifying those local fields round-trips.
const toIsoLocal = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Capped at yesterday (SPEC.md §5/§1.4) — today and the future are always disabled,
// and nothing before the timeline's start is selectable either. The month shown
// follows the selected range so the calendar stays in sync with the linear timeline.
export function DateRangePicker({
  range,
  onRangeChange,
  minDate,
  maxDate,
  news,
  numberOfMonths = 1,
  variant = 'a',
  label,
  onDayClick,
}: DateRangePickerProps) {
  const { lang, t } = useLanguage();

  // Initial mount only: start on the latest month so the calendar agrees with the
  // timeline's default view (the full-span default range starts back in Oct 2023,
  // which we don't want to jump to) — the selection's month is the *last* shown,
  // keeping the recent end of the range in view.
  const anchorEndingAt = (d: Date) => {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (numberOfMonths - 1), 1));
    const floor = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1));
    return m < floor ? floor : m;
  };
  // After mount: follow a newly-picked start date by making *it* the first shown
  // month (so picking March with 4 months visible shows March–June, not Dec–March) —
  // clamped so the window never runs past the data's last month.
  const anchorStartingAt = (d: Date) => {
    const floor = new Date(Date.UTC(minDate.getUTCFullYear(), minDate.getUTCMonth(), 1));
    const ceilingRaw = new Date(Date.UTC(maxDate.getUTCFullYear(), maxDate.getUTCMonth() - (numberOfMonths - 1), 1));
    const ceiling = ceilingRaw < floor ? floor : ceilingRaw;
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    if (m < floor) return floor;
    if (m > ceiling) return ceiling;
    return m;
  };
  const [month, setMonth] = useState<Date>(() => anchorEndingAt(maxDate));
  const rangeFromKey = range.from ? range.from.getTime() : null;
  // Compare against the last *applied* value (not a "did I mount" flag) so React
  // StrictMode's double-effect-invoke can't spuriously yank the month on first load.
  const [appliedFrom, setAppliedFrom] = useState(rangeFromKey);
  if (rangeFromKey !== appliedFrom) {
    setAppliedFrom(rangeFromKey);
    if (range.from) setMonth(anchorStartingAt(range.from));
  }

  // Local-date days (DayPicker compares against local-midnight Dates) that carry a
  // GDELT news marker or a curated key event, for calendar dot/highlight modifiers.
  const { newsDays, keyDays } = useMemo(() => {
    const toLocal = (iso: string) => {
      const d = dayUTC(iso);
      return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    };
    return {
      newsDays: [...new Set(news.map((n) => n.d))].map(toLocal),
      keyDays: KEY_EVENTS.map((e) => toLocal(e.date)),
    };
  }, [news]);

  return (
    <div className={`range-picker side-${variant}`}>
      {label && (
        <div className="range-picker-head">
          <span className={`range-dot side-dot-${variant}`} />
          {label}
        </div>
      )}
      <div className="range-picker-body">
        {/* DOM order, not a hardcoded side: this sits at the inline-start edge, which
            is physically the right in RTL (Hebrew) and the left in LTR (English) —
            same bidi convention the rest of the app uses. */}
        <div className="calendar-legend">
          <span className="legend-item">
            <span className="legend-dot legend-news" /> {t('legendNews')}
          </span>
          <span className="legend-item">
            <span className="legend-dot legend-key" /> {t('legendKeyEvent')}
          </span>
        </div>
        <DayPicker
          mode="range"
          numberOfMonths={numberOfMonths}
          pagedNavigation
          locale={lang === 'he' ? he : enUS}
          dir={lang === 'he' ? 'rtl' : 'ltr'}
          selected={range}
          onSelect={(next) => {
            if (next) onRangeChange(next);
          }}
          onDayClick={(day, modifiers) => {
            if (modifiers.disabled) return;
            onDayClick?.(toIsoLocal(day));
          }}
          month={month}
          onMonthChange={setMonth}
          startMonth={minDate}
          endMonth={maxDate}
          disabled={[{ before: minDate }, { after: maxDate }]}
          modifiers={{ hasNews: newsDays, keyEvent: keyDays }}
          modifiersClassNames={{ hasNews: 'rdp-has-news', keyEvent: 'rdp-key-event' }}
        />
      </div>
    </div>
  );
}
