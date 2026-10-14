// Nucleo dell'orchestratore: stato conversazione, regole, dati, selezione, routing, verifica. Puro TypeScript.
import { CONTRACT_VERSION, ENGINE_VERSION, emptyCriteria } from './contract.ts';
import type { OrchestratorRequest, OrchestratorResponse, Question, NormalizedCriteria, Metrics, ResponseStatus, CommercialGroups } from './contract.ts';
import type { Ports, SessionRecord, Candidate, AgendaEvent, AgentSettings, Locality, Province, AiPatch } from './ports.ts';
import { romeNow, validDate, isoDow, timeToMin, minToTime, formatDateIt, addDaysIso, strip } from './time.ts';
import { interpret } from './interpret.ts';
import { defaultGroups } from './commercial.ts';
import { decideAll } from './agenda.ts';
import { planTour, areaLabel, type PlannerInput } from '../gptour-planner-core/planner.ts';

export interface Subject { uid: string; role: string | null; isAdmin: boolean }
const ADMIN_ROLES = new Set(['admin', 'admincustom']), ALLOWED = new Set(['admin', 'admincustom', 'agent', 'agentcustom']);
export const isAdminRole = (r: string | null | undefined): boolean => !!r && ADMIN_ROLES.has(r);

const newId = (): string => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

