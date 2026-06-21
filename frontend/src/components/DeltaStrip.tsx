import type { PanelData } from '../data/usePanelData';

const numberFmt = new Intl.NumberFormat('he-IL');

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
  const fatA = a.fatalities.reduce((s, f) => s + f.f, 0);
  const fatB = b.fatalities.reduce((s, f) => s + f.f, 0);
  const peakA = peakHour(a.hourHistogram);
  const peakB = peakHour(b.hourHistogram);
  const topA = [...a.cityWeights].sort((x, y) => y.weight - x.weight)[0]?.he ?? '—';
  const topB = [...b.cityWeights].sort((x, y) => y.weight - x.weight)[0]?.he ?? '—';

  return (
    <div className="delta-strip" dir="rtl">
      <Delta label="התרעות (א׳→ב׳)" value={`${numberFmt.format(a.totalAlerts)} → ${numberFmt.format(b.totalAlerts)}`} sub={pct(a.totalAlerts, b.totalAlerts)} />
      <Delta label="הרוגים" value={`${numberFmt.format(fatA)} → ${numberFmt.format(fatB)}`} sub={pct(fatA, fatB)} />
      <Delta label="שעת שיא" value={`${peakA ?? '—'} → ${peakB ?? '—'}`} sub="" />
      <Delta label="יישוב מוביל" value={`${topA} → ${topB}`} sub="" />
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
