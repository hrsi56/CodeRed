// Color system from SPEC.md §4 — single source of truth so the map and charts stay consistent.
export const theme = {
  land: '#F4EEE2',
  outline: '#D8CDBA',
  // Subtle aesthetic context layer (SPEC.md §3.3) — alpha is baked into the gradient
  // stops themselves so it reads as "low opacity, no sharp edges" under leaflet.heat.
  population: {
    gradient: { 0.0: 'transparent', 0.4: 'rgba(231,214,190,0.35)', 1.0: 'rgba(184,154,110,0.55)' },
  },
  alertHeat: {
    gradient: { 0.0: 'transparent', 0.5: '#F2A65A', 1.0: '#D7263D' },
  },
  fatality: '#2B0A0A',
} as const;