export async function handleTurn(req: OrchestratorRequest, subject: Subject, ports: Ports): Promise<OrchestratorResponse> {
  const t0 = Date.now(); const metrics: Metrics = { durationMs: 0, crmQueries: 0, aiCalls: 0, routingCalls: 0 };
  const nowIso = ports.clock.nowIso(); const now = romeNow(nowIso); const today = now.date;
  const base = (session: SessionRecord | null, status: ResponseStatus, message: string, extra: Partial<OrchestratorResponse> = {}): OrchestratorResponse => ({
    status, contractVersion: CONTRACT_VERSION, engineVersion: ENGINE_VERSION, sessionId: req.sessionId, sessionRevision: session?.revision ?? 0, requestId: req.requestId, generatedAt: nowIso,
    message, question: null, criteria: session?.criteria ?? emptyCriteria(), pendingDecisions: [], plan: null, planId: null, conflicts: [],
    dataQuality: { candidatesComplete: false, poolTruncated: false, purchasesVerified: false, registryVerified: false, routingSource: 'none', notes: [] },
    metrics: { ...metrics, durationMs: Date.now() - t0 }, ...extra,
  });

  // --- identità e autorizzazione: mai dal payload ---
  if (!subject.role || !ALLOWED.has(subject.role)) return base(null, 'blocked', 'Ruolo non autorizzato per GPTour.', { errorCode: 'forbidden_role' });
  const requested = req.targetAgentId?.trim() || null;
  let agentId = subject.uid;
  if (requested && requested !== subject.uid) {
    if (!subject.isAdmin) return base(null, 'blocked', 'Un agente può pianificare solo il proprio giro.', { errorCode: 'forbidden_agent' });
    const check = await ports.crm.authorizeAgentAccess(subject.uid, subject.role, requested); metrics.crmQueries++;
    if (!check.ok) return base(null, 'blocked', `Agente non autorizzato: ${check.reason || 'nessuna autorizzazione CRM'}.`, { errorCode: 'forbidden_agent' });
    agentId = requested;
  }

  // --- idempotenza ---
  const cached = await ports.store.getResponse(req.sessionId, req.requestId);
  if (cached) return cached;

  let session = await ports.store.getSession(req.sessionId);
  if (session && session.ownerUid !== subject.uid) return base(null, 'blocked', 'Sessione appartenente a un altro utente.', { errorCode: 'forbidden_session' });
  if (session && session.agentId !== agentId) return base(session, 'blocked', 'La sessione è legata a un altro agente: apri una nuova sessione.', { errorCode: 'agent_mismatch' });
  if (!session) session = { sessionId: req.sessionId, ownerUid: subject.uid, agentId, revision: 0, turn: 0, createdAt: nowIso, updatedAt: nowIso, criteria: emptyCriteria(), pendingQuestion: null, pendingPayload: null, followUpDecisions: [], departure: null, lastPlanId: null, history: [] };
  if (req.expectedRevision !== undefined && req.expectedRevision !== session.revision) return base(session, 'failed', `Revisione non aggiornata (attesa ${session.revision}).`, { errorCode: 'revision_conflict' });

  const finish = async (r: OrchestratorResponse): Promise<OrchestratorResponse> => {
    session!.updatedAt = nowIso; session!.history.push({ role: 'orchestrator', text: r.message, at: nowIso });
    r.sessionRevision = session!.revision; r.criteria = session!.criteria; r.metrics = { ...metrics, durationMs: Date.now() - t0 };
    try { await ports.store.saveSession(session!); } catch (e) {
      if (/revision_conflict/.test(String((e as Error).message))) return base(null, 'failed', 'Un\'altra richiesta ha aggiornato questa sessione nello stesso momento: ripeti l\'ultimo messaggio.', { errorCode: 'revision_conflict', sessionRevision: session!.revision - 1 });
      if (/forbidden_session/.test(String((e as Error).message))) return base(null, 'blocked', 'Identificativo di sessione non disponibile (appartiene a un altro utente): usane uno nuovo.', { errorCode: 'forbidden_session' });
      throw e;
    }
    await ports.store.saveResponse(r); return r;
  };
  const ask = (q: Question, message = q.text, payload: Record<string, unknown> | null = null, conflicts: string[] = []): Promise<OrchestratorResponse> => {
    session!.pendingQuestion = q; session!.pendingPayload = payload;
    return finish(base(session, 'needs_clarification', message, { question: q, pendingDecisions: [q.kind], conflicts }));
  };

  // --- recupero piano: stesso contenuto, nessuna nuova generazione ---
  if (req.action?.type === 'get_plan') {
    const plan = await ports.store.getPlan(req.action.planId);
    if (!plan || plan.sessionId !== session.sessionId) return base(session, 'failed', 'Piano non trovato per questa sessione.', { errorCode: 'plan_not_found' });
    return base(session, plan.verification === 'verified_routing' ? 'ready' : 'planning', 'Piano recuperato.', { plan, planId: plan.planId, dataQuality: { candidatesComplete: true, poolTruncated: false, purchasesVerified: true, registryVerified: true, routingSource: plan.verification === 'verified_routing' ? 'osrm' : 'estimate', notes: ['recupero senza rigenerazione'] } });
  }

  session.turn++; session.revision++;
  if (req.departure) session.departure = { lat: req.departure.lat, lng: req.departure.lng, label: req.departure.label || 'Partenza scelta' };
  else if (req.gps && !session.departure && Number.isFinite(req.gps.accuracyM) && req.gps.accuracyM <= 200) session.departure = { lat: req.gps.lat, lng: req.gps.lng, label: 'Posizione corrente' };
  const c = session.criteria;

  let settings: AgentSettings; try { settings = await ports.crm.loadSettings(agentId); metrics.crmQueries++; }
  catch (e) { return base(session, 'blocked', `Impostazioni AI Tour dell'agente non disponibili con le autorizzazioni correnti (${String((e as Error).message || e).slice(0, 90)}). Nessun piano generato.`, { errorCode: 'agent_settings_unavailable', sessionRevision: session.revision - 1 }); }
  const [localities, provinces] = await Promise.all([ports.crm.listLocalities(agentId), ports.crm.listProvinces()]); metrics.crmQueries += 2;

  // --- applicazione del turno ---
  const pending = session.pendingQuestion;
  if (req.action) applyAction(session, req.action, today);
  session.pendingQuestion = null;
  if (req.message) {
    session.history.push({ role: 'agent', text: req.message, at: nowIso });
    const it = interpret({ message: req.message, criteria: c, localities, provinces, today });
    if (it.reset) { session.criteria = emptyCriteria(); session.followUpDecisions = []; session.lastPlanId = null; }
    const cr = session.criteria;
    const groupsBefore = JSON.stringify(cr.groups);
    let handled = false;
    if (pending) handled = await answerPending(session, pending, it, req.message, today, ports, metrics);
    if (!handled) {
      if (it.groups) cr.groups = it.groups;
      if (it.area) cr.area = it.area;
      if (it.date) { cr.date = it.date; cr.dateAnchorTurn = session.turn; cr.nonWorkingConfirmed = false; }
      if (it.startTime) cr.startTime = it.startTime;
      if (it.endTime) cr.endTime = it.endTime;
      if (it.wantAll !== null) cr.wantAll = it.wantAll;
      if (it.maxDays !== null) { cr.maxDays = it.maxDays; cr.extraDaysApproved = it.maxDays > 1; }
      for (const n of it.excludeNames) { if (!cr.excludedNames.includes(n)) cr.excludedNames.push(n); cr.requiredNames = cr.requiredNames.filter((x) => x !== n); }
      for (const n of it.requireNames) { if (!cr.requiredNames.includes(n)) cr.requiredNames.push(n); cr.excludedNames = cr.excludedNames.filter((x) => x !== n); }
      const useAi = !!ports.ai && (ports.aiMode === 'always' || !it.recognized);
      let aiUnderstood = false;
      if (useAi) {
        metrics.aiCalls++;
        const patch = await ports.ai!.interpret(req.message, { criteria: cr, today, knownLocalities: localities.map((l) => l.name), knownProvinces: provinces, pendingQuestion: pending, history: session.history.slice(-8, -1).map((h) => ({ role: h.role, text: h.text })) });
        if (patch?.usage) { metrics.aiPromptTokens = (metrics.aiPromptTokens || 0) + patch.usage.promptTokens; metrics.aiCompletionTokens = (metrics.aiCompletionTokens || 0) + patch.usage.completionTokens; metrics.aiMs = (metrics.aiMs || 0) + patch.usage.ms; }
        if (!patch) metrics.aiFailures = (metrics.aiFailures || 0) + 1;
        else aiUnderstood = applyAiPatch(cr, patch, it, { message: req.message, today, turn: session.turn, localities, provinces, detGroupsChanged: !!it.groups && JSON.stringify(it.groups) !== groupsBefore });
      }
      if (!it.recognized && !aiUnderstood && !pending) {
        return ask({ id: 'free_text', kind: 'free_text', text: 'Non ho riconosciuto la richiesta. Indica zona (comune o provincia), tipo di clienti e giorno del giro.', options: [] });
      }
    }
  }
  const cr = session.criteria;
  if (cr.startTime && cr.endTime && timeToMin(cr.endTime) <= timeToMin(cr.startTime)) { cr.endTime = null; }

  // --- scala delle decisioni: una domanda alla volta, mai informazioni già confermate ---
  if (cr.groups?.needsDays) return ask({ id: 'inactive_days', kind: 'inactive_days', text: 'Da quanti giorni non devono aver acquistato i clienti da includere?', options: [{ id: '15', label: '15 giorni' }, { id: '30', label: '30 giorni' }, { id: '60', label: '60 giorni' }] });
  if (!cr.area) return ask({ id: 'area', kind: 'area', text: 'In quale zona vuoi fare il giro? Indica un comune (anche più di uno) oppure una provincia.', options: [] });
  if (!cr.date) return ask({ id: 'date', kind: 'date', text: `Quando vuoi effettuare il giro ${areaLabel(cr)}?`, options: [{ id: today, label: `Oggi (${formatDateIt(today)})` }, { id: addDaysIso(today, 1), label: `Domani (${formatDateIt(addDaysIso(today, 1))})` }, { id: 'altro', label: 'Un altro giorno' }] });
  if (cr.date < today) {
    const stale = session.lastPlanId ? 'La bozza si riferisce a una data ormai passata e non è più attuale. ' : '';
    return ask({ id: 'date', kind: session.lastPlanId ? 'stale_draft' : 'date', text: `${stale}Il ${formatDateIt(cr.date)} è già passato: per quale giorno vuoi pianificare?`, options: [{ id: today, label: 'Oggi' }, { id: addDaysIso(today, 1), label: 'Domani' }] });
  }
  if (!settings.workingDays.includes(isoDow(cr.date)) && !cr.nonWorkingConfirmed) {
    return ask({ id: `non_working:${cr.date}`, kind: 'non_working_day', text: `${formatDateIt(cr.date)} non è un giorno lavorativo configurato. Confermi il giro in via eccezionale o preferisci un altro giorno?`, options: [{ id: 'confirm', label: 'Sì, confermo l\'eccezione' }, { id: 'change', label: 'Scegli un altro giorno' }] });
  }
  const workStart = timeToMin(settings.workStart), workEnd = timeToMin(cr.endTime || settings.workEnd);
  let startMin = cr.startTime ? timeToMin(cr.startTime) : workStart;
  if (cr.date === today) {
    const earliest = now.minuteOfDay + settings.prepMinutes;
    if (cr.startTime && timeToMin(cr.startTime) < now.minuteOfDay) return ask({ id: 'past_time', kind: 'past_time', text: `Sono le ${minToTime(now.minuteOfDay)}: la partenza alle ${cr.startTime} è già trascorsa. A che ora vuoi partire?`, options: [{ id: minToTime(Math.ceil(earliest / 15) * 15), label: `Appena possibile (${minToTime(Math.ceil(earliest / 15) * 15)})` }] });
    startMin = Math.max(startMin, earliest);
    if (startMin + 45 > workEnd) return ask({ id: 'day_over', kind: 'day_over', text: `Oggi l'orario di lavoro termina alle ${minToTime(workEnd)} e sono le ${minToTime(now.minuteOfDay)}: non c'è tempo per un giro. Vuoi pianificarlo per domani?`, options: [{ id: addDaysIso(today, 1), label: 'Sì, domani' }, { id: 'altro', label: 'Un altro giorno' }] });
  }
  if (!cr.groups) cr.groups = defaultGroups();

  // --- pianificazione: planner condiviso D3(a) (gptour-planner-core); qui solo traduzione dell'esito in risposta/sessione v7 ---
  const out = await planTour({ agentId, sessionId: session.sessionId, sessionRevision: session.revision, nowIso, today, criteria: cr as PlannerInput['criteria'], settings, followUpDecisions: session.followUpDecisions, departure: session.departure, startMin, workEnd }, { crm: ports.crm, routing: ports.routing, newId }, metrics);
  switch (out.kind) {
    case 'blocked': return base(session, 'blocked', out.message, { errorCode: out.errorCode, sessionRevision: session.revision - 1 });
    case 'ask': return ask(out.question, undefined, out.payload, out.conflicts);
    case 'infeasible': return finish(base(session, 'infeasible', out.message, { conflicts: out.conflicts, dataQuality: out.dataQuality }));
    case 'failed': return base(session, 'failed', out.message, { errorCode: out.errorCode, dataQuality: out.dataQuality, sessionRevision: session.revision - 1 });
    case 'plan': {
      await ports.store.savePlan(out.plan); session.lastPlanId = out.plan.planId;
      return finish(base(session, out.status, out.message, { plan: out.plan, planId: out.plan.planId, dataQuality: out.dataQuality, conflicts: [], pendingDecisions: out.pendingDecisions }));
    }
  }
}

