import type { Meta } from '../data/types';

const formatHebrewDate = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

// Required, persistent notice (SPEC.md §1.4/§5/CLAUDE.md Hard Rule #4) — never
// optional, always visible regardless of which layers/range are active.
export function FreshnessBanner({ meta }: { meta: Meta }) {
  return (
    <div className="freshness-banner" role="status">
      {meta.dataThroughDate
        ? `הנתונים מעודכנים עד סוף יום ${formatHebrewDate(meta.dataThroughDate)}. היום הנוכחי אינו כלול.`
        : 'אין עדיין נתונים זמינים — ייתכן שתהליך העדכון היומי עדיין לא רץ.'}
    </div>
  );
}
