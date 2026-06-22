import { useMemo } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CityWeight } from '../data/aggregate';
import type { FatalityEvent } from '../data/types';
import { useLanguage } from '../i18n/LanguageContext';
import { localeOf, localizedName } from '../i18n/strings';

interface StatsPanelProps {
  hourHistogram: number[];
  totalAlerts: number;
  cityWeights: CityWeight[];
  fatalities: FatalityEvent[];
  dayCount: number;
}

export function StatsPanel({ hourHistogram, totalAlerts, cityWeights, fatalities, dayCount }: StatsPanelProps) {
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
  const totalFatalities = useMemo(() => fatalities.reduce((a, f) => a + f.f, 0), [fatalities]);

  const hourData = hourHistogram.map((count, hour) => ({ hour, count }));
  const peakCount = Math.max(...hourHistogram, 0);

  return (
    <div className="stats-panel">
      <div className="stat-grid">
        <Stat label={t('statAlertsInRange')} value={totalAlerts} numberFmt={numberFmt} />
        <Stat label={t('statAvgPerDay')} text={formatPerDay(totalAlerts, dayCount, numberFmt)} />
        <Stat label={t('statLocalitiesHit')} value={cityWeights.length} numberFmt={numberFmt} />
        <Stat label={t('statZonesHit')} value={distinctZones} numberFmt={numberFmt} />
        <Stat label={t('statFatalities')} value={totalFatalities} numberFmt={numberFmt} accent />
      </div>

      <h3 className="stats-heading">{t('hourChartHeading')}</h3>
      <div className="hour-chart">
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={hourData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} tickFormatter={(h) => `${h}`} />
            <YAxis tick={{ fontSize: 10 }} width={36} />
            <Tooltip
              formatter={(v) => [numberFmt.format(Number(v)), t('tooltipAlerts')]}
              labelFormatter={(h) => `${t('tooltipHourPrefix')} ${h}:00`}
              contentStyle={{ direction: lang === 'he' ? 'rtl' : 'ltr', fontSize: 12 }}
            />
            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
              {hourData.map((d) => (
                <Cell key={d.hour} fill={d.count === peakCount && peakCount > 0 ? '#bd0026' : '#f0843c'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h3 className="stats-heading">{t('topCitiesHeading')}</h3>
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