function applyAction(session: SessionRecord, a: NonNullable<OrchestratorRequest['action']>, today: string): void {
  const cr = session.criteria;
  switch (a.type) {
    case 'set_date': if (validDate(a.date)) { cr.date = a.date; cr.dateAnchorTurn = session.turn; cr.nonWorkingConfirmed = false; } break;
    case 'set_start_time': if (/^\d{2}:\d{2}$/.test(a.time)) cr.startTime = a.time; break;
    case 'require_stop': if (!cr.requiredKeys.includes(a.key)) cr.requiredKeys.push(a.key); cr.excludedKeys = cr.excludedKeys.filter((k) => k !== a.key); break;
    case 'exclude_stop': if (!cr.excludedKeys.includes(a.key)) cr.excludedKeys.push(a.key); cr.requiredKeys = cr.requiredKeys.filter((k) => k !== a.key); break;
    case 'follow_up_decision': {
      const ev = (session.pendingPayload?.events as AgendaEvent[] | undefined)?.find((e) => e.id === a.followUpId);
      session.followUpDecisions = session.followUpDecisions.filter((d) => d.followUpId !== a.followUpId);
      session.followUpDecisions.push({ followUpId: a.followUpId, key: ev?.key ?? null, name: ev?.name ?? a.followUpId, date: ev?.date ?? today, time: ev?.time ?? null, decision: a.decision, proposedDate: a.proposedDate ?? null });
      break;
    }
    case 'answer': {
      const q = session.pendingQuestion;
      if (!q) break;
      if (q.kind === 'inactive_days' && cr.groups && Number(a.optionId) > 0) { cr.groups.inactiveDays = Number(a.optionId); cr.groups.needsDays = false; }
      if ((q.kind === 'date' || q.kind === 'stale_draft' || q.kind === 'day_over') && validDate(a.optionId)) { cr.date = a.optionId; cr.dateAnchorTurn = session.turn; cr.nonWorkingConfirmed = false; }
      if (q.kind === 'non_working_day') { if (a.optionId === 'confirm') cr.nonWorkingConfirmed = true; else cr.date = null; }
      if (q.kind === 'past_time' && /^\d{2}:\d{2}$/.test(a.optionId)) cr.startTime = a.optionId;
      if (q.kind === 'follow_ups') { const evs = (session.pendingPayload?.events as AgendaEvent[]) || []; session.followUpDecisions.push(...decideAll(evs, a.optionId === 'include_all' ? 'include' : a.optionId === 'exclude_all' ? 'exclude' : 'propose_reschedule', a.value ?? null)); }
      if (q.kind === 'infeasible') { if (a.optionId === 'split_days') { cr.extraDaysApproved = true; cr.maxDays = Math.max(2, cr.maxDays || 0); } else if (a.optionId === 'reduce') cr.wantAll = false; else if (a.optionId === 'extend' && a.value && /^\d{2}:\d{2}$/.test(a.value)) cr.endTime = a.value; else if (a.optionId === 'change_date') cr.date = null; }
      break;
    }
    case 'reset': session.criteria = emptyCriteria(); session.followUpDecisions = []; session.lastPlanId = null; break;
    default: break;
  }
}

