// Persistenza AI Tour: impostazioni agente + salvataggio/caricamento tour.
import { supabase } from '../supabase';
import type { AiTourSettings, TourPlan } from './types';
import { DEFAULT_SETTINGS, minToTime } from './types';

export async function getSettings(agentId: string): Promise<AiTourSettings> {
  const { data, error } = await supabase
    .from('ai_tour_settings')
    .select('*')
    .eq('agent_id', agentId)
    .maybeSingle();
  if (error) {
    console.warn('[AITour][settings]', error);
    return { ...DEFAULT_SETTINGS };
  }
  return data ? { ...DEFAULT_SETTINGS, ...data } : { ...DEFAULT_SETTINGS };
}

export async function saveSettings(agentId: string, settings: AiTourSettings): Promise<void> {
  const { agent_id: _ignored, ...rest } = settings;
  const { error } = await supabase
    .from('ai_tour_settings')
    .upsert({ agent_id: agentId, ...rest, updated_at: new Date().toISOString() }, { onConflict: 'agent_id' });
  if (error) throw error;
}

export interface SavedTour {
  id: string;
  agent_id: string;
  tour_date: string;
  start_time: string;
  end_time: string;
  start_label: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_label: string | null;
  end_lat: number | null;
  end_lng: number | null;
  tour_type: string;
  resolved_tour_type: string | null;
  status: string;
  planned_visits: number;
  planned_distance_km: number | null;
  planned_drive_minutes: number | null;
  planned_visit_minutes: number | null;
  planned_buffer_minutes: number | null;
  potential_value: number | null;
  ai_summary: string | null;
  created_at: string;
}

export async function saveTour(agentId: string, plan: TourPlan): Promise<string> {
  const { data: tour, error } = await supabase
    .from('ai_tours')
    .insert({
      agent_id: agentId,
      tour_date: plan.tourDate,
      start_time: minToTime(plan.startMin),
      end_time: minToTime(plan.endMin),
      start_label: plan.start.label,
      start_lat: plan.start.lat,
      start_lng: plan.start.lng,
      end_mode: plan.end ? 'point' : 'none',
      end_label: plan.end?.label || null,
      end_lat: plan.end?.lat ?? null,
      end_lng: plan.end?.lng ?? null,
      tour_type: plan.dayType,
      resolved_tour_type: plan.resolvedDayType,
      status: 'planned',
      planned_visits: plan.stops.length,
      planned_distance_km: Math.round(plan.totalKm * 10) / 10,
      planned_drive_minutes: Math.round(plan.driveMin),
      planned_visit_minutes: Math.round(plan.visitMin),
      planned_buffer_minutes: Math.round(plan.bufferMin),
      potential_value: Math.round(plan.potentialValue),
      ai_summary: plan.aiSummary,
      route_geometry: plan.geometry,
    })
    .select('id')
    .single();
  if (error) throw error;

  const stops = plan.stops.map((s) => ({
    tour_id: tour.id,
    entity_type: s.candidate.entityType,
    customer_id: s.candidate.customerId,
    tabaccheria_id: s.candidate.tabaccheriaId,
    business_name: s.candidate.name,
    address: s.candidate.address,
    city: s.candidate.city,
    province: s.candidate.province,
    latitude: s.candidate.lat,
    longitude: s.candidate.lng,
    planned_sequence: s.sequence,
    planned_arrival: minToTime(s.arrivalMin),
    planned_departure: minToTime(s.departureMin),
    planned_duration_minutes: s.candidate.visitMinutes,
    travel_minutes: Math.round(s.travelMinFromPrev),
    travel_km: Math.round(s.travelKmFromPrev * 10) / 10,
    priority_score: s.candidate.score,
    priority_class: s.candidate.priorityClass,
    mandatory: s.mandatory,
    status: 'planned',
    ai_reason: s.candidate.reason,
  }));
  const { error: stopsErr } = await supabase.from('ai_tour_stops').insert(stops);
  if (stopsErr) throw stopsErr;

  await supabase.from('ai_tour_events').insert({
    tour_id: tour.id,
    event_type: 'created',
    details: { visits: plan.stops.length, km: Math.round(plan.totalKm), day_type: plan.resolvedDayType },
  });
  return tour.id as string;
}

export async function listTours(agentId: string): Promise<SavedTour[]> {
  const { data, error } = await supabase
    .from('ai_tours')
    .select('id, agent_id, tour_date, start_time, end_time, start_label, start_lat, start_lng, end_label, end_lat, end_lng, tour_type, resolved_tour_type, status, planned_visits, planned_distance_km, planned_drive_minutes, planned_visit_minutes, planned_buffer_minutes, potential_value, ai_summary, created_at')
    .eq('agent_id', agentId)
    .order('tour_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data || []) as SavedTour[];
}

export interface SavedStop {
  id: string;
  entity_type: string;
  customer_id: string | null;
  business_name: string;
  address: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  planned_sequence: number;
  planned_arrival: string | null;
  planned_departure: string | null;
  planned_duration_minutes: number | null;
  travel_minutes: number | null;
  travel_km: number | null;
  priority_score: number | null;
  priority_class: string | null;
  mandatory: boolean;
  status: string;
  ai_reason: string | null;
}

export async function loadTourStops(tourId: string): Promise<{ stops: SavedStop[]; geometry: [number, number][] }> {
  const [{ data: stops, error }, { data: tour, error: tErr }] = await Promise.all([
    supabase.from('ai_tour_stops').select('*').eq('tour_id', tourId).order('planned_sequence'),
    supabase.from('ai_tours').select('route_geometry').eq('id', tourId).single(),
  ]);
  if (error) throw error;
  if (tErr) throw tErr;
  return { stops: (stops || []) as SavedStop[], geometry: (tour?.route_geometry || []) as [number, number][] };
}

export async function deleteTour(tourId: string): Promise<void> {
  const { error } = await supabase.from('ai_tours').delete().eq('id', tourId);
  if (error) throw error;
}
