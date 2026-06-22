import type { DateRange } from 'react-day-picker';
import type { NewsEvent } from '../data/types';
import { KEY_EVENTS } from '../data/keyEvents';
import { useLanguage } from '../i18n/useLanguage';
import { localeOf } from '../i18n/strings';

interface DayInfoBarProps {
  /** ISO date of the day to show, or null to render nothing (no reserved space). */
  day: string | null;
  news: NewsEvent[];
  onPickRange: (range: DateRange) => void;
  onClose: () => void;
}

const DAY_MS = 86_400_000;
const dayUTC = (iso: string) => new Date(`${iso}T00:00:00Z`);
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);

// A persistent, low/wide strip between the timeline and the calendars showing "what
// happened on this day" — replaces an earlier floating popover that covered the
// calendars underneath it. Reserves no space at all when no day is selected.
export function DayInfoBar({ day, news, onPickRange, onClose }: DayInfoBarProps) {
  const { lang, t } = useLanguage();
  if (!day) return null;

  const locale = localeOf(lang);
  const dayEvents = news.filter((n) => n.d === day);
  const keyEvent = KEY_EVENTS.find((e) => e.date === day);

  const pick = (mode: 'day' | 'week' | 'around') => {
    const d = dayUTC(day);
    let from = d;
    let to = d;
    if (mode === 'week') to = addDays(d, 6);
    if (mode === 'around') {
      from = addDays(d, -3);
      to = addDays(d, 3);
    }
    onPickRange({ from, to });
    onClose();
  };

  return (
    <div className="day-info-bar">
      <div className="day-info-head">
        <strong className="day-info-date">
          {keyEvent ? `${lang === 'he' ? keyEvent.he : keyEvent.en} · ` : ''}
          {dayUTC(day).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
        </strong>
        {dayEvents.length === 0 && <span className="day-info-empty">{t('noNewsThisDay')}</span>}
        <div className="day-info-presets">
          <button type="button" onClick={() => pick('day')}>
            {t('presetDayOf')}
          </button>
          <button type="button" onClick={() => pick('week')}>
            {t('presetWeekAfter')}
          </button>
          <button type="button" onClick={() => pick('around')}>
            {t('presetAroundDays')}
          </button>
        </div>
        <button type="button" className="day-info-close" onClick={onClose} aria-label={t('timelineCloseAria')}>
          ×
        </button>
      </div>
      {dayEvents.length > 0 && (
        <ul className="day-info-headlines">
          {dayEvents.map((n, i) => (
            <li key={i}>
              {n.url ? (
                <a
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={n.domain ? `${n.title} — ${n.domain}` : n.title}
                >
                  {n.title}
                </a>
              ) : (
                <span title={n.title}>{n.title}</span>
              )}
              {n.domain && <span className="day-info-domain"> · {n.domain}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
