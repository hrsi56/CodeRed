export interface Meta {
  dataStartDate: string;
  dataThroughDate: string | null;
  generatedAt: string;
}

export interface City {
  id: string;
  he: string;
  lat: number;
  lng: number;
  zone: string | null;
}

export interface CitiesExport {
  subAreas: Record<string, { ci: string }>;
  cities: City[];
}

// Packed [dayIndex, subAreaId, count] rows (SPEC.md §3.5).
export type SubareaDailyRow = [number, number, number];

// hourDaily[dayIndex] = counts per hour 0..23 (Israel TZ).
export type HourDaily = number[][];

// [lat, lng, weight] points.
export type PopulationPoints = [number, number, number][];

export interface Outline {
  country: GeoJSON.FeatureCollection;
  districts: GeoJSON.FeatureCollection;
}

export interface AtlasData {
  meta: Meta;
  cities: CitiesExport;
  subareaDaily: SubareaDailyRow[];
  hourDaily: HourDaily;
  population: PopulationPoints;
  outline: Outline;
}
