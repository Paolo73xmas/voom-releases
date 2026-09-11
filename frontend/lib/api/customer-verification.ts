import { supabase } from '../supabase';
import { haversineKm } from '../aitour/types';

export type AnomalyType = 'geolocation' | 'closed' | 'moved' | 'other';
export interface VerificationPoint { lat: number; lng: number }
export interface VerificationSubject {
  customerId: string | null;
  tabaccheriaId: string | null;
  name: string;
  gps: VerificationPoint | null;
}
export interface VerificationInput {
  subject: VerificationSubject;
  anomalyType: AnomalyType;
  notes: string;
  agentGps: VerificationPoint | null;
}
export interface VerificationReceipt { id: string; reported_by_agent_id: string; status: string }
export const ANOMALY_LABELS: Record<AnomalyType, string> = {
  geolocation: 'GPS errato', closed: 'Attività chiusa', moved: 'Attività trasferita', other: 'Altro',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isVerificationPoint = (p: VerificationPoint | null | undefined): p is VerificationPoint => !!p
  && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180 && !(p.lat === 0 && p.lng === 0);

export async function verificationTimeout<T>(operation: PromiseLike<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve(operation), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })]);
  } finally { if (timer) clearTimeout(timer); }
}

export function buildVerificationPayload(id: string, agentId: string, input: VerificationInput) {
  if (!UUID.test(id) || !UUID.test(agentId)) throw new Error('Identificativo della segnalazione o sessione non valido');
  const customerId = input.subject.customerId?.trim() || null;
  const tabaccheriaId = input.subject.tabaccheriaId?.trim() || null;
  const name = input.subject.name.trim();
  if (customerId && !UUID.test(customerId)) throw new Error('Identificativo cliente non valido');
  if (tabaccheriaId && !UUID.test(tabaccheriaId)) throw new Error('Identificativo tabaccheria non valido');
  if (!customerId && !tabaccheriaId && !name) throw new Error('Seleziona il soggetto da segnalare');
  if (!Object.prototype.hasOwnProperty.call(ANOMALY_LABELS, input.anomalyType)) throw new Error('Seleziona il tipo di anomalia');
  if (input.notes.length > 3000) throw new Error('Le note possono contenere al massimo 3000 caratteri');
  const agent = isVerificationPoint(input.agentGps) ? input.agentGps : null;
  const customer = isVerificationPoint(input.subject.gps) ? input.subject.gps : null;
  return {
    id, customer_id: customerId, tabaccheria_id: tabaccheriaId, subject_name: name || null,
    reported_by_agent_id: agentId, anomaly_type: input.anomalyType, notes: input.notes.trim() || null,
    agent_gps_lat: agent?.lat ?? null, agent_gps_lng: agent?.lng ?? null,
    customer_gps_lat: customer?.lat ?? null, customer_gps_lng: customer?.lng ?? null,
    distance_km: agent && customer ? Math.round(haversineKm(agent.lat, agent.lng, customer.lat, customer.lng) * 100) / 100 : null,
    status: 'pending' as const,
  };
}

function verificationError(error: unknown): Error {
  if (error instanceof Error) return error;
  const detail = (error as { message?: string } | null)?.message;
  return new Error(detail || 'Invio non confermato. I dati sono conservati: riprova.');
}
async function findOwnReceipt(id: string, agentId: string): Promise<VerificationReceipt | null> {
  const { data, error } = await verificationTimeout(supabase.from('customer_verification_requests')
    .select('id,reported_by_agent_id,status').eq('id', id).eq('reported_by_agent_id', agentId).maybeSingle(), 10000, 'Verifica invio non disponibile: riprova con gli stessi dati');
  if (error) throw verificationError(error);
  return data as VerificationReceipt | null;
}

// Stesso id e payload nei retry. Un timeout non prova che il server NON abbia scritto.
export async function submitVerificationRequest(id: string, expectedAgentId: string, input: VerificationInput): Promise<VerificationReceipt> {
  const row = buildVerificationPayload(id, expectedAgentId, input);
  const { data: auth, error: authError } = await verificationTimeout(supabase.auth.getUser(), 12000, 'Sessione non verificabile: controlla la connessione e riprova');
  if (authError || !auth.user || auth.user.id !== expectedAgentId) throw new Error('La sessione è cambiata o è scaduta. Accedi con l’account della segnalazione e riprova.');
  const existing = await findOwnReceipt(id, auth.user.id);
  if (existing) return existing;
  try {
    const { data, error } = await verificationTimeout(supabase.from('customer_verification_requests').insert(row)
      .select('id,reported_by_agent_id,status').single(), 15000, 'Invio non confermato dalla rete. Riprova: non verrà creata una seconda segnalazione.');
    if (error) throw verificationError(error);
    if (!data?.id) throw new Error('Invio non confermato: nessuna ricevuta restituita');
    return data as VerificationReceipt;
  } catch (error) {
    const committed = await findOwnReceipt(id, auth.user.id).catch(() => null);
    if (committed) return committed;
    throw verificationError(error);
  }
}