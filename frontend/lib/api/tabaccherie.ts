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

/**
 * Fetch tabaccherie within the exact visible map bounds.
 * Paginates to overcome the Supabase 1000-row default limit.
 */
export async function fetchTabaccherieByBounds(
  bounds: { north: number; south: number; east: number; west: number },
  userId?: string,
  userRole?: string,
  filterMode?: 'all' | 'active' | 'not_visited'
): Promise<Tabaccheria[]> {
  try {
    console.log('[tabaccherie] Fetching by visible bounds:', bounds, 'filter:', filterMode);

    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

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
          telefono_mobile,
          telefono_fisso,
          email,
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
        .lte('gps_lng', bounds.east.toString());

      // Apply filter
      if (filterMode === 'active') {
        query = query.in('stato_visita', ['visitato', 'ordinato']);
      } else if (filterMode === 'not_visited') {
        query = query.or('stato_visita.is.null,stato_visita.eq.non_visitato');
      }

      const { data, error } = await query.range(from, to);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allData = allData.concat(data);
      hasMore = data.length === PAGE_SIZE && allData.length < 1000;
      page++;

      // Max 1000 points visible
      if (allData.length >= 1000) {
        allData = allData.slice(0, 1000);
        break;
      }
    }

    const validResults: Tabaccheria[] = [];
    allData.forEach((tab: any) => {
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
        customer_first_visit_date: customerData?.first_visit_date || null,
        telefono_mobile: tab.telefono_mobile || null,
        telefono_fisso: tab.telefono_fisso || null,
        email: tab.email || null,
      });
    });

    console.log('[tabaccherie] Returning', validResults.length, 'points from', allData.length, 'rows (' + page, 'pages)');
    return validResults;
  } catch (error) {
    console.error('[tabaccherie] Error fetching by bounds:', error);
    throw error;
  }
}

/**
 * Fetch di una singola tabaccheria per ID (con join customers per popup mappa).
 * Usato dalla ricerca MPVP quando il punto selezionato non è nei bounds correnti.
 */
export async function fetchTabaccheriaById(id: string): Promise<Tabaccheria | null> {
  try {
    const { data: tab, error } = await supabase
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
        telefono_mobile,
        telefono_fisso,
        email,
        customers!tabaccherie_customer_id_fkey (
          id,
          business_name,
          agent_id,
          last_order_date,
          last_visit_date,
          first_visit_date
        )
      `)
      .eq('id', id)
      .single();

    if (error || !tab) {
      console.error('[tabaccherie] fetchTabaccheriaById error:', error);
      return null;
    }

    const lat = parseCoordinate(tab.gps_lat);
    const lng = parseCoordinate(tab.gps_lng);
    const customerData: any = tab.customers || null;

    return {
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
      customer_first_visit_date: customerData?.first_visit_date || null,
      telefono_mobile: tab.telefono_mobile || null,
      telefono_fisso: tab.telefono_fisso || null,
      email: tab.email || null,
    };
  } catch (error) {
    console.error('[tabaccherie] fetchTabaccheriaById exception:', error);
    return null;
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
        telefono_mobile,
        telefono_fisso,
        email,
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
        customer_first_visit_date: customerData?.first_visit_date || null,
        telefono_mobile: tab.telefono_mobile || null,
        telefono_fisso: tab.telefono_fisso || null,
        email: tab.email || null,
      });
    });

    console.log('[tabaccherie] Returning', validResults.length, 'valid points (ALL)');
    return validResults;
  } catch (error) {
    console.error('[tabaccherie] Error:', error);
    throw error;
  }
}
