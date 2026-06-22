import { useMemo } from 'react';
import { Bar, BarChart, Rectangle, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CityWeight } from '../data/aggregate';
import { useLanguage } from '../i18n/useLanguage';
import { localeOf, localizedName } from '../i18n/strings';

interface StatsPanelProps {
  hourHistogram: number[];
  totalAlerts: number;
  cityWeights: CityWeight[];
  dayCount: number;
}

export function StatsPanel({ hourHistogram, totalAlerts, cityWeights, dayCount }: StatsPanelProps) {
  const { lang, t } = useLanguage();
  const numberFmt = useMemo(() => new Intl.NumberFormat(localeOf(lang)), [lang]);
  const topCities = useMemo(
    () => [...cityWeights].sort((a, b) => b.weight - a.weight).slice(0, 10),
    [cityWeights],
  );
  const distinctZones = useMemo(
    () => new Set(cityWeights.map((c) => c.zone).filter(Boolean)).size,
    [cityWeights],
  );

  const hourData = hourHistogram.map((count, hour) => ({ hour, count }));
  const peakCount = Math.max(...hourHistogram, 0);

  return (
    <div className="stats-panel">
      {/* Numbers + hour chart. Israel is narrow, so on a wide-enough data panel the
          localities list sits beside this column rather than below it. */}
      <div className="stats-main">
        <div className="stat-grid">
          <Stat label={t('statAlertsInRange')} value={totalAlerts} numberFmt={numberFmt} />
          <Stat label={t('statAvgPerDay')} text={formatPerDay(totalAlerts, dayCount, numberFmt)} />
          <Stat label={t('statLocalitiesHit')} value={cityWeights.length} numberFmt={numberFmt} />
          <Stat label={t('statZonesHit')} value={distinctZones} numberFmt={numberFmt} />
        </div>

        <h3 className="stats-heading">{t('hourChartHeading')}</h3>
        <div className="hour-chart">
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={hourData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} tickFormatter={(h) => `${h}`} />
              <YAxis tick={{ fontSize: 10 }} width={36} />
              <Tooltip
                formatter={(v) => [numberFmt.format(Number(v)), t('tooltipAlerts')]}
                labelFormatter={(h) => `${t('tooltipHourPrefix')} ${h}:00`}
                contentStyle={{ direction: lang === 'he' ? 'rtl' : 'ltr', fontSize: 12 }}
              />
              <Bar
                dataKey="count"
                radius={[2, 2, 0, 0]}
                // hourData is a fresh array/objects every render, which kept resetting
                // Recharts' enter animation to frame 0 before it could finish — bars
                // rendered permanently at ~0 height. Not animating avoids that entirely.
                isAnimationActive={false}
                // `Cell`-per-bar coloring is deprecated in recharts v3 (and no longer
                // actually renders) — `shape` is the current way to vary a bar's fill.
                shape={(props) => {
                  const { payload, ...rest } = props as typeof props & { payload: { hour: number; count: number } };
                  const fill = payload.count === peakCount && peakCount > 0 ? '#bd0026' : '#f0843c';
                  return <Rectangle {...rest} fill={fill} />;
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="stats-cities">
        <h3 className="stats-heading stats-heading-first">{t('topCitiesHeading')}</h3>
        {topCities.length === 0 ? (
          <p className="stats-empty">{t('noAlertsInRange')}</p>
        ) : (
          <ol className="top-cities">
            {topCities.map((c) => (
              <li key={c.id}>
                <span className="city-name">{localizedName(lang, c.he, c.en)}</span>
                <span className="city-bar-wrap">
                  <span
                    className="city-bar"
                    style={{ width: `${(c.weight / topCities[0].weight) * 100}%` }}
                  />
                </span>
                <span className="city-count">{numberFmt.format(c.weight)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function formatPerDay(total: number, days: number, numberFmt: Intl.NumberFormat): string {
  if (days <= 0) return '0';
  const v = total / days;
  return v < 10 && v > 0 ? v.toFixed(1) : numberFmt.format(Math.round(v));
}

function Stat({
  label,
  value,
  text,
  numberFmt,
  accent,
}: {
  label: string;
  value?: number;
  text?: string;
  numberFmt?: Intl.NumberFormat;
  accent?: boolean;
}) {
  return (
    <div className={`stat${accent ? ' stat-accent' : ''}`}>
      <div className="stat-value">{text ?? numberFmt?.format(value ?? 0)}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
