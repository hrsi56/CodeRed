// Color system — single source of truth so the map and charts stay consistent.
export const theme = {
  // CARTO Voyager basemap (real tiles). OSM + CARTO attribution is legally required
  // and rendered by Leaflet's attribution control.
  basemap: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  },

  // Alert density heatmap — a classic warm YlOrRd kernel-density ramp (single warm
  // family, per SPEC.md §1's single-hue intent) tuned to read as a real heatmap on a
  // light basemap rather than a flat smear.
  alertHeat: {
    gradient: {
      0.0: 'rgba(255,255,178,0)',
      0.2: 'rgba(254,217,118,0.65)',
      0.4: 'rgba(253,141,60,0.78)',
      0.65: 'rgba(240,59,32,0.88)',
      1.0: 'rgba(189,0,38,0.95)',
    },
  },
} as const;
