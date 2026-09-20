// Validatore deterministico del TourBrief: contraddizioni interne con correzione a un tap.
// Nessuna chiamata AI: tutto calcolato lato CRM dai chip che l'agente vede.
// Parità web src/lib/aitour/brief-consistency.ts
import type { TourBriefV4, BriefCondition, BriefArea, BriefStopRef } from './brief-v4';
import { projectRuleLabel, fillerLabel } from './brief-v4';
import type { BriefCustomer } from './brief-customers';
import { normalizeLocality, provinceCode } from './brief-area';
import { timeToMin, minToTime } from './types';

export interface BriefFix { label: string; apply: (b: TourBriefV4) => TourBriefV4 }
export interface BriefIssue { id: string; message: string; fixes: BriefFix[]; hides?: string }

const CLIENT_SOURCES = new Set(['clients_all', 'clients_frequent', 'clients_top']);
const DEV_SOURCES = new Set(['prospects', 'orphans']);
const NUMERIC = new Set(['last_order_days', 'last_visit_days', 'revenue', 'orders_count']);
const NUMERIC_LABEL: Record<string, string> = { last_order_days: 'giorni dall\'ultimo ordine', last_visit_days: 'giorni dall\'ultima visita', revenue: 'fatturato', orders_count: 'numero ordini' };

const isProject = (c: BriefCondition) => c.type === 'project_membership' || c.type === 'project';
const condNames = (c: BriefCondition): string[] => Array.isArray(c.names) ? c.names : (c as { name?: string }).name ? [(c as { name?: string }).name as string] : [];
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export const sameArea = (a: BriefArea, b: BriefArea) => a.kind === b.kind && (a.kind === 'province'
  ? (provinceCode(a.value) || a.value.toUpperCase()) === (provinceCode(b.value) || b.value.toUpperCase())
  : normalizeLocality(a.value) === normalizeLocality(b.value));

function interval(c: BriefCondition): [number, number] | null {
  const v = c.value;
  if (v == null) return null;
  switch (c.operator || '>=') {
    case '>=': return [v, Infinity];
    case '>': return [v + 1e-9, Infinity];
    case '<=': return [-Infinity, v];
    case '<': return [-Infinity, v - 1e-9];
    default: return [v, v];
  }
}
const covers = (outer: [number, number], inner: [number, number]) => outer[0] <= inner[0] && outer[1] >= inner[1];

const rmSel = (b: TourBriefV4, i: number): TourBriefV4 => ({ ...b, selection: { ...b.selection, conditions: b.selection.conditions.filter((_, x) => x !== i) } });
const rmExcl = (b: TourBriefV4, i: number): TourBriefV4 => ({ ...b, exclusions: b.exclusions.filter((_, x) => x !== i) });
const rmArea = (b: TourBriefV4, i: number): TourBriefV4 => ({ ...b, areas: b.areas.filter((_, x) => x !== i) });
const rmPref = (b: TourBriefV4, i: number): TourBriefV4 => ({ ...b, preferences: b.preferences.filter((_, x) => x !== i) });
const setRoute = (b: TourBriefV4, patch: Partial<TourBriefV4['route']>): TourBriefV4 => ({ ...b, route: { ...b.route, ...patch } });
const setStop = (b: TourBriefV4, group: 'mandatoryStops' | 'preferredStops', i: number, patch: Partial<BriefStopRef>): TourBriefV4 => ({ ...b, [group]: b[group].map((s, x) => x === i ? { ...s, ...patch } : s) });
function rmSelNames(b: TourBriefV4, i: number, names: string[]): TourBriefV4 {
  const c = b.selection.conditions[i];
  const rest = condNames(c).filter((n) => !names.some((m) => sameName(m, n)));
  if (!rest.length) return rmSel(b, i);
  return { ...b, selection: { ...b.selection, conditions: b.selection.conditions.map((x, n) => n === i ? { ...x, names: rest } : x) } };
}

