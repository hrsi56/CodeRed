import type { PanelData } from '../data/usePanelData';
import { useLanguage } from '../i18n/LanguageContext';
import { localeOf, localizedName } from '../i18n/strings';

function peakHour(hist: number[]): number | null {
  let best = -1;
  let bestIdx: number | null = null;
  hist.forEach((c, h) => {
    if (c > best) {
      best = c;
      bestIdx = h;
    }
  });
  return best > 0 ? bestIdx : null;
}

function pct(a: number, b: number): string {
  if (a === 0) return b === 0 ? '0%' : '∞';
  const change = ((b - a) / a) * 100;
  const sign = change > 0 ? '+' : '';
  return `${sign}${change.toFixed(0)}%`;
}

// Honest A↔B deltas (SPEC.md §6). A = right panel, B = left, matching the RTL order.
export function DeltaStrip({ a, b }: { a: PanelData; b: PanelData }) {
  const { lang, t } = useLanguage();
  const numberFmt = new Intl.NumberFormat(localeOf(lang));
  const peakA = peakHour(a.hourHistogram);
  const peakB = peakHour(b.hourHistogram);
  const topACity = [...a.cityWeights].sort((x, y) => y.weight - x.weight)[0];
  const topBCity = [...b.cityWeights].sort((x, y) => y.weight - x.weight)[0];
  const topA = topACity ? localizedName(lang, topACity.he, topACity.en) : '—';
  const topB = topBCity ? localizedName(lang, topBCity.he, topBCity.en) : '—';

  return (
    <div className="delta-strip" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      <Delta label={t('deltaAlerts')} value={`${numberFmt.format(a.totalAlerts)} → ${numberFmt.format(b.totalAlerts)}`} sub={pct(a.totalAlerts, b.totalAlerts)} />
      <Delta label={t('deltaPeakHour')} value={`${peakA ?? '—'} → ${peakB ?? '—'}`} sub="" />
      <Delta label={t('deltaTopLocality')} value={`${topA} → ${topB}`} sub="" />
    </div>
  );
}

function Delta({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="delta">
      <div className="delta-label">{label}</div>
      <div className="delta-value">{value}</div>
      {sub && <div className="delta-sub">{sub}</div>}
    </div>
  );
}
