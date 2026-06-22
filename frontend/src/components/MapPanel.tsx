import type { DateRange } from 'react-day-picker';
import { MapView } from './MapView';
import { DateRangePicker } from './DateRangePicker';
import { StatsPanel } from './StatsPanel';
import type { PanelData } from '../data/usePanelData';
import type { NewsEvent } from '../data/types';

interface MapPanelProps {
  title?: string;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  minDate: Date;
  maxDate: Date;
  derived: PanelData;
  heatmapMax: number;
  showHeatmap: boolean;
  news: NewsEvent[];
}

// One self-contained comparison unit (SPEC.md §6): its own range picker, map, and
// stats. App composes one or two of these side by side.
export function MapPanel({
  title,
  range,
  onRangeChange,
  minDate,
  maxDate,
  derived,
  heatmapMax,
  showHeatmap,
  news,
}: MapPanelProps) {
  return (
    <section className="panel">
      <div className="panel-map">
        {title && <div className="panel-badge">{title}</div>}
        <MapView
          cityWeights={derived.cityWeights}
          showHeatmap={showHeatmap}
          heatmapMax={heatmapMax}
        />
      </div>
      <div className="panel-side">
        {title && <h2 className="panel-title">{title}</h2>}
        <DateRangePicker range={range} onRangeChange={onRangeChange} minDate={minDate} maxDate={maxDate} news={news} />
        <StatsPanel
          hourHistogram={derived.hourHistogram}
          totalAlerts={derived.totalAlerts}
          cityWeights={derived.cityWeights}
          dayCount={derived.dayCount}
        />
      </div>
    </section>
  );
}
