// Applicazione DETERMINISTICA delle operazioni semantiche: validazione valori, risoluzione riferimenti sul catalogo
// del server, consensi solo espliciti. "Atomica" = calcolo puro IN MEMORIA (tutto o niente sul nuovo stato);
// NON garantisce l'atomicità della persistenza su Supabase, che resta da implementare (U2).
import {
  CATEGORIES, CONSENT_KINDS, emptySemanticCriteria, type AreaLocality, type Category, type ConsentKind, type Operation, type QuestionKind,
  type OpName, type SourcedOp, type QuestionOption, type ReferenceCatalog, type PendingQuestion, type Segment, type SemanticCriteria, type StopRef,
} from './contract.ts';
import { addDaysIso, isoDow, strip, validDate } from '../gptour-orchestrator/time.ts';

export interface ApplyContext { today: string; turn: number; catalog: ReferenceCatalog; pending: PendingQuestion | null }
/** consentSource vale SOLO per le operazioni generate dal server (pulsanti/risposte deterministiche), mai per quelle dell'LLM. */
export interface ApplyOptions { consentSource?: 'answer' | 'action' }

/** La citazione deve comparire nel messaggio del turno da cui l'operazione proviene. */
export const evidenceOk = (op: Operation, message: string): boolean => op.evidence.trim().length > 0 && norm(message).includes(norm(op.evidence));
export interface Issue { opIndex: number; kind: QuestionKind; text: string; options: QuestionOption[]; reason: string; consentKind?: ConsentKind }
export interface ApplyOutcome { criteria: SemanticCriteria; applied: Operation[]; issues: Issue[]; invalidated: Array<{ kind: ConsentKind; dates: string[] }> }

/** "Ambito" di un'operazione: serve a capire se un nuovo turno risolve una domanda pendente o la lascia aperta. */
export function slotOf(op: Operation): string {
  if (op.op === 'reset_all') return '*';
  if (isAreaOp(op) || (op.op === 'clear' && op.field === 'area')) return 'area';
  if (['add_segment', 'replace_segments', 'remove_segment'].includes(op.op) || (op.op === 'clear' && ['segments', 'purchase_filter', 'visit_filter'].includes(op.field ?? ''))) return 'segments';
  if (op.op === 'require_stop' || op.op === 'exclude_stop' || (op.op === 'clear' && op.field === 'stops')) return 'stops';
  if (op.op === 'follow_up' || op.op === 'propose_reschedule' || (op.op === 'clear' && op.field === 'follow_ups')) return 'events';
  if (op.op === 'grant_consent' || op.op === 'decline_consent') return `consent:${op.consent}`;
  const f = op.field ?? '';
  return `f:${f.startsWith('revenue') ? 'revenue' : f.startsWith('lodging') ? 'lodging' : f}`;
}

export const norm = (s: string): string => strip(s).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const ORDERING: Category[] = ['client', 'orphan'];
const STOPWORDS = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'di', 'del', 'della', 'dei', 'da', 'dal', 'un', 'una', 'tappa', 'cliente', 'follow', 'up', 'followup', 'quello', 'quella', 'appuntamento', 'con', 'e']);
const WEEKDAYS = ['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato', 'domenica'];
const CONSENT_TEXT: Record<ConsentKind, string> = {
  extra_days: 'distribuire i punti su giornate aggiuntive', non_working_day: 'lavorare in un giorno non lavorativo',
  exceed_end_time: "superare l'orario di fine indicato", outside_territory: 'includere punti fuori dal tuo territorio',
};
const SKIP: QuestionOption = { id: 'skip', label: 'Procedi senza questo elemento' };
const intIn = (v: number | null, lo: number, hi: number): v is number => v !== null && Number.isInteger(v) && v >= lo && v <= hi;
const tokens = (s: string): string[] => norm(s).split(' ').filter((t) => t.length >= 2 && !STOPWORDS.has(t));
const mentionMatches = (mention: string, label: string): boolean => {
  const want = tokens(mention), have = new Set(tokens(label));
  return want.length > 0 && want.every((t) => have.has(t));
};

