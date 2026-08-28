import { supabase } from '../supabase';
import { Inspection } from '../../types';
import { uploadSinglePhoto } from './photos';

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

export function getInspectionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
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
