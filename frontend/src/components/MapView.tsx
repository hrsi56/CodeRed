import { useCallback, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { HeatLayer } from './HeatLayer';
import { theme } from '../config/theme';
import { ISRAEL_BOUNDS, ISRAEL_CENTER } from '../config/constants';
import type { CityWeight } from '../data/aggregate';

interface MapViewProps {
  cityWeights: CityWeight[];
  showHeatmap: boolean;
  heatmapMax: number;
}

type Bounds = [[number, number], [number, number]];

// Frame to where the alerts are *concentrated* (the localities the heatmap actually
// draws as warm), not to every locality with a single stray siren — this dataset has
// near-nationwide sparse coverage, so a fit-to-all would always show the whole country.
// We keep localities whose weight is at least this fraction of the range's peak; that
// matches the visible "red": a northern-only spell frames the north, a Gaza-envelope
// spell frames the envelope, alerts at both Metula and Eilat frame the whole length.
const FRAME_WEIGHT_FRACTION = 0.1;

function AutoView({ cityWeights }: { cityWeights: CityWeight[] }) {
  const map = useMap();
  const boundsRef = useRef<Bounds | null>(null);

  const apply = useCallback(() => {
    map.invalidateSize();
    const b = boundsRef.current;
    if (!b) {
      map.setView(ISRAEL_CENTER, 8, { animate: false });
      return;
    }
    // maxZoom keeps a single dominant locality from zooming in absurdly far.
    map.fitBounds(b, { padding: [30, 30], maxZoom: 11, animate: false });
  }, [map]);

  useEffect(() => {
    const pts = cityWeights.filter((c) => c.weight > 0);
    if (pts.length === 0) {
      boundsRef.current = null;
    } else {
      const peak = pts.reduce((m, c) => Math.max(m, c.weight), 0);
      const threshold = peak * FRAME_WEIGHT_FRACTION;
      const strong = pts.filter((c) => c.weight >= threshold);
      const framed = strong.length > 0 ? strong : pts;
      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLng = Infinity;
      let maxLng = -Infinity;
      for (const c of framed) {
        if (c.lat < minLat) minLat = c.lat;
        if (c.lat > maxLat) maxLat = c.lat;
        if (c.lng < minLng) minLng = c.lng;
        if (c.lng > maxLng) maxLng = c.lng;
      }
      boundsRef.current = [
        [minLat, minLng],
        [maxLat, maxLng],
      ];
    }
    apply();
  }, [cityWeights, apply]);

  useEffect(() => {
    const observer = new ResizeObserver(() => apply());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map, apply]);

  return null;
}

export function MapView({ cityWeights, showHeatmap, heatmapMax }: MapViewProps) {
  const heatPoints = useMemo<[number, number, number][]>(
    () => cityWeights.map((c) => [c.lat, c.lng, c.weight]),
    [cityWeights],
  );

  return (
    <MapContainer
      center={ISRAEL_CENTER}
      zoom={8}
      minZoom={7}
      maxZoom={16}
      maxBounds={ISRAEL_BOUNDS}
      maxBoundsViscosity={1}
      style={{ width: '100%', height: '100%' }}
    >
      <AutoView cityWeights={cityWeights} />
      <TileLayer
        url={theme.basemap.url}
        attribution={theme.basemap.attribution}
        subdomains={theme.basemap.subdomains}
        maxZoom={theme.basemap.maxZoom}
      />

      {showHeatmap && (
        <HeatLayer
          points={heatPoints}
          gradient={theme.alertHeat.gradient}
          radius={22}
          blur={16}
          max={heatmapMax}
          minOpacity={0.3}
          maxZoom={12}
        />
      )}
    </MapContainer>
  );
}