/** Data attesa da parole relative nella citazione: guardia deterministica contro date errate dell'LLM. */
function dateGuard(evidence: string, date: string, today: string): string | null {
  const e = norm(evidence);
  const rel = /\bdopodomani\b/.test(e) ? 2 : /\bdomani\b/.test(e) ? 1 : /\boggi\b/.test(e) ? 0 : null;
  if (rel !== null && date !== addDaysIso(today, rel)) return `la data ${date} non corrisponde a «${evidence}» (atteso ${addDaysIso(today, rel)})`;
  const wd = WEEKDAYS.findIndex((w) => new RegExp(`\\b${w}\\b`).test(e));
  if (rel === null && wd >= 0 && isoDow(date) !== wd + 1) return `la data ${date} non è un ${WEEKDAYS[wd]}`;
  return null;
}

const AREA_OPS = new Set<OpName>(['add_locality', 'replace_area', 'remove_locality']);
export const isAreaOp = (op: Operation): boolean => AREA_OPS.has(op.op) || (op.op === 'set' && op.field === 'allow_nearby');
const VAGUE = /\b(?:dintorni|hinterland|circondario|vicinanze|paraggi|area metropolitana|zona di|zona del|area di)\b/;
const ADJ = /\b(?:nel|nell|del|dell|in)\s+([a-z]{5,}(?:ese|ano|ino|asco))\b/;

/** Espressione territoriale non precisa nel messaggio ("dintorni", "nel Milanese"): mai tradotta in silenzio in un'area. */
export function vagueTerritory(message: string, catalog: ReferenceCatalog): { phrase: string; base: string | null } | null {
  const m = norm(message);
  const v = m.match(VAGUE);
  if (v) return { phrase: v[0], base: null };
  const a = m.match(ADJ);
  if (!a || catalog.localities.some((l) => norm(l.name) === a[1])) return null;
  const base = [...catalog.provinces.map((p) => p.nome), ...catalog.localities.map((l) => l.name)].find((n) => {
    const w = norm(n).split(' ')[0]; return a[1].startsWith(w.slice(0, Math.max(4, w.length - 1)));
  });
  return base ? { phrase: a[0], base } : null;
}
/** Opzioni deterministiche per un'area incerta: solo comune, comune + limitrofi, intera provincia. */
export function geoOptions(base: string, catalog: ReferenceCatalog, sigla: string | null = null): QuestionOption[] {
  const out: QuestionOption[] = [];
  for (const l of catalog.localities.filter((x) => norm(x.name) === norm(base))) {
    const tag = l.provincia ? ` (${l.provincia})` : '';
    out.push({ id: `geo:comune|${l.name}|${l.provincia ?? ''}`, label: `Solo il comune di ${l.name}${tag}` }, { id: `geo:nearby|${l.name}|${l.provincia ?? ''}`, label: `${l.name}${tag} e comuni limitrofi` });
  }
  const p = catalog.provinces.find((x) => norm(x.nome) === norm(base) || x.sigla === sigla);
  if (p) out.push({ id: `geo:provincia|${p.sigla}`, label: `Tutta la provincia di ${p.nome}` });
  return out;
}

type Resolved<T> = { ok: T } | { ambiguous: Array<{ id: string; label: string; value: T }> } | { unknown: true };