async function answerPending(session: SessionRecord, q: Question, it: ReturnType<typeof interpret>, message: string, today: string, _ports: Ports, _m: Metrics): Promise<boolean> {
  const cr = session.criteria;
  switch (q.kind) {
    case 'inactive_days': if (it.number && cr.groups) { cr.groups.inactiveDays = it.number; cr.groups.needsDays = false; return true; } return false;
    case 'date': case 'stale_draft': case 'day_over': if (it.date) { cr.date = it.date; cr.dateAnchorTurn = session.turn; cr.nonWorkingConfirmed = false; if (it.startTime) cr.startTime = it.startTime; return true; } if (it.yes && q.kind === 'day_over') { cr.date = addDaysIso(today, 1); cr.dateAnchorTurn = session.turn; return true; } return false;
    case 'non_working_day': if (it.yes) { cr.nonWorkingConfirmed = true; return true; } if (it.no) { cr.date = null; return true; } if (it.date) { cr.date = it.date; cr.dateAnchorTurn = session.turn; cr.nonWorkingConfirmed = false; return true; } return false;
    case 'past_time': if (it.startTime) { cr.startTime = it.startTime; return true; } if (/\b(?:appena possibile|subito|adesso|ora)\b/i.test(message)) { cr.startTime = null; return true; } return false;
    case 'follow_ups': {
      const evs = (session.pendingPayload?.events as AgendaEvent[]) || [];
      if (/\b(?:sposta|rimanda|posticipa|riprogramma)/i.test(message)) { session.followUpDecisions.push(...decideAll(evs, 'propose_reschedule', it.date)); return true; }
      if (it.yes || /\b(?:includi|inserisci|mantieni)/i.test(message)) { session.followUpDecisions.push(...decideAll(evs, 'include', null)); return true; }
      if (it.no || /\b(?:escludi|togli|fuori|lascia)/i.test(message)) { session.followUpDecisions.push(...decideAll(evs, 'exclude', null)); return true; }
      return false;
    }
    case 'infeasible': if (it.maxDays !== null && it.maxDays > 1) { cr.maxDays = it.maxDays; cr.extraDaysApproved = true; return true; } if (/\b(?:sottoinsieme|riduci|scegli tu|compatt)/i.test(message)) { cr.wantAll = false; return true; } if (it.date) { cr.date = it.date; cr.dateAnchorTurn = session.turn; return true; } if (it.startTime && /\bfino\b|\bprolung/i.test(message)) { cr.endTime = it.startTime; return true; } return false;
    case 'area': case 'free_text': return false;
    default: return false;
  }
}

