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

  // Alert density heatmap — one constant red (matches --accent, the app's "alert"
  // colour elsewhere) with intensity carried *only* by opacity, per the user's
  // explicit choice over SPEC.md §4's example multi-stop warm ramp. minOpacity/
  // maxOpacity/gamma below are what vary; the colour itself never shifts hue.
  alertHeat: {
    gradient: {
      0.0: 'rgba(215,38,61,1)',
      1.0: 'rgba(215,38,61,1)',
    },
    radius: 16,
    blur: 10,
    // Every locality with at least one alert must read as clearly present, so the
    // floor is non-zero; the ceiling caps how dark the single hottest locality gets.
    // Lowered from 0.45 — at a constant hue (no colour to separate weak from strong),
    // a 0.45 floor meant almost everywhere with *any* alerts looked nearly as solid
    // as the real hot spots, washing out the map into one red mass.
    minOpacity: 0.25,
    maxOpacity: 0.92,
    // weight/max is raised to this power before mapping to color/opacity — gamma<1
    // pulls low counts up sharply (so one alert is plainly visible) while compressing
    // the rest of the range, so more alerts read as only "a little" darker, not a
    // jump from invisible to blazing red.
    gamma: 0.35,
  },
} as const;
