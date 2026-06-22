import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { maxHeatLayer, type HeatPoint, type HeatGradient } from '../leaflet/maxHeatLayer';

export interface HeatLayerProps {
  points: HeatPoint[];
  gradient: HeatGradient;
  radius?: number;
  blur?: number;
  max?: number;
  maxZoom?: number;
  minOpacity?: number;
  maxOpacity?: number;
  gamma?: number;
}

// react-leaflet has no built-in heat layer, so this wraps our own MaxHeatLayer
// imperatively: add it on mount, swap it for a fresh instance on data/option change,
// remove on unmount. (Previously wrapped the `leaflet.heat` plugin — replaced because
// its kernel-density blending accumulates alpha across overlapping points, which let
// dense clusters of low-weight localities outshine real high-weight ones. See
// MaxHeatLayer for the per-pixel-max approach that fixes this.)
export function HeatLayer({
  points,
  gradient,
  radius = 25,
  blur = 18,
  max,
  maxZoom,
  minOpacity,
  maxOpacity,
  gamma,
}: HeatLayerProps) {
  const map = useMap();

  useEffect(() => {
    const layer = maxHeatLayer(points, { gradient, radius, blur, max, maxZoom, minOpacity, maxOpacity, gamma });
    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points, gradient, radius, blur, max, maxZoom, minOpacity, maxOpacity, gamma]);

  return null;
}