function apptRange(s: BriefStopRef): [number, number] | null {
  const a = s.appointment;
  if (!a || a.type === 'none') return null;
  if (a.type === 'window' && a.from && a.to) return [timeToMin(a.from), timeToMin(a.to)];
  if (a.time) { const t = timeToMin(a.time); return a.type === 'approximate' ? [t - 45, t + 45] : [t, t + 15]; }
  return null;
}
const apptLabel = (s: BriefStopRef) => s.appointment?.time || `${s.appointment?.from}-${s.appointment?.to}`;
const stopName = (s: BriefStopRef, customers: BriefCustomer[]) => customers.find((c) => c.id === s.selectedCustomerId)?.name || s.rawReference;

export function briefConsistencyIssues(brief: TourBriefV4, customers: BriefCustomer[], today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })): BriefIssue[] {
  const out: BriefIssue[] = [];
  const sel = brief.selection.conditions;
  const ex = brief.exclusions;

  sel.forEach((c, i) => ex.forEach((e, j) => {
    if (isProject(c) && isProject(e)) {
      const common = condNames(c).filter((n) => condNames(e).some((m) => sameName(m, n)));
      if (common.length) out.push({ id: `project-${i}-${j}`, message: `${common.join(', ')}: richiesto e insieme escluso`, fixes: [
        { label: `Visita ${common.join(', ')}`, apply: (b) => rmExcl(b, j) },
        { label: `Escludi ${common.join(', ')}`, apply: (b) => rmSelNames(b, i, common) },
      ] });
    } else if (DEV_SOURCES.has(c.type) && c.type === e.type) {
      const lbl = c.type === 'prospects' ? 'prospect' : 'orfani';
      out.push({ id: `dev-${i}-${j}`, message: `${lbl[0].toUpperCase()}${lbl.slice(1)}: richiesti e insieme esclusi`, fixes: [
        { label: `Includi ${lbl}`, apply: (b) => rmExcl(b, j) },
        { label: `Escludi ${lbl}`, apply: (b) => rmSel(b, i) },
      ] });
    } else if (NUMERIC.has(c.type) && c.type === e.type) {
      const ic = interval(c), ie = interval(e);
      if (ic && ie && covers(ie, ic)) out.push({ id: `num-${i}-${j}`, message: `L'esclusione su ${NUMERIC_LABEL[c.type]} annulla tutto il filtro richiesto: nessun cliente resterebbe`, fixes: [
        { label: 'Togli l\'esclusione', apply: (b) => rmExcl(b, j) },
        { label: 'Togli il filtro', apply: (b) => rmSel(b, i) },
      ] });
    }
  }));

  brief.areas.forEach((a, i) => brief.areas.forEach((b, j) => {
    if (i >= j || !sameArea(a, b) || a.mode === b.mode) return;
    if (a.mode === 'exclude' || b.mode === 'exclude') {
      const exIdx = a.mode === 'exclude' ? i : j, inIdx = a.mode === 'exclude' ? j : i;
      const inMode = brief.areas[inIdx].mode === 'prefer' ? 'preferita' : 'richiesta';
      out.push({ id: `area-${i}-${j}`, message: `${a.value}: zona ${inMode} e insieme esclusa`, fixes: [
        { label: `Visita ${a.value}`, apply: (x) => rmArea(x, exIdx) },
        { label: `Evita ${a.value}`, apply: (x) => rmArea(x, inIdx) },
      ] });
    }
  }));
  brief.preferences.forEach((p, i) => {
    if (p.type !== 'prefer_area' || !p.value) return;
    const j = brief.areas.findIndex((a) => a.mode === 'exclude' && normalizeLocality(a.value) === normalizeLocality(p.value || ''));
    if (j >= 0) out.push({ id: `prefarea-${i}`, message: `${p.value}: zona preferita ma esclusa`, fixes: [
      { label: `Preferisci ${p.value}`, apply: (b) => rmArea(b, j) },
      { label: `Evita ${p.value}`, apply: (b) => rmPref(b, i) },
    ] });
  });
  if (brief.journey?.stages.length) brief.areas.forEach((a, i) => {
    if (a.mode !== 'include') return;
    out.push({ id: `journey-area-${i}`, message: `Percorso a zone e area "${a.value}" insieme: restano solo i clienti presenti in entrambe`, fixes: [
      { label: `Segui solo il percorso (togli ${a.value})`, apply: (b) => rmArea(b, i) },
      { label: 'Mantieni entrambi', apply: (b) => b },
    ] });
  });

  const sources = sel.filter((c) => CLIENT_SOURCES.has(c.type) || DEV_SOURCES.has(c.type));
  if (brief.dayType === 'clienti' && sources.length && sources.every((c) => DEV_SOURCES.has(c.type))) {
    out.push({ id: 'daytype-clienti', message: 'Giornata "clienti" ma hai chiesto solo prospect/orfani', fixes: [
      { label: 'Giornata sviluppo', apply: (b) => ({ ...b, dayType: 'sviluppo' }) },
      { label: 'Giornata mista', apply: (b) => ({ ...b, dayType: 'mista' }) },
    ] });
  }
  if (brief.dayType === 'sviluppo' && sources.length && sources.every((c) => CLIENT_SOURCES.has(c.type))) {
    out.push({ id: 'daytype-sviluppo', message: 'Giornata "sviluppo" ma hai chiesto solo clienti già acquisiti', fixes: [
      { label: 'Giornata clienti', apply: (b) => ({ ...b, dayType: 'clienti' }) },
      { label: 'Giornata mista', apply: (b) => ({ ...b, dayType: 'mista' }) },
    ] });
  }
  const exP = ex.findIndex((e) => e.type === 'prospects'), exO = ex.findIndex((e) => e.type === 'orphans');
  if (brief.dayType === 'sviluppo' && exP >= 0 && exO >= 0 && !sources.some((c) => CLIENT_SOURCES.has(c.type))) {
    out.push({ id: 'dev-empty', message: 'Sviluppo senza prospect né orfani: non resterebbe nessuno da visitare', fixes: [
      { label: 'Includi prospect e orfani', apply: (b) => ({ ...b, exclusions: b.exclusions.filter((_, x) => x !== exP && x !== exO) }) },
      { label: 'Giornata clienti', apply: (b) => ({ ...b, dayType: 'clienti' }) },
    ] });
  }

  const startMin = brief.route.startTime ? timeToMin(brief.route.startTime) : null;
  const finishField: 'finishBy' | 'endTime' = brief.route.finishBy ? 'finishBy' : 'endTime';
  const finishMin = brief.route[finishField] ? timeToMin(brief.route[finishField] as string) : null;
  for (const group of ['mandatoryStops', 'preferredStops'] as const) brief[group].forEach((s, i) => {
    if (s.areaDecision === 'exclude') return;
    const r = apptRange(s);
    if (!r) return;
    const name = stopName(s, customers);
    const noAppt: BriefFix = { label: 'Togli l\'appuntamento', apply: (b) => setStop(b, group, i, { appointment: null }) };
    if (group === 'preferredStops') out.push({ id: `appt-pref-${i}`, message: `${name}: ha un appuntamento (${apptLabel(s)}) ma è solo "se possibile"`, fixes: [
      { label: 'Rendi obbligatoria', apply: (b) => ({ ...b, preferredStops: b.preferredStops.filter((_, x) => x !== i), mandatoryStops: [...b.mandatoryStops, { ...s, priority: s.priority ?? 2 }] }) },
      noAppt,
    ] });
    if (startMin != null && r[0] < startMin) out.push({ id: `appt-start-${group}-${i}`, message: `${name}: appuntamento alle ${apptLabel(s)} ma il giro inizia alle ${brief.route.startTime}`, fixes: [
      { label: `Inizia alle ${minToTime(Math.max(0, r[0] - 15))}`, apply: (b) => setRoute(b, { startTime: minToTime(Math.max(0, r[0] - 15)) }) },
      noAppt,
    ] });
    if (finishMin != null && r[1] > finishMin) out.push({ id: `appt-end-${group}-${i}`, message: `${name}: appuntamento alle ${apptLabel(s)} ma devi finire entro le ${brief.route[finishField]}`, fixes: [
      { label: `Fine entro ${minToTime(r[1] + 15)}`, apply: (b) => setRoute(b, { [finishField]: minToTime(r[1] + 15) }) },
      noAppt,
    ] });
  });

  if (brief.route.returnHome && brief.route.returnToStart) out.push({ id: 'return-both', message: 'Rientro a casa e ritorno al punto di partenza insieme', fixes: [
    { label: 'Rientro a casa', apply: (b) => setRoute(b, { returnToStart: false, endPlace: { kind: 'home', rawReference: 'Casa' } }) },
    { label: 'Torno al punto di partenza', apply: (b) => setRoute(b, { returnHome: false, endPlace: null }) },
  ] });
  if (brief.route.returnHome && brief.route.endPlace && brief.route.endPlace.kind !== 'home') out.push({ id: 'return-end', message: `Rientro a casa ma arrivo indicato: ${brief.route.endPlace.rawReference}`, fixes: [
    { label: 'Arrivo a casa', apply: (b) => setRoute(b, { endPlace: { kind: 'home', rawReference: 'Casa' } }) },
    { label: `Arrivo: ${brief.route.endPlace.rawReference}`, apply: (b) => setRoute(b, { returnHome: false }) },
  ] });
  if (brief.route.splitAllowed === false && (brief.route.maxDays ?? 1) > 1) out.push({ id: 'split-days', message: `Tutto in un giorno ma anche "massimo ${brief.route.maxDays} giorni"`, fixes: [
    { label: 'Un solo giorno', apply: (b) => setRoute(b, { maxDays: null }) },
    { label: `Consenti fino a ${brief.route.maxDays} giorni`, apply: (b) => setRoute(b, { splitAllowed: true }) },
  ] });
  if (brief.route.compact === 'required' && brief.journey?.stages.length) out.push({ id: 'compact-journey', message: 'Zona compatta vincolante e percorso a zone ordinate: il percorso prevale', fixes: [
    { label: 'Compatto: se possibile', apply: (b) => setRoute(b, { compact: 'prefer' }) },
    { label: 'Nessun vincolo compatto', apply: (b) => setRoute(b, { compact: 'off' }) },
  ] });
  if (startMin != null && finishMin != null && startMin >= finishMin) out.push({ id: 'time-order', message: `Fine (${brief.route[finishField]}) non successiva alla partenza (${brief.route.startTime})`, hides: 'L’orario di arrivo/fine', fixes: [
    { label: 'Togli l\'orario di fine', apply: (b) => setRoute(b, { finishBy: null, endTime: null }) },
    { label: 'Togli l\'orario di partenza', apply: (b) => setRoute(b, { startTime: null }) },
  ] });

  brief.preferredStops.forEach((p, i) => {
    if (!p.selectedCustomerId) return;
    const m = brief.mandatoryStops.find((s) => s.selectedCustomerId === p.selectedCustomerId && s.areaDecision !== 'exclude');
    if (m) out.push({ id: `dup-${i}`, message: `${stopName(m, customers)}: indicato sia come obbligatorio sia come "se possibile"`, hides: 'Lo stesso cliente', fixes: [
      { label: 'Tieni come obbligatorio', apply: (b) => ({ ...b, preferredStops: b.preferredStops.filter((_, x) => x !== i) }) },
    ] });
  });

  const kept = [...brief.mandatoryStops, ...brief.preferredStops].filter((r) => r.areaDecision !== 'exclude');
  const nMand = new Set(brief.mandatoryStops.filter((r) => r.areaDecision !== 'exclude').map((r) => r.selectedCustomerId || r.rawReference)).size;
  const vt = brief.visitTarget;
  const upper = vt.mode === 'range' ? vt.max : ['exact', 'approximately', 'maximum'].includes(vt.mode) ? vt.value ?? vt.max : null;
  if (vt.scope !== 'automatic_plus_mandatory' && upper && nMand > upper) out.push({ id: 'target-mandatory', message: `${nMand} clienti obbligatori ma ${upper} visite in totale`, hides: `${nMand} clienti obbligatori ma`, fixes: [
    { label: `Porta a ${nMand} visite`, apply: (b) => ({ ...b, visitTarget: { ...b.visitTarget, value: vt.mode === 'range' ? b.visitTarget.value : nMand, max: vt.mode === 'range' ? nMand : b.visitTarget.max } }) },
    { label: `${upper} visite oltre agli obbligatori`, apply: (b) => ({ ...b, visitTarget: { ...b.visitTarget, scope: 'automatic_plus_mandatory' } }) },
  ] });
  if (brief.includeAutomatic === false && ['exact', 'minimum', 'range'].includes(vt.mode)) {
    const lower = vt.mode === 'range' ? vt.min : vt.value;
    if (lower && lower > kept.length) out.push({ id: 'target-named', message: `${kept.length} clienti nominati per ${lower} visite, senza altri clienti automatici`, hides: 'Hai indicato', fixes: [
      { label: 'Aggiungi altri clienti', apply: (b) => ({ ...b, includeAutomatic: true }) },
      { label: 'Solo i clienti nominati', apply: (b) => ({ ...b, visitTarget: { ...b.visitTarget, mode: 'unspecified', value: null, min: null, max: null } }) },
    ] });
  }

  // Quote progetti: coerenza con selezione e con il numero totale di visite
  const selProjects = sel.filter(isProject).flatMap(condNames);
  const rmRule = (b: TourBriefV4, i: number): TourBriefV4 => ({ ...b, projectRules: b.projectRules.filter((_, x) => x !== i) });
  brief.projectRules.forEach((r, i) => {
    if (selProjects.length && !selProjects.some((n) => sameName(n, r.project))) out.push({ id: `rule-sel-${i}`, message: `"${r.project}" ha una regola ma non è tra i progetti richiesti (${selProjects.join(', ')})`, fixes: [
      { label: `Aggiungi ${r.project} ai progetti`, apply: (b) => ({ ...b, selection: { ...b.selection, conditions: b.selection.conditions.map((c) => isProject(c) ? { ...c, names: [...condNames(c), r.project] } : c) } }) },
      { label: 'Togli la regola', apply: (b) => rmRule(b, i) },
    ] });
    if (ex.some((e) => isProject(e) && condNames(e).some((n) => sameName(n, r.project))) && r.type !== 'maximum_count') out.push({ id: `rule-ex-${i}`, message: `"${r.project}": regola "${projectRuleLabel(r)}" ma il progetto è escluso`, fixes: [
      { label: `Visita ${r.project}`, apply: (b) => ({ ...b, exclusions: b.exclusions.filter((e) => !(isProject(e) && condNames(e).some((n) => sameName(n, r.project)))) }) },
      { label: 'Togli la regola', apply: (b) => rmRule(b, i) },
    ] });
  });
  const mins = brief.projectRules.filter((r) => (r.type === 'minimum_count' || r.type === 'exact_count') && r.value);
  if (upper && mins.length) {
    const sumMin = mins.reduce((s, r) => s + (r.value || 0), 0);
    if (sumMin > upper) out.push({ id: 'rule-total', message: `Le quote minime (${mins.map(projectRuleLabel).join(', ')}) superano le ${upper} visite totali`, fixes: [
      { label: `Porta a ${sumMin} visite`, apply: (b) => ({ ...b, visitTarget: { ...b.visitTarget, value: vt.mode === 'range' ? b.visitTarget.value : sumMin, max: vt.mode === 'range' ? sumMin : b.visitTarget.max } }) },
      { label: 'Togli le quote', apply: (b) => ({ ...b, projectRules: b.projectRules.filter((r) => r.type === 'priority' || r.type === 'maximum_count') }) },
    ] });
  }
  brief.fillers.forEach((f, i) => {
    const same = f.selection.conditions.every((c) => sel.some((s) => s.type === c.type && JSON.stringify(condNames(s)) === JSON.stringify(condNames(c))));
    if (same) out.push({ id: `filler-same-${i}`, message: `"${fillerLabel(f)}": è già la selezione principale, non un riempitivo`, fixes: [
      { label: 'Togli il riempitivo', apply: (b) => ({ ...b, fillers: b.fillers.filter((_, x) => x !== i) }) },
    ] });
  });

  const rd = brief.requestedDate;
  if (rd.value && rd.value < today) {    const t = new Date(`${today}T12:00:00`); t.setDate(t.getDate() + 1);
    const tomorrow = t.toLocaleDateString('sv-SE');
    out.push({ id: 'date-past', message: `La data ${rd.value.slice(8, 10)}/${rd.value.slice(5, 7)} è già passata`, hides: 'La data richiesta', fixes: [
      { label: 'Oggi', apply: (b) => ({ ...b, requestedDate: { type: 'today', value: today } }) },
      { label: 'Domani', apply: (b) => ({ ...b, requestedDate: { type: 'tomorrow', value: tomorrow } }) },
    ] });
  }
  return out;
}

