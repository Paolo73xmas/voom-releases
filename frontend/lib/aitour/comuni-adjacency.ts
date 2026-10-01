// Exact versioned web asset at 88bfb44. No geographic-distance substitute for ISTAT adjacency.
import adjacency from '../../assets/data/comuni-adiacenti.json';
export const normalizeComune = (s: string): string => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
export function bordersOf(comune: string): Set<string> {
  return new Set(((adjacency as Record<string, string[]>)[normalizeComune(comune)] || []).map(normalizeComune));
}
export function comuneGeoTier(comune: string, requested: string, borders: Set<string>): number {
  if (!requested || normalizeComune(comune) === normalizeComune(requested)) return 0;
  return borders.has(normalizeComune(comune)) ? 1 : 2;
}