export function resolveProvince(raw: string, catalog: ReferenceCatalog): string | null {
  const n = norm(raw);
  return catalog.provinces.find((p) => norm(p.sigla) === n || norm(p.nome) === n)?.sigla ?? null;
}
export function resolveLocality(mention: string, provincia: string | null, catalog: ReferenceCatalog): Resolved<AreaLocality> {
  const n = norm(mention);
  const sigla = provincia ? resolveProvince(provincia, catalog) : null;
  const pool = sigla ? catalog.localities.filter((l) => l.provincia === sigla) : catalog.localities;
  const exact = pool.filter((l) => norm(l.name) === n);
  const prefix = exact.length ? exact : pool.filter((l) => norm(l.name).startsWith(`${n} `));
  const list = exact.length ? exact : prefix;
  if (list.length === 1 && (exact.length === 1 || n.length >= 4)) return { ok: list[0] };
  if (list.length >= 1) return { ambiguous: list.slice(0, 6).map((l) => ({ id: `loc:${l.name}|${l.provincia ?? ''}`, label: l.provincia ? `${l.name} (${l.provincia})` : l.name, value: l })) };
  return { unknown: true };
}
function resolveRef<T extends { label: string }>(refId: string | null, mention: string | null, items: Array<T & { id: string }>): Resolved<T & { id: string }> {
  if (refId) {
    const it = items.find((x) => x.id === refId);
    if (!it || (mention && !mentionMatches(mention, it.label))) return { unknown: true };
    return { ok: it };
  }
  if (!mention) return { unknown: true };
  const hits = items.filter((x) => mentionMatches(mention, x.label));
  if (hits.length === 1) return { ok: hits[0] };
  if (hits.length > 1) return { ambiguous: hits.slice(0, 6).map((h) => ({ id: `ref:${h.id}`, label: h.label, value: h })) };
  return { unknown: true };
}
const stopItems = (cat: ReferenceCatalog) => cat.stops.map((s) => ({ id: s.key, label: `${s.name} ${s.city}`, name: s.name, city: s.city }));
const eventItems = (cat: ReferenceCatalog) => cat.events.map((e) => ({ ...e, label: e.label }));

function segmentKey(s: Segment): string { return s.allCategories ? '*' : [...s.categories].sort().join(','); }

/** Ogni operazione è validata rispetto alla PROPRIA provenienza: le operazioni dell'LLM contro il messaggio originale del loro turno
 *  (anche se riprese dopo un chiarimento), quelle del server senza citazione ma senza poteri di consenso impliciti. */
