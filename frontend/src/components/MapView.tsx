import { useEffect, useMemo } from 'react';
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

// Some embeds briefly give the map container a 0x0 size right at mount (seen in this
// project's own preview tooling). Leaflet recovers fine from that once told the real
// size, but the canvas-drawing HeatLayer needs a nudge — this is that nudge.
function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
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
      <MapResizeHandler />
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
