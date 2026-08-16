// Geometria pura per AI Tour mobile (senza dipendenza @turf):
// point-in-polygon con ray casting + conversione anello GeoJSON -> lat/lng.

interface PolygonLike {
  type: string;
  coordinates: number[][][];
}

/** Ray casting su un anello [lng, lat][] */
function pointInRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Verifica se un punto (lat, lng) e' dentro un poligono GeoJSON.
 * Gestisce anche gli eventuali "buchi" (anelli successivi al primo).
 */
export function isPointInPolygon(lat: number, lng: number, polygon: PolygonLike): boolean {
  if (!polygon || polygon.type !== 'Polygon' || !Array.isArray(polygon.coordinates) || polygon.coordinates.length === 0) {
    return false;
  }
  const outer = polygon.coordinates[0];
  if (!Array.isArray(outer) || outer.length < 3) return false;
  if (!pointInRing(lat, lng, outer)) return false;
  // Buchi: se il punto e' dentro un buco, e' fuori dal poligono
  for (let h = 1; h < polygon.coordinates.length; h++) {
    if (pointInRing(lat, lng, polygon.coordinates[h])) return false;
  }
  return true;
}

/** Converte l'anello esterno di un poligono GeoJSON ([lng,lat][]) in punti { lat, lng } */
export function geoJSONToLeafletLatLngs(geometry: PolygonLike): { lat: number; lng: number }[] {
  if (!geometry || geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
    return [];
  }
  const outer = geometry.coordinates[0];
  if (!Array.isArray(outer)) return [];
  return outer
    .filter((p) => Array.isArray(p) && p.length >= 2)
    .map((p) => ({ lat: p[1], lng: p[0] }));
}
