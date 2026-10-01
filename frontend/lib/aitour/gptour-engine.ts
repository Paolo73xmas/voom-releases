import type { GptDay, GptResult } from './gptour-api';
import type { TourIntent } from './gptour-intent';
import type { AiTourSettings, GeoPoint, TourCandidate, TourPlan } from './types';
import { haversineKm, timeToMin } from './types';
import { candidateMatchesTourIntent, candidateIntentProblems } from './gptour-criteria';
import { IdentitySet, identityTokensOf } from './gptour-identity';
import { addDaysIso, isoDow, nextWorkingDay, validDate } from './gptour-dates';
import { planGptDay, routing, roadKmWithRetry, decideReturnHome, type RoutingDependencies } from './gptour-routing';
import type { GptEvent } from './gptour-followups';

export interface GptDayPlan {
  day: number; total: number; plan: TourPlan; startsFrom: 'home' | 'previous_day_end';
  returnHomeAfterDay: boolean; nightKmHome: number | null;
  nightDecision: 'threshold' | 'global' | 'last_day' | 'routing_unknown' | 'unstable';
  nightFirstStop?: string;
}
export interface GptBuild { days: GptDayPlan[]; result: GptResult; warnings: string[] }
export function resultDays(r: GptResult, date: string): GptDay[] {
  const days = r.multiDay && r.days.length ? r.days : [{ day: 1, tourDate: r.tourDate || date, area: null, startTime: r.startTime, endTime: r.endTime, selection: r.selection }];
  return days.map((d, i) => ({ ...d, day: i + 1, tourDate: d.tourDate || addDaysIso(r.tourDate || date, i), selection: [...d.selection] }));
}
/** Same identity on two CRM event dates must be resolved, never silently deduplicated. */
export function assertEventIdentity(intent: TourIntent, pool: TourCandidate[]): void {
  const tokens = new Map<string, { id: string; date: string }>();
  for (const d of intent.followUpDecisions.filter((x) => x.decision !== 'excluded')) {
    const c = pool.find((x) => x.key === d.key); if (!c) throw new Error(`Follow-up ${d.customerName}: cliente non disponibile nel portafoglio autorizzato.`);
    for (const token of identityTokensOf(c)) {
      const old = tokens.get(token);
      if (old && old.id !== d.followUpId && old.date !== d.currentDate)
        throw new Error(`Due follow-up distinti di ${d.customerName} hanno date diverse. Mantieni un evento nel giro o pianifica giri separati: nessun evento è stato eliminato.`);
      tokens.set(token, { id: d.followUpId, date: d.currentDate });
    }
  }
}
export function prepareGptDays(r: GptResult, pool: TourCandidate[], intent: TourIntent, settings: AiTourSettings, date: string): { days: GptDay[]; warnings: string[] } {
  assertEventIdentity(intent, pool);
  let days = resultDays(r, date); const warnings: string[] = [];
  if (days.some((d) => !validDate(d.tourDate || ''))) throw new Error('Data del giro non valida.');
  if (new Set(days.map((d) => d.tourDate)).size !== days.length) throw new Error('Due giornate hanno la stessa data. Correggi le date.');
  if (intent.maxDays && days.length > intent.maxDays) throw new Error(`La risposta supera il limite di ${intent.maxDays} giorni. Nessun piano è stato sostituito.`);
  const byKey = new Map(pool.map((c) => [c.key, c])), seen = new IdentitySet();
  const keep = intent.followUpDecisions.filter((d) => d.decision !== 'excluded');
  const keptKeys = new Set(keep.map((d) => d.key));
  const excluded = new Set(intent.followUpDecisions.filter((d) => d.decision === 'excluded' && !keptKeys.has(d.key)).map((d) => d.key));
  // Dated followups own the visit's date, not the LLM's placement.
  for (const day of days) day.selection = day.selection.filter((s) => !keptKeys.has(s.key));
  for (const dec of keep) {
    let target = days.find((d) => d.tourDate === dec.currentDate);
    if (!target && dec.currentDate < date) target = days[0];
    if (!target) throw new Error(`Il follow-up di ${dec.customerName} è al ${dec.currentDate}, fuori dalle date del giro. Modifica le date o escludilo esplicitamente.`);
    if (!target.selection.some((s) => s.key === dec.key)) target.selection.unshift({ key: dec.key, reason: 'Follow-up confermato' });
  }
  for (const day of days) day.selection = day.selection.filter((s) => {
    const c = byKey.get(s.key);
    if (!c) { warnings.push(`Chiave non disponibile: ${s.key}`); return false; }
    const problems = candidateIntentProblems(c, intent);
    if (excluded.has(s.key)) problems.push('follow-up escluso dal giro');
    if (problems.length) {
      if (keptKeys.has(s.key) || intent.requiredStops.includes(s.key)) throw new Error(`${c.name}: obbligatorio in conflitto (${problems.join(', ')}). Correggi i criteri o la decisione.`);
      warnings.push(`${c.name}: escluso (${problems.join(', ')})`); return false;
    }
    if (seen.has(c)) { warnings.push(`${c.name}: duplicato accorpato`); return false; }
    seen.add(c); return true;
  });
  for (const key of intent.requiredStops) {
    const c = byKey.get(key);
    if (!c || !candidateMatchesTourIntent(c, intent)) throw new Error(`Tappa obbligatoria non idonea o non disponibile: ${c?.name || key}`);
    if (!seen.has(c)) { days[0].selection.push({ key, reason: 'Obbligatoria' }); seen.add(c); }
  }
  const average = pool.reduce((s, c) => s + c.visitMinutes, 0) / Math.max(1, pool.length) || 25;
  const capacity = Math.max(1, Math.floor((timeToMin(settings.work_end) - timeToMin(settings.work_start) - settings.lunch_break_minutes) / (average + 12)));
  if (intent.wantAll) for (const c of pool.filter((x) => candidateMatchesTourIntent(x, intent) && !excluded.has(x.key))) {
    if (seen.has(c)) continue;
    const center = (d: GptDay) => { const cs = d.selection.map((s) => byKey.get(s.key)!); return cs.length ? { lat: cs.reduce((a, x) => a + x.lat, 0) / cs.length, lng: cs.reduce((a, x) => a + x.lng, 0) / cs.length } : c; };
    const ranked = [...days].sort((a, b) => { const x = center(a), y = center(b); return haversineKm(c.lat, c.lng, x.lat, x.lng) - haversineKm(c.lat, c.lng, y.lat, y.lng); });
    let target = ranked.find((d) => d.selection.length < capacity && !c.excludedDays?.includes(isoDow(d.tourDate!)) && haversineKm(c.lat, c.lng, center(d).lat, center(d).lng) <= 45);
    if (!target && (!intent.maxDays || days.length < intent.maxDays)) {
      let newDate = nextWorkingDay(days[days.length - 1].tourDate!);
      for (let n = 0; n < 7 && c.excludedDays?.includes(isoDow(newDate)); n++) newDate = nextWorkingDay(newDate);
      target = { day: days.length + 1, tourDate: newDate, area: c.city, startTime: null, endTime: null, selection: [] }; days.push(target);
    }
    target ||= ranked[0]; // preserve all visits at maxDays; feasibility remains blocking at save.
    target.selection.push({ key: c.key, reason: 'Completamento deterministico: tutti gli idonei' }); seen.add(c);
  }
  // Rebalance only unpinned days and only if geographic/calendar constraints remain valid.
  if (intent.wantAll && !keep.length && !r.orderImposed) {
    for (let i = days.length - 1; i > 0; i--) {
      const small = days[i];
      const target = days.slice(0, i).find((d) => d.selection.length + small.selection.length <= capacity && small.selection.every((s) => {
        const c = byKey.get(s.key)!; return !c.excludedDays?.includes(isoDow(d.tourDate!)) && d.selection.every((x) => { const a = byKey.get(x.key)!; return haversineKm(a.lat, a.lng, c.lat, c.lng) <= 45; });
      }));
      if (target) { target.selection.push(...small.selection); days.splice(i, 1); }
    }
  }
  days = days.filter((d) => d.selection.length).map((d, i) => ({ ...d, day: i + 1 }));
  if (!days.length) throw new Error('Nessun candidato rispetta i criteri. Modifica la richiesta: nessuna selezione è stata inventata.');
  return { days, warnings };
}
export async function buildGptour(r: GptResult, pool: TourCandidate[], intent: TourIntent, settings: AiTourSettings,
  home: GeoPoint, date: string, deps: RoutingDependencies = routing, calendar: GptEvent[] = []): Promise<GptBuild> {
  const prepared = prepareGptDays(r, pool, intent, settings, date), ds = prepared.days;
  const required = new Set([...intent.requiredStops, ...intent.followUpDecisions.filter((d) => d.decision !== 'excluded').map((d) => d.key)]);
  const byKey = new Map(pool.map((c) => [c.key, c]));
  let homes = ds.map((_, i) => i === ds.length - 1 || r.lodging !== 'away');
  const unknown = new Set<number>(), unstable = new Set<number>(); let plans: GptDayPlan[] = [];
  const history = new Set<string>();
  const calculate = async () => {
    const out: GptDayPlan[] = [];
    for (let index = 0; index < ds.length; index++) {
      const d = ds[index], previous = out[index - 1];
      const fromPrevious = !!previous && !homes[index - 1];
      const prevLast = previous?.plan.stops[previous.plan.stops.length - 1]?.candidate;
      const start = fromPrevious && prevLast ? { lat: prevLast.lat, lng: prevLast.lng, label: `Pernottamento · ${prevLast.city}` } : home;
      const list = d.selection.map((s) => ({ ...byKey.get(s.key)!, reason: s.reason || '' })).map((c) => {
        if (intent.followUpDecisions.some((f) => f.key === c.key && f.decision !== 'excluded')) c = { ...c, isFollowUp: true };
        const appointments = calendar.filter((e) => e.customerId === c.customerId && e.customerId && e.date === d.tourDate);
        if (appointments.length > 1) throw new Error(`${c.name}: più appuntamenti distinti nella stessa giornata. Verifica gli orari prima di costruire il giro.`);
        if (appointments.length) {
          const e = appointments[0]; required.add(c.key);
          c = { ...c, appointmentAt: e.appointmentDate, preferredSlots: [{ id: e.id, label: `Appuntamento ${e.time}`, start: timeToMin(e.time), end: timeToMin(e.time) + 5, strict: true }] };
        }
        const timed = intent.followUpDecisions.filter((f) => f.key === c.key && f.decision !== 'excluded' && f.currentDate === d.tourDate && f.currentTime);
        const times = [...new Set(timed.map((f) => f.currentTime!))];
        if (times.length > 1) throw new Error(`${c.name}: due follow-up con orari distinti. Risolvi il conflitto senza eliminare eventi.`);
        return timed.length ? { ...c, isFollowUp: true, preferredSlots: [{ id: timed[0].followUpId, label: `Follow-up ${times[0]}`, start: timeToMin(times[0]), end: timeToMin(times[0]) + 5, strict: true }] } : c;
      });
      const plan = await planGptDay(list, start, homes[index] ? home : null, d.tourDate!,
        { ...settings, work_start: d.startTime || r.startTime || settings.work_start, work_end: d.endTime || r.endTime || settings.work_end }, !!r.orderImposed, required, deps,
        calendar.filter((e) => e.date === d.tourDate && !list.some((c) => c.customerId && c.customerId === e.customerId)).map((e) => ({ start: timeToMin(e.time), end: timeToMin(e.time) + e.duration, name: e.name })));
      const outside = calendar.filter((e) => e.date === d.tourDate && !list.some((c) => c.customerId && c.customerId === e.customerId));
      if (outside.length) plan.warnings.push('Tempo riservato agli appuntamenti esterni al giro; trasferimento non verificato. Includi il relativo cliente o verifica l’impegno nel calendario prima di salvare.');
      out.push({ day: index + 1, total: ds.length, plan, startsFrom: fromPrevious ? 'previous_day_end' : 'home', returnHomeAfterDay: homes[index], nightKmHome: null, nightDecision: index === ds.length - 1 ? 'last_day' : 'global' });
    }
    return out;
  };
  for (let pass = 0; pass < 4; pass++) {
    plans = await calculate();
    if (!intent.lodgingRule) break;
    const next = [...homes];
    for (let i = 0; i < plans.length - 1; i++) {
      const first = plans[i + 1].plan.stops[0].candidate;
      const km = await roadKmWithRetry(home, { ...first, label: first.name }, deps);
      plans[i].nightKmHome = km; plans[i].nightFirstStop = first.name;
      if (km === null) { unknown.add(i); next[i] = true; } else { unknown.delete(i); next[i] = decideReturnHome(km, intent.lodgingRule.maxKmHome); }
      plans[i].nightDecision = unknown.has(i) ? 'routing_unknown' : 'threshold';
    }
    if (next.every((v, i) => v === homes[i])) break;
    const key = JSON.stringify(next);
    if (history.has(key) || pass === 3) {
      next.forEach((v, i) => { if (v !== homes[i]) unstable.add(i); }); homes = homes.map((v, i) => unstable.has(i) || unknown.has(i) ? true : v);
      plans = await calculate(); break;
    }
    history.add(JSON.stringify(homes)); homes = next;
  }
  for (const i of unknown) { plans[i].nightDecision = 'routing_unknown'; plans[i].nightKmHome = null; plans[i].plan.warnings.push('routing_unknown: distanza stradale non disponibile, rientro prudenziale a casa.'); }
  for (const i of unstable) { plans[i].nightDecision = 'unstable'; plans[i].plan.warnings.push('Decisione pernottamento instabile: rientro prudenziale a casa.'); }
  return { days: plans, warnings: prepared.warnings, result: { ...r, multiDay: ds.length > 1, days: ds, selection: ds.length === 1 ? ds[0].selection : [], tourDate: ds[0].tourDate } };
}