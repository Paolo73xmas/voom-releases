import { supabase } from '../supabase';
import type { TourCandidate } from './types';
import type { TourIntent, FollowUpDecision } from './gptour-intent';
import { romeDate, romeTime, romeLocalToIso, validDate, todayRome } from './gptour-dates';
import { resolveGptourAgent } from './gptour-auth';

export interface GptEvent {
  id: string; agentId: string; customerId: string | null; key: string; name: string;
  date: string; time: string; type: string; appointmentDate: string; duration: number;
}
export async function loadGptourEvents(agentId: string, dates: string[], pool: TourCandidate[], client = supabase): Promise<GptEvent[]> {
  if (!dates.length) return [];
  const max = [...dates].sort().pop()!;
  const events: GptEvent[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from('appointments').select('id,agent_id,customer_id,appointment_date,appointment_type,status,quick_customer_name,notes')
      .eq('agent_id', agentId).eq('status', 'scheduled').is('completed_at', null)
      .lte('appointment_date', romeLocalToIso(max, '23:59:59')).order('appointment_date').order('id').range(offset, offset + 499);
    if (error) throw new Error('Agenda non disponibile. Riprova: nessun follow-up è stato ignorato.');
    for (const row of data || []) {
      const date = romeDate(row.appointment_date), c = pool.find((x) => x.customerId === row.customer_id);
      if (!dates.includes(date) && !(row.appointment_type === 'follow_up' && date < todayRome())) continue;
      events.push({ id: row.id, agentId: row.agent_id, customerId: row.customer_id, key: c?.key || `client:${row.customer_id || row.id}`,
        name: c?.name || row.quick_customer_name || 'Impegno in agenda', date, time: romeTime(row.appointment_date), type: row.appointment_type || 'appointment', appointmentDate: row.appointment_date, duration: c?.visitMinutes || 30 });
    }
    if (!data || data.length < 500) break;
  }
  return events;
}
export function pendingGptEvents(events: GptEvent[], intent: TourIntent): GptEvent[] {
  return events.filter((e) => e.type === 'follow_up' && !intent.followUpDecisions.some((d) => d.followUpId === e.id && d.currentDate === e.date));
}
export function eventDecision(event: GptEvent, action: 'keep' | 'exclude', currentDate = event.date, currentTime = event.time): FollowUpDecision {
  if (event.type !== 'follow_up') throw new Error('Questo evento è un appuntamento, non un follow-up.');
  return { followUpId: event.id, key: event.key, customerName: event.name, originalDate: event.date, currentDate, currentTime,
    decision: action === 'keep' ? 'required' : 'excluded' };
}
export async function rescheduleGptFollowUp(event: GptEvent, date: string, time: string, context: { role: string; agentId: string; confirmed: boolean }, client = supabase): Promise<{ event: GptEvent; decision: FollowUpDecision }> {
  if (!context.confirmed) throw new Error('Conferma esplicitamente la modifica reale nel CRM.');
  if (!validDate(date) || date < todayRome() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Indica una data futura valida e un orario HH:MM.');
  const session = await client.auth.getSession();
  const id = resolveGptourAgent(context.role, session.data.session?.user.id || '', context.agentId);
  if (event.agentId !== id || event.type !== 'follow_up' || !event.customerId) throw new Error('Follow-up non modificabile per questo agente.');
  // Recheck the actual owner and state immediately before writing, keeping RLS intact.
  const current = await client.from('appointments').select('id,agent_id,customer_id,status,appointment_type,appointment_date').eq('id', event.id).eq('agent_id', id).single();
  if (current.error || current.data?.status !== 'scheduled' || current.data.appointment_type !== 'follow_up' || current.data.customer_id !== event.customerId) throw new Error('Il follow-up è cambiato o non è più disponibile. Ricarica l’agenda.');
  if (current.data.appointment_date !== event.appointmentDate) throw new Error('La data del follow-up è stata modificata da un’altra sessione. Ricarica l’agenda.');
  const { data, error } = await client.rpc('ai_tour_reschedule_follow_up', { p_follow_up_id: event.id, p_customer_id: event.customerId, p_new_date: date, p_new_time: `${time}:00` });
  if (error) throw new Error('Spostamento non confermato dal CRM. Ricarica l’agenda prima di riprovare.');
  if (!data || data.id !== event.id || data.local_date !== date || String(data.local_time).slice(0, 5) !== time) throw new Error('Esito dello spostamento da verificare: nessuna conferma mostrata. Ricarica l’agenda.');
  return { event: { ...event, date, time, appointmentDate: data.appointment_date }, decision: { ...eventDecision(event, 'keep', date, time), decision: 'rescheduled' } };
}
export function followUpContext(events: GptEvent[], intent: TourIntent, dates: string[]) {
  return { pending: pendingGptEvents(events, intent).map((e) => ({ id: e.id, key: e.key, nome: e.name, data: e.date, ora: e.time, giorno: e.date, arretrato: e.date < todayRome() })),
    decided: intent.followUpDecisions.map((d) => ({ id: d.followUpId, key: d.key, nome: d.customerName, data: d.currentDate, decisione: d.decision })), tourDates: dates };
}