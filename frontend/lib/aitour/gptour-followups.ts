import { supabase } from '../supabase';
import type { TourCandidate } from './types';
import type { TourIntent, FollowUpDecision } from './gptour-intent';
import { romeDate, romeTime, romeLocalToIso, validDate, todayRome, addDaysIso, isoDow } from './gptour-dates';
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
  const label = { required: 'mantenuto (obbligatorio)', excluded: 'escluso dal giro', rescheduled: 'spostato' } as const;
  return { pending: pendingGptEvents(events, intent).map((e) => ({ id: e.id, key: e.key, nome: e.name, data: e.date, ora: e.time, giorno: formatDateIt(e.date).split(' ')[0], arretrato: e.date < todayRome() })),
    decided: intent.followUpDecisions.map((d) => ({ id: d.followUpId, key: d.key, nome: d.customerName, data: d.currentDate, decisione: label[d.decision] + (d.decision === 'rescheduled' ? ` al ${formatDateIt(d.currentDate)}` : '') })), tourDates: dates };
}

// ─── Parità web (gptour-followups.ts): domanda in chat e risoluzione deterministica delle date ───
const WEEKDAYS_IT = ['', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const MONTHS_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
export function formatDateIt(date: string, withWeekday = true): string {
  const [, m, d] = date.split('-').map(Number);
  const base = `${d} ${MONTHS_IT[m - 1]}`;
  return withWeekday ? `${WEEKDAYS_IT[isoDow(date)]} ${base}` : base;
}
const listNames = (xs: string[]): string => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`;
/** Domanda deterministica sui follow-up non decisi: sostituisce la risposta AI, come nel web. */
export function followUpQuestion(pending: GptEvent[], tourDates: string[], today = todayRome()): string {
  const overdue = pending.filter((e) => e.date < today), inTour = pending.filter((e) => e.date >= today && tourDates.includes(e.date));
  const parts: string[] = [];
  if (inTour.length) {
    const groups = new Map<string, GptEvent[]>();
    for (const e of inTour) groups.set(e.date, [...(groups.get(e.date) || []), e]);
    const entries = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (entries.length === 1) parts.push(`Per ${formatDateIt(entries[0][0])} risultano già ${entries[0][1].length} follow-up programmat${entries[0][1].length === 1 ? 'o' : 'i'}: ${listNames(entries[0][1].map((e) => e.name))}.`);
    else parts.push(`Nel periodo richiesto risultano già ${inTour.length} follow-up programmati:\n` + entries.map(([date, evs]) => `• ${formatDateIt(date)}: ${listNames(evs.map((e) => e.name))}`).join('\n'));
  }
  if (overdue.length) parts.push(`${inTour.length ? 'Inoltre ti' : 'Prima di preparare il giro ti'} segnalo che hai anche ${overdue.length} follow-up arretrat${overdue.length === 1 ? 'o' : 'i'}: ${listNames(overdue.map((e) => `${e.name}, previsto per il ${formatDateIt(e.date, false)}`))}.`);
  parts.push(inTour.length && !overdue.length ? 'Vuoi mantenerli tutti nel giro, inserirne soltanto alcuni oppure rinviarne qualcuno?' : 'Vuoi inserirli nel giro, riprogrammarli oppure lasciarli fuori? Puoi rispondermi qui o usare i pulsanti.');
  return parts.join(' ');
}
const strip = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const WD = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica'];
const NUM: Record<string, number> = { una: 1, uno: 1, un: 1, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7 };
/** Data relativa risolta in modo deterministico (mai dalla sola interpretazione AI); null se non interpretabile. */
export function resolveRelativeDate(exprRaw: string, anchorDate: string, today: string): { date: string | null; time: string | null } | null {
  const expr = strip(exprRaw || '').trim();
  if (!expr) return null;
  const base = anchorDate >= today ? anchorDate : today;
  let time: string | null = null;
  const tm = expr.match(/\balle?\s*(?:ore\s*)?(\d{1,2})(?:[:.](\d{2}))?\b/);
  if (tm) { const h = Number(tm[1]); if (h >= 0 && h <= 23) time = `${String(h).padStart(2, '0')}:${tm[2] || '00'}`; }
  let date: string | null = null;
  const iso = expr.match(/(\d{4})-(\d{2})-(\d{2})/);
  const dmy = expr.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  const dMonth = expr.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS_IT.join('|')})\\b`));
  const rel = expr.match(/\btra\s+(\w+)\s+(giorn[oi]|settiman[ae])\b/);
  const wdIdx = WD.findIndex((w) => new RegExp(`\\b${w}\\b`).test(expr));
  if (iso) date = `${iso[1]}-${iso[2]}-${iso[3]}`;
  else if (dMonth) date = `${today.slice(0, 4)}-${String(MONTHS_IT.indexOf(dMonth[2]) + 1).padStart(2, '0')}-${dMonth[1].padStart(2, '0')}`;
  else if (dmy) { const y = dmy[3] ? (dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3])) : Number(today.slice(0, 4)); date = `${y}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`; }
  else if (/\bdopodomani\b/.test(expr)) date = addDaysIso(today, 2);
  else if (/\bdomani\b/.test(expr)) date = addDaysIso(today, 1);
  else if (/\boggi\b/.test(expr)) date = today;
  else if (rel) { const n = NUM[rel[1]] ?? Number(rel[1]); if (Number.isFinite(n) && n > 0) date = addDaysIso(base, rel[2].startsWith('settiman') ? n * 7 : n); }
  else if (wdIdx >= 0) {
    const target = wdIdx + 1, nextWeek = /\bprossim[oa]\b|settimana prossima/.test(expr);
    let d = nextWeek ? addDaysIso(base, 8 - isoDow(base)) : addDaysIso(base, 1);
    while (isoDow(d) !== target) d = addDaysIso(d, 1);
    date = d;
  }
  if (!date && !time) return null;
  return { date, time };
}
export function resolveRescheduleTarget(a: { newDateExpr?: string | null; newTime?: string | null }, ev: GptEvent, today: string): { date: string; time: string | null } | { error: string } {
  const r = a.newDateExpr ? resolveRelativeDate(a.newDateExpr, ev.date, today) : null;
  const date = r?.date || null;
  if (!date) return { error: `Non ho capito con certezza a quale data spostare il follow-up di ${ev.name} (${formatDateIt(ev.date)}): indicami il giorno esatto (es. "venerdì 9 ottobre")` };
  if (date < today) return { error: `La data ${formatDateIt(date)} per ${ev.name} è nel passato` };
  const time = r?.time || (a.newTime && /^\d{2}:\d{2}$/.test(a.newTime) ? a.newTime : null);
  return { date, time };
}