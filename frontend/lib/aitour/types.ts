// Tipi condivisi AI Tour (Fase 1: pianificazione)

export type EntityType = 'client' | 'prospect' | 'orphan' | 'free' | 'never';
export type DayType = 'clienti' | 'sviluppo' | 'mista' | 'ai';
export type PriorityClass = 'Urgente' | 'Alta' | 'Media' | 'Bassa';

export interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
}

export interface TourCandidate {
  key: string;
  entityType: EntityType;
  customerId: string | null;
  // Solo mobile: customer id di un orfano di altro agente, usato esclusivamente
  // per il modale storico ordini del badge Orfano (non abilita visite/appuntamenti CRM)
  historyCustomerId?: string | null;
  tabaccheriaId: string | null;
  name: string;
  address: string;
  city: string;
  province: string;
  lat: number;
  lng: number;
  lastVisitDate: string | null;
  lastOrderDate: string | null;
  orderCount: number;
  totalRevenue: number;
  revenue6m: number;
  avgOrderValue: number;
  avgReorderDays: number | null;
  daysSinceOrder: number | null;
  /** Ultimo ordine telefonico/remoto (order_channel='remoto') e relativo importo */
  lastRemoteOrderDate?: string | null;
  lastRemoteOrderAmount?: number | null;
  daysSinceVisit: number | null;
  followUpDate: string | null;
  appointmentAt: string | null;
  notes: string | null;
  orphanStatus: 'orphan_a' | 'orphan_b' | null;
  estimatedRevenue: number | null;
  projectType?: string | null;
  projectName?: string | null;
  score: number;
  priorityClass: PriorityClass;
  reason: string;
  nextSuggestedVisit: string | null;
  visitMinutes: number;
  visitLearnedSamples?: number;
  potentialValue: number;
}

export interface PlannedStop {
  candidate: TourCandidate;
  sequence: number;
  arrivalMin: number;
  departureMin: number;
  travelMinFromPrev: number;
  travelKmFromPrev: number;
  mandatory: boolean;
}

export interface TourPlan {
  stops: PlannedStop[];
  geometry: [number, number][];
  start: GeoPoint;
  end: GeoPoint | null;
  tourDate: string;
  startMin: number;
  endMin: number;
  dayType: DayType;
  resolvedDayType: Exclude<DayType, 'ai'>;
  areaLabel: string;
  totalKm: number;
  driveMin: number;
  visitMin: number;
  bufferMin: number;
  returnMin: number;
  returnKm: number;
  finishMin: number;
  potentialValue: number;
  avgScore: number;
  excluded: { candidate: TourCandidate; why: string }[];
  aiSummary: string;
  aiRecommendation: string | null;
  warnings: string[];
  routingFallback: boolean;
}

export interface AiTourSettings {
  agent_id?: string;
  work_start: string;
  work_end: string;
  visit_minutes_client: number;
  visit_minutes_prospect: number;
  visit_minutes_orphan: number;
  buffer_pct_clienti: number;
  buffer_pct_sviluppo: number;
  buffer_pct_mista: number;
  buffer_max_min: number;
  cadence_weeks_active: number;
  cadence_weeks_low: number;
  home_address: string | null;
  home_lat: number | null;
  home_lng: number | null;
  office_address: string | null;
  office_lat: number | null;
  office_lng: number | null;
}

export const DEFAULT_SETTINGS: AiTourSettings = {
  work_start: '08:00',
  work_end: '18:00',
  visit_minutes_client: 20,
  visit_minutes_prospect: 25,
  visit_minutes_orphan: 25,
  buffer_pct_clienti: 18,
  buffer_pct_sviluppo: 35,
  buffer_pct_mista: 25,
  buffer_max_min: 60,
  cadence_weeks_active: 5,
  cadence_weeks_low: 8,
  home_address: null,
  home_lat: null,
  home_lng: null,
  office_address: null,
  office_lat: null,
  office_lng: null,
};

export const ENTITY_LABELS: Record<EntityType, string> = {
  client: 'Cliente',
  prospect: 'Prospect',
  orphan: 'Orfano',
  free: 'Da acquisire',
  never: 'Mai visitata',
};

export const ENTITY_COLORS: Record<EntityType, string> = {
  client: '#2563eb',
  prospect: '#059669',
  orphan: '#7c3aed',
  free: '#0d9488',
  never: '#db2777',
};

export function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minToTime(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function fmtDur(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export function fmtEur(v: number): string {
  return v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

export function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr).getTime();
  if (Number.isNaN(d)) return null;
  return Math.floor((Date.now() - d) / 86400000);
}

export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
