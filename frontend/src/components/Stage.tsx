import { useRef, useState } from 'react';
import type { UIEvent } from 'react';
import { MapView } from './MapView';
import { StatsPanel } from './StatsPanel';
import type { PanelData } from '../data/usePanelData';
import { useLanguage } from '../i18n/useLanguage';

interface StageProps {
  comparing: boolean;
  isMobile: boolean;
  a: PanelData;
  b: PanelData;
  showHeatmap: boolean;
  heatmapMaxA: number;
  heatmapMaxB: number;
}

function MapCard({
  derived,
  showHeatmap,
  heatmapMax,
  side,
}: {
  derived: PanelData;
  showHeatmap: boolean;
  heatmapMax: number;
  side: 'a' | 'b';
}) {
  return (
    <div className={`map-card side-${side}`}>
      <MapView cityWeights={derived.cityWeights} showHeatmap={showHeatmap} heatmapMax={heatmapMax} />
    </div>
  );
}

function StatsCard({ derived, side }: { derived: PanelData; side: 'a' | 'b' }) {
  return (
    <div className={`stats-card side-${side}`}>
      <StatsPanel
        hourHistogram={derived.hourHistogram}
        totalAlerts={derived.totalAlerts}
        cityWeights={derived.cityWeights}
        dayCount={derived.dayCount}
      />
    </div>
  );
}

// The map+data area. On desktop everything sits in one row with the data columns on
// the outer edges and the maps adjacent in the middle (SPEC §6 comparison, plus the
// user's "data on the far sides, map next to map" request). On phones the same content
// becomes a two-page horizontal carousel: swipe between the map(s) and the data.
export function Stage({ comparing, isMobile, a, b, showHeatmap, heatmapMaxA, heatmapMaxB }: StageProps) {
  const { t } = useLanguage();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0); // 0 = map(s), 1 = data

  if (!isMobile) {
    return (
      <div className={`stage stage-desktop${comparing ? ' comparing' : ''}`}>
        <StatsCard derived={a} side="a" />
        <MapCard derived={a} showHeatmap={showHeatmap} heatmapMax={heatmapMaxA} side="a" />
        {comparing && <MapCard derived={b} showHeatmap={showHeatmap} heatmapMax={heatmapMaxB} side="b" />}
        {comparing && <StatsCard derived={b} side="b" />}
      </div>
    );
  }

  // RTL horizontal scroll reports a negative scrollLeft in modern engines, so go by
  // magnitude and flip the target sign — keeps paging correct in both directions.
  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const next = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
    if (next !== page) setPage(next);
  };

  const goTo = (p: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === 'rtl';
    el.scrollTo({ left: (rtl ? -1 : 1) * p * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="stage stage-mobile">
      <div className="stage-carousel" ref={scrollerRef} onScroll={onScroll}>
        <div className={`carousel-slide slide-maps${comparing ? ' comparing' : ''}`}>
          <MapCard derived={a} showHeatmap={showHeatmap} heatmapMax={heatmapMaxA} side="a" />
          {comparing && <MapCard derived={b} showHeatmap={showHeatmap} heatmapMax={heatmapMaxB} side="b" />}
        </div>
        <div className={`carousel-slide slide-stats${comparing ? ' comparing' : ''}`}>
          <StatsCard derived={a} side="a" />
          {comparing && <StatsCard derived={b} side="b" />}
        </div>
      </div>
      <div className="carousel-pager" role="tablist">
        {[t('carouselMap'), t('carouselData')].map((labelText, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={page === i}
            className={`pager-pill${page === i ? ' active' : ''}`}
            onClick={() => goTo(i)}
          >
            <span className="pager-dot" />
            {labelText}
          </button>
        ))}
      </div>
    </div>
  );
}
