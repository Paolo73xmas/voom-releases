// D3(a): planner condiviso estratto da gptour-orchestrator/orchestrator.ts (handleTurn, sezione «dati CRM → selezione → routing → verifica → piano»).
// Puro TypeScript, nessuna interpretazione/persistenza/sessione: l'esito è un valore che il chiamante (v7 wrapper o U2-d adapter) traduce.
// Regole, messaggi, ordine delle letture CRM/routing e contatori sono IDENTICI al codice v7 di origine (golden prima/dopo byte-identici).
import { CONTRACT_VERSION, ENGINE_VERSION } from '../gptour-orchestrator/contract.ts';
import type { Question, Plan, NormalizedCriteria, DataQuality, GeoPoint, ResponseStatus } from '../gptour-orchestrator/contract.ts';
import type { CrmPort, RoutingPort, SessionRecord, AgentSettings, Territory } from '../gptour-orchestrator/ports.ts';
import { timeToMin, minToTime, formatDateIt, strip } from '../gptour-orchestrator/time.ts';
import { classifyAll, groupsLabel, type Classified } from '../gptour-orchestrator/commercial.ts';
import { pendingAgenda, agendaQuestion, externalCommitments } from '../gptour-orchestrator/agenda.ts';
import { selectCompact, centroid, haversineKm, pointInRing } from '../gptour-orchestrator/geo.ts';
import { buildSchedule, subMatrix, fillWaits, fmt, type StopInput } from '../gptour-orchestrator/routing.ts';
import { splitIntoDays, planMultiDay, nextWorkingDay } from '../gptour-orchestrator/multiday.ts';

export type FollowUpDecision = SessionRecord['followUpDecisions'][number];
export interface PlannerCounters { crmQueries: number; routingCalls: number }
export interface PlannerIo { crm: Pick<CrmPort, 'loadTerritory' | 'loadCandidates' | 'loadPurchases' | 'loadAgenda'>; routing: RoutingPort; newId: () => string }
/** Tutto ciò che handleTurn aveva già deciso prima della pianificazione: criteri completi (groups non null, date valida), orario di partenza/fine, consensi. */
export interface PlannerInput {
  agentId: string; sessionId: string; sessionRevision: number; nowIso: string; today: string;
  criteria: NormalizedCriteria & { groups: NonNullable<NormalizedCriteria['groups']>; area: NonNullable<NormalizedCriteria['area']>; date: string };
  settings: AgentSettings; followUpDecisions: FollowUpDecision[]; departure: GeoPoint | null; startMin: number; workEnd: number;
}
export type PlannerOutcome =
  | { kind: 'blocked'; errorCode: 'territory_unavailable'; message: string }
  | { kind: 'ask'; question: Question; payload: Record<string, unknown> | null; conflicts: string[] }
  | { kind: 'infeasible'; message: string; conflicts: string[]; dataQuality: DataQuality }
  | { kind: 'failed'; errorCode: 'routing_unavailable'; message: string; dataQuality: DataQuality }
  | { kind: 'plan'; plan: Plan; status: ResponseStatus; message: string; dataQuality: DataQuality; pendingDecisions: string[] };

export function areaLabel(c: NormalizedCriteria): string {
  if (!c.area) return '';
  return c.area.provincia ? `in provincia di ${c.area.provincia}` : `a ${c.area.comuni.join(', ')}`;
}

