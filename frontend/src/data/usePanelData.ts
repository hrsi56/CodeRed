import { useMemo } from 'react';
import type { DateRange } from 'react-day-picker';
import type { AtlasData } from './types';
import {
  computeCityWeights,
  computeHourHistogram,
  dateToDayIndex,
  totalAlertsInRange,
  type CityWeight,
} from './aggregate';

export interface PanelData {
  cityWeights: CityWeight[];
  hourHistogram: number[];
  totalAlerts: number;
  ownHeatmapMax: number;
  dayCount: number;
}

const EMPTY_HIST = new Array<number>(24).fill(0);

// Derives everything one panel needs for a date range, fully client-side (SPEC.md
// §3.5). Always called (even for an inactive comparison panel) so hook order is stable.
export function usePanelData(data: AtlasData | null, range: DateRange | undefined): PanelData {
  return useMemo(() => {
    if (!data || !range?.from) {
      return { cityWeights: [], hourHistogram: EMPTY_HIST, totalAlerts: 0, ownHeatmapMax: 1, dayCount: 0 };
    }
    const start = dateToDayIndex(range.from);
    const end = dateToDayIndex(range.to ?? range.from);
    const cityWeights = computeCityWeights(data.subareaDaily, data.cities, start, end);
    return {
      cityWeights,
      hourHistogram: computeHourHistogram(data.hourDaily, start, end),
      totalAlerts: totalAlertsInRange(data.hourDaily, start, end),
      ownHeatmapMax: Math.max(1, ...cityWeights.map((c) => c.weight)),
      dayCount: end - start + 1,
    };
  }, [data, range]);
}
