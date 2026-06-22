import { useEffect, useState } from 'react';
import type { AtlasData, CitiesExport, HourDaily, Meta, NewsEvent, SubareaDailyRow } from './types';

const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`;

async function fetchJson<T>(file: string): Promise<T> {
  const res = await fetch(dataUrl(file));
  if (!res.ok) {
    throw new Error(`נכשלה טעינת ${file}: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

interface AtlasDataState {
  data: AtlasData | null;
  loading: boolean;
  error: string | null;
}

// Fetches every /data/*.json export once on mount. Per SPEC.md §3.5, everything
// downstream (date-range filtering, the MAX-per-city union, every statistic) is
// then computed client-side from this — no further network calls.
export function useAtlasData(): AtlasDataState {
  const [state, setState] = useState<AtlasDataState>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetchJson<Meta>('meta.json'),
      fetchJson<CitiesExport>('cities.json'),
      fetchJson<SubareaDailyRow[]>('subarea_daily.json'),
      fetchJson<HourDaily>('hour_daily.json'),
      fetchJson<NewsEvent[]>('news.json').catch(() => [] as NewsEvent[]),
    ])
      .then(([meta, cities, subareaDaily, hourDaily, news]) => {
        if (cancelled) return;
        setState({
          data: { meta, cities, subareaDaily, hourDaily, news },
          loading: false,
          error: null,
        });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({ data: null, loading: false, error: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
