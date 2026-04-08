import { supabase } from '../supabase';
import { Tabaccheria } from '../../types';

function parseCoordinate(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? null : num;
}

function isValidCoordinate(lat: number | null, lng: number | null): boolean {
  if (lat === null || lng === null) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

export async function fetchTabaccherieInBounds(
  bounds: { north: number; south: number; east: number; west: number },
  userId?: string,
  userRole?: string
): Promise<Tabaccheria[]> {
  // Deprecated: use fetchTabaccherieInRadius instead
  return fetchTabaccherieInRadius(
    (bounds.north + bounds.south) / 2,
    (bounds.east + bounds.west) / 2,
    40,
    userId,
    userRole
  );
}

/**
 * Fetch tabaccherie within a radius (km) from center point.
 * Calculates a bounding box from the center and radius, then queries Supabase.
 */
export async function fetchTabaccherieInRadius(
  centerLat: number,
  centerLng: number,
  radiusKm: number,
  userId?: string,
  userRole?: string
): Promise<Tabaccheria[]> {
  try {
    // Calculate bounding box from center + radius
    // 1 degree latitude ≈ 111km
    // 1 degree longitude ≈ 111km * cos(latitude)
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(centerLat * Math.PI / 180));

    const bounds = {
      north: centerLat + latDelta,
      south: centerLat - latDelta,
      east: centerLng + lngDelta,
      west: centerLng - lngDelta,
    };

    console.log('[tabaccherie] Fetching in radius', radiusKm, 'km from center:', centerLat, centerLng, 'bounds:', bounds);

    const { data, error } = await supabase
      .from('tabaccherie')
      .select(`
        id,
        denominazione,
        indirizzo,
        comune,
        provincia,
        cap,
        gps_lat,
        gps_lng,
        customer_id,
        agente_id,
        stato_visita,
        customers!tabaccherie_customer_id_fkey (
          id,
          business_name,
          agent_id,
          last_order_date,
          last_visit_date,
          first_visit_date
        )
      `)
      .gte('gps_lat', bounds.south.toString())
      .lte('gps_lat', bounds.north.toString())
      .gte('gps_lng', bounds.west.toString())
      .lte('gps_lng', bounds.east.toString())
      .limit(5000);

    if (error) throw error;
    if (!data) return [];

    const validResults: Tabaccheria[] = [];

    data.forEach((tab: any) => {
      const lat = parseCoordinate(tab.gps_lat);
      const lng = parseCoordinate(tab.gps_lng);

      if (!isValidCoordinate(lat, lng)) return;

      const customerData = tab.customers || null;

      validResults.push({
        id: tab.id,
        denominazione: tab.denominazione || '',
        indirizzo: tab.indirizzo || '',
        comune: tab.comune || '',
        provincia: tab.provincia || '',
        cap: tab.cap || '',
        gps_lat: tab.gps_lat?.toString() || '',
        gps_lng: tab.gps_lng?.toString() || '',
        latitude: lat,
        longitude: lng,
        customer_id: tab.customer_id,
        agente_id: tab.agente_id,
        stato_visita: tab.stato_visita,
        customer_business_name: customerData?.business_name || null,
        customer_last_order_date: customerData?.last_order_date || null,
        customer_last_visit_date: customerData?.last_visit_date || null,
      });
    });

    console.log('[tabaccherie] Returning', validResults.length, 'valid points in', radiusKm, 'km radius');
    return validResults;
  } catch (error) {
    console.error('[tabaccherie] Error:', error);
    throw error;
  }
}

export async function fetchAllTabaccherie(
  userId?: string,
  userRole?: string,
  filterMode?: string
): Promise<Tabaccheria[]> {
  try {
    console.log('[tabaccherie] Fetching ALL tabaccherie, filter:', filterMode);

    let query = supabase
      .from('tabaccherie')
      .select(`
        id,
        denominazione,
        indirizzo,
        comune,
        provincia,
        cap,
        gps_lat,
        gps_lng,
        customer_id,
        agente_id,
        stato_visita,
        customers!tabaccherie_customer_id_fkey (
          id,
          business_name,
          agent_id,
          last_order_date,
          last_visit_date,
          first_visit_date
        )
      `)
      .limit(5000);

    if (filterMode === 'active') {
      query = query.in('stato_visita', ['visitato', 'ordinato']);
    } else if (filterMode === 'not_visited') {
      query = query.or('stato_visita.is.null,stato_visita.eq.non_visitato');
    }

    const { data, error } = await query;

    if (error) throw error;
    if (!data) return [];

    const validResults: Tabaccheria[] = [];

    data.forEach((tab: any) => {
      const lat = parseCoordinate(tab.gps_lat);
      const lng = parseCoordinate(tab.gps_lng);

      if (!isValidCoordinate(lat, lng)) return;

      const customerData = tab.customers || null;

      validResults.push({
        id: tab.id,
        denominazione: tab.denominazione || '',
        indirizzo: tab.indirizzo || '',
        comune: tab.comune || '',
        provincia: tab.provincia || '',
        cap: tab.cap || '',
        gps_lat: tab.gps_lat?.toString() || '',
        gps_lng: tab.gps_lng?.toString() || '',
        latitude: lat,
        longitude: lng,
        customer_id: tab.customer_id,
        agente_id: tab.agente_id,
        stato_visita: tab.stato_visita,
        customer_business_name: customerData?.business_name || null,
        customer_last_order_date: customerData?.last_order_date || null,
        customer_last_visit_date: customerData?.last_visit_date || null,
      });
    });

    console.log('[tabaccherie] Returning', validResults.length, 'valid points (ALL)');
    return validResults;
  } catch (error) {
    console.error('[tabaccherie] Error:', error);
    throw error;
  }
}

export async function searchTabaccherie(query: string): Promise<Tabaccheria[]> {
  if (!query || query.length < 2) return [];

  try {
    const searchTerm = `%${query}%`;

    const { data, error } = await supabase
      .from('tabaccherie')
      .select('*')
      .or(`denominazione.ilike.${searchTerm},indirizzo.ilike.${searchTerm},comune.ilike.${searchTerm}`)
      .limit(50);

    if (error) throw error;

    return (data || []).map((tab: any) => ({
      ...tab,
      latitude: parseCoordinate(tab.gps_lat),
      longitude: parseCoordinate(tab.gps_lng),
    }));
  } catch (error) {
    console.error('[searchTabaccherie] Error:', error);
    throw error;
  }
}

export function getStatusColor(status: string | null | undefined): string {
  switch (status) {
    case 'ordinato':
      return '#10B981'; // Green
    case 'visitato':
      return '#3B82F6'; // Blue
    case 'non_visitato':
    default:
      return '#EF4444'; // Red
  }
}

export function getStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'ordinato':
      return 'Ordinato';
    case 'visitato':
      return 'Visitato';
    case 'non_visitato':
    default:
      return 'Non Visitato';
  }
}
