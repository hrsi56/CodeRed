import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import 'leaflet/dist/leaflet.css';
import { useAtlasData } from './data/useAtlasData';
import { usePanelData } from './data/usePanelData';
import { Stage } from './components/Stage';
import { DateRangePicker } from './components/DateRangePicker';
import { Timeline } from './components/Timeline';
import { DeltaStrip } from './components/DeltaStrip';
import { FreshnessBanner } from './components/FreshnessBanner';
import { Disclaimer } from './components/Disclaimer';
import { LanguageToggle } from './components/LanguageToggle';
import { useLanguage } from './i18n/useLanguage';
import { useViewport, monthsThatFit } from './hooks/useViewport';

const DAY_MS = 86_400_000;

export default function App() {
  const { lang, t } = useLanguage();
  const { data, loading, error } = useAtlasData();
  const { width, isMobile } = useViewport();
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

  const months = monthsThatFit(width, comparing, isMobile);

  const addComparison = () =>
    setRangeB({ from: minDate, to: new Date(Math.min(minDate.getTime() + 30 * DAY_MS, maxDate.getTime())) });

  return (
    <div className={`app${comparing ? ' comparing' : ''}`} dir={lang === 'he' ? 'rtl' : 'ltr'}>
      <header className="app-bar">
        <h1>{t('appTitle')}</h1>
        <FreshnessBanner meta={data.meta} />
        <div className="app-bar-controls">
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
          <LanguageToggle />
        </div>
      </header>

      <div className="timeline-zone">
        <Timeline minDate={minDate} maxDate={maxDate} news={data.news} range={activeA} onPickRange={setRangeA} />
      </div>

      <div className={`calendars${comparing ? ' comparing' : ''}`}>
        <DateRangePicker
          range={activeA}
          onRangeChange={setRangeA}
          minDate={minDate}
          maxDate={maxDate}
          news={data.news}
          numberOfMonths={months}
          variant="a"
          label={comparing ? t('panelA') : undefined}
        />
        {comparing && rangeB && (
          <DateRangePicker
            range={rangeB}
            onRangeChange={(r) => setRangeB(r)}
            minDate={minDate}
            maxDate={maxDate}
            news={data.news}
            numberOfMonths={months}
            variant="b"
            label={t('panelB')}
          />
        )}
      </div>

      {comparing && (
        <div className="delta-zone">
          <DeltaStrip a={a} b={b} />
        </div>
      )}

      <Stage
        comparing={comparing}
        isMobile={isMobile}
        a={a}
        b={b}
        showHeatmap={showHeatmap}
        heatmapMaxA={heatmapMaxA}
        heatmapMaxB={heatmapMaxB}
      />

      <footer className="app-footer">
        <Disclaimer />
      </footer>
    </div>
  );
}