export async function planTour(input: PlannerInput, io: PlannerIo, metrics: PlannerCounters): Promise<PlannerOutcome> {
  const { agentId, today, nowIso, settings, departure: sessionDeparture, startMin, workEnd } = input;
  const cr = input.criteria; const session = { sessionId: input.sessionId, revision: input.sessionRevision, followUpDecisions: input.followUpDecisions };
  const ports = io;
  // --- dati CRM: il server è la fonte ---
  let territory: Territory; try { territory = await ports.crm.loadTerritory(agentId); metrics.crmQueries++; }
  catch (e) { return { kind: 'blocked', errorCode: 'territory_unavailable', message: `Territorio dell'agente non leggibile con le autorizzazioni correnti (${String((e as Error).message || e).slice(0, 90)}). Nessun piano generato.` }; }
  const load = await ports.crm.loadCandidates(agentId, { comuni: cr.area.comuni, provincia: cr.area.provincia }, cr.groups); metrics.crmQueries++;
  const notes: string[] = [...load.errors];
  const polygons = territory.polygons || [];
  const unrestricted = territory.comuni.length === 0 && polygons.length === 0;
  let candidates = load.candidates.map((x) => ({ ...x, inTerritory: x.inTerritory && (unrestricted || x.territoryExempt === true || territory.comuni.some((t) => t.toLowerCase() === x.city.toLowerCase()) || (x.provincia != null && territory.province.includes(x.provincia)) || polygons.some((ring) => pointInRing(x.lat, x.lng, ring))) }));
  let purchasesVerified = true;
  if (cr.groups.existing && cr.groups.inactiveDays != null) {
    const ids = candidates.filter((x) => x.relationship !== 'none' && x.customerId).map((x) => x.customerId!);
    const p = await ports.crm.loadPurchases(agentId, ids); metrics.crmQueries++;
    if (p.error) { purchasesVerified = false; notes.push(`storico acquisti non caricato: ${p.error}`); candidates = candidates.map((x) => ({ ...x, purchasesLoaded: false })); }
    else candidates = candidates.map((x) => x.customerId && p.byCustomer.has(x.customerId) ? { ...x, purchasesLoaded: true, lastOrderDate: p.byCustomer.get(x.customerId)!.lastOrderDate, orderCount: p.byCustomer.get(x.customerId)!.orderCount } : x.customerId ? { ...x, purchasesLoaded: true, lastOrderDate: null, orderCount: 0 } : x);
  }
  const agenda = await ports.crm.loadAgenda(agentId, cr.date, cr.date, today); metrics.crmQueries++;
  if (agenda.error) notes.push(`agenda non caricata: ${agenda.error}`);
  const pendingEvents = pendingAgenda(agenda.events, session.followUpDecisions, cr.date);
  if (pendingEvents.length) return { kind: 'ask', question: agendaQuestion(pendingEvents, cr.date), payload: { eventIds: pendingEvents.map((e) => e.id), events: pendingEvents }, conflicts: [] };

  const dq: DataQuality = { candidatesComplete: load.complete && !load.truncated, poolTruncated: load.truncated, purchasesVerified, registryVerified: candidates.some((x) => x.newPointEvidence === 'verified') || !cr.groups.newPoints, routingSource: 'none', notes };
  const normName = (v: string) => strip(v).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const keysByName = (names: string[]) => candidates.filter((x) => names.some((n) => normName(x.name) === normName(n) || (normName(n).length >= 4 && normName(x.name).includes(normName(n))))).map((x) => x.key);
  const excluded = new Set([...cr.excludedKeys, ...keysByName(cr.excludedNames)]);
  const requiredSet = new Set([...cr.requiredKeys, ...keysByName(cr.requiredNames)].filter((k) => !excluded.has(k)));
  const classified = classifyAll(candidates, cr.groups, today);
  const eligible = classified.filter((x) => x.group && !excluded.has(x.candidate.key));
  const rejected = classified.filter((x) => !x.group || excluded.has(x.candidate.key)).map((x) => ({ key: x.candidate.key, name: x.candidate.name, reason: excluded.has(x.candidate.key) ? 'escluso dall\'agente' : x.problems.join('; ') }));
  const includedFU = session.followUpDecisions.filter((d) => d.decision === 'include' && !(d.key && excluded.has(d.key)));
  const inPool = new Set(classified.map((x) => x.candidate.key));
  // Impegni inclusi il cui cliente non è nel pool dell'area: bloccano il tempo come impegni esterni, con avviso (trasferimento non verificato).
  const externalIncluded = includedFU.filter((d) => !d.key || !inPool.has(d.key));
  const mandatoryKeys = new Set<string>([...requiredSet, ...includedFU.map((d) => d.key).filter((k): k is string => !!k && inPool.has(k))]);
  const missingMandatory = [...mandatoryKeys].filter((k) => !eligible.some((e) => e.candidate.key === k));
  if (missingMandatory.length) {
    const names = missingMandatory.map((k) => classified.find((x) => x.candidate.key === k)?.candidate.name || k);
    return { kind: 'infeasible', message: `Tappe obbligatorie non pianificabili con i criteri attuali: ${names.join(', ')}. Modifica i criteri/l'area oppure escludile esplicitamente.`, conflicts: names.map((n) => `obbligatoria non idonea: ${n}`), dataQuality: dq };
  }
  if (!eligible.length) {
    const why = cr.groups.inactiveDays != null ? `Nessun cliente ${areaLabel(cr)} con un ordine valido risalente ad almeno ${cr.groups.inactiveDays} giorni (verificati gli ordini, non le visite; i mai acquirenti non sono inclusi).` : `Nessun candidato verificato ${areaLabel(cr)} per: ${groupsLabel(cr.groups)}.`;
    return { kind: 'infeasible', message: `${why} Non estendo zona o categorie senza il tuo consenso.${load.truncated ? ' Il registro caricato è parziale: l\'assenza non è dimostrata.' : ''}`, conflicts: ['nessun candidato idoneo'], dataQuality: dq };
  }

  // --- selezione geografica ---
  const departure: GeoPoint = sessionDeparture || settings.home;
  const returnTo: GeoPoint | null = settings.returnHome ? settings.home : null;
  const visitMin = (x: Classified) => x.candidate.visitMinutes ?? (x.group === 'new' ? settings.visitMinutes.new : settings.visitMinutes.existing);
  const multiDays = cr.extraDaysApproved && (cr.maxDays || 1) > 1 ? cr.maxDays! : 1;
  // Capacità selezionabile: la giornata richiesta + le giornate aggiuntive già autorizzate (intere), mai oltre il consenso.
  const budget = (workEnd - startMin) + (multiDays - 1) * Math.max(0, workEnd - timeToMin(settings.workStart));
  const mixed = cr.groups.existing && cr.groups.newPoints;
  const sel = cr.wantAll ? { chosen: eligible, dropped: [], estimatedMin: 0, poolTruncated: load.truncated, mixedUnmet: null as null | 'existing' | 'new' }
    : selectCompact({ start: departure, returnTo, eligible, mandatoryKeys, budgetMin: budget, lunchMin: settings.lunchBreakMin, visitMin, mixedRequested: mixed, maxPool: 60 });
  if (sel.poolTruncated) dq.poolTruncated = true;

  const toStop = (x: Classified): StopInput => {
    const fu = includedFU.find((d) => d.key === x.candidate.key);
    const appt = agenda.events.find((e) => e.key === x.candidate.key && e.date === cr.date && e.type === 'appointment' && e.time);
    const role = appt ? 'appointment' : fu ? 'follow_up_confirmed' : requiredSet.has(x.candidate.key) ? 'required_by_agent' : 'suggested';
    const win = appt ? { start: timeToMin(appt.time!), end: timeToMin(appt.time!) + 5, strict: true } : fu?.time ? { start: timeToMin(fu.time), end: timeToMin(fu.time) + 5, strict: true } : x.candidate.preferredSlots[0] ? { ...x.candidate.preferredSlots[0] } : null;
    return { c: x, role, visitMin: visitMin(x), window: win, reason: role === 'suggested' ? (x.group === 'new' ? 'nuovo punto verificato nel registro' : x.daysSinceOrder != null ? `cliente, ultimo ordine ${x.daysSinceOrder} giorni fa` : 'cliente con relazione commerciale') : role };
  };
  // --- più giornate: SOLO su consenso esplicito (maxDays > 1 approvato) ---
  if (cr.extraDaysApproved && (cr.maxDays || 1) > 1) {
    const k = Math.min(cr.maxDays!, Math.max(2, Math.ceil((cr.wantAll ? eligible : sel.chosen).length / 1)));
    const dates: string[] = [cr.date]; while (dates.length < k) dates.push(nextWorkingDay(dates[dates.length - 1], settings.workingDays));
    const agendaByDate = await ports.crm.loadAgenda(agentId, dates[0], dates[dates.length - 1], today); metrics.crmQueries++;
    const decided = new Set(session.followUpDecisions.map((d) => d.followUpId));
    const pendingMulti = agendaByDate.events.filter((e) => !decided.has(e.id) && (e.overdue || dates.includes(e.date)));
    if (pendingMulti.length) return { kind: 'ask', question: agendaQuestion(pendingMulti, dates[0]), payload: { eventIds: pendingMulti.map((e) => e.id), events: pendingMulti }, conflicts: [] };
    const pinned = new Map<string, number>();
    for (const d of includedFU) { if (!d.key || !inPool.has(d.key)) continue; const idx = dates.indexOf(d.date); if (idx < 0) return { kind: 'infeasible', message: `Il follow-up di ${d.name} è al ${formatDateIt(d.date)}, fuori dalle giornate ${dates.map(formatDateIt).join(' / ')}. Modifica le date o escludilo esplicitamente.`, conflicts: [`follow-up fuori dalle date del giro: ${d.name}`], dataQuality: dq }; pinned.set(d.key, idx); }
    const groupsByDay = splitIntoDays(cr.wantAll ? eligible : sel.chosen, k, pinned, { perDayMin: dates.map((_, i) => (i === 0 ? workEnd - startMin : workEnd - timeToMin(settings.workStart)) - settings.lunchBreakMin - 60), costMin: (x) => visitMin(x) + 8 }).filter((g) => g.length);
    const usedDates = dates.slice(0, groupsByDay.length);
    const toStopDay = (x: Classified, date: string): StopInput => { const st = toStop(x); const fu = includedFU.find((d) => d.key === x.candidate.key && d.date === date); return fu ? { ...st, role: 'follow_up_confirmed', window: fu.time ? { start: timeToMin(fu.time), end: timeToMin(fu.time) + 5, strict: true } : st.window } : st; };
    const md = await planMultiDay({ trimOptional: !cr.wantAll, groups: groupsByDay, dates: usedDates, settings, home: settings.home, firstDeparture: departure, startMinFirstDay: startMin, endMin: workEnd, toStop: toStopDay, routing: ports.routing,
      commitmentsFor: (date, ks) => externalCommitments(agendaByDate.events, date, ks, session.followUpDecisions) });
    metrics.routingCalls += md.routingCalls; dq.routingSource = md.source;
    const bad = md.days.filter((d) => d.finishMin > d.endMin + 0.001 || d.conflicts.length);
    if (bad.length) {
      const conflicts = bad.flatMap((d) => [...d.conflicts, ...(d.finishMin > d.endMin ? [`giornata ${d.day} (${formatDateIt(d.date)}): fine ${fmt(d.finishMin)} oltre le ${minToTime(d.endMin)}`] : [])]);
      return { kind: 'ask', question: { id: 'infeasible', kind: 'infeasible', text: `Anche su ${md.days.length} giornate il giro non rispetta l'orario: ${conflicts.join('; ')}. Come procedo?`, options: [{ id: 'split_days', label: 'Aggiungi un\'altra giornata' }, { id: 'reduce', label: 'Scegli tu un sottoinsieme compatto' }, { id: 'extend', label: 'Prolunga l\'orario' }] }, payload: { conflicts }, conflicts };
    }
    const d1 = md.days[0];
    const plan: Plan = {
      planId: io.newId(), sessionId: session.sessionId, sessionRevision: session.revision, engineVersion: ENGINE_VERSION, contractVersion: CONTRACT_VERSION, generatedAt: nowIso,
      date: d1.date, startMin: d1.startMin, finishMin: d1.finishMin, endMin: d1.endMin, departure: d1.departure, returnTo: d1.returnTo, stops: d1.stops, totals: d1.totals, geometry: d1.geometry,
      verification: md.source === 'osrm' ? 'verified_routing' : 'estimated_routing', snapshotRef: `crm@${nowIso}|agent:${agentId}|area:${JSON.stringify(cr.area)}|days:${usedDates.join(',')}`,
      selectionReasons: { selected: md.days.flatMap((d) => d.stops.map((s) => ({ key: s.key, reason: `giorno ${d.day}: ${s.reason}` }))), excluded: [...rejected, ...(cr.wantAll ? [] : sel.dropped), ...md.leftOut.map((x) => ({ key: x.candidate.key, name: x.candidate.name, reason: 'idoneo ma fuori tempo con i tempi stradali reali della giornata assegnata' }))] },
      warnings: [...md.days.flatMap((d) => d.warnings.map((w) => `giorno ${d.day}: ${w}`)), ...(md.leftOut.length ? [`${md.leftOut.length} tappe idonee lasciate fuori per tempo (tempi stradali reali)`] : [])], dependsOnPendingChanges: session.followUpDecisions.filter((d) => d.decision === 'propose_reschedule').map((d) => `riprogrammazione proposta (non eseguita) per ${d.name}: ${d.proposedDate || 'data da definire'}`), days: md.days,
    };
    const nights = md.days.filter((d) => !d.returnHomeAfterDay).length;
    return { kind: 'plan', plan, status: plan.verification === 'verified_routing' ? 'ready' : 'planning', message: `Giro su ${md.days.length} giornate (${usedDates.map(formatDateIt).join(', ')}), autorizzato da te: ${md.days.map((d) => `g${d.day} ${d.stops.length} tappe ${fmt(d.startMin)}→${fmt(d.finishMin)}${d.returnHomeAfterDay ? '' : ` pernottamento (${d.nightKmHome} km da casa ≥ ${settings.lodgingMaxKmHome})`}`).join('; ')}. ${nights ? `${nights} pernottamenti secondo la regola configurata.` : 'Rientro a casa ogni sera.'}`, dataQuality: dq, pendingDecisions: [] };
  }

  // --- routing + verifica finale (una sola matrice: tappe scelte + riserva di tappe idonee vicine per riempire le attese; i tagli riusano la sottomatrice) ---
  const chosenKeys = new Set(sel.chosen.map((x) => x.candidate.key));
  const selCentroid = sel.chosen.length ? centroid(sel.chosen.map((x) => x.candidate)) : departure;
  const reserve = cr.wantAll ? [] : eligible.filter((x) => !chosenKeys.has(x.candidate.key)).sort((a, b) => haversineKm(selCentroid, a.candidate) - haversineKm(selCentroid, b.candidate)).slice(0, 12);
  const allChosen = [...sel.chosen, ...reserve];
  const points: GeoPoint[] = [departure, ...allChosen.map((x) => x.candidate), ...(returnTo ? [returnTo] : [])];
  let matrix; try { matrix = await ports.routing.matrix(points); metrics.routingCalls++; }
  catch (e) { return { kind: 'failed', errorCode: 'routing_unavailable', message: `Servizio di calcolo percorsi non disponibile (${String((e as Error).message || e).slice(0, 80)}): nessun piano generato, riprova tra poco.`, dataQuality: dq }; }
  dq.routingSource = matrix.source;
  let stops = allChosen.map(toStop);
  let keep = sel.chosen.map((_, i) => i);
  const reserveIdx = reserve.map((_, i) => sel.chosen.length + i);
  const commitments = externalCommitments(agenda.events, cr.date, new Set(stops.map((s) => s.c.candidate.key)), session.followUpDecisions);
  const schedInput = { startMin, endMin: workEnd, departure, returnTo, stops, matrix, lunchBreakMin: settings.lunchBreakMin, commitments };
  const schedFor = (k: number[]) => buildSchedule({ ...schedInput, stops: k.map((i) => stops[i]), matrix: subMatrix(matrix, k, !!returnTo, stops.length) });
  let sched = schedFor(keep);
  const trimmed: Array<{ key: string; name: string; reason: string }> = []; const trimmedIdx: number[] = [];
  while (!sched.feasible && !cr.wantAll) {
    const optional = keep.filter((i) => stops[i].role === 'suggested');
    if (!optional.length) break;
    const ctr = centroid([departure, ...keep.filter((i) => stops[i].role !== 'suggested').map((i) => stops[i].c.candidate)]);
    const far = optional.sort((a, b) => haversineKm(ctr, stops[b].c.candidate) - haversineKm(ctr, stops[a].c.candidate))[0];
    trimmed.push({ key: stops[far].c.candidate.key, name: stops[far].c.candidate.name, reason: 'rimossa per rientrare nel tempo disponibile' }); trimmedIdx.push(far);
    keep = keep.filter((i) => i !== far);
    sched = schedFor(keep);
  }
  // Attese evitabili (appuntamenti fissi/impegni): riempite con tappe idonee vicine (prima quelle tagliate, poi la riserva), solo se il piano resta fattibile e l'attesa cala.
  const filled: string[] = [];
  if (sched.feasible && (trimmedIdx.length || reserveIdx.length)) {
    const f = fillWaits(schedInput, keep, [...trimmedIdx, ...reserveIdx]);
    if (f.added.length) { keep = f.keep; sched = f.sched; for (const i of f.added) { stops[i].reason += ' (aggiunta per utilizzare un\'attesa)'; filled.push(stops[i].c.candidate.key); } }
  }
  stops = keep.map((i) => stops[i]);
  if (!sched.feasible) {
    const over = Math.round(sched.finishMin - workEnd);
    const late = sched.stops.filter((s) => s.role !== 'suggested' && s.departureMin > workEnd).map((s) => `${s.name} (${s.role === 'appointment' ? 'appuntamento' : 'impegno'} ore ${fmt(s.arrivalMin)}, oltre le ${minToTime(workEnd)})`);
    const msg = cr.wantAll ? `Visitare tutti i ${stops.length} punti richiesti richiede ${fmt(sched.totals.totalMin)} h (fine prevista ${fmt(sched.finishMin)}, oltre le ${minToTime(workEnd)} di ${over} min). Non taglio tappe né aggiungo giornate senza il tuo consenso.`
      : sched.conflicts.length ? `Le tappe obbligatorie sono in conflitto: ${sched.conflicts.join('; ')}.`
      : `Le sole tappe obbligatorie non entrano nell'orario (fine prevista ${fmt(sched.finishMin)}, limite ${minToTime(workEnd)})${late.length ? `: ${late.join('; ')}. Non sposto impegni: escludili esplicitamente o prolunga l'orario` : ''}.`;
    const conflicts = [...sched.conflicts, ...late.map((l) => `impegno oltre l'orario: ${l}`), ...(over > 0 ? [`sforamento ${over} min`] : [])];
    return { kind: 'ask', question: { id: 'infeasible', kind: 'infeasible', text: `${msg} Come procedo?`, options: [{ id: 'reduce', label: 'Scegli tu un sottoinsieme compatto' }, { id: 'split_days', label: 'Dividi su più giornate' }, { id: 'extend', label: 'Prolunga l\'orario' }, { id: 'change_date', label: 'Cambia giorno' }] }, payload: { conflicts }, conflicts };
  }
  const geometry = await ports.routing.geometry([departure, ...sched.stops.map((s) => ({ lat: s.lat, lng: s.lng })), ...(returnTo ? [returnTo] : [])]); metrics.routingCalls++;
  const fixedToday = new Set(commitments.map((c) => c.name));
  const warnings = [...sched.warnings, ...externalIncluded.map((d) => fixedToday.has(d.name)
    ? `impegno "${d.name}" fuori dal pool pianificato: tempo riservato nell'orario fissato, trasferimento non verificato`
    : `follow-up arretrato "${d.name}" fuori dall'area del giro: non inserito nel percorso, resta da pianificare separatamente (nessun tempo riservato)`)];
  if (filled.length) warnings.push(`${filled.length} tappe idonee vicine aggiunte per utilizzare attese altrimenti inevitabili (appuntamenti/impegni a orario fisso)`);
  else if (sched.totals.waitMin >= 15) warnings.push(`attese ${Math.round(sched.totals.waitMin)} min dovute a impegni a orario fisso: nessuna tappa idonea vicina compatibile con l'orario`);
  if (sel.mixedUnmet) warnings.push(`gruppo "${sel.mixedUnmet === 'new' ? 'nuovi punti' : 'clienti'}" richiesto ma non rappresentabile nel tempo disponibile accanto alle altre tappe`);
  if (dq.poolTruncated) warnings.push('pool candidati analizzato parzialmente: la selezione non è esaustiva');
  if (!load.complete) warnings.push('registro/portafoglio caricati in modo incompleto: la copertura non è dichiarata completa');
  const proposals = session.followUpDecisions.filter((d) => d.decision === 'propose_reschedule').map((d) => `riprogrammazione proposta (non eseguita) per ${d.name}: ${d.proposedDate || 'data da definire'}`);
  const plan: Plan = {
    planId: io.newId(), sessionId: session.sessionId, sessionRevision: session.revision, engineVersion: ENGINE_VERSION, contractVersion: CONTRACT_VERSION, generatedAt: nowIso,
    date: cr.date, startMin, finishMin: sched.finishMin, endMin: workEnd, departure, returnTo, stops: sched.stops, totals: sched.totals, geometry,
    verification: matrix.source === 'osrm' ? 'verified_routing' : 'estimated_routing', snapshotRef: `crm@${nowIso}|agent:${agentId}|area:${JSON.stringify(cr.area)}`,
    selectionReasons: { selected: sched.stops.map((s) => ({ key: s.key, reason: s.reason })), excluded: [...rejected, ...sel.dropped.filter((d) => !filled.includes(d.key)), ...trimmed.filter((d) => !filled.includes(d.key))] },
    warnings, dependsOnPendingChanges: proposals,
  };
  const status: ResponseStatus = plan.verification === 'verified_routing' ? 'ready' : 'planning';
  const summary = `${formatDateIt(cr.date)} ${areaLabel(cr)} — ${groupsLabel(cr.groups)}: ${sched.stops.length} tappe, partenza ${fmt(startMin)}, fine ${fmt(sched.finishMin)} (guida ${Math.round(sched.totals.driveMin + sched.totals.returnMin)} min, visite ${Math.round(sched.totals.visitMin)} min, pause ${Math.round(sched.totals.breakMin)} min, attese ${Math.round(sched.totals.waitMin)} min).${status === 'planning' ? ' Tempi stimati: routing stradale non verificato.' : ''}${trimmed.length ? ` ${trimmed.length} tappe idonee lasciate fuori per il tempo disponibile.` : ''}`;
  return { kind: 'plan', plan, status, message: summary, dataQuality: dq, pendingDecisions: proposals.length ? ['reschedule_proposals_not_applied'] : [] };
}
