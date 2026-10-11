import type { Coordinate } from './contract';
import { OrchestratorError } from './errors';
export function validCoordinate(p: Coordinate): boolean {
  return !!p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
}
/** Coordinate order MUST come from the verified handoff, never a geographic guess. */
export function displayCoordinates(points: readonly (readonly number[])[], order: 'lat_lng' | 'lng_lat'): Coordinate[] {
  if (!['lat_lng', 'lng_lat'].includes(order)) throw new OrchestratorError('INVALID_RESPONSE');
  return points.map(p => {
    if (p.length !== 2) throw new OrchestratorError('INVALID_RESPONSE');
    const point = { latitude: p[order === 'lat_lng' ? 0 : 1], longitude: p[order === 'lat_lng' ? 1 : 0] };
    if (!validCoordinate(point)) throw new OrchestratorError('INVALID_RESPONSE');
    return point;
  });
}