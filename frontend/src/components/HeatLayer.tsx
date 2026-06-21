import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';

export interface HeatLayerProps {
  points: L.HeatLatLngTuple[];
  gradient: L.ColorGradientConfig;
  radius?: number;
  blur?: number;
  max?: number;
  maxZoom?: number;
  minOpacity?: number;
}

// react-leaflet has no built-in heat layer, so this wraps leaflet.heat imperatively:
// add it on mount, swap its data/options in place on change, remove on unmount.
export function HeatLayer({ points, gradient, radius = 25, blur = 18, max, maxZoom, minOpacity }: HeatLayerProps) {
  const map = useMap();

  useEffect(() => {
    const layer = L.heatLayer(points, { gradient, radius, blur, max, maxZoom, minOpacity });
    try {
      // If the map container is still size-0 at mount (briefly true in some embeds),
      // leaflet.heat's first synchronous draw throws — but by then it has already
      // registered its own 'moveend' redraw listener, so MapView's ResizeObserver
      // (which calls invalidateSize() once the container gets a real size) is enough
      // to make it self-heal without us doing anything special here.
      layer.addTo(map);
    } catch {
      /* see comment above — recovers on the next invalidateSize()-triggered redraw */
    }
    return () => {
      map.removeLayer(layer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points, gradient, radius, blur, max, maxZoom, minOpacity]);

  return null;
}
