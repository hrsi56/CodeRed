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

// Frame to *every* locality the heatmap actually paints red. The heat layer draws
// all weight>0 points (minOpacity 0.25 + gamma 0.35 make even low-weight localities
// clearly visible), so the auto-zoom must include them all — otherwise a faint-but-red
// area at the edge of the range gets clipped out of view. Earlier we framed only to a
// fraction of the peak weight, which cut off exactly those visible-but-weaker areas.
//
// The heat glow also extends beyond each centroid (radius 16 + blur 10 ≈ 26px), so we
// pad the fitted bounds enough to keep the glow of edge localities on-screen.
const FRAME_PADDING_PX = 48;

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
    map.fitBounds(b, { padding: [FRAME_PADDING_PX, FRAME_PADDING_PX], maxZoom: 11, animate: false });
  }, [map]);

  useEffect(() => {
    const framed = cityWeights.filter((c) => c.weight > 0);
    if (framed.length === 0) {
      boundsRef.current = null;
    } else {
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
      minZoom={5}
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
          radius={theme.alertHeat.radius}
          blur={theme.alertHeat.blur}
          max={heatmapMax}
          minOpacity={theme.alertHeat.minOpacity}
          maxOpacity={theme.alertHeat.maxOpacity}
          gamma={theme.alertHeat.gamma}
          maxZoom={12}
        />
      )}
    </MapContainer>
  );
}
