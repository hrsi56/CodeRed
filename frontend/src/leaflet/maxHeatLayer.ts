import L from 'leaflet';

export type HeatPoint = [lat: number, lng: number, weight: number];
export type HeatGradient = Record<number, string>;

export interface MaxHeatLayerOptions extends L.LayerOptions {
  radius?: number;
  blur?: number;
  max?: number;
  maxZoom?: number;
  /** Floor alpha for the dimmest point that still has weight>0 — every real alert
   *  must read as visibly present, however small relative to the range's max. */
  minOpacity?: number;
  /** Ceiling alpha for the single most-intense point in the range. */
  maxOpacity?: number;
  /** weight/max is raised to this power (0–1) before driving colour/opacity — a
   *  gamma<1 pulls low counts up sharply and compresses the rest of the range, so
   *  the map reads as "a little darker per alert", not "invisible vs. blazing". */
  gamma?: number;
  gradient: HeatGradient;
}

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

// Internal Leaflet API used only for the live CSS-transform during a zoom animation
// (the exact technique the `leaflet.heat` plugin itself uses — see
// node_modules/leaflet.heat/src/HeatLayer.js _animateZoom). Not in @types/leaflet.
interface LeafletMapInternals extends L.Map {
  _getCenterOffset(center: L.LatLng): L.Point;
  _getMapPanePos(): L.Point;
}

function parseColor(input: string): RGBA {
  const m = input.match(/rgba?\(([^)]+)\)/);
  if (!m) return { r: 0, g: 0, b: 0, a: 1 };
  const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
  return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts.length > 3 ? parts[3] : 1 };
}

// Precomputes a 256-entry RGBA ramp from the gradient stops, so colouring a pixel at
// draw time is a single array lookup rather than re-parsing/interpolating per pixel.
function buildRamp(gradient: HeatGradient): RGBA[] {
  const stops = Object.entries(gradient)
    .map(([stop, color]) => ({ stop: Number(stop), color: parseColor(color) }))
    .sort((a, b) => a.stop - b.stop);
  const ramp: RGBA[] = new Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let lo = stops[0];
    let hi = stops[stops.length - 1];
    for (let j = 1; j < stops.length; j++) {
      if (t <= stops[j].stop) {
        lo = stops[j - 1];
        hi = stops[j];
        break;
      }
    }
    const span = hi.stop - lo.stop || 1;
    const f = lo === hi ? 0 : Math.min(1, Math.max(0, (t - lo.stop) / span));
    ramp[i] = {
      r: lo.color.r + (hi.color.r - lo.color.r) * f,
      g: lo.color.g + (hi.color.g - lo.color.g) * f,
      b: lo.color.b + (hi.color.b - lo.color.b) * f,
      a: lo.color.a + (hi.color.a - lo.color.a) * f,
    };
  }
  return ramp;
}

/**
 * A heat layer where overlap can never inflate intensity. Standard kernel-density
 * heatmaps (incl. the `leaflet.heat` plugin this replaced) draw each point as a soft
 * blob and let overlapping blobs *accumulate* alpha — so a tight cluster of many
 * low-weight localities (e.g. central Israel, where towns sit close together) can
 * out-redden one real high-weight locality elsewhere, purely because more circles
 * happen to overlap there. That's not informative; it's a rendering artifact.
 *
 * Here every pixel's colour comes from whichever single point's kernel is strongest
 * at that pixel — a per-pixel MAX over points, never a sum. A point's own colour is
 * fixed by its own weight/max ratio before any compositing happens, so no amount of
 * nearby overlap can push a pixel redder than the strongest real contributor there.
 */
export class MaxHeatLayer extends L.Layer {
  private _points: HeatPoint[];
  private _opts: MaxHeatLayerOptions;
  private _ramp: RGBA[];
  private _canvas?: HTMLCanvasElement;
  private _ctx?: CanvasRenderingContext2D | null;
  private _frame: number | null = null;
  private _mapRef?: L.Map;

  constructor(points: HeatPoint[], options: MaxHeatLayerOptions) {
    super(options);
    this._points = points;
    this._opts = options;
    this._ramp = buildRamp(options.gradient);
  }

  onAdd(map: L.Map): this {
    this._mapRef = map;
    if (!this._canvas) this._initCanvas(map);
    map.getPane('overlayPane')!.appendChild(this._canvas!);
    map.on('moveend', this._reset, this);
    map.on('resize', this._reset, this);
    if (map.options.zoomAnimation && L.Browser.any3d) {
      map.on('zoomanim', this._animateZoom, this);
    }
    this._reset();
    return this;
  }

  onRemove(map: L.Map): this {
    if (this._canvas) map.getPane('overlayPane')!.removeChild(this._canvas);
    map.off('moveend', this._reset, this);
    map.off('resize', this._reset, this);
    map.off('zoomanim', this._animateZoom, this);
    if (this._frame !== null) {
      cancelAnimationFrame(this._frame);
      this._frame = null;
    }
    this._mapRef = undefined;
    return this;
  }

