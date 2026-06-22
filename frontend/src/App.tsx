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
import { LanguageToggle } from './components/LanguageToggle';
import { useLanguage } from './i18n/useLanguage';

const DAY_MS = 86_400_000;

export default function App() {
  const { lang, t } = useLanguage();
  const { data, loading, error } = useAtlasData();
  const [rangeA, setRangeA] = useState<DateRange>();
  const [rangeB, setRangeB] = useState<DateRange | null>(null); // null = single view
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [lockScales, setLockScales] = useState(true);

  const minDate = data ? new Date(`${data.meta.dataStartDate}T00:00:00Z`) : null;
  const maxDate = data?.meta.dataThroughDate ? new Date(`${data.meta.dataThroughDate}T00:00:00Z`) : null;
  const defaultRange: DateRange | undefined = minDate && maxDate ? { from: minDate, to: maxDate } : undefined;
  const activeA = rangeA ?? defaultRange;

  // Hooks must run unconditionally and in stable order — call before any early return.
  const a = usePanelData(data, activeA);
  const b = usePanelData(data, rangeB ?? undefined);

  if (loading) return <div className="status-screen">{t('loading')}</div>;
  if (error || !data) return <div className="status-screen">{t('errorPrefix')}{error ? `: ${error}` : ''}</div>;
  if (!minDate || !maxDate || !activeA) {
    return <div className="status-screen">{t('noDataYet')}</div>;
  }

  const comparing = rangeB !== null;
  // Shared, locked scale across both panels for an honest visual comparison (SPEC.md §6).
  const sharedMax = Math.max(a.ownHeatmapMax, b.ownHeatmapMax);
  const heatmapMaxA = comparing && lockScales ? sharedMax : a.ownHeatmapMax;
  const heatmapMaxB = comparing && lockScales ? sharedMax : b.ownHeatmapMax;

  const addComparison = () =>
    setRangeB({ from: minDate, to: new Date(Math.min(minDate.getTime() + 30 * DAY_MS, maxDate.getTime())) });

  return (
    <div className="app" dir={lang === 'he' ? 'rtl' : 'ltr'}>
      <header className="app-header">
        <div className="app-header-row">
          <h1>{t('appTitle')}</h1>
          <LanguageToggle />
          <FreshnessBanner meta={data.meta} />
        </div>
        <Timeline minDate={minDate} maxDate={maxDate} news={data.news} range={activeA} onPickRange={setRangeA} />
        <div className="controls">
          <label>
            <input type="checkbox" checked={showHeatmap} onChange={(e) => setShowHeatmap(e.target.checked)} />
            {t('layerHeatmap')}
          </label>
          {comparing && (
            <label>
              <input type="checkbox" checked={lockScales} onChange={(e) => setLockScales(e.target.checked)} />
              {t('lockScales')}
            </label>
          )}
          {comparing ? (
            <button type="button" className="ctrl-btn" onClick={() => setRangeB(null)}>
              {t('removeComparison')}
            </button>
          ) : (
            <button type="button" className="ctrl-btn" onClick={addComparison}>
              {t('addComparison')}
            </button>
          )}
        </div>
        {comparing && <DeltaStrip a={a} b={b} />}
      </header>

      <div className={`panels${comparing ? ' comparing' : ''}`}>
        <MapPanel
          title={comparing ? t('panelA') : undefined}
          range={activeA}
          onRangeChange={setRangeA}
          minDate={minDate}
          maxDate={maxDate}
          derived={a}
          heatmapMax={heatmapMaxA}
          showHeatmap={showHeatmap}
          news={data.news}
        />
        {comparing && rangeB && (
          <MapPanel
            title={t('panelB')}
            range={rangeB}
            onRangeChange={(r) => setRangeB(r)}
            minDate={minDate}
            maxDate={maxDate}
            derived={b}
            heatmapMax={heatmapMaxB}
            showHeatmap={showHeatmap}
            news={data.news}
          />
        )}
      </div>

      <Disclaimer />
    </div>
  );
}
