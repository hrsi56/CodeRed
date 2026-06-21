import { useEffect, useMemo } from 'react';
import { MapContainer, GeoJSON, useMap } from 'react-leaflet';
import type { PathOptions } from 'leaflet';
import { HeatLayer } from './HeatLayer';
import { theme } from '../config/theme';
import { ISRAEL_BOUNDS, ISRAEL_CENTER } from '../config/constants';
import type { Outline, PopulationPoints } from '../data/types';
import type { CityWeight } from '../data/aggregate';

interface MapViewProps {
  outline: Outline;
  population: PopulationPoints;
  cityWeights: CityWeight[];
  showPopulation: boolean;
  showHeatmap: boolean;
  heatmapMax?: number;
}

const countryStyle: PathOptions = { color: theme.outline, weight: 1.5, fill: false };
const districtStyle: PathOptions = { color: theme.outline, weight: 0.75, fill: false, dashArray: '2 4' };

// Some embeds briefly give the map container a 0x0 size right at mount (seen in this
// project's own preview tooling). Leaflet itself recovers fine from that once told the
// real size, but layers that draw straight to a sized canvas (HeatLayer) need a nudge —
// this is that nudge.
function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

// Layer order bottom -> top (SPEC.md §4): beige base -> population -> outline ->
// alert heatmap. No tile layer at all — just a beige canvas (the spec's preferred,
// most minimal route over a custom MapLibre style).
export function MapView({ outline, population, cityWeights, showPopulation, showHeatmap, heatmapMax }: MapViewProps) {
  const heatPoints = useMemo<[number, number, number][]>(
    () => cityWeights.map((c) => [c.lat, c.lng, c.weight]),
    [cityWeights],
  );

  return (
    <MapContainer
      center={ISRAEL_CENTER}
      zoom={8}
      minZoom={7}
      maxZoom={13}
      maxBounds={ISRAEL_BOUNDS}
      maxBoundsViscosity={1}
      attributionControl={false}
      style={{ background: theme.land, width: '100%', height: '100%' }}
    >
      <MapResizeHandler />
      {showPopulation && (
        <HeatLayer
          points={population}
          gradient={theme.population.gradient}
          radius={28}
          blur={22}
          maxZoom={11}
        />
      )}
      <GeoJSON data={outline.districts} style={districtStyle} />
      <GeoJSON data={outline.country} style={countryStyle} />
      {showHeatmap && (
        <HeatLayer
          points={heatPoints}
          gradient={theme.alertHeat.gradient}
          radius={32}
          blur={20}
          max={heatmapMax}
          maxZoom={11}
        />
      )}
    </MapContainer>
  );
}
