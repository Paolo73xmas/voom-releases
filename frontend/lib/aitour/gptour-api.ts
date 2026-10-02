import { supabase } from '../supabase';
import type { TourCandidate } from './types';
import type { TourIntent } from './gptour-intent';
import { sanitizeIntentPatch } from './gptour-intent';
import { assertEffectiveAgent, resolveGptourAgent } from './gptour-auth';

export interface GptMessage { role: 'user' | 'assistant'; content: string }
export interface GptDay { day: number; tourDate: string | null; area: string | null; startTime: string | null; endTime: string | null; selection: { key: string; reason: string | null }[] }
export interface GptResult {
  reply: string; needsInfo: boolean; multiDay: boolean; lodging: 'home' | 'away' | null;
  tourDate: string | null; startTime: string | null; endTime: string | null;
  selection: GptDay['selection']; days: GptDay[]; notes: string | null;
  intent?: Partial<TourIntent>; intentReset?: boolean; orderImposed?: boolean;
  corridor?: { suggest: boolean; destinationLabel?: string | null };
  followUpActions?: { action: 'keep' | 'exclude' | 'reschedule'; followUpId: string; key: string; currentDate: string; newDate?: string | null; newTime?: string | null; newDateExpr?: string | null }[];
}
const clean = (v: unknown) => String(v ?? '').replace(/[\t\n\r]/g, ' ').trim();
export function candidatesToTsv(pool: TourCandidate[]): string {
  return ['key\tnome\tcomune\tprov\ttipo\tprogetto\tggUltimoOrdine\tggUltimaVisita\tggContattoFisico\tordini\tfat6m\torfano\torfanoMio\tfollowUp\tappuntamento\tlat\tlng',
    ...pool.map((c) => [c.key, c.crmName || c.name, c.city, c.province, c.entityType, c.projectName || c.projectType,
      c.daysSinceOrder, c.daysSinceVisit, c.daysSincePhysicalContact, c.orderCount,
      c.gptourData?.revenueKnown === false ? '' : Math.round(c.revenue6m), c.orphanStatus,
      c.entityType === 'orphan' ? Number(c.isOwnOrphan === true) : '', c.followUpDate?.slice(0, 10), c.appointmentAt?.slice(0, 10), c.lat, c.lng].map(clean).join('\t'))].join('\n');
}
export interface GptRequest {
  agentId: string; role: string; messages: GptMessage[]; pool: TourCandidate[];
  intent: TourIntent; agentInfo: Record<string, unknown>;
  currentTour?: unknown[]; followUps?: unknown; corridorProposal?: unknown[];
}
export function validateGptourResult(data: Record<string, unknown>): void {
  const time = (v: unknown) => v == null || (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v));
  const date = (v: unknown) => v == null || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v));
  const selection = (v: unknown) => Array.isArray(v) && v.every((s) => s && typeof s.key === 'string' && (s.reason == null || typeof s.reason === 'string'));
  if (typeof data.reply !== 'string' || typeof data.needsInfo !== 'boolean' || typeof data.multiDay !== 'boolean' ||
    !selection(data.selection) || !Array.isArray(data.days) || !time(data.startTime) || !time(data.endTime) || !date(data.tourDate) ||
    (data.lodging != null && data.lodging !== 'home' && data.lodging !== 'away') ||
    data.days.some((d) => !d || !selection(d.selection) || !time(d.startTime) || !time(d.endTime) || !date(d.tourDate)))
    throw new Error('Risposta GPTour incompleta o non valida. Il piano precedente è rimasto invariato.');
  if (data.followUpActions != null && (!Array.isArray(data.followUpActions) || data.followUpActions.some((a) => !a || typeof a.followUpId !== 'string' || !['keep', 'exclude', 'reschedule'].includes(a.action))))
    throw new Error('Decisioni follow-up non valide. Nessuna modifica effettuata.');
}
export async function runGptour(input: GptRequest, client = supabase): Promise<GptResult> {
  const { data: auth, error: authError } = await client.auth.getSession();
  if (authError || !auth.session) throw new Error('Sessione scaduta. Accedi nuovamente.');
  const uid = auth.session.user.id;
  const agentId = resolveGptourAgent(input.role, uid, input.agentId);
  const { data, error } = await client.functions.invoke('ai-tour-gptour', {
    headers: { Authorization: `Bearer ${auth.session.access_token}` },
    body: { messages: input.messages, candidatesText: candidatesToTsv(input.pool), count: input.pool.length,
      agentInfo: { ...input.agentInfo, agentId }, intent: input.intent,
      currentTour: input.currentTour || null, followUps: input.followUps || null,
      corridorProposal: input.corridorProposal || null },
  });
  if (error) {
    const status = error.context?.status;
    if (status === 403) throw new Error('Non sei autorizzato a creare questo giro (403). Il piano precedente è rimasto invariato.');
    if (status === 401) throw new Error('Sessione scaduta. Accedi nuovamente.');
    // La Edge Function inoltra l'errore del provider AI: il credito esaurito va detto chiaramente, non come guasto generico.
    let detail = '';
    try { detail = typeof error.context?.text === 'function' ? await error.context.text() : ''; } catch { detail = ''; }
    if (/insufficient_quota|credit_balance_exhausted|no credits remaining/i.test(detail)) throw new Error('GPTour è fermo: il credito OpenAI dell’assistente è esaurito. Ricarica il credito su platform.openai.com (billing) e riprova: conversazione e piano restano invariati.');
    if (/AI API error 429|rate limit/i.test(detail)) throw new Error('L’assistente AI è momentaneamente saturo (429). Riprova tra qualche istante: conversazione e piano restano invariati.');
    throw new Error('GPTour non è temporaneamente disponibile. Riprova: conversazione e piano restano invariati.');
  }
  assertEffectiveAgent(agentId, data?.effectiveAgentId);
  const current = await client.auth.getSession();
  if (current.data.session?.user.id !== uid) throw new Error('Account cambiato: risposta GPTour ignorata.');
  validateGptourResult(data);
  return { ...data, intentReset: data.intentReset === true, orderImposed: data.orderImposed === true, intent: sanitizeIntentPatch(data.intent) } as GptResult;
}