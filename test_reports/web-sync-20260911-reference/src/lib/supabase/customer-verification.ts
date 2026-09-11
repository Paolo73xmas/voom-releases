/**
 * Customer Verification System - AI Tour
 * 
 * Gestisce le segnalazioni di anomalie clienti durante i tour:
 * - Creazione segnalazioni da parte degli agenti
 * - Verifica e gestione da parte dello staff
 * - Statistiche e storico
 */

import { supabase } from './client';

// ============================================================
// TYPES
// ============================================================

export type AnomalyType = 'geolocation' | 'closed' | 'moved' | 'other';
export type VerificationStatus = 'pending' | 'verified_ok' | 'updated' | 'disabled';

export interface CustomerVerificationRequest {
  id: string;
  customer_id: string | null;
  tabaccheria_id: string | null;
  subject_name: string | null;
  reported_by_agent_id: string;
  reported_at: string;
  anomaly_type: AnomalyType;
  notes: string | null;
  agent_gps_lat: number | null;
  agent_gps_lng: number | null;
  customer_gps_lat: number | null;
  customer_gps_lng: number | null;
  distance_km: number | null;
  status: VerificationStatus;
  verified_at: string | null;
  verified_by_user_id: string | null;
  verification_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VerificationRequestWithDetails extends CustomerVerificationRequest {
  customer: {
    id: string;
    business_name: string;
    vat_number: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    latitude: number | null;
    longitude: number | null;
    disabled: boolean;
  } | null;
  tabaccheria: {
    id: string;
    denominazione: string | null;
    codice_rivendita: string | null;
    partita_iva: string | null;
    indirizzo: string | null;
    comune: string | null;
    provincia: string | null;
    gps_lat: string | null;
    gps_lng: string | null;
    telefono_mobile: string | null;
    telefono_fisso: string | null;
    email: string | null;
    chiusa: boolean;
  } | null;
  agent: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  verifier: {
    id: string;
    full_name: string;
  } | null;
  multiple_reports_count?: number;
}

export interface CreateVerificationRequestParams {
  customer_id?: string | null;
  tabaccheria_id?: string | null;
  subject_name?: string | null;
  anomaly_type: AnomalyType;
  notes?: string;
  agent_gps: { lat: number; lng: number } | null;
  customer_gps: { lat: number; lng: number } | null;
}

export interface VerificationFilters {
  agentId?: string;
  anomalyType?: AnomalyType;
  dateFrom?: string;
  dateTo?: string;
  searchQuery?: string;
  multipleOnly?: boolean;
  status?: VerificationStatus;
}

export interface VerificationStats {
  total_requests: number;
  pending_requests: number;
  verified_ok: number;
  updated: number;
  disabled: number;
  by_anomaly_type: Array<{ type: AnomalyType; count: number }>;
  by_agent: Array<{ agent_id: string; agent_name: string; count: number }>;
  avg_verification_time_hours: number;
  trend_vs_previous: number; // percentuale variazione rispetto al periodo precedente
}

export interface CustomerVisit {
  id: string;
  visit_date: string;
  agent_id: string;
  agent_name: string;
  visit_type: string;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
}

// ============================================================
// UTILITY - Calcolo distanza Haversine
// ============================================================

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Raggio Terra in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================
// CREATE - Creazione segnalazione
// ============================================================

export async function createVerificationRequest(
  params: CreateVerificationRequestParams
): Promise<{ data: CustomerVerificationRequest | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Utente non autenticato');

    // Calcola distanza se entrambe le posizioni sono disponibili
    let distance_km: number | null = null;
    if (
      params.agent_gps &&
      params.customer_gps &&
      params.agent_gps.lat &&
      params.agent_gps.lng &&
      params.customer_gps.lat &&
      params.customer_gps.lng
    ) {
      distance_km = haversineDistance(
        params.agent_gps.lat,
        params.agent_gps.lng,
        params.customer_gps.lat,
        params.customer_gps.lng
      );
      distance_km = Math.round(distance_km * 100) / 100; // 2 decimali
    }

    const { data, error } = await supabase
      .from('customer_verification_requests')
      .insert({
        customer_id: params.customer_id || null,
        tabaccheria_id: params.tabaccheria_id || null,
        subject_name: params.subject_name || null,
        reported_by_agent_id: user.id,
        anomaly_type: params.anomaly_type,
        notes: params.notes || null,
        agent_gps_lat: params.agent_gps?.lat || null,
        agent_gps_lng: params.agent_gps?.lng || null,
        customer_gps_lat: params.customer_gps?.lat || null,
        customer_gps_lng: params.customer_gps?.lng || null,
        distance_km,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('[createVerificationRequest] Error:', error);
    return { data: null, error: error as Error };
  }
}

// ============================================================
// READ - Lista segnalazioni con filtri
// ============================================================

export async function getVerificationRequests(
  filters: VerificationFilters = {}
): Promise<{ data: VerificationRequestWithDetails[]; error: Error | null }> {
  try {
    let query = supabase
      .from('customer_verification_requests')
      .select(`
        *,
        customer:customers!customer_verification_requests_customer_id_fkey (
          id,
          business_name,
          vat_number,
          address,
          city,
          province,
          latitude,
          longitude,
          disabled
        ),
        agent:profiles!customer_verification_requests_reported_by_agent_id_fkey (
          id,
          full_name,
          email
        ),
        tabaccheria:tabaccherie!customer_verification_requests_tabaccheria_id_fkey (
          id,
          denominazione,
          codice_rivendita,
          partita_iva,
          indirizzo,
          comune,
          provincia,
          gps_lat,
          gps_lng,
          telefono_mobile,
          telefono_fisso,
          email,
          chiusa
        ),
        verifier:profiles!customer_verification_requests_verified_by_user_id_fkey (
          id,
          full_name
        )
      `)
      .order('reported_at', { ascending: false });

    // Applica filtri
    if (filters.agentId) {
      query = query.eq('reported_by_agent_id', filters.agentId);
    }
    if (filters.anomalyType) {
      query = query.eq('anomaly_type', filters.anomalyType);
    }
    if (filters.dateFrom) {
      query = query.gte('reported_at', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('reported_at', filters.dateTo);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;

    let results = data as VerificationRequestWithDetails[];

    // Filtro ricerca nome cliente
    if (filters.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      results = results.filter(
        (r) =>
          r.customer?.business_name?.toLowerCase().includes(searchLower) ||
          r.customer?.vat_number?.toLowerCase().includes(searchLower) ||
          r.subject_name?.toLowerCase().includes(searchLower)
      );
    }

    // Calcola conteggio segnalazioni multiple per cliente
    const customerIds = [...new Set(results.map((r) => r.customer_id).filter((id): id is string => !!id))];
    if (customerIds.length > 0) {
      const { data: counts } = await supabase
        .from('customer_verification_requests')
        .select('customer_id')
        .in('customer_id', customerIds);

      const countMap = new Map<string, number>();
      counts?.forEach((c) => {
        if (!c.customer_id) return;
        countMap.set(c.customer_id, (countMap.get(c.customer_id) || 0) + 1);
      });

      results = results.map((r) => ({
        ...r,
        multiple_reports_count: r.customer_id ? countMap.get(r.customer_id) || 1 : 1,
      }));
    }

    // Filtro solo multiple
    if (filters.multipleOnly) {
      results = results.filter((r) => (r.multiple_reports_count || 0) > 1);
    }

    return { data: results, error: null };
  } catch (error) {
    console.error('[getVerificationRequests] Error:', error);
    return { data: [], error: error as Error };
  }
}

// ============================================================
// READ - Statistiche verifiche
// ============================================================

export async function getVerificationStats(
  period: 'month' | '3months' | 'year' = 'month'
): Promise<{ data: VerificationStats | null; error: Error | null }> {
  try {
    const now = new Date();
    const periodMap = {
      month: 30,
      '3months': 90,
      year: 365,
    };
    const days = periodMap[period];
    const dateFrom = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
    const previousDateFrom = new Date(now.getTime() - 2 * days * 24 * 60 * 60 * 1000).toISOString();

    // Query periodo corrente
    const { data: current, error: currentError } = await supabase
      .from('customer_verification_requests')
      .select('*, agent:profiles!customer_verification_requests_reported_by_agent_id_fkey(full_name)')
      .gte('reported_at', dateFrom);

    if (currentError) throw currentError;

    // Query periodo precedente (per trend)
    const { data: previous, error: prevError } = await supabase
      .from('customer_verification_requests')
      .select('id')
      .gte('reported_at', previousDateFrom)
      .lt('reported_at', dateFrom);

    if (prevError) throw prevError;

    // Calcola statistiche
    const total_requests = current?.length || 0;
    const pending_requests = current?.filter((r) => r.status === 'pending').length || 0;
    const verified_ok = current?.filter((r) => r.status === 'verified_ok').length || 0;
    const updated = current?.filter((r) => r.status === 'updated').length || 0;
    const disabled = current?.filter((r) => r.status === 'disabled').length || 0;

    // Per tipo anomalia
    const byType = new Map<AnomalyType, number>();
    current?.forEach((r) => {
      byType.set(r.anomaly_type, (byType.get(r.anomaly_type) || 0) + 1);
    });
    const by_anomaly_type = Array.from(byType.entries()).map(([type, count]) => ({
      type,
      count,
    }));

    // Per agente (top 3)
    const byAgent = new Map<string, { id: string; name: string; count: number }>();
    current?.forEach((r) => {
      const agentId = r.reported_by_agent_id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const agentName = (r as any).agent?.full_name || 'Sconosciuto';
      if (!byAgent.has(agentId)) {
        byAgent.set(agentId, { id: agentId, name: agentName, count: 0 });
      }
      byAgent.get(agentId)!.count++;
    });
    const by_agent = Array.from(byAgent.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((a) => ({ agent_id: a.id, agent_name: a.name, count: a.count }));

    // Tempo medio verifica (in ore)
    const verified = current?.filter((r) => r.verified_at) || [];
    let avg_verification_time_hours = 0;
    if (verified.length > 0) {
      const totalHours = verified.reduce((sum, r) => {
        const reported = new Date(r.reported_at).getTime();
        const verifiedAt = new Date(r.verified_at!).getTime();
        return sum + (verifiedAt - reported) / (1000 * 60 * 60);
      }, 0);
      avg_verification_time_hours = Math.round((totalHours / verified.length) * 10) / 10;
    }

    // Trend vs periodo precedente
    const previousCount = previous?.length || 0;
    let trend_vs_previous = 0;
    if (previousCount > 0) {
      trend_vs_previous = Math.round(((total_requests - previousCount) / previousCount) * 100);
    } else if (total_requests > 0) {
      trend_vs_previous = 100;
    }

    const stats: VerificationStats = {
      total_requests,
      pending_requests,
      verified_ok,
      updated,
      disabled,
      by_anomaly_type,
      by_agent,
      avg_verification_time_hours,
      trend_vs_previous,
    };

    return { data: stats, error: null };
  } catch (error) {
    console.error('[getVerificationStats] Error:', error);
    return { data: null, error: error as Error };
  }
}

// ============================================================
// UPDATE - Registro tabaccherie (soggetti senza scheda cliente)
// ============================================================

export interface TabaccheriaAnagraficaUpdate {
  denominazione: string;
  partita_iva: string | null;
  indirizzo: string | null;
  comune: string | null;
  provincia: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
}

export async function updateTabaccheriaAnagrafica(
  tabaccheriaId: string,
  values: TabaccheriaAnagraficaUpdate
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('tabaccherie')
    .update({
      denominazione: values.denominazione,
      partita_iva: values.partita_iva,
      indirizzo: values.indirizzo,
      comune: values.comune,
      provincia: values.provincia,
      gps_lat: values.gps_lat !== null ? String(values.gps_lat) : null,
      gps_lng: values.gps_lng !== null ? String(values.gps_lng) : null,
    })
    .eq('id', tabaccheriaId);
  return { error: error as Error | null };
}

export async function closeTabaccheria(
  tabaccheriaId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('tabaccherie')
    .update({ chiusa: true, chiusa_at: new Date().toISOString() })
    .eq('id', tabaccheriaId);
  return { error: error as Error | null };
}

// ============================================================
// UPDATE - Verifica cliente
// ============================================================

export async function verifyCustomer(
  requestId: string,
  status: VerificationStatus,
  verificationNotes?: string
): Promise<{ data: CustomerVerificationRequest | null; error: Error | null }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Utente non autenticato');

    const { data, error } = await supabase
      .from('customer_verification_requests')
      .update({
        status,
        verified_at: new Date().toISOString(),
        verified_by_user_id: user.id,
        verification_notes: verificationNotes || null,
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;

    // Se il cliente è stato disabilitato, aggiorna la tabella customers
    if (status === 'disabled' && data?.customer_id) {
      await supabase
        .from('customers')
        .update({ disabled: true })
        .eq('id', data.customer_id);
    }

    return { data, error: null };
  } catch (error) {
    console.error('[verifyCustomer] Error:', error);
    return { data: null, error: error as Error };
  }
}

// ============================================================
// READ - Storico visite cliente
// ============================================================

export async function getCustomerVisitHistory(
  customerId: string,
  limit = 10
): Promise<{ data: CustomerVisit[]; error: Error | null }> {
  try {
    const { data: visitRows, error: tourError } = await supabase
      .from('visits')
      .select(`
        id,
        visit_date,
        visit_type,
        notes,
        latitude,
        longitude,
        agent_id,
        agent:profiles!visits_agent_id_fkey (
          id,
          full_name
        )
      `)
      .eq('customer_id', customerId)
      .order('visit_date', { ascending: false })
      .limit(limit);

    if (tourError) throw tourError;

    const visits: CustomerVisit[] = (visitRows || []).map((v) => ({
      id: v.id,
      visit_date: v.visit_date,
      agent_id: v.agent_id || '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      agent_name: (v as any).agent?.full_name || 'Sconosciuto',
      visit_type: v.visit_type || 'Visita',
      notes: v.notes,
      latitude: v.latitude,
      longitude: v.longitude,
    }));

    return { data: visits, error: null };
  } catch (error) {
    console.error('[getCustomerVisitHistory] Error:', error);
    return { data: [], error: error as Error };
  }
}

// ============================================================
// READ - Conteggio segnalazioni multiple
// ============================================================

export async function getMultipleReportsCount(
  customerId: string
): Promise<{ data: number; error: Error | null }> {
  try {
    const { count, error } = await supabase
      .from('customer_verification_requests')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', customerId);

    if (error) throw error;
    return { data: count || 0, error: null };
  } catch (error) {
    console.error('[getMultipleReportsCount] Error:', error);
    return { data: 0, error: error as Error };
  }
}

// ============================================================
// UTILITY - Notifica agente verifica completata
// ============================================================

export async function notifyAgentVerificationComplete(
  requestId: string,
  outcome: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    // Recupera dettagli segnalazione
    const { data: request, error: reqError } = await supabase
      .from('customer_verification_requests')
      .select(`
        *,
        customer:customers!customer_verification_requests_customer_id_fkey (business_name)
      `)
      .eq('id', requestId)
      .single();

    if (reqError) throw reqError;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customerName = (request as any).customer?.business_name || request.subject_name || 'Cliente';

    // Crea notifica (usa il sistema notifiche esistente se disponibile)
    // Altrimenti registra in una tabella notifications
    const message = `Cliente "${customerName}" verificato: ${outcome}`;

    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: request.reported_by_agent_id,
      title: 'Verifica Cliente Completata',
      message,
      notification_type: 'verification_complete',
      related_entity_type: 'customer_verification_request',
      related_entity_id: requestId,
      is_read: false,
    });

    // Se la tabella notifications non esiste, ignora l'errore
    if (notifError && !notifError.message.includes('does not exist')) {
      console.warn('[notifyAgentVerificationComplete] Notification error:', notifError);
    }

    return { success: true, error: null };
  } catch (error) {
    console.error('[notifyAgentVerificationComplete] Error:', error);
    return { success: false, error: error as Error };
  }
}

// ============================================================
// UTILITY - Label tipo anomalia
// ============================================================

export function getAnomalyTypeLabel(type: AnomalyType): string {
  const labels: Record<AnomalyType, string> = {
    geolocation: 'GPS Errato',
    closed: 'Cliente Chiuso',
    moved: 'Cliente Trasferito',
    other: 'Altro',
  };
  return labels[type] || type;
}

// ============================================================
// UTILITY - Label stato verifica
// ============================================================

export function getVerificationStatusLabel(status: VerificationStatus): string {
  const labels: Record<VerificationStatus, string> = {
    pending: 'Da Verificare',
    verified_ok: 'Verificato OK',
    updated: 'Anagrafica Aggiornata',
    disabled: 'Cliente Disabilitato',
  };
  return labels[status] || status;
}

// ============================================================
// UTILITY - Colore badge tipo anomalia
// ============================================================

export function getAnomalyTypeBadgeColor(type: AnomalyType): string {
  const colors: Record<AnomalyType, string> = {
    geolocation: 'bg-blue-100 text-blue-800 border-blue-300',
    closed: 'bg-red-100 text-red-800 border-red-300',
    moved: 'bg-orange-100 text-orange-800 border-orange-300',
    other: 'bg-gray-100 text-gray-800 border-gray-300',
  };
  return colors[type] || colors.other;
}

// ============================================================
// UTILITY - Colore badge stato
// ============================================================

export function getVerificationStatusBadgeColor(status: VerificationStatus): string {
  const colors: Record<VerificationStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    verified_ok: 'bg-green-100 text-green-800 border-green-300',
    updated: 'bg-blue-100 text-blue-800 border-blue-300',
    disabled: 'bg-red-100 text-red-800 border-red-300',
  };
  return colors[status] || colors.pending;
}
