import { useEffect, useState } from 'react';

// Breakpoint below which the layout switches from the desktop "everything in one
// window" arrangement to the phone carousel (map ⇄ data swipe). Kept here so App and
// the CSS media queries agree on a single number.
export const MOBILE_MAX = 820;

export interface Viewport {
  width: number;
  isMobile: boolean;
}

const read = (): Viewport => {
  const width = typeof window === 'undefined' ? 1280 : window.innerWidth;
  return { width, isMobile: width <= MOBILE_MAX };
};

// Tracks the window width so the layout can decide how many calendar months fit and
// whether to render the desktop row or the mobile carousel.
export function useViewport(): Viewport {
  const [vp, setVp] = useState<Viewport>(read);
  useEffect(() => {
    const onResize = () => setVp(read());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return vp;
}

// One compact calendar month is ~224px wide with our shrunk cells (7 × 30px + gap).
// Given the current width and whether we're showing two calendars side by side, return
// how many months fit (always ≥1). Phone shows a single month.
const MONTH_WIDTH = 224;

export function monthsThatFit(width: number, comparing: boolean, isMobile: boolean): number {
  if (isMobile) return 1;
  const available = comparing ? width / 2 - 44 : width - 56;
  const cap = comparing ? 3 : 4;
  return Math.max(1, Math.min(cap, Math.floor(available / MONTH_WIDTH)));
}
