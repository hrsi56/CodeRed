import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { HeatLayer } from './HeatLayer';
import { theme } from '../config/theme';
import { ISRAEL_BOUNDS, ISRAEL_CENTER } from '../config/constants';
import type { FatalityEvent } from '../data/types';
import type { CityWeight } from '../data/aggregate';

interface MapViewProps {
  cityWeights: CityWeight[];
  fatalities: FatalityEvent[];
  showHeatmap: boolean;
  showFatalities: boolean;
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

const formatHebrewDate = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

export function MapView({ cityWeights, fatalities, showHeatmap, showFatalities, heatmapMax }: MapViewProps) {
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

      {showFatalities &&
        fatalities.map((ev, i) => (
          <CircleMarker
            key={`${ev.d}-${ev.loc}-${i}`}
            center={[ev.lat, ev.lng]}
            radius={Math.max(4, Math.min(34, Math.sqrt(ev.f) * 2.2))}
            pathOptions={{
              color: theme.fatality.stroke,
              weight: 1,
              fillColor: theme.fatality.fill,
              fillOpacity: 0.6,
            }}
          >
            <Popup>
              <div style={{ direction: 'rtl', textAlign: 'right', minWidth: 180 }}>
                <strong>{ev.loc}</strong>
                <br />
                {formatHebrewDate(ev.d)}
                <br />
                הרוגים מדווחים: <strong>{ev.f}</strong>
                <br />
                סוג אירוע: {ev.t}
                {ev.src && (
                  <>
                    <br />
                    <span style={{ fontSize: 11, color: '#666' }}>מקורות: {ev.src}</span>
                  </>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
    </MapContainer>
  );
}
