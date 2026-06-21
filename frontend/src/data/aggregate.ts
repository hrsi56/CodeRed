import { DATA_START_DATE } from '../config/constants';
import type { CitiesExport, FatalityEvent, HourDaily, SubareaDailyRow } from './types';

const MS_PER_DAY = 86_400_000;
const dataStart = new Date(`${DATA_START_DATE}T00:00:00Z`);

export function dateToDayIndex(date: Date): number {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((utc - dataStart.getTime()) / MS_PER_DAY);
}

export function dayIndexToDate(dayIndex: number): Date {
  return new Date(dataStart.getTime() + dayIndex * MS_PER_DAY);
}

export interface CityWeight {
  id: string;
  he: string;
  lat: number;
  lng: number;
  zone: string | null;
  weight: number;
}

// The MAX-rule city union (SPEC.md §3.1/§4): sum each sub-area's alerts across the
// selected range, group sub-areas by base city, and take the MAX per city — not the
// sum. subarea_daily.json keeps sub-area granularity precisely so this works for any
// arbitrary range, computed fresh client-side each time the range changes.
export function computeCityWeights(
  subareaDaily: SubareaDailyRow[],
  cities: CitiesExport,
  startDayIndex: number,
  endDayIndex: number,
): CityWeight[] {
  const sumBySubArea = new Map<number, number>();
  for (const [day, subAreaId, count] of subareaDaily) {
    if (day < startDayIndex || day > endDayIndex) continue;
    sumBySubArea.set(subAreaId, (sumBySubArea.get(subAreaId) ?? 0) + count);
  }

  const maxByCityId = new Map<string, number>();
  for (const [subAreaId, sum] of sumBySubArea) {
    const cityId = cities.subAreas[String(subAreaId)]?.ci;
    if (!cityId) continue;
    maxByCityId.set(cityId, Math.max(maxByCityId.get(cityId) ?? 0, sum));
  }

  const cityById = new Map(cities.cities.map((c) => [c.id, c]));
  const weights: CityWeight[] = [];
  for (const [cityId, weight] of maxByCityId) {
    const city = cityById.get(cityId);
    if (!city) continue;
    weights.push({ id: city.id, he: city.he, lat: city.lat, lng: city.lng, zone: city.zone, weight });
  }
  return weights;
}

// Total alert-rows per hour-of-day (0..23, Israel TZ) summed across the range.
export function computeHourHistogram(
  hourDaily: HourDaily,
  startDayIndex: number,
  endDayIndex: number,
): number[] {
  const hist = new Array<number>(24).fill(0);
  const from = Math.max(0, startDayIndex);
  const to = Math.min(hourDaily.length - 1, endDayIndex);
  for (let day = from; day <= to; day++) {
    const row = hourDaily[day];
    for (let h = 0; h < 24; h++) hist[h] += row[h];
  }
  return hist;
}

export function totalAlertsInRange(
  hourDaily: HourDaily,
  startDayIndex: number,
  endDayIndex: number,
): number {
  return computeHourHistogram(hourDaily, startDayIndex, endDayIndex).reduce((a, b) => a + b, 0);
}

export function filterFatalitiesByDate(
  fatalities: FatalityEvent[],
  fromIso: string,
  toIso: string,
): FatalityEvent[] {
  return fatalities.filter((f) => f.d >= fromIso && f.d <= toIso);
}
