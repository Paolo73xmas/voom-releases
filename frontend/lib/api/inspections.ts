import { supabase } from '../supabase';
import { Inspection } from '../../types';
import { uploadSinglePhoto } from './photos';
import { closeDueFollowUps } from './appointments';
import { literalSearch, pageRange, readPage, readEveryPage, type ReadPageOptions } from './read-pages';

export async function fetchInspections(userId: string, userRole: string): Promise<Inspection[]> {
  try {
    let query = supabase
      .from('inspections')
      .select(`
        *,
        customer:customers (
          id,
          business_name,
          city,
          province,
          address
        )
      `)
      .order('inspection_date', { ascending: false })
      .limit(100);

    if (userRole !== 'admin' && userRole !== 'supervisor' && userRole !== 'admincustom') {
      query = query.eq('agent_id', userId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[fetchInspections] Error:', error);
    throw error;
  }
}

export async function createInspection(inspectionData: {
  customer_id: string;
  agent_id: string;
  latitude: number;
  longitude: number;
  gps_accuracy?: number;
  notes?: string;
  follow_up_date?: string;
}): Promise<Inspection> {
  try {
    const { data, error } = await supabase
      .from('inspections')
      .insert({
        ...inspectionData,
        inspection_date: new Date().toISOString(),
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    // Un'ispezione è una visita: chiude i follow-up dovuti su quel cliente
    await closeDueFollowUps(inspectionData.customer_id, inspectionData.agent_id);
    return data;
  } catch (error) {
    console.error('[createInspection] Error:', error);
    throw error;
  }
}

/**
 * Ispezione registrata dall'esito del Tour Live (parità con createInspection web):
 * record inspections con status 'completed', aggiornamento last_visit_date del cliente,
 * foto caricate nel bucket 'inspection_photos' + record inspection_photos (gps + ordine).
 */
/**
 * Registra un'ispezione (con foto) generata dall'esito di una tappa AI Tour.
 * Ogni foto ha un retry (2 tentativi); i fallimenti definitivi vengono conteggiati
 * e riferiti al chiamante (photoFailures) per avvisare l'agente.
 */
export async function createTourInspection(args: {
  customer_id: string;
  agent_id: string;
  notes: string;
  latitude: number;
  longitude: number;
  photos: { uri: string }[];
  gps: { lat: number; lon: number };
  onProgress?: (done: number, total: number) => void;
}): Promise<{ photoFailures: number }> {
  const { data: inspection, error } = await supabase
    .from('inspections')
    .insert({
      customer_id: args.customer_id,
      agent_id: args.agent_id,
      notes: args.notes,
      status: 'completed',
      latitude: args.latitude,
      longitude: args.longitude,
      inspection_date: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;

  // Le ispezioni contano come visite: aggiorna last_visit_date (non bloccante)
  const { error: visitDateError } = await supabase
    .from('customers')
    .update({ last_visit_date: new Date().toISOString() })
    .eq('id', args.customer_id);
  if (visitDateError) console.warn('[createTourInspection] last_visit_date:', visitDateError.message);

  // L'ispezione chiude i follow-up dovuti: rete di sicurezza se l'esito Tour Live non passa da completeStop
  await closeDueFollowUps(args.customer_id, args.agent_id);

  let photoFailures = 0;
  for (let i = 0; i < args.photos.length; i++) {
    let saved = false;
    for (let attempt = 1; attempt <= 2 && !saved; attempt++) {
      try {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 15);
        const fileName = `${inspection.id}/${timestamp}_${randomStr}_${i + 1}.jpg`;
        const publicUrl = await uploadSinglePhoto(args.photos[i].uri, fileName, 'inspection_photos');
        if (!publicUrl) throw new Error('upload fallito');
        const { error: photoError } = await supabase.from('inspection_photos').insert({
          inspection_id: inspection.id,
          photo_url: publicUrl,
          gps_lat: args.gps.lat,
          gps_lng: args.gps.lon,
          photo_order: i + 1,
        });
        if (photoError) throw photoError;
        saved = true;
      } catch (err) {
        console.warn(`[createTourInspection] foto ${i + 1} (tentativo ${attempt}/2):`, err);
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1200));
      }
    }
    if (!saved) photoFailures++;
    args.onProgress?.(i + 1, args.photos.length);
  }
  return { photoFailures };
}

/** Ispezioni del singolo agente (ognuno vede solo le proprie), con cliente e conteggio foto.
 * Filtri opzionali come nel gestionale web: testo su cliente/note e intervallo date.
 */
export interface AgentInspection {
  id: string;
  inspection_date: string;
  notes: string | null;
  status: string;
  photoCount: number;
  customerId: string | null;
  customerName: string;
  customerCity: string;
}

type InspectionPageOptions = ReadPageOptions & { dateFrom?: string; dateTo?: string };

export async function fetchAgentInspectionPage(agentId: string, opts: InspectionPageOptions = {}) {
  if (!agentId) throw new Error('Agente non disponibile');
  const { offset, end } = pageRange(opts);
  let query = supabase
    .from('inspections')
    .select('id, inspection_date, notes, status, customer_id, customers(business_name, city), inspection_photos(id), matched_customer:customers()', { count: 'exact' })
    .eq('agent_id', agentId)
    .order('inspection_date', { ascending: false }).order('id').range(offset, end);
  if (opts.dateFrom) query = query.gte('inspection_date', new Date(`${opts.dateFrom}T00:00:00`).toISOString());
  if (opts.dateTo) {
    const endDay = new Date(`${opts.dateTo}T00:00:00`);
    endDay.setDate(endDay.getDate() + 1);
    query = query.lt('inspection_date', endDay.toISOString());
  }
  if (opts.search?.trim()) {
    const term = literalSearch(opts.search);
    query = query.or(`business_name.ilike.${term},city.ilike.${term}`, { referencedTable: 'matched_customer' })
      .or(`notes.ilike.${term},matched_customer.not.is.null`);
  }
  const { data, error, count } = await query;
  if (error) throw error;
  const rows: AgentInspection[] = (data || []).map((row) => {
    const customer = row.customers as { business_name?: string; city?: string } | null;
    return {
      id: row.id,
      inspection_date: row.inspection_date,
      notes: row.notes || null,
      status: row.status,
      photoCount: Array.isArray(row.inspection_photos) ? row.inspection_photos.length : 0,
      customerId: row.customer_id || null,
      customerName: customer?.business_name || 'Cliente non collegato',
      customerCity: customer?.city || '',
    };
  });
  return readPage(rows, count, offset);
}

/** Piccolo riepilogo dashboard; lo storico completo usa fetchAgentInspectionPage. */
export async function fetchAgentInspections(agentId: string, opts?: { limit?: number; dateFrom?: string; dateTo?: string }): Promise<AgentInspection[]> {
  return (await fetchAgentInspectionPage(agentId, { ...opts, pageSize: opts?.limit ?? 50 })).rows;
}

/** Note delle ispezioni già eseguite su un cliente (solo quelle dell'agente): usate in Tour Live. */
export interface InspectionNote { id: string; date: string; notes: string; photoCount: number }

export async function fetchCustomerInspectionNotes(customerId: string, agentId: string): Promise<InspectionNote[]> {
  if (!customerId || !agentId) throw new Error('Cliente o agente non disponibile');
  // Pagina tutte le note di QUESTO cliente/agente: nessun tetto30, nessuno storico globale in memoria.
  const data = await readEveryPage((from, to) => supabase
    .from('inspections')
    .select('id, inspection_date, notes, inspection_photos(id)')
    .eq('customer_id', customerId)
    .eq('agent_id', agentId)
    .not('notes', 'is', null).neq('notes', '')
    .order('inspection_date', { ascending: false })
    .order('id').range(from, to), 50);
  return data
    .map((row) => ({
      id: row.id,
      date: row.inspection_date,
      notes: (row.notes || '').trim(),
      photoCount: Array.isArray(row.inspection_photos) ? row.inspection_photos.length : 0,
    }))
    .filter((n) => n.notes.length > 0);
}

export interface InspectionDetail extends AgentInspection {  latitude: number | null;
  longitude: number | null;
  photos: { id: string; photo_url: string; photo_order: number }[];
}

export async function fetchInspectionDetail(inspectionId: string, agentId: string): Promise<InspectionDetail | null> {
  const { data, error } = await supabase
    .from('inspections')
    .select('id, inspection_date, notes, status, customer_id, latitude, longitude, customers(business_name, city), inspection_photos(id, photo_url, photo_order)')
    .eq('id', inspectionId)
    .eq('agent_id', agentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const customer = data.customers as { business_name?: string; city?: string } | null;
  const photos = (data.inspection_photos as { id: string; photo_url: string; photo_order: number }[] | null) || [];
  return {
    id: data.id,
    inspection_date: data.inspection_date,
    notes: data.notes || null,
    status: data.status,
    photoCount: photos.length,
    customerId: data.customer_id || null,
    customerName: customer?.business_name || 'Cliente non collegato',
    customerCity: customer?.city || '',
    latitude: data.latitude ?? null,
    longitude: data.longitude ?? null,
    photos: [...photos].sort((a, b) => (a.photo_order || 0) - (b.photo_order || 0)),
  };
}

export function getInspectionStatusLabel(status: string): string {  const labels: Record<string, string> = {
    pending: 'In Attesa',
    completed: 'Completata',
    cancelled: 'Annullata',
  };
  return labels[status] || status;
}

export function getInspectionStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: '#F59E0B',
    completed: '#10B981',
    cancelled: '#EF4444',
  };
  return colors[status] || '#9CA3AF';
}
