import type { Meta } from '../data/types';
import { useLanguage } from '../i18n/useLanguage';
import { localeOf } from '../i18n/strings';

const formatDate = (isoDate: string, locale: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

// Required, persistent notice (SPEC.md §1.4/§5/CLAUDE.md Hard Rule #4) — never
// optional, always visible regardless of which layers/range are active.
export function FreshnessBanner({ meta }: { meta: Meta }) {
  const { lang, t } = useLanguage();
  const locale = localeOf(lang);
  const message = meta.dataThroughDate
    ? lang === 'he'
      ? `הנתונים מעודכנים עד סוף יום ${formatDate(meta.dataThroughDate, locale)}. היום הנוכחי אינו כלול.`
      : `Data is current through the end of ${formatDate(meta.dataThroughDate, locale)}. Today is not included.`
    : t('freshnessUnavailable');

  return (
    <div className="freshness-banner" role="status">
      {message}
    </div>
  );
}
