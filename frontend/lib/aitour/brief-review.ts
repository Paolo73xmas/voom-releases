import type { TourBriefV4, BriefStopRef, BriefPlace } from './brief-v4';
import type { BriefCustomer } from './brief-customers';
import { matchBriefCustomers, validCustomerPoint } from './brief-customers';
import { areaProblem, areaConsentKey, outsideAreaReason } from './brief-area';
import { journeyProblems } from './brief-journey';
import { pendingUnresolvedEntities } from './brief-consistency';

export function identifyBriefStops(refs: BriefStopRef[], customers: BriefCustomer[]): BriefStopRef[] {
  return refs.map((r) => { const m = matchBriefCustomers(r, customers); return { ...r, selectedCustomerId: m.status === 'resolved' ? m.options[0].id : undefined }; });
}
export function briefReviewProblems(brief: TourBriefV4, customers: BriefCustomer[]): string[] {
  const errors = brief.areas.map(areaProblem).filter((s): s is string => !!s);
  errors.push(...journeyProblems(brief.journey));
  const places: [string, BriefPlace | null | undefined][] = [['Partenza', brief.route.startPlace], ['Arrivo', brief.route.endPlace]];
  for (const [label, p] of places) if (p && (!p.point || !validCustomerPoint(p.point))) errors.push(`${label}: conferma ${p.rawReference}`);
  const kept = [...brief.mandatoryStops, ...brief.preferredStops].filter((r) => r.areaDecision !== 'exclude');
  if (brief.includeAutomatic === false && !kept.length) errors.push('Nessun cliente selezionato: indica una tappa o autorizza altri clienti');
  const rd = brief.requestedDate;
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  if (rd.value && rd.value < today) errors.push('La data richiesta è già passata: scegli una data futura');
  if ((rd.type === 'explicit' || rd.type === 'selected') && (!rd.value || !/^\d{4}-\d{2}-\d{2}$/.test(rd.value))) errors.push('Scegli la data del giro (AAAA-MM-GG)');
  for (const r of kept) {
    const c = customers.find((x) => x.id === r.selectedCustomerId);
    if (!c) { errors.push(`Cliente da identificare: ${r.rawReference}`); continue; }
    if (!validCustomerPoint(c)) errors.push(`${c.name}: coordinate mancanti o non valide nell'anagrafica`);
    if (outsideAreaReason(c, brief.areas, brief.journey) && (r.areaDecision !== 'include' || r.areaConsent !== areaConsentKey(c, brief.areas, brief.journey))) errors.push(`${c.name}: scegli se includere l'eccezione fuori zona o escluderla`);
  }
  const ids = kept.map((r) => r.selectedCustomerId).filter(Boolean);
  if (new Set(ids).size !== ids.length) errors.push('Lo stesso cliente è indicato più volte: elimina il doppione');
  const n = new Set(brief.mandatoryStops.filter((r) => r.areaDecision !== 'exclude').map((r) => r.selectedCustomerId).filter(Boolean)).size;
  const vt = brief.visitTarget;
  const upper = vt.mode === 'range' ? vt.max : ['exact', 'approximately', 'maximum'].includes(vt.mode) ? vt.value ?? vt.max : null;
  if (vt.scope !== 'automatic_plus_mandatory' && upper && n > upper) errors.push(`${n} clienti obbligatori ma ${upper} visite richieste: correggi il numero o escludi una tappa`);
  if (brief.includeAutomatic === false && ['exact', 'minimum', 'range'].includes(vt.mode)) {
    const lower = vt.mode === 'range' ? vt.min : vt.value;
    if (lower && lower > kept.length) errors.push(`Hai indicato ${kept.length} clienti per ${lower} visite: correggi il numero o autorizza altri clienti`);
  }
  const pending = pendingUnresolvedEntities(brief);
  errors.push(...pending.map((e) => `Da chiarire nella richiesta: ${e}`));
  for (const time of [brief.route.startTime, brief.route.endTime, brief.route.finishBy]) if (time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) errors.push('Usa orari validi nel formato HH:MM');
  const start = brief.route.startTime, finish = brief.route.finishBy || brief.route.endTime;
  if (start && finish && start >= finish) errors.push('L’orario di arrivo/fine deve essere successivo alla partenza');
  return [...new Set(errors)];
}