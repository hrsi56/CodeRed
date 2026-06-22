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
}

const dayUTC = (iso: string) => new Date(`${iso}T00:00:00Z`);

// Capped at yesterday (SPEC.md §5/§1.4) — today and the future are always disabled,
// and nothing before the timeline's start is selectable either. The month shown
// follows the selected range so the calendar stays in sync with the linear timeline.
export function DateRangePicker({ range, onRangeChange, minDate, maxDate, news }: DateRangePickerProps) {
  const { lang, t } = useLanguage();

  // Start on the latest month so the calendar agrees with the timeline's default
  // view (the full-span default range starts back in Oct 2023, which we don't want
  // to jump to). After mount, follow the selection (e.g. picked on the timeline)
  // whenever range.from actually changes — without clobbering manual navigation.
  const [month, setMonth] = useState<Date>(maxDate);
  const rangeFromKey = range.from ? range.from.getTime() : null;
  // Compare against the last *applied* value (not a "did I mount" flag) so React
  // StrictMode's double-effect-invoke can't spuriously yank the month on first load.
  const [appliedFrom, setAppliedFrom] = useState(rangeFromKey);
  if (rangeFromKey !== appliedFrom) {
    setAppliedFrom(rangeFromKey);
    if (range.from) setMonth(range.from);
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
    <div className="range-picker">
      <DayPicker
        mode="range"
        locale={lang === 'he' ? he : enUS}
        dir={lang === 'he' ? 'rtl' : 'ltr'}
        selected={range}
        onSelect={(next) => {
          if (next) onRangeChange(next);
        }}
        month={month}
        onMonthChange={setMonth}
        startMonth={minDate}
        endMonth={maxDate}
        disabled={[{ before: minDate }, { after: maxDate }]}
        modifiers={{ hasNews: newsDays, keyEvent: keyDays }}
        modifiersClassNames={{ hasNews: 'rdp-has-news', keyEvent: 'rdp-key-event' }}
      />
      <div className="calendar-legend">
        <span className="legend-item">
          <span className="legend-dot legend-news" /> {t('legendNews')}
        </span>
        <span className="legend-item">
          <span className="legend-dot legend-key" /> {t('legendKeyEvent')}
        </span>
      </div>
    </div>
  );
}
