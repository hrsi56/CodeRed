import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import 'leaflet/dist/leaflet.css';
import { useAtlasData } from './data/useAtlasData';
import { usePanelData } from './data/usePanelData';
import { MapPanel } from './components/MapPanel';
import { Timeline } from './components/Timeline';
import { DeltaStrip } from './components/DeltaStrip';
import { FreshnessBanner } from './components/FreshnessBanner';
import { Disclaimer } from './components/Disclaimer';

const DAY_MS = 86_400_000;

export default function App() {
  const { data, loading, error } = useAtlasData();
  const [rangeA, setRangeA] = useState<DateRange>();
  const [rangeB, setRangeB] = useState<DateRange | null>(null); // null = single view
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showFatalities, setShowFatalities] = useState(true);
  const [lockScales, setLockScales] = useState(true);

  const minDate = data ? new Date(`${data.meta.dataStartDate}T00:00:00Z`) : null;
  const maxDate = data?.meta.dataThroughDate ? new Date(`${data.meta.dataThroughDate}T00:00:00Z`) : null;
  const defaultRange: DateRange | undefined = minDate && maxDate ? { from: minDate, to: maxDate } : undefined;
  const activeA = rangeA ?? defaultRange;

  // Hooks must run unconditionally and in stable order — call before any early return.
  const a = usePanelData(data, activeA);
  const b = usePanelData(data, rangeB ?? undefined);

  if (loading) return <div className="status-screen">טוען נתונים…</div>;
  if (error || !data) return <div className="status-screen">שגיאה בטעינת הנתונים{error ? `: ${error}` : ''}</div>;
  if (!minDate || !maxDate || !activeA) {
    return <div className="status-screen">אין עדיין נתונים זמינים — תהליך העדכון היומי עדיין לא רץ בהצלחה.</div>;
  }

  const comparing = rangeB !== null;
  // Shared, locked scale across both panels for an honest visual comparison (SPEC.md §6).
  const sharedMax = Math.max(a.ownHeatmapMax, b.ownHeatmapMax);
  const heatmapMaxA = comparing && lockScales ? sharedMax : a.ownHeatmapMax;
  const heatmapMaxB = comparing && lockScales ? sharedMax : b.ownHeatmapMax;

  const addComparison = () =>
    setRangeB({ from: minDate, to: new Date(Math.min(minDate.getTime() + 30 * DAY_MS, maxDate.getTime())) });

  return (
    <div className="app" dir="rtl">
      <header className="app-header">
        <div className="app-header-row">
          <h1>מפת התרעות צבע אדום — היסטוריה</h1>
          <FreshnessBanner meta={data.meta} />
        </div>
        <Timeline minDate={minDate} maxDate={maxDate} news={data.news} range={activeA} onPickRange={setRangeA} />
        <div className="controls">
          <label>
            <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} />
            מפת חום
          </label>
          <label>
            <input type="checkbox" checked={showFatalities} onChange={(e) => setShowFatalities(e.target.checked)} />
            הרוגים (ACLED)
          </label>
          {comparing && (
            <label>
              <input type="checkbox" checked={lockScales} onChange={(e) => setLockScales(e.target.checked)} />
              נעילת קנה־מידה
            </label>
          )}
          {comparing ? (
            <button type="button" className="ctrl-btn" onClick={() => setRangeB(null)}>
              הסר השוואה
            </button>
          ) : (
            <button type="button" className="ctrl-btn" onClick={addComparison}>
              הוסף השוואה
            </button>
          )}
        </div>
        {comparing && <DeltaStrip a={a} b={b} />}
      </header>

      <div className={`panels${comparing ? ' comparing' : ''}`}>
        <MapPanel
          title={comparing ? 'טווח א׳' : undefined}
          range={activeA}
          onRangeChange={setRangeA}
          minDate={minDate}
          maxDate={maxDate}
          derived={a}
          heatmapMax={heatmapMaxA}
          showHeatmap={showHeatmap}
          showFatalities={showFatalities}
        />
        {comparing && rangeB && (
          <MapPanel
            title="טווח ב׳"
            range={rangeB}
            onRangeChange={(r) => setRangeB(r)}
            minDate={minDate}
            maxDate={maxDate}
            derived={b}
            heatmapMax={heatmapMaxB}
            showHeatmap={showHeatmap}
            showFatalities={showFatalities}
          />
        )}
      </div>

      <Disclaimer />
    </div>
  );
}