export function pendingUnresolvedEntities(brief: TourBriefV4): string[] {
  const projectNames = [...brief.selection.conditions, ...brief.exclusions, ...brief.fillers.flatMap((f) => f.selection.conditions)]
    .filter(isProject).flatMap(condNames);
  const placed = new Set([
    ...brief.areas.map((a) => normalizeLocality(a.value)),
    ...(brief.journey?.stages || []).map((s) => normalizeLocality(s.name)),
    ...[...brief.mandatoryStops, ...brief.preferredStops].map((s) => normalizeLocality(s.rawReference)),
    // Progetti e regole già collocati: non vanno richiesti di nuovo all'agente
    ...projectNames.map(normalizeLocality),
    ...brief.projectRules.map((r) => normalizeLocality(r.project)),
  ]);
  return brief.interpretation.unresolvedEntities.filter((e) => !placed.has(normalizeLocality(e)));
}

// Domande mirate per le entita' che l'AI non ha saputo collocare: la scelta la fa l'agente.
export function briefClarifications(brief: TourBriefV4): BriefIssue[] {
  return pendingUnresolvedEntities(brief).map((e, i) => {
    const drop = (b: TourBriefV4): TourBriefV4 => ({ ...b, interpretation: { ...b.interpretation, unresolvedEntities: b.interpretation.unresolvedEntities.filter((x) => x !== e) } });
    const fixes: BriefFix[] = [
      { label: 'È un cliente da visitare', apply: (b) => ({ ...drop(b), mandatoryStops: [...b.mandatoryStops, { rawReference: e, cityHint: null, appointment: null, priority: 2 }] }) },
      { label: 'È una zona (comune)', apply: (b) => ({ ...drop(b), areas: [...b.areas, { kind: 'city', value: e, mode: 'include' }] }) },
    ];
    if (provinceCode(e)) fixes.push({ label: `È la provincia ${provinceCode(e)}`, apply: (b) => ({ ...drop(b), areas: [...b.areas, { kind: 'province', value: provinceCode(e) as string, mode: 'include' }] }) });
    fixes.push({ label: 'Ignora', apply: drop });
    return { id: `clarify-${i}`, message: `"${e}": cosa intendevi?`, hides: `Da chiarire nella richiesta: ${e}`, fixes };
  });
}