  private _initCanvas(map: L.Map) {
    const canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer leaflet-layer') as HTMLCanvasElement;
    const size = map.getSize();
    canvas.width = size.x;
    canvas.height = size.y;
    const animated = map.options.zoomAnimation && L.Browser.any3d;
    L.DomUtil.addClass(canvas, animated ? 'leaflet-zoom-animated' : 'leaflet-zoom-hide');
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
  }

  private _reset = () => {
    const map = this._mapRef;
    if (!map || !this._canvas) return;
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(this._canvas, topLeft);
    const size = map.getSize();
    if (this._canvas.width !== size.x) this._canvas.width = size.x;
    if (this._canvas.height !== size.y) this._canvas.height = size.y;
    this._scheduleRedraw();
  };

  private _scheduleRedraw() {
    if (this._frame !== null || !this._mapRef) return;
    this._frame = requestAnimationFrame(() => {
      this._frame = null;
      this._draw();
    });
  }

  private _draw() {
    const map = this._mapRef;
    const ctx = this._ctx;
    const canvas = this._canvas;
    if (!map || !ctx || !canvas) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    // Guards the "container is briefly 0×0 at mount" case some embeds hit — the
    // ResizeObserver-driven invalidateSize() elsewhere fires our 'resize' handler
    // once the container gets a real size, so this just waits rather than crashing.
    if (width === 0 || height === 0) return;

    const radius = this._opts.radius ?? 25;
    const blur = this._opts.blur ?? 15;
    const minOpacity = this._opts.minOpacity ?? 0.05;
    const maxOpacity = this._opts.maxOpacity ?? 1;
    const gamma = this._opts.gamma ?? 1;
    const max = this._opts.max && this._opts.max > 0 ? this._opts.max : 1;
    const r = radius + blur;
    const r2 = r * r;

    // Running per-pixel max of "display intensity" (bestDisplay) and, in lockstep,
    // the *normalized* weight ratio that produced it (bestT, used to pick the
    // colour) — so the final colour always reflects the single strongest
    // contributor at each pixel.
    const bestT = new Float32Array(width * height);
    const bestDisplay = new Float32Array(width * height);
    let touched = false;

    for (const [lat, lng, weight] of this._points) {
      if (!weight || weight <= 0) continue;
      const t = Math.pow(Math.min(1, weight / max), gamma);
      const p = map.latLngToContainerPoint([lat, lng]);
      const cx = p.x;
      const cy = p.y;
      if (cx < -r || cx > width + r || cy < -r || cy > height + r) continue;

      const peak = minOpacity + (maxOpacity - minOpacity) * t;
      const x0 = Math.max(0, Math.floor(cx - r));
      const x1 = Math.min(width - 1, Math.ceil(cx + r));
      const y0 = Math.max(0, Math.floor(cy - r));
      const y1 = Math.min(height - 1, Math.ceil(cy + r));

      for (let y = y0; y <= y1; y++) {
        const dy = y - cy;
        const rowBase = y * width;
        for (let x = x0; x <= x1; x++) {
          const dx = x - cx;
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          // Smooth falloff from 1 at the centre to 0 at the radius+blur edge — the
          // same soft "blob" look as a kernel-density heatmap, just not additive.
          const falloff = 1 - Math.sqrt(d2) / r;
          const display = peak * falloff * falloff;
          const idx = rowBase + x;
          if (display > bestDisplay[idx]) {
            bestDisplay[idx] = display;
            bestT[idx] = t;
            touched = true;
          }
        }
      }
    }

    if (!touched) return;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    const ramp = this._ramp;
    for (let i = 0; i < bestDisplay.length; i++) {
      const display = bestDisplay[i];
      if (display <= 0) continue;
      const color = ramp[Math.min(255, Math.max(0, Math.round(bestT[i] * 255)))];
      const o = i * 4;
      data[o] = color.r;
      data[o + 1] = color.g;
      data[o + 2] = color.b;
      data[o + 3] = Math.round(Math.min(1, display) * color.a * 255);
    }
    ctx.putImageData(imageData, 0, 0);
  }

  private _animateZoom = (e: { zoom: number; center: L.LatLng }) => {
    const map = this._mapRef as LeafletMapInternals | undefined;
    const canvas = this._canvas;
    if (!map || !canvas) return;
    const scale = map.getZoomScale(e.zoom, map.getZoom());
    const offset = map._getCenterOffset(e.center).multiplyBy(-scale).subtract(map._getMapPanePos());
    L.DomUtil.setTransform(canvas, offset, scale);
  };
}

export function maxHeatLayer(points: HeatPoint[], options: MaxHeatLayerOptions): MaxHeatLayer {
  return new MaxHeatLayer(points, options);
}
