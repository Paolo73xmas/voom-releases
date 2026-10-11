import type { DayPlan, Plan, PlanStop, NormalizedCriteria, Question } from './wire-contract';
import type { DayView, PlanView, StopView, QuestionView } from './contract';
import { displayCoordinates } from './coordinates';
export const formatMinute = (m: number): string => `${String(Math.floor(Math.round(m) / 60)).padStart(2, '0')}:${String(Math.round(m) % 60).padStart(2, '0')}`;
const minutes = (m: number) => `${m} min`;
const km = (n: number) => `${n.toFixed(1).replace('.', ',')} km`;
const point = (p: { lat: number; lng: number; label?: string }) => ({ coordinate: { latitude: p.lat, longitude: p.lng }, label: p.label || `${p.lat}, ${p.lng}` });
function stopView(s: PlanStop, i: number, day: number): StopView {
  return { id: `${day}-${i + 1}`, sequence: String(i + 1), name: s.name, city: s.city, coordinate: point(s).coordinate,
    arrival: formatMinute(s.arrivalMin), departure: formatMinute(s.departureMin), travel: `${minutes(s.travelMinFromPrev)} · ${km(s.travelKmFromPrev)}`,
    visit: minutes(s.visitMin), wait: minutes(s.waitMin), lunch: minutes(s.lunchBeforeMin), reason: s.reason,
    role: s.role, group: s.group, outsideWindow: s.outsideWindow, mandatory: s.role !== 'suggested',
    lastOrder: s.lastOrderDate ? `${s.lastOrderDate}${s.daysSinceOrder != null ? ` · ${s.daysSinceOrder} giorni` : ''}` : 'Non fornito dal motore',
    options: [
      { id: 'require', label: 'Richiedi questa tappa', command: { name: 'require_stop', input: { key: s.key } } },
      { id: 'exclude', label: 'Escludi questa tappa', command: { name: 'exclude_stop', input: { key: s.key } } },
    ] };
}
export function presentPlan(plan: Plan): PlanView {
  const multi = !!plan.days && plan.days.length > 1;
  const days = multi ? plan.days! : [plan];
  return { planId: plan.planId, metadata: `${plan.engineVersion} · contratto ${plan.contractVersion} · ${plan.generatedAt}`,
    routing: plan.verification === 'verified_routing' ? 'verified' : 'estimated', warnings: [...plan.warnings, ...plan.dependsOnPendingChanges],
    excluded: plan.selectionReasons.excluded,
    days: days.map((d, index): DayView => {
      const day = d as DayPlan, t = d.totals;
      const geometry = d.geometry.length ? d.geometry : [[d.departure.lat, d.departure.lng], ...d.stops.map(s => [s.lat, s.lng]), ...(d.returnTo ? [[d.returnTo.lat, d.returnTo.lng]] : [])];
      return { id: String(multi ? day.day : 1), title: `Giorno ${multi ? day.day : 1}`, date: d.date,
        start: { ...point(d.departure), label: `${formatMinute(d.startMin)} · ${point(d.departure).label}${day.startsFrom === 'previous_day_end' ? ' · fine giornata precedente' : ''}` },
        end: d.returnTo ? { ...point(d.returnTo), label: `${formatMinute(d.finishMin)} · ${point(d.returnTo).label}` } : null,
        geometry: displayCoordinates(geometry, 'lat_lng'), geometryKind: d.geometry.length ? 'server' : 'connections',
        stops: d.stops.map((s, i) => stopView(s, i, index + 1)),
        metrics: [ ['distance', 'Chilometri complessivi', km(t.totalKm)], ['drive', 'Guida tra tappe', minutes(t.driveMin)],
          ['return', 'Rientro', minutes(t.returnMin)], ['visit', 'Visite', minutes(t.visitMin)], ['wait', 'Attese', minutes(t.waitMin)],
          ['break', 'Pause', minutes(t.breakMin)], ['total', 'Tempo complessivo', minutes(t.totalMin)],
          ['available', 'Tempo disponibile', minutes(t.availableMin)], ['buffer', 'Margine', minutes(t.bufferMin)],
          ['finish', 'Fine / limite', `${formatMinute(d.finishMin)} / ${formatMinute(d.endMin)}`] ].map(([id, label, value]) => ({ id, label, value })),
        breaks: [], commitments: [], overnight: multi && !day.returnHomeAfterDay ? `Pernottamento proposto${day.nightKmHome != null ? ` · casa a ${km(day.nightKmHome)}` : ''} · ${day.nightDecision}` : undefined,
        warnings: [...(multi ? [...day.warnings, ...day.conflicts] : []), ...(!d.geometry.length ? ['Geometria non fornita: la linea collega solo i punti, non è un percorso stradale ricostruito.'] : [])] };
    }) };
}
export function criteriaLabels(c: NormalizedCriteria): string[] {
  const g = c.groups;
  return [g?.existing && 'Clienti esistenti', g?.newPoints && 'Nuovi punti mai visitati', g?.ownOnly && 'Solo mio portafoglio',
    g?.inactiveDays != null && `Inattività ≥ ${g.inactiveDays} giorni`, g?.needsDays && 'Soglia da chiarire',
    c.area?.comuni.join(', '), c.area?.provincia, c.date, c.startTime && `Partenza ${c.startTime}`, c.endTime && `Fine entro ${c.endTime}`,
    c.maxDays != null && `Giornate: ${c.maxDays}`, c.extraDaysApproved && 'Giornate aggiuntive autorizzate',
    c.wantAll && 'Tutte le tappe richieste', c.area?.exhaustive && 'Area esaustiva', c.nonWorkingConfirmed && 'Giorno non lavorativo confermato',
    ...c.requiredKeys.map(k => `Richiesta: ${k}`), ...c.requiredNames.map(k => `Richiesta: ${k}`),
    ...c.excludedKeys.map(k => `Esclusa: ${k}`), ...c.excludedNames.map(k => `Esclusa: ${k}`), ...c.consents].filter((v): v is string => typeof v === 'string' && !!v);
}
export function presentQuestion(q: Question): QuestionView {
  const result: QuestionView = { id: q.id, kind: q.kind, text: q.text, options: q.options.map(o => ({ id: o.id, label: o.label,
    command: { name: 'answer', input: { questionId: q.id, optionId: o.id } } })) };
  if (q.kind === 'follow_ups' && q.id.startsWith('followups:')) {
    const ids = q.id.slice('followups:'.length).split(',').filter(Boolean);
    const rows = q.text.split('\n').filter(row => row.trim().startsWith('•')).map(row => row.replace(/^\s*•\s*/, ''));
    // No guessed association if the parallel ID/text lists do not agree.
    if (ids.length === rows.length && new Set(ids).size === ids.length) result.followUps = ids.map((id, i) => ({ id, text: rows[i] }));
  }
  return result;
}