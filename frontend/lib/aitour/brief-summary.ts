// Riassunto deterministico del TourBrief generato dal CRM a partire dai chip finali:
// e' sempre coerente con cio' che il planner ricevera', anche dopo modifiche manuali.
// Parità web src/lib/aitour/brief-summary.ts
import type { TourBriefV4, BriefStopRef } from './brief-v4';
import { conditionLabel, preferenceLabel, projectRuleLabel, fillerLabel } from './brief-v4';
import type { BriefCustomer } from './brief-customers';
import { journeyLabel } from './brief-journey';
import { RECENT_CONTACT_DAYS } from './scoring';

const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function resolveBriefDate(brief: TourBriefV4, now = new Date()): string {
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = fmt(now);
  let date = today;
  if (brief.requestedDate.type === 'tomorrow') { const t = new Date(now); t.setDate(t.getDate() + 1); date = brief.requestedDate.value || fmt(t); }
  else if ((brief.requestedDate.type === 'explicit' || brief.requestedDate.type === 'selected') && brief.requestedDate.value) date = brief.requestedDate.value;
  return date < today ? today : date;
}

const lower = (s: string) => s ? s[0].toLowerCase() + s.slice(1) : s;
const joinIt = (parts: string[], sep = ', ', last = ' e ') => parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(sep)}${last}${parts[parts.length - 1]}`;

function stopText(s: BriefStopRef, customers: BriefCustomer[]): string {
  const c = customers.find((x) => x.id === s.selectedCustomerId);
  let t = c ? `${c.name}${c.city ? ` (${c.city})` : ''}` : s.rawReference;
  const a = s.appointment;
  if (a && a.type !== 'none') t += a.type === 'window' ? ` tra le ${a.from} e le ${a.to}` : a.type === 'approximate' ? ` verso le ${a.time}` : ` alle ${a.time}`;
  if (s.priority === 1) t += ' [priorità alta]';
  if (s.priority === 3) t += ' [per ultimo]';
  return t;
}

export function briefSummary(brief: TourBriefV4, customers: BriefCustomer[], now = new Date()): string {
  const date = resolveBriefDate(brief, now);
  const today = resolveBriefDate({ ...brief, requestedDate: { type: 'today', value: null } }, now);
  const dayWord = brief.dayType === 'sviluppo' ? 'Giro di sviluppo' : brief.dayType === 'mista' ? 'Giro misto' : brief.dayType === 'clienti' ? 'Giro clienti' : 'Giro';
  const when = date === today ? 'oggi' : brief.requestedDate.type === 'tomorrow' ? `domani ${dmy(date)}` : `il ${dmy(date)}`;
  const sentences: string[] = [];

  const mand = brief.mandatoryStops.filter((s) => s.areaDecision !== 'exclude');
  const pref = brief.preferredStops.filter((s) => s.areaDecision !== 'exclude');
  const excludedNamed = [...brief.mandatoryStops, ...brief.preferredStops].filter((s) => s.areaDecision === 'exclude');

  let who = '';
  if (brief.includeAutomatic === false) who = 'solo i clienti che hai nominato';
  else {
    const conds = brief.selection.conditions.map((c) => lower(conditionLabel(c)));
    who = conds.length ? joinIt(conds, ', ', brief.selection.operator === 'OR' ? ' oppure ' : ' e ') : 'tutti i clienti';
  }
  let where = '';
  if (brief.journey?.stages.length) where = ` lungo il percorso ${brief.journey.stages.map(journeyLabel).join(' → ')}`;
  const inc = brief.areas.filter((a) => a.mode === 'include').map((a) => a.kind === 'province' ? `provincia ${a.value}` : a.kind === 'place' ? `zona ${a.value}${a.radiusKm ? ` (${a.radiusKm} km)` : ''}` : a.value);
  const prf = brief.areas.filter((a) => a.mode === 'prefer').map((a) => a.value);
  const exc = brief.areas.filter((a) => a.mode === 'exclude').map((a) => a.kind === 'province' ? `provincia ${a.value}` : a.value);
  if (inc.length) where += ` a ${joinIt(inc)}`;
  if (prf.length) where += `, preferibilmente ${joinIt(prf)}`;
  if (exc.length) where += `, evitando ${joinIt(exc)}`;
  sentences.push(`${dayWord} ${when}: ${who}${where}.`);

  const excl = brief.exclusions.map((c) => lower(conditionLabel(c)));
  if (excl.length) sentences.push(`Esclusi: ${joinIt(excl)}.`);
  const prefs = brief.preferences.map((p) => lower(preferenceLabel(p)));
  if (prefs.length) sentences.push(`Preferenze: ${joinIt(prefs)}.`);
  if (brief.projectRules.length) sentences.push(`Quote tra progetti: ${joinIt(brief.projectRules.map((r) => lower(projectRuleLabel(r))))}.`);
  if (brief.fillers.length) sentences.push(`${joinIt(brief.fillers.map(fillerLabel), '; ', '; ')} (aggiunti solo nel tempo residuo, vicino al giro).`);

  if (mand.length) sentences.push(`${mand.length === 1 ? 'Tappa obbligatoria' : `${mand.length} tappe obbligatorie`}: ${joinIt(mand.map((s) => stopText(s, customers)))}.`);
  if (pref.length) sentences.push(`Se possibile anche ${joinIt(pref.map((s) => stopText(s, customers)))}.`);
  if (excludedNamed.length) sentences.push(`Escluse su tua scelta: ${joinIt(excludedNamed.map((s) => stopText(s, customers)))}.`);

  const vt = brief.visitTarget;
  const scope = vt.scope === 'automatic_plus_mandatory' && mand.length ? ' oltre agli obbligatori' : mand.length ? ' compresi gli obbligatori' : '';
  const target = vt.mode === 'exact' ? `${vt.value} visite${scope}` : vt.mode === 'approximately' ? `circa ${vt.value} visite${scope}` : vt.mode === 'maximum' ? `al massimo ${vt.value ?? vt.max} visite${scope}`
    : vt.mode === 'minimum' ? `almeno ${vt.value ?? vt.min} visite${scope}` : vt.mode === 'range' ? `da ${vt.min} a ${vt.max} visite${scope}` : vt.mode === 'all' ? 'tutti i clienti idonei' : vt.mode === 'maximize' ? 'il massimo di visite possibile' : '';
  const timing: string[] = [];
  if (brief.route.startTime) timing.push(`dalle ${brief.route.startTime}`);
  if (brief.route.finishBy) timing.push(`fine tassativa entro le ${brief.route.finishBy}`);
  else if (brief.route.endTime) timing.push(`fine entro le ${brief.route.endTime}`);
  const t2 = [target, timing.join(', ')].filter(Boolean);
  if (t2.length) sentences.push(`${t2.join(', ')[0].toUpperCase()}${t2.join(', ').slice(1)}.`);

  const route: string[] = [];
  if (brief.route.startPlace) route.push(`partenza da ${brief.route.startPlace.kind === 'home' ? 'casa' : brief.route.startPlace.kind === 'office' ? 'sede' : brief.route.startPlace.rawReference}`);
  else route.push('partenza dalla posizione attuale');
  if (brief.route.returnToStart) route.push('ritorno al punto di partenza');
  else if (brief.route.returnHome) route.push('rientro a casa');
  else if (brief.route.endPlace) route.push(`arrivo a ${brief.route.endPlace.rawReference}`);
  if (brief.route.compact === 'required') route.push('tutte le visite in una sola zona');
  else if (brief.route.compact === 'prefer') route.push('percorso compatto se possibile');
  if (brief.route.splitAllowed === false) route.push('tutto in un giorno');
  else if (brief.route.maxDays) route.push(`al massimo ${brief.route.maxDays} giornate`);
  sentences.push(`${route.join(', ')[0].toUpperCase()}${route.join(', ').slice(1)}.`);

  if (brief.includeAutomatic !== false) sentences.push(`I clienti visitati o con ordine negli ultimi ${RECENT_CONTACT_DAYS} giorni restano fuori, salvo quelli nominati o con follow-up in scadenza.`);
  return sentences.join(' ');
}
