import { useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import 'leaflet/dist/leaflet.css';
import { useAtlasData } from './data/useAtlasData';
import { computeCityWeights, dateToDayIndex } from './data/aggregate';
import { MapView } from './components/MapView';
import { DateRangePicker } from './components/DateRangePicker';
import { FreshnessBanner } from './components/FreshnessBanner';
import { Disclaimer } from './components/Disclaimer';

const DAY_MS = 86_400_000;
const DEFAULT_WINDOW_DAYS = 7;

export default function App() {
  const { data, loading, error } = useAtlasData();
  const [range, setRange] = useState<DateRange>();
  const [showPopulation, setShowPopulation] = useState(true);
  const [showHeatmap, setShowHeatmap] = useState(true);

  const minDate = data ? new Date(`${data.meta.dataStartDate}T00:00:00Z`) : null;
  const maxDate = data?.meta.dataThroughDate ? new Date(`${data.meta.dataThroughDate}T00:00:00Z`) : null;
  const defaultRange: DateRange | undefined = maxDate
    ? { from: new Date(maxDate.getTime() - (DEFAULT_WINDOW_DAYS - 1) * DAY_MS), to: maxDate }
    : undefined;
  const activeRange = range ?? defaultRange;

  const cityWeights = useMemo(() => {
    if (!data || !activeRange?.from) return [];
    const start = dateToDayIndex(activeRange.from);
    const end = dateToDayIndex(activeRange.to ?? activeRange.from);
    return computeCityWeights(data.subareaDaily, data.cities, start, end);
  }, [data, activeRange]);

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
              <input
                type="checkbox"
                checked={showPopulation}
                onChange={(e) => setShowPopulation(e.target.checked)}
              />
              שכבת אוכלוסין
            </label>
            <label>
              <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} />
              מפת חום של התרעות
            </label>
          </div>

          <Disclaimer />
        </aside>

        <main className="map-pane">
          <MapView
            outline={data.outline}
            population={data.population}
            cityWeights={cityWeights}
            showPopulation={showPopulation}
            showHeatmap={showHeatmap}
          />
        </main>
      </div>
    </div>
  );
}
