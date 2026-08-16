// Report fine giornata AI Tour: consuntivo con ordini, km reali (GPS) e durata.
import { supabase } from '../supabase';
import { haversineKm } from './types';

export interface TourReport {
  ordersCount: number;
  ordersTotal: number;
  km: number | null;
  kmSource: 'gps' | 'planned' | null;
  trackPoints: number;
  durationMin: number | null;
  ongoing: boolean;
}

// Percorso reale dell'agente nel periodo del tour (tabella GPS condivisa, RLS: own/admin)
export async function loadTourTrack(agentId: string, fromIso: string, toIso: string | null): Promise<[number, number][]> {
  const to = toIso || new Date().toISOString();
  const { data, error } = await supabase
    .from('app_4d4e73c9f0_gps_tracking')
    .select('latitude, longitude, created_at')
    .eq('user_id', agentId)
    .gte('created_at', fromIso)
    .lte('created_at', to)
    .order('created_at', { ascending: true })
    .limit(2000);
  if (error) {
    console.warn('[AITour][report] loadTourTrack:', error);
    return [];
  }
  const pts: [number, number][] = [];
  for (const r of data || []) {
    const lat = Number(r.latitude);
    const lng = Number(r.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
    // Scarta glitch GPS: salto > 30 km dal punto precedente
    if (pts.length > 0 && haversineKm(pts[pts.length - 1][0], pts[pts.length - 1][1], lat, lng) > 30) continue;
    pts.push([lat, lng]);
  }
  return pts;
}

export function trackKm(track: [number, number][]): number {
  let km = 0;
  for (let i = 1; i < track.length; i++) km += haversineKm(track[i - 1][0], track[i - 1][1], track[i][0], track[i][1]);
  return km;
}

export async function buildTourReport(tourId: string, track?: [number, number][]): Promise<TourReport | null> {
  const { data: tour, error } = await supabase
    .from('ai_tours')
    .select('id, agent_id, status, actual_start, actual_end, planned_distance_km')
    .eq('id', tourId)
    .single();
  if (error || !tour) {
    console.warn('[AITour][report] buildTourReport:', error);
    return null;
  }
  const from = tour.actual_start as string | null;
  const to = (tour.actual_end as string | null) || new Date().toISOString();
  const ongoing = tour.status === 'active';

  let ordersCount = 0;
  let ordersTotal = 0;
  if (from) {
    const { data: orders, error: ordErr } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('agent_id', tour.agent_id)
      .neq('status', 'cancelled')
      .gte('created_at', from)
      .lte('created_at', to);
    if (ordErr) console.warn('[AITour][report] orders:', ordErr);
    for (const o of orders || []) {
      ordersCount += 1;
      ordersTotal += Number(o.total_amount || 0);
    }
  }

  const pts = track ?? (from ? await loadTourTrack(tour.agent_id, from, tour.actual_end as string | null) : []);
  const gpsKm = trackKm(pts);
  let km: number | null = null;
  let kmSource: 'gps' | 'planned' | null = null;
  if (pts.length >= 5 && gpsKm >= 0.3) {
    km = Math.round(gpsKm * 10) / 10;
    kmSource = 'gps';
  } else if (tour.planned_distance_km != null) {
    km = Number(tour.planned_distance_km);
    kmSource = 'planned';
  }

  const durationMin = from ? Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000)) : null;
  return { ordersCount, ordersTotal, km, kmSource, trackPoints: pts.length, durationMin, ongoing };
}
