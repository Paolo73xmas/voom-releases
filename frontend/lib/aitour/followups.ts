// Follow-up e appuntamenti in agenda per una data: avviso consapevole in fase di creazione tour (parità web).
import { supabase } from '../supabase';

export interface PendingFollowUp {
  customerId: string;
  businessName: string;
  city: string | null;
  /** Orario dell'appuntamento (HH:MM) come registrato in agenda */
  time: string;
  type: 'follow_up' | 'appointment';
  reason: string | null;
}

interface ApptRow {
  customer_id: string | null;
  appointment_date: string;
  appointment_type: string | null;
  notes: string | null;
  follow_up_reason: string | null;
  customers: { business_name: string | null; city: string | null } | null;
}

export async function fetchFollowUpsForDate(agentId: string, date: string): Promise<PendingFollowUp[]> {
  const map = await fetchFollowUpsForDates(agentId, [date]);
  return map[date] || [];
}

const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function rowToFollowUp(a: ApptRow): PendingFollowUp {
  return {
    customerId: a.customer_id as string,
    businessName: a.customers?.business_name || 'Cliente',
    city: a.customers?.city || null,
    time: (a.appointment_date || '').slice(11, 16) || '09:00',
    type: a.appointment_type === 'follow_up' ? 'follow_up' : 'appointment',
    reason: a.follow_up_reason || a.notes || null,
  };
}

/** Follow-up in agenda raggruppati per giorno (YYYY-MM-DD) per le date richieste. */
export async function fetchFollowUpsForDates(agentId: string, dates: string[]): Promise<Record<string, PendingFollowUp[]>> {
  const out: Record<string, PendingFollowUp[]> = {};
  if (!agentId || dates.length === 0) return out;
  const sorted = [...dates].sort();
  const after = new Date(`${sorted[sorted.length - 1]}T00:00:00`);
  after.setDate(after.getDate() + 1);
  const { data, error } = await supabase
    .from('appointments')
    .select('customer_id, appointment_date, appointment_type, notes, follow_up_reason, customers(business_name, city)')
    .eq('agent_id', agentId)
    .eq('status', 'scheduled')
    .gte('appointment_date', `${sorted[0]}T00:00:00`)
    .lt('appointment_date', `${fmtDate(after)}T00:00:00`)
    .order('appointment_date');
  if (error) throw error;
  const wanted = new Set(dates);
  for (const a of ((data || []) as unknown) as ApptRow[]) {
    if (!a.customer_id) continue;
    const day = (a.appointment_date || '').slice(0, 10);
    if (!wanted.has(day)) continue;
    const list = out[day] || (out[day] = []);
    if (list.some((o) => o.customerId === a.customer_id)) continue;
    list.push(rowToFollowUp(a));
  }
  return out;
}

export interface OverdueFollowUp extends PendingFollowUp {
  /** Data originale (YYYY-MM-DD) del follow-up mai gestito */
  date: string;
}

/** Follow-up dei giorni passati mai gestiti (ancora 'scheduled'), il più recente per cliente. */
export async function fetchOverdueFollowUps(agentId: string, maxDaysBack = 60): Promise<OverdueFollowUp[]> {
  if (!agentId) return [];
  const from = new Date();
  from.setDate(from.getDate() - maxDaysBack);
  const { data, error } = await supabase
    .from('appointments')
    .select('customer_id, appointment_date, appointment_type, notes, follow_up_reason, customers(business_name, city)')
    .eq('agent_id', agentId)
    .eq('status', 'scheduled')
    .gte('appointment_date', `${fmtDate(from)}T00:00:00`)
    .lt('appointment_date', `${fmtDate(new Date())}T00:00:00`)
    .order('appointment_date', { ascending: false });
  if (error) throw error;
  const out: OverdueFollowUp[] = [];
  for (const a of ((data || []) as unknown) as ApptRow[]) {
    if (!a.customer_id || out.some((o) => o.customerId === a.customer_id)) continue;
    out.push({ ...rowToFollowUp(a), date: (a.appointment_date || '').slice(0, 10) });
  }
  return out;
}
