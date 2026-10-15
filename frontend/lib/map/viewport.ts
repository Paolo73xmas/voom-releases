export type MapViewport = { lat: number; lng: number; zoom: number; version: number };
export function validViewport(value: MapViewport): boolean {
  return !!value && Number.isFinite(value.lat) && Math.abs(value.lat) <= 90 && Number.isFinite(value.lng) && Math.abs(value.lng) <= 180
    && Number.isFinite(value.zoom) && value.zoom >= 0 && value.zoom <= 22 && Number.isSafeInteger(value.version) && value.version >= 0;
}
/** Ignore old WebView/animated move events after a newer explicit center command. */
export function acceptViewport(current: MapViewport | null, incoming: MapViewport): MapViewport | null {
  return validViewport(incoming) && (!current || incoming.version >= current.version) ? incoming : current;
}