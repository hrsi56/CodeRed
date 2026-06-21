import { useMemo } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CityWeight } from '../data/aggregate';
import type { FatalityEvent } from '../data/types';

interface StatsPanelProps {
  hourHistogram: number[];
  totalAlerts: number;
  cityWeights: CityWeight[];
  fatalities: FatalityEvent[];
}

const numberFmt = new Intl.NumberFormat('he-IL');

export function StatsPanel({ hourHistogram, totalAlerts, cityWeights, fatalities }: StatsPanelProps) {
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
        <Stat label="התרעות בטווח" value={totalAlerts} />
        <Stat label="יישובים מותקפים" value={cityWeights.length} />
        <Stat label="אזורים נפגעים" value={distinctZones} />
        <Stat label="הרוגים מדווחים" value={totalFatalities} accent />
      </div>

      <h3 className="stats-heading">התרעות לפי שעה ביממה</h3>
      <div className="hour-chart">
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={hourData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} tickFormatter={(h) => `${h}`} />
            <YAxis tick={{ fontSize: 10 }} width={36} />
            <Tooltip
              formatter={(v) => [numberFmt.format(Number(v)), 'התרעות']}
              labelFormatter={(h) => `שעה ${h}:00`}
              contentStyle={{ direction: 'rtl', fontSize: 12 }}
            />
            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
              {hourData.map((d) => (
                <Cell key={d.hour} fill={d.count === peakCount && peakCount > 0 ? '#bd0026' : '#f0843c'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h3 className="stats-heading">יישובים מובילים (לפי כלל ה-MAX)</h3>
      {topCities.length === 0 ? (
        <p className="stats-empty">אין התרעות בטווח שנבחר.</p>
      ) : (
        <ol className="top-cities">
          {topCities.map((c) => (
            <li key={c.id}>
              <span className="city-name">{c.he}</span>
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

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`stat${accent ? ' stat-accent' : ''}`}>
      <div className="stat-value">{numberFmt.format(value)}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