export type { Province, Locality, AgentSettings, Candidate };

/** Applica un patch AI SOLO dove il parser deterministico non ha riconosciuto nulla e SOLO se validabile: località/province note,
 *  date non passate, orari validi, gruppi coerenti. L'AI propone, il nucleo decide. Ritorna true se almeno un campo è stato accolto. */
export function applyAiPatch(cr: NormalizedCriteria, p: AiPatch, it: ReturnType<typeof interpret>, ctx: { message: string; today: string; turn: number; localities: Locality[]; provinces: Province[]; detGroupsChanged: boolean }): boolean {
  if (p.unclear) return false;
  let applied = false;
  // Anti-invenzione: numeri (giorni di inattività, giornate) accettati solo se il messaggio contiene davvero una quantità.
  const msg = strip(ctx.message);
  const hasQuantity = /\d|\b(?:un[oa]?|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|quindici|venti|trenta|quaranta|quarantacinque|sessanta|novanta|cento|mese|mesi|settiman[ae])\b/.test(msg);
  const lower = (s: string) => strip(s).replace(/\s+/g, ' ').trim();
  if (!it.area) {
    const known = (p.comuni || []).filter((n) => typeof n === 'string').map((n) => ctx.localities.find((l) => lower(l.name) === lower(n))?.name).filter((x): x is string => !!x);
    const uniq = [...new Set(known)];
    if (uniq.length) { cr.area = { comuni: uniq, provincia: null, exhaustive: cr.area?.exhaustive ?? false }; applied = true; }
    else if (typeof p.provincia === 'string' && p.provincia.trim()) {
      const pv = ctx.provinces.find((x) => lower(x.sigla) === lower(p.provincia!) || lower(x.nome) === lower(p.provincia!));
      if (pv) { cr.area = { comuni: [], provincia: pv.sigla, exhaustive: cr.area?.exhaustive ?? false }; applied = true; }
    }
  }
  if (!it.date && typeof p.date === 'string' && validDate(p.date) && p.date >= ctx.today) { cr.date = p.date; cr.dateAnchorTurn = ctx.turn; cr.nonWorkingConfirmed = false; applied = true; }
  const hhmm = (v: unknown): v is string => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) && timeToMin(v) < 1440;
  if (!it.startTime && hhmm(p.startTime)) { cr.startTime = p.startTime; applied = true; }
  if (!it.endTime && hhmm(p.endTime)) { cr.endTime = p.endTime; applied = true; }
  if (it.wantAll === null && typeof p.wantAll === 'boolean') { cr.wantAll = p.wantAll; applied = true; }
  if (it.maxDays === null && hasQuantity && /giorn/.test(msg) && Number.isInteger(p.maxDays) && (p.maxDays as number) >= 2 && (p.maxDays as number) <= 7) { cr.maxDays = p.maxDays as number; cr.extraDaysApproved = true; applied = true; }
  if (!ctx.detGroupsChanged && p.groups) {
    const g: CommercialGroups = cr.groups ? { ...cr.groups } : { version: 1, existing: false, newPoints: false, ownOnly: false, inactiveDays: null, needsDays: false };
    let touched = false;
    if (typeof p.groups.existing === 'boolean') { g.existing = p.groups.existing; touched = true; }
    if (typeof p.groups.newPoints === 'boolean') { g.newPoints = p.groups.newPoints; touched = true; }
    if (typeof p.groups.ownOnly === 'boolean') { g.ownOnly = p.groups.ownOnly; touched = true; }
    if (hasQuantity && Number.isInteger(p.groups.inactiveDays) && (p.groups.inactiveDays as number) > 0 && (p.groups.inactiveDays as number) <= 3650) { g.inactiveDays = p.groups.inactiveDays as number; g.needsDays = false; g.existing = true; touched = true; }
    else if (p.groups.needsDays === true) { g.inactiveDays = null; g.needsDays = true; g.existing = true; touched = true; }
    if (!g.existing) { g.inactiveDays = null; g.needsDays = false; }
    if (touched && (g.existing || g.newPoints)) { cr.groups = g; applied = true; }
  }
  return applied;
}
