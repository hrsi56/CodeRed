import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import 'leaflet/dist/leaflet.css';
import { useAtlasData } from './data/useAtlasData';
import {
  computeCityWeights,
  computeHourHistogram,
  dateToDayIndex,
  filterFatalitiesByDate,
  totalAlertsInRange,
} from './data/aggregate';
import { MapView } from './components/MapView';
import { DateRangePicker } from './components/DateRangePicker';
import { FreshnessBanner } from './components/FreshnessBanner';
import { Disclaimer } from './components/Disclaimer';
import { StatsPanel } from './components/StatsPanel';

const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default function App() {
  const { data, loading, error } = useAtlasData();
  const [range, setRange] = useState<DateRange>();
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showFatalities, setShowFatalities] = useState(true);

  const minDate = data ? new Date(`${data.meta.dataStartDate}T00:00:00Z`) : null;
  const maxDate = data?.meta.dataThroughDate ? new Date(`${data.meta.dataThroughDate}T00:00:00Z`) : null;
  // Default to the full available window so the first view is a rich overview; users
  // narrow from there.
  const defaultRange: DateRange | undefined = minDate && maxDate ? { from: minDate, to: maxDate } : undefined;
  const activeRange = range ?? defaultRange;

  const cityWeights = useMemo(() => {
    if (!data || !activeRange?.from) return [];
    const start = dateToDayIndex(activeRange.from);
    const end = dateToDayIndex(activeRange.to ?? activeRange.from);
    return computeCityWeights(data.subareaDaily, data.cities, start, end);
  }, [data, activeRange]);

  const hourHistogram = useMemo(() => {
    if (!data || !activeRange?.from) return new Array<number>(24).fill(0);
    const start = dateToDayIndex(activeRange.from);
    const end = dateToDayIndex(activeRange.to ?? activeRange.from);
    return computeHourHistogram(data.hourDaily, start, end);
  }, [data, activeRange]);

  const totalAlerts = useMemo(() => {
    if (!data || !activeRange?.from) return 0;
    const start = dateToDayIndex(activeRange.from);
    const end = dateToDayIndex(activeRange.to ?? activeRange.from);
    return totalAlertsInRange(data.hourDaily, start, end);
  }, [data, activeRange]);

  const fatalitiesInRange = useMemo(() => {
    if (!data || !activeRange?.from) return [];
    return filterFatalitiesByDate(data.fatalities, isoDay(activeRange.from), isoDay(activeRange.to ?? activeRange.from));
  }, [data, activeRange]);

  const heatmapMax = useMemo(
    () => Math.max(1, ...cityWeights.map((c) => c.weight)),
    [cityWeights],
  );

  if (loading) {
    return <div className="status-screen">טוען נתונים…</div>;
  }
  if (error || !data) {
    return <div className="status-screen">שגיאה בטעינת הנתונים{error ? `: ${error}` : ''}</div>;
  }
  if (!minDate || !maxDate || !activeRange) {
    return <div className="status-screen">אין עדיין נתונים זמינים — תהליך העדכון היומי עדיין לא רץ בהצלחה.</div>;
  }

  return (
    <div className="app" dir="rtl">
      <header className="app-header">
        <h1>מפת התרעות צבע אדום — היסטוריה</h1>
        <FreshnessBanner meta={data.meta} />
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <DateRangePicker range={activeRange} onRangeChange={setRange} minDate={minDate} maxDate={maxDate} />

          <div className="layer-toggles">
            <label>
              <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} />
              מפת חום של התרעות
            </label>
            <label>
              <input
                type="checkbox"
                checked={showFatalities}
                onChange={(e) => setShowFatalities(e.target.checked)}
              />
              נקודות הרוגים (ACLED)
            </label>
          </div>

          <StatsPanel
            hourHistogram={hourHistogram}
            totalAlerts={totalAlerts}
            cityWeights={cityWeights}
            fatalities={fatalitiesInRange}
          />

          <Disclaimer />
        </aside>

        <main className="map-pane">
          <MapView
            cityWeights={cityWeights}
            fatalities={fatalitiesInRange}
            showHeatmap={showHeatmap}
            showFatalities={showFatalities}
            heatmapMax={heatmapMax}
          />
        </main>
      </div>
    </div>
  );
}
