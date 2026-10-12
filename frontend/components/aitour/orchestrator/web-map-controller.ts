import type { routeMapData } from './route-map-document';
import type { Leaflet, LeafletMarker } from './web-leaflet';
import { OSM_TILE_URL } from './web-leaflet';
import { WEB_MAP_STYLE } from './web-map-style';

export type WebMapData = ReturnType<typeof routeMapData>;
export interface WebMapController { select: (id?: string) => void; destroy: () => void }
type MapEvent = { type: 'ready' | 'tile-error' | 'stop-select'; id?: string };

/** No routing or data fetching except normal viewport tiles. All labels use textContent. */
export function createWebMap(L: Leaflet, root: ShadowRoot, data: WebMapData, emit: (e: MapEvent) => void): WebMapController {
  const style = document.createElement('style'); style.textContent = WEB_MAP_STYLE;
  const node = document.createElement('div'); node.id = 'map'; node.dataset.testid = 'orchestrator-map-canvas';
  node.setAttribute('aria-label', 'Mappa del giro'); node.tabIndex = 0;
  const payload = document.createElement('script'); payload.id = 'server-map-data'; payload.type = 'application/json';
  payload.textContent = JSON.stringify(data); // Inert data only, no executable interpolation.
  root.append(style, node, payload);
  // Leaflet 1.9.4's zoom transition timeout can outlive map.remove() during fullscreen changes.
  // Use supported non-animated zoom instead of timer/private-API patches; RN modal animation stays.
  const map = L.map(node, { zoomControl: true, attributionControl: true, zoomSnap: 0.25, zoomDelta: 0.5,
    zoomAnimation: false, markerZoomAnimation: false });
  const scope = root.host.getAttribute?.('data-testid') ?? 'orchestrator-map-surface';
  for (const direction of ['in', 'out']) node.querySelector?.(`.leaflet-control-zoom-${direction}`)?.setAttribute('data-testid', `${scope}-zoom-${direction}`);
  node.querySelectorAll?.('.leaflet-control-attribution a').forEach((link, i) => link.setAttribute('data-testid', `${scope}-attribution-${i}`));
  const points = [data.start.point, ...data.geometry, ...data.stops.map(s => s.point), ...(data.end ? [data.end.point] : [])];
  const fit = () => { map.invalidateSize({ pan: false }); map.fitBounds(points, { padding: [42, 42], maxZoom: 15, animate: false }); };
  fit(); // Before adding tiles: do not download an invisible intermediate zoom level.

  const icon = (text: string, color: string, mandatory: boolean, endpoint: boolean, anchor?: number[]) => {
    const span = document.createElement('span'); span.textContent = text; span.style.backgroundColor = color;
    span.className = endpoint ? 'endpoint' : mandatory ? 'mandatory' : '';
    return L.divIcon({ className: 'route-marker', html: span, iconSize: [44, 44], iconAnchor: anchor ?? (endpoint ? [22, 0] : [22, 22]) });
  };
  const endpoint = (point: WebMapData['start'], text: string, title: string, id: string, anchor?: number[]) => {
    const marker = L.marker(point.point, { icon: icon(text, '#0f172a', false, true, anchor), title, zIndexOffset: 100 }).addTo(map);
    marker.getElement().dataset.testid = id;
    const content = document.createElement('div'); content.textContent = `${title} · ${point.label}`; marker.bindPopup(content);
  };
  const sameEnd = data.end?.point[0] === data.start.point[0] && data.end?.point[1] === data.start.point[1];
  endpoint(data.start, 'P', 'Partenza', 'orchestrator-map-start', sameEnd ? [40, 0] : undefined);
  if (data.end) endpoint(data.end, 'R', 'Rientro', 'orchestrator-map-return', sameEnd ? [4, 0] : undefined);
  if (data.geometry.length > 1) {
    L.polyline(data.geometry, { color: data.routeColor, weight: 4, opacity: 0.8 }).addTo(map).getElement().dataset.testid = 'orchestrator-server-route';
  }
  const markers = new Map<string, LeafletMarker>();
  const select = (id?: string) => markers.forEach((marker, key) => {
    marker.getElement().classList.toggle('selected', key === id); marker.setZIndexOffset(key === id ? 300 : 200);
  });
  data.stops.forEach(stop => {
    const marker = L.marker(stop.point, { icon: icon(stop.number, stop.color, stop.mandatory, false), title: `${stop.number}. ${stop.name}`, zIndexOffset: 200 }).addTo(map);
    markers.set(stop.id, marker); marker.getElement().dataset.testid = `orchestrator-map-stop-${stop.id}`;
    marker.getElement().setAttribute('aria-label', `${stop.number}. ${stop.name}`);
    marker.on('click', () => { select(stop.id); emit({ type: 'stop-select', id: stop.id }); });
  });
  const tiles = L.tileLayer(OSM_TILE_URL, {
    maxZoom: 19, updateWhenIdle: true, keepBuffer: 0,
    referrerPolicy: 'strict-origin-when-cross-origin', // Real document origin, set by the browser; never a spoofed header.
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
  });
  let loaded = false;
  tiles.on('tileload', () => { if (!loaded) { loaded = true; emit({ type: 'ready' }); } });
  tiles.on('tileerror', event => { if (event.tile) event.tile.style.visibility = 'hidden'; emit({ type: 'tile-error' }); });
  tiles.addTo(map);
  const observer = new ResizeObserver(fit); observer.observe(root.host);
  return { select, destroy: () => { observer.disconnect(); map.remove(); root.replaceChildren(); } };
}