export function applyOperations(prev: SemanticCriteria, items: SourcedOp[], ctx: ApplyContext, opts: ApplyOptions = {}): ApplyOutcome {
  const ops = items.map((x) => x.op);
  const vagueCache = new Map<string, ReturnType<typeof vagueTerritory>>();
  let fromLlm = false, msg = '';
  let c = clone(prev);
  const issues: Issue[] = [], applied: Operation[] = [];
  let replacedSegments = false, replacedArea = false, areaQuestioned = false;
  const decided = new Map<string, string>();
  const issue = (i: number, kind: QuestionKind, text: string, reason: string, options: QuestionOption[] = [], consentKind?: ConsentKind) => { issues.push({ opIndex: i, kind, text, options, reason, consentKind }); };

  ops.forEach((op, i) => {
    const src = items[i].source;
    fromLlm = src.kind === 'llm'; msg = fromLlm ? norm((src as { message: string }).message) : '';
    if (fromLlm && !vagueCache.has(msg)) vagueCache.set(msg, vagueTerritory(msg, ctx.catalog));
    const vague = fromLlm ? vagueCache.get(msg)! : null;
    if (fromLlm && !evidenceOk(op, msg)) return issue(i, 'unclear', 'Non sono sicuro di aver capito una parte della richiesta: puoi riformularla?', `citazione non presente nel messaggio: «${op.evidence}»`);
    const before = issues.length;
    if (vague && isAreaOp(op)) {
      if (areaQuestioned) return;
      areaQuestioned = true;
      const base = vague.base ?? op.locality ?? (op.provincia ? ctx.catalog.provinces.find((p) => p.sigla === resolveProvince(op.provincia!, ctx.catalog))?.nome ?? null : null);
      const o = base ? geoOptions(base, ctx.catalog) : [];
      return issue(i, o.length ? 'area_ambiguous' : 'locality_unknown', `«${vague.phrase}» non individua un'area precisa: quale zona intendi?`, 'espressione territoriale ambigua', [...o, SKIP]);
    }
    switch (op.op) {
      case 'reset_all': c = emptySemanticCriteria(); replacedSegments = replacedArea = true; break;
      case 'set': applySet(c, op, i); break;
      case 'clear': applyClear(c, op, i); break;
      case 'add_segment': case 'replace_segments': {
        const seg = buildSegment(op, i); if (!seg) break;
        if (op.op === 'replace_segments' && !replacedSegments) { c.segments = []; replacedSegments = true; }
        const idx = c.segments.findIndex((s) => segmentKey(s) === segmentKey(seg));
        if (idx < 0) c.segments.push(seg);
        else c.segments[idx] = op.op === 'replace_segments' ? seg : {
          ...c.segments[idx],
          minDaysSinceOrder: op.minDaysSinceOrder ?? c.segments[idx].minDaysSinceOrder,
          minDaysSinceVisit: op.minDaysSinceVisit ?? c.segments[idx].minDaysSinceVisit,
          ownOnly: op.ownOnly ?? c.segments[idx].ownOnly,
        };
        break;
      }
      case 'remove_segment': {
        const rm = new Set(op.categories || []);
        if (!rm.size) { issue(i, 'invalid_value', 'Quale tipologia vuoi togliere?', 'remove_segment senza categorie'); break; }
        c.segments = c.segments.map((s) => ({ ...s, allCategories: false, categories: (s.allCategories ? [...CATEGORIES] : s.categories).filter((k) => !rm.has(k)) })).filter((s) => s.categories.length > 0);
        break;
      }
      case 'add_locality': case 'replace_area': case 'remove_locality': applyArea(c, op, i); break;
      case 'require_stop': case 'exclude_stop': {
        const r = resolveRef(op.refId, op.mention, stopItems(ctx.catalog));
        if (!refOk(r, i, 'tappa')) break;
        const s = (r as { ok: { id: string; name: string } }).ok, ref: StopRef = { key: s.id, name: s.name };
        const [add, del] = op.op === 'require_stop' ? ['required', 'excluded'] as const : ['excluded', 'required'] as const;
        c.stops[del] = c.stops[del].filter((x) => x.key !== ref.key);
        if (!c.stops[add].some((x) => x.key === ref.key)) c.stops[add].push(ref);
        break;
      }
      case 'follow_up': {
        if (!op.decision) { issue(i, 'invalid_value', 'Vuoi includere o escludere questo evento?', 'decision mancante'); break; }
        const r = resolveRef(op.refId, op.mention, eventItems(ctx.catalog));
        if (!refOk(r, i, 'evento in agenda')) break;
        const e = (r as { ok: { id: string; label: string } }).ok;
        if (!decide(e.id, op.decision, i, e.label)) break;
        // Ultima decisione prevale: una proposta di spostamento sullo stesso evento è superata e rimossa.
        c.rescheduleProposals = c.rescheduleProposals.filter((p) => p.eventId !== e.id);
        c.followUps = [...c.followUps.filter((f) => f.eventId !== e.id), { eventId: e.id, label: e.label, decision: op.decision }];
        break;
      }
      case 'propose_reschedule': {
        const r = resolveRef(op.refId, op.mention, eventItems(ctx.catalog));
        if (!refOk(r, i, 'evento in agenda')) break;
        const e = (r as { ok: { id: string; label: string; date: string } }).ok;
        if (!op.proposedDate || !validDate(op.proposedDate) || op.proposedDate < ctx.today || op.proposedDate === e.date) { issue(i, 'invalid_value', `In quale data vuoi proporre di spostare «${e.label}»?`, 'data proposta non valida'); break; }
        if (!decide(e.id, `reschedule:${op.proposedDate}`, i, e.label)) break;
        c.followUps = c.followUps.filter((f) => f.eventId !== e.id);
        c.rescheduleProposals = [...c.rescheduleProposals.filter((p) => p.eventId !== e.id), { eventId: e.id, label: e.label, fromDate: e.date, proposedDate: op.proposedDate, status: 'proposed' }];
        break;
      }
      case 'grant_consent': {
        const k = op.consent;
        if (!k || !CONSENT_KINDS.includes(k)) { issue(i, 'invalid_value', 'A quale autorizzazione ti riferisci?', 'consenso non specificato'); break; }
        const asked = ctx.pending?.kind === 'consent' && ctx.pending.consentKind === k ? ctx.pending : null;
        const serverGrant = !fromLlm && !!opts.consentSource;
        if (!serverGrant && !asked) { issue(i, 'consent', `Confermi esplicitamente di voler ${CONSENT_TEXT[k]}?`, 'consenso non richiesto da una domanda esplicita', [{ id: 'yes', label: 'Sì, confermo' }, { id: 'no', label: 'No' }], k); break; }
        if (asked && fromLlm && /^(?:no|non|niente|annulla|lascia)\b/.test(msg)) { issue(i, 'consent', asked.text, 'consenso in un messaggio di diniego', asked.options, k); break; }
        // Accettazione di una PROPOSTA del sistema: il limite diventa quello proposto, mai oltre.
        const days = asked?.proposal?.kind === k ? asked.proposal.days : null;
        let dates: string[] | null = null;
        if (k === 'non_working_day') {
          // Legato alle date ESATTE: quelle della proposta, quelle indicate dal pulsante, altrimenti quelle correnti del giro.
          dates = [...new Set(asked?.proposal?.kind === k && asked.proposal.dates?.length ? asked.proposal.dates : op.dates?.length ? op.dates : c.dates)].sort();
          if (!dates.length || dates.some((d) => !c.dates.includes(d))) { issue(i, 'invalid_value', 'Per quale data del giro autorizzi il giorno non lavorativo?', 'consenso non lavorativo senza data del giro corrispondente'); break; }
        }
        c.consents = [...c.consents.filter((x) => x.kind !== k), { kind: k, source: serverGrant ? opts.consentSource! : 'answer', turn: ctx.turn, detail: days, dates }];
        if (k === 'extra_days' && days) c.maxDays = days;
        break;
      }
      case 'decline_consent': {
        // Rifiuto esplicito di una PROPOSTA pendente dello stesso tipo: nessuna modifica ai criteri, nessun consenso. L'interprete scarta a monte
        // (senza chiudere la domanda) i rifiuti con citazione assente, tipo diverso, senza domanda o in conflitto con grant_consent.
        const k = op.consent;
        if (!k || !(ctx.pending?.kind === 'consent' && ctx.pending.consentKind === k)) { issue(i, 'invalid_value', 'A quale autorizzazione ti riferisci?', 'rifiuto non riferito a una domanda di consenso pendente'); break; }
        break;
      }
      default: issue(i, 'invalid_value', 'Operazione non riconosciuta.', `op sconosciuta ${(op as Operation).op}`);
    }
    if (issues.length === before) applied.push(op);
  });

  if (!issues.length) {
    if (c.startTime && c.endTime && c.endTime <= c.startTime) issue(-1, 'invalid_value', `L'orario di fine (${c.endTime}) è precedente all'inizio (${c.startTime}): quale orario vuoi usare?`, 'finestra oraria incoerente');
    if (c.revenue && c.revenue.min !== null && c.revenue.max !== null && c.revenue.min > c.revenue.max) issue(-1, 'invalid_value', 'Il fatturato minimo supera il massimo: puoi correggere?', 'fatturato incoerente');
    if (c.lodging?.mode === 'conditional' && c.lodging.maxKmHome === null) issue(-1, 'invalid_value', 'Entro quanti km da casa preferisci rientrare la sera?', 'regola pernottamento senza soglia');
  }
  // Consensi legati alle date: se le date del giro cambiano o vengono azzerate, l'autorizzazione non più pertinente decade.
  const invalidated: ApplyOutcome['invalidated'] = [];
  if (!issues.length) {
    c.consents = c.consents.flatMap((x) => {
      if (!x.dates) return [x];
      const keep = x.dates.filter((d) => c.dates.includes(d)), lost = x.dates.filter((d) => !c.dates.includes(d));
      if (lost.length) invalidated.push({ kind: x.kind, dates: lost });
      return keep.length ? [{ ...x, dates: keep }] : [];
    });
  }
  return { criteria: issues.length ? prev : c, applied: issues.length ? [] : applied, issues, invalidated: issues.length ? [] : invalidated };

  function decide(id: string, d: string, i: number, label: string): boolean {
    if (decided.has(id) && decided.get(id) !== d) { issue(i, 'invalid_value', `Per «${label}» hai indicato decisioni diverse nello stesso messaggio: quale vale?`, 'decisioni contrastanti sullo stesso evento'); return false; }
    decided.set(id, d); return true;
  }
  function refOk(r: Resolved<unknown>, i: number, what: string): boolean {
    if ('ok' in r) return true;
    const label = ops[i].mention || ops[i].refId || '';
    if ('ambiguous' in r) issue(i, 'reference_ambiguous', `A quale ${what} ti riferisci con «${label}»?`, 'riferimento ambiguo', [...r.ambiguous.map((a) => ({ id: a.id, label: a.label })), SKIP]);
    else issue(i, 'reference_unknown', `Non trovo «${label}» tra i dati verificati (${what}): non lo aggiungo.`, 'riferimento inesistente nel catalogo del server', [SKIP]);
    return false;
  }
  function buildSegment(op: Operation, i: number): Segment | null {
    const all = op.allCategories === true;
    const cats = all ? [...CATEGORIES] : [...new Set(op.categories || [])];
    if (!cats.length) { issue(i, 'invalid_value', 'Quali tipologie di punti vuoi includere?', 'segmento senza categorie'); return null; }
    for (const [k, v] of [['ordini', op.minDaysSinceOrder], ['visite', op.minDaysSinceVisit]] as const) {
      if (v !== null && !intIn(v, 1, 3650)) { issue(i, 'invalid_value', `Il numero di giorni per il filtro ${k} non è valido.`, `giorni ${k} fuori intervallo`); return null; }
    }
    if (op.minDaysSinceOrder !== null && !all && !cats.some((k) => ORDERING.includes(k))) { issue(i, 'invalid_value', 'Prospect e nuovi punti non hanno ordini: intendevi un filtro sulle visite?', 'filtro acquisti su categorie senza ordini'); return null; }
    if (op.ownOnly && !all && !cats.some((k) => ORDERING.includes(k))) { issue(i, 'invalid_value', '«Miei» vale solo per clienti e orfani: puoi precisare?', 'ownOnly su categorie non pertinenti'); return null; }
    return { categories: cats, allCategories: all, minDaysSinceOrder: op.minDaysSinceOrder, minDaysSinceVisit: op.minDaysSinceVisit, ownOnly: op.ownOnly ?? false };
  }
  function applySet(cr: SemanticCriteria, op: Operation, i: number): void {
    const bad = (t: string, r: string) => issue(i, 'invalid_value', t, r);
    switch (op.field) {
      case 'dates': {
        const ds = op.dates || [];
        if (!ds.length || ds.some((d) => !validDate(d) || d < ctx.today || d > addDaysIso(ctx.today, 365))) return bad('Per quale giorno vuoi il giro? La data deve essere oggi o futura.', 'data non valida o passata');
        if (ds.length === 1) { const g = dateGuard(op.evidence, ds[0], ctx.today); if (g) return bad(`Non sono sicuro della data: ${g}. Per quale giorno vuoi il giro?`, g); }
        cr.dates = [...new Set(ds)].sort(); return;
      }
      case 'start_time': case 'end_time':
        if (!op.text || !HHMM.test(op.text)) return bad('Orario non valido: indicalo come HH:MM.', 'orario non valido');
        if (op.field === 'start_time') cr.startTime = op.text; else cr.endTime = op.text; return;
      case 'revenue_min': case 'revenue_max':
        if (op.number === null || op.number < 0) return bad('Importo di fatturato non valido.', 'fatturato non valido');
        cr.revenue = { min: cr.revenue?.min ?? null, max: cr.revenue?.max ?? null, [op.field === 'revenue_min' ? 'min' : 'max']: op.number }; return;
      case 'project': {
        const p = op.text ? ctx.catalog.projects.find((x) => norm(x) === norm(op.text!)) : undefined;
        if (!p) return issue(i, 'reference_unknown', `Non trovo il progetto «${op.text ?? ''}» tra quelli disponibili: non lo applico.`, 'progetto inesistente', [SKIP]);
        cr.project = p; return;
      }
      case 'coverage': if (op.text !== 'selection' && op.text !== 'all_matching') return bad('Valore di copertura non valido.', 'coverage non valida'); cr.coverage = op.text; return;
      case 'max_days': if (!intIn(op.number, 1, 10)) return bad('Su quante giornate (da 1 a 10) vuoi organizzare il giro?', 'max_days non valido'); cr.maxDays = op.number; return;
      case 'overflow_policy':
        if (op.text !== 'ask' && op.text !== 'extend_days' && op.text !== 'drop_excess') return bad('Come vuoi procedere se i punti non entrano?', 'overflow non valido');
        cr.overflowPolicy = op.text; return;
      case 'lodging_mode':
        if (op.text !== 'home' && op.text !== 'away' && op.text !== 'conditional') return bad('Rientri a casa o pernotti fuori?', 'lodging non valido');
        cr.lodging = { mode: op.text, maxKmHome: op.text === 'conditional' ? (op.number ?? cr.lodging?.maxKmHome ?? null) : null }; return;
      case 'lodging_max_km':
        if (op.number === null || op.number <= 0 || op.number > 500) return bad('Distanza massima da casa non valida.', 'km non validi');
        cr.lodging = { mode: 'conditional', maxKmHome: op.number }; return;
      case 'follow_ups_mode': if (op.text !== 'consider' && op.text !== 'skip') return bad('Valore follow-up non valido.', 'follow_ups_mode non valido'); cr.followUpsMode = op.text; return;
      case 'allow_nearby':
        if (op.flag === null || !cr.area) return bad('Indica prima la zona del giro.', 'allow_nearby senza area');
        cr.area.allowNearby = op.flag; return;
      default: return bad('Criterio non modificabile.', `set non ammesso su ${op.field}`);
    }
  }
  function applyClear(cr: SemanticCriteria, op: Operation, i: number): void {
    const e = emptySemanticCriteria();
    switch (op.field) {
      case 'segments': cr.segments = []; return;
      case 'purchase_filter': cr.segments = cr.segments.map((s) => ({ ...s, minDaysSinceOrder: null })); return;
      case 'visit_filter': cr.segments = cr.segments.map((s) => ({ ...s, minDaysSinceVisit: null })); return;
      case 'revenue': cr.revenue = null; return;
      case 'area': cr.area = null; return;
      case 'dates': cr.dates = []; return;
      case 'start_time': cr.startTime = null; return;
      case 'end_time': cr.endTime = null; return;
      case 'project': cr.project = null; return;
      case 'coverage': cr.coverage = e.coverage; return;
      case 'max_days': cr.maxDays = null; return;
      case 'overflow_policy': cr.overflowPolicy = null; return;
      case 'lodging': cr.lodging = null; return;
      case 'stops': cr.stops = e.stops; return;
      case 'follow_ups': cr.followUps = []; cr.rescheduleProposals = []; return;
      default: issue(i, 'invalid_value', 'Criterio da azzerare non riconosciuto.', `clear non ammesso su ${op.field}`);
    }
  }
  function applyArea(cr: SemanticCriteria, op: Operation, i: number): void {
    if (op.op === 'replace_area' && !replacedArea) { cr.area = null; replacedArea = true; }
    if (!op.locality) {
      const sigla = op.op !== 'remove_locality' && op.provincia ? resolveProvince(op.provincia, ctx.catalog) : null;
      if (!sigla) return issue(i, 'locality_unknown', `Non riconosco la zona «${op.provincia ?? op.mention ?? ''}»: indica un comune o una provincia.`, 'provincia non riconosciuta', [SKIP]);
      const nome = ctx.catalog.provinces.find((p) => p.sigla === sigla)!.nome;
      // Provincia senza la parola «provincia» nel testo: se esiste un comune omonimo o il nome non compare, si chiede (mai reinterpretare in silenzio).
      if (fromLlm && !/\bprovincia\b/.test(norm(op.evidence))) {
        const homonym = ctx.catalog.localities.some((l) => norm(l.name) === norm(nome));
        const literal = new RegExp(`\\b(?:${norm(nome)}|${sigla.toLowerCase()})\\b`).test(msg);
        if (homonym || !literal) return issue(i, 'area_ambiguous', `Con «${op.evidence}» intendi il comune o l'intera provincia?`, 'provincia senza la parola «provincia» nel testo', [...geoOptions(nome, ctx.catalog, sigla), SKIP]);
      }
      cr.area = { localities: cr.area?.localities ?? [], provincia: sigla, allowNearby: cr.area?.allowNearby ?? false }; return;
    }
    const r = resolveLocality(op.locality, op.provincia, ctx.catalog);
    if ('ambiguous' in r) return issue(i, 'locality_ambiguous', `Con «${op.locality}» intendi quale comune?`, 'località ambigua', [...r.ambiguous.map((a) => ({ id: a.id, label: a.label })), SKIP]);
    if ('unknown' in r) return issue(i, 'locality_unknown', `Non trovo «${op.locality}» tra i comuni disponibili: non lo aggiungo. Puoi indicare un altro comune?`, 'località inesistente', [SKIP]);
    const loc = r.ok;
    // "provincia di Milano" interpretata come comune Milano: incoerente con il testo, si chiede.
    const homonymProv = ctx.catalog.provinces.find((p) => norm(p.nome) === norm(loc.name));
    if (fromLlm && op.op !== 'remove_locality' && homonymProv && new RegExp(`\\bprovincia\\s+(?:di\\s+)?${norm(homonymProv.nome)}\\b`).test(msg))
      return issue(i, 'area_ambiguous', `Hai scritto «provincia»: intendi tutta la provincia di ${homonymProv.nome} o solo il comune?`, 'comune al posto di una provincia citata', [...geoOptions(loc.name, ctx.catalog, homonymProv.sigla), SKIP]);
    if (op.op === 'remove_locality') {
      if (!cr.area) return;
      const rest = cr.area.localities.filter((l) => norm(l.name) !== norm(loc.name));
      cr.area = rest.length || cr.area.provincia ? { ...cr.area, localities: rest } : null; return;
    }
    cr.area = cr.area ?? { localities: [], provincia: null, allowNearby: false };
    if (!cr.area.localities.some((l) => norm(l.name) === norm(loc.name) && l.provincia === loc.provincia)) cr.area.localities.push(loc);
  }
}

/** Percorsi di primo livello cambiati (per diagnostica e UI). */
export function changedPaths(a: SemanticCriteria, b: SemanticCriteria): string[] {
  return (Object.keys(b) as Array<keyof SemanticCriteria>).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}
