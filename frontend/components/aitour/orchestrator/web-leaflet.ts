/** Trusted, integrity-pinned Leaflet dependency for the browser adapter only.
 * Native continues to resolve MapSurface.native.tsx. No keys, proxy or fake identity. */
type Point = number[];
interface Layer { addTo(map: LeafletMap): this }
export interface LeafletMap {
  fitBounds(points: Point[], options: Record<string, unknown>): void;
  invalidateSize(options: { pan: boolean }): void;
  remove(): void;
}
export interface LeafletMarker extends Layer {
  getElement(): HTMLElement;
  setZIndexOffset(value: number): void;
  bindPopup(content: HTMLElement): this;
  on(event: string, fn: () => void): this;
}
export interface Leaflet {
  version: string; noConflict(): Leaflet;
  map(node: HTMLElement, options: Record<string, unknown>): LeafletMap;
  tileLayer(url: string, options: Record<string, unknown>): Layer & { on(event: string, fn: (e: { tile?: HTMLImageElement }) => void): void };
  divIcon(options: Record<string, unknown>): unknown;
  marker(point: Point, options: Record<string, unknown>): LeafletMarker;
  polyline(points: Point[], options: Record<string, unknown>): Layer & { getElement(): SVGPathElement };
}

export const LEAFLET_ASSETS = {
  js: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  jsIntegrity: 'sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH',
  css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  cssIntegrity: 'sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H',
};
export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
let pending: Promise<Leaflet> | undefined;

export function loadWebLeaflet(): Promise<Leaflet> {
  if (pending) return pending;
  pending = new Promise<Leaflet>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = LEAFLET_ASSETS.js; script.integrity = LEAFLET_ASSETS.jsIntegrity; script.crossOrigin = 'anonymous';
    const fail = () => { script.remove(); reject(new Error('LEAFLET_LOAD_FAILED')); };
    script.onerror = fail;
    script.onload = () => {
      const leaflet = (window as unknown as { L?: Leaflet }).L;
      if (leaflet?.version !== '1.9.4') { fail(); return; }
      resolve(leaflet.noConflict()); // Restore any previous global instead of overwriting another map.
    };
    document.head.appendChild(script);
  }).catch(error => { pending = undefined; throw error; });
  return pending;
}

export function loadWebMapStyles(root: ShadowRoot): Promise<void> {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = LEAFLET_ASSETS.css;
    link.integrity = LEAFLET_ASSETS.cssIntegrity; link.crossOrigin = 'anonymous';
    link.onload = () => resolve(); link.onerror = () => reject(new Error('LEAFLET_STYLE_FAILED'));
    root.appendChild(link);
  });
}