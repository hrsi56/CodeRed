export interface Meta {
  dataStartDate: string;
  dataThroughDate: string | null;
  generatedAt: string;
}

export interface City {
  id: string;
  he: string;
  en: string | null;
  lat: number;
  lng: number;
  zone: string | null;
  zoneEn: string | null;
}

export interface CitiesExport {
  subAreas: Record<string, { ci: string }>;
  cities: City[];
}

// Packed [dayIndex, subAreaId, count] rows (SPEC.md §3.5).
export type SubareaDailyRow = [number, number, number];

// hourDaily[dayIndex] = counts per hour 0..23 (Israel TZ).
export type HourDaily = number[][];

export interface NewsEvent {
  d: string;
  title: string;
  url: string | null;
  domain: string | null;
}

export interface AtlasData {
  meta: Meta;
  cities: CitiesExport;
  subareaDaily: SubareaDailyRow[];
  hourDaily: HourDaily;
  news: NewsEvent[];
}
