// Territori AI Tour: riusa la tabella agent_zones (poligoni GeoJSON per agente, anche non contigui).
import { supabase } from '../supabase';
import { isPointInPolygon, geoJSONToLeafletLatLngs } from './geo';
import { loadFreeTabaccherie } from './data';
import type { TourCandidate, AiTourSettings } from './types';

export interface TerritoryZone {
  id: string;
  agent_id: string;
  zone_name: string;
  color: string;
  geometry: GeoJSON.Polygon;
  agent_name: string;
}

interface ZoneRow {
  id: string;
  agent_id: string;
  zone_name: string;
  zone_color: string | null;
  coordinates: number[][];
  agent: { full_name: string | null } | null;
}

export async function listAllZones(): Promise<TerritoryZone[]> {
  const { data, error } = await supabase
    .from('agent_zones')
    .select('id, agent_id, zone_name, zone_color, coordinates, agent:profiles!agent_zones_agent_id_fkey(full_name)')
    .eq('is_active', true)
    .order('created_at');
  if (error) throw error;
  return ((data || []) as unknown as ZoneRow[])
    .filter((r) => Array.isArray(r.coordinates) && r.coordinates.length >= 4)
    .map((r) => ({
      id: r.id,
      agent_id: r.agent_id,
      zone_name: r.zone_name,
      color: r.zone_color || '#3B82F6',
      geometry: { type: 'Polygon', coordinates: [r.coordinates] } as GeoJSON.Polygon,
      agent_name: r.agent?.full_name || '',
    }));
}

export async function createZone(agentId: string, zoneName: string, ring: number[][], color: string): Promise<void> {
  const { error } = await supabase.from('agent_zones').insert({
    agent_id: agentId,
    zone_name: zoneName,
    zone_color: color,
    color,
    coordinates: ring,
    is_active: true,
  });
  if (error) throw error;
}

export async function removeZone(zoneId: string): Promise<void> {
  const { error } = await supabase
    .from('agent_zones')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', zoneId);
  if (error) throw error;
}

export function pointInZones(lat: number, lng: number, zones: TerritoryZone[]): boolean {
  return zones.some((z) => isPointInPolygon(lat, lng, z.geometry));
}

// Tabaccherie mai visitate (del territorio dell'agente) + libere "da acquisire" nella geografia del giro:
// riempitivi di sviluppo per Settimana/Mensile. Se ci sono zone disegnate comanda il territorio, altrimenti il portafoglio.
export async function loadNeverVisitedFillers(
  agentId: string,
  candidates: TourCandidate[],
  zones: TerritoryZone[],
  settings: AiTourSettings,
  limit: number,
): Promise<TourCandidate[]> {
  const pts: [number, number][] = zones.length > 0
    ? zones.flatMap((z) => geoJSONToLeafletLatLngs(z.geometry).map((p) => [p.lat, p.lng] as [number, number]))
    : candidates.map((c) => [c.lat, c.lng] as [number, number]);
  if (pts.length < 2) return [];
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180, sLat = 0, sLng = 0;
  for (const [la, ln] of pts) {
    minLat = Math.min(minLat, la); maxLat = Math.max(maxLat, la);
    minLng = Math.min(minLng, ln); maxLng = Math.max(maxLng, ln);
    sLat += la; sLng += ln;
  }
  const pad = 0.03;
  const exclude = new Set(candidates.map((c) => c.tabaccheriaId).filter((x): x is string => !!x));
  let extra = await loadFreeTabaccherie(
    { minLat: minLat - pad, maxLat: maxLat + pad, minLng: minLng - pad, maxLng: maxLng + pad },
    exclude,
    settings,
    { refLat: sLat / pts.length, refLng: sLng / pts.length, agentId },
    limit,
  );
  if (zones.length > 0) extra = extra.filter((c) => pointInZones(c.lat, c.lng, zones));
  return extra;
}

export async function agentPortfolioPoints(agentId: string): Promise<[number, number][]> {
  const { data, error } = await supabase
    .from('customers')
    .select('latitude, longitude')
    .eq('agent_id', agentId)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(800);
  if (error) throw error;
  return ((data || []) as { latitude: unknown; longitude: unknown }[])
    .map((r) => [Number(r.latitude), Number(r.longitude)] as [number, number])
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
}
