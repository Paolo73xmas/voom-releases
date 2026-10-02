import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { getSettings } from '../lib/aitour/tours';
import { DEFAULT_SETTINGS, minToTime, type AiTourSettings, type GeoPoint, type TourPlan } from '../lib/aitour/types';
import { loadGptourPool, type GptPool } from '../lib/aitour/gptour-data';
import { runGptour, type GptMessage, type GptResult } from '../lib/aitour/gptour-api';
import { DEFAULT_INTENT, mergeIntent, applyRejection, type TourIntent } from '../lib/aitour/gptour-intent';
import { buildGptour, prepareGptDays, resultDays, type GptBuild, type GptDayPlan } from '../lib/aitour/gptour-engine';
import { loadGptourEvents, pendingGptEvents, eventDecision, rescheduleGptFollowUp, followUpContext, followUpQuestion, formatDateIt, resolveRescheduleTarget, type GptEvent } from '../lib/aitour/gptour-followups';
import { attachGptourContext } from '../lib/aitour/gptour-context';
import { proposeGptour, type GptProposal } from '../lib/aitour/gptour-opportunities';
import { saveGptourBatch, reconcileGptourSave } from '../lib/aitour/gptour-save';
import { todayRome } from '../lib/aitour/gptour-dates';
import { candidateMatchesTourIntent } from '../lib/aitour/gptour-criteria';
import { acceptDisplayedFillKeys, acceptedKeysAfterIntentPatch, readAcceptedFillKeys, retainAcceptedFillKeys } from '../lib/aitour/gptour-acceptance';

export interface GptActor { id: string; role: string }
export function useGptour(actor: GptActor, agentId: string, agentName?: string) {
  const [settings, setSettings] = useState<AiTourSettings>(DEFAULT_SETTINGS);
  const [pool, setPool] = useState<GptPool | null>(null), [home, setHome] = useState<GeoPoint | null>(null);
  const [messages, setMessages] = useState<GptMessage[]>([]), [intent, setIntent] = useState<TourIntent>(DEFAULT_INTENT);
  const [acceptedFillKeys, setAcceptedFillKeys] = useState<string[]>([]);
  const [result, setResult] = useState<GptResult | null>(null), [days, setDays] = useState<GptDayPlan[]>([]);
  const [events, setEvents] = useState<GptEvent[]>([]), [groupId, setGroupId] = useState(randomUUID);
  const [activeDay, setActiveDay] = useState(0), [proposal, setProposal] = useState<GptProposal | null>(null);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [stale, setStale] = useState(true), [saved, setSaved] = useState<string[]>([]);
  const [uncertainSave, setUncertainSave] = useState(false), [reschedule, setReschedule] = useState<GptEvent | null>(null);
  const [draftAvailable, setDraftAvailable] = useState(false), [loadKey, setLoadKey] = useState(0);
  const epoch = useRef(0), inFlight = useRef(false), mounted = useRef(true);
  const loadedDraftKey = useRef<string | null>(null);
  const draftKey = `gptour:draft:v1:${actor.id}:${agentId}`;
  useEffect(() => { const counter = epoch; mounted.current = true; return () => { mounted.current = false; counter.current++; }; }, []);
  useEffect(() => {
    const counter = epoch;
    const token = ++counter.current;
    loadedDraftKey.current = null;
    setLoading(true); setPool(null); setDays([]); setResult(null); setMessages([]); setIntent(DEFAULT_INTENT); setEvents([]);
    setAcceptedFillKeys([]);
    setError(''); setHome(null); setProposal(null); setSaved([]); setStale(true); setUncertainSave(false); setGroupId(randomUUID()); setDraftAvailable(false);
    inFlight.current = false; setBusy(false);
    (async () => {
      try {
        const s = await getSettings(agentId), p = await loadGptourPool(agentId, s), draft = await AsyncStorage.getItem(draftKey);
        if (token !== epoch.current) return;
        setSettings(s); setPool(p);
        if (s.home_lat != null && s.home_lng != null) setHome({ lat: s.home_lat, lng: s.home_lng, label: s.home_address || 'Casa' });
        else if (s.office_lat != null && s.office_lng != null) setHome({ lat: s.office_lat, lng: s.office_lng, label: s.office_address || 'Sede' });
        if (draft) {
          const d = JSON.parse(draft);
          if (d.version === 1 && d.agentId === agentId && d.actorId === actor.id) {
            setMessages(d.messages || []); setIntent(mergeIntent(DEFAULT_INTENT, d.intent)); setResult(d.result || null);
            setGroupId(d.groupId || randomUUID()); setDraftAvailable(!!d.result); setUncertainSave(!!d.uncertainSave);
            setAcceptedFillKeys(d.gptourContext?.version === 1 ? readAcceptedFillKeys(d.gptourContext.acceptedFillKeys) : []);
          }
        }
        loadedDraftKey.current = draftKey;
      } catch (e) { if (token === epoch.current) setError(e instanceof Error ? e.message : 'Caricamento non riuscito.'); }
      finally { if (token === epoch.current) setLoading(false); }
    })();
    return () => { counter.current++; };
  }, [actor.id, agentId, draftKey, loadKey]);
  useEffect(() => {
    if (loading || !pool || loadedDraftKey.current !== draftKey) return;
    const token = epoch.current;
    AsyncStorage.setItem(draftKey, JSON.stringify({ version: 1, actorId: actor.id, agentId, groupId, messages, intent, result, uncertainSave, gptourContext: { version: 1, acceptedFillKeys } }))
      .catch(() => { if (token === epoch.current) setError('Bozza locale non salvata: non chiudere la schermata prima di aver verificato il piano.'); });
  }, [draftKey, actor.id, agentId, groupId, messages, intent, result, uncertainSave, acceptedFillKeys, loading, pool]);
  const withBusy = async (operation: (token: number) => Promise<void>) => {
    if (inFlight.current) return;
    const token = epoch.current; inFlight.current = true; setBusy(true); setError('');
    try { await operation(token); } catch (e) { if (token === epoch.current) setError(e instanceof Error ? e.message : 'Operazione non riuscita.'); }
    finally { if (token === epoch.current) { inFlight.current = false; setBusy(false); } }
  };
  const rebuild = async (nextResult: GptResult, nextIntent: TourIntent, token: number, selected = activeDay, nextAccepted: readonly string[] = acceptedFillKeys, suggest = true): Promise<{ blocked: boolean; notes: string[] }> => {
    if (!pool || !home) throw new Error('Scegli Casa, Sede o posizione GPS prima di costruire il giro.');
    const requiredKeys = new Set(nextIntent.followUpDecisions.filter((d) => d.decision !== 'excluded').map((d) => d.key));
    const available = [...pool.candidates, ...pool.authorizedCandidates.filter((c) => requiredKeys.has(c.key) && !pool.candidates.some((p) => p.key === c.key))];
    setStale(true);
    const accepted = retainAcceptedFillKeys(nextAccepted, [...resultDays(nextResult, todayRome()).flatMap((d) => d.selection.map((s) => s.key)), ...nextIntent.requiredStops, ...requiredKeys]);
    const initialDates = resultDays(nextResult, todayRome()).map((d) => d.tourDate!);
    nextIntent = { ...nextIntent, tourDates: initialDates };
    let agenda = await loadGptourEvents(agentId, initialDates, pool.authorizedCandidates);
    if (token !== epoch.current) return { blocked: true, notes: [] };
    setEvents(agenda); setResult(nextResult); setIntent(nextIntent); setAcceptedFillKeys(accepted);
    // Follow-up non decisi: domanda in chat e nessuna generazione definitiva (parità web).
    let pending = pendingGptEvents(agenda, nextIntent);
    if (pending.length) return { blocked: true, notes: [followUpQuestion(pending, initialDates)] };
    const prepared = prepareGptDays(nextResult, available, nextIntent, settings, todayRome(), accepted);
    const dates = prepared.days.map((d) => d.tourDate!);
    if (dates.join() !== initialDates.join()) {
      agenda = await loadGptourEvents(agentId, dates, pool.authorizedCandidates);
      if (token !== epoch.current) return { blocked: true, notes: [] };
      setEvents(agenda); pending = pendingGptEvents(agenda, nextIntent);
      if (pending.length) {
        setResult({ ...nextResult, multiDay: prepared.days.length > 1, days: prepared.days, selection: prepared.days.length === 1 ? prepared.days[0].selection : [] });
        setIntent({ ...nextIntent, tourDates: dates });
        return { blocked: true, notes: [`Per coprire tutti gli idonei ho aggiunto giornate (${dates.map((d) => formatDateIt(d)).join(', ')}). ${followUpQuestion(pending, dates)}`] };
      }
    }
    // Appointments remain appointments: don't silently convert them to follow-ups or drop commitments.
    const appointments = agenda.filter((e) => e.type !== 'follow_up' && dates.includes(e.date));
    const built = await buildGptour(nextResult, available, nextIntent, settings, home, todayRome(), undefined, appointments, accepted);
    if (token !== epoch.current) return { blocked: true, notes: [] };
    const retained = retainAcceptedFillKeys(accepted, built.days.flatMap((d) => d.plan.stops.map((s) => s.candidate.key)));
    const attached = attachGptourContext(built.days, { ...nextIntent, tourDates: dates }, groupId, retained), index = Math.min(selected, attached.length - 1);
    setAcceptedFillKeys(retained); setIntent({ ...nextIntent, tourDates: dates });
    setDays(attached); setResult(built.result); setActiveDay(index); setProposal(null); setStale(false); setDraftAvailable(false);
    const notes = narrate(built, nextResult);
    notes.unshift(`${attached.length > 1 ? `Giro su ${attached.length} giornate` : `Giro di ${formatDateIt(attached[0].plan.tourDate)}`}: ${attached.reduce((n, d) => n + d.plan.stops.length, 0)} tappe, ${Math.round(attached.reduce((n, d) => n + d.plan.totalKm, 0))} km. Lo trovi qui sotto: puoi modificarlo a mano o chiedermi altre modifiche.`);
    if (!suggest) return { blocked: false, notes };
    const suggestion = await proposeGptour(attached[index].plan, attached.map((d) => d.plan), pool.candidates, nextIntent, settings, !!nextResult.corridor?.suggest);
    if (token !== epoch.current) return { blocked: false, notes };
    setProposal(suggestion);
    if (suggestion.candidates.length) notes.push(proposalMessage(suggestion, attached[index].plan, settings.max_daily_buffer_minutes ?? 120, !!nextResult.corridor?.suggest, nextResult.corridor?.destinationLabel || attached[index].plan.areaLabel));
    return { blocked: false, notes };
  };
  const agentInfo = () => ({
    today: todayRome(), nome: agentName || null, nComuni: new Set(pool?.candidates.map((c) => c.city).filter(Boolean)).size, nClienti: pool?.candidates.length ?? 0, poolComplete: pool?.complete ?? false,
    orarioLavoro: { inizio: settings.work_start, fine: settings.work_end }, pausaPranzoMin: settings.lunch_break_minutes,
    durataVisitaMin: { cliente: settings.visit_minutes_client, prospect: settings.visit_minutes_prospect, orfano: settings.visit_minutes_orphan, nuova: settings.visit_minutes_prospect },
    casa: settings.home_lat != null ? { indirizzo: settings.home_address, lat: settings.home_lat, lng: settings.home_lng } : null,
    ufficio: settings.office_lat != null ? { indirizzo: settings.office_address, lat: settings.office_lat, lng: settings.office_lng } : null,
    partenza: home ? { indirizzo: home.label, lat: home.lat, lng: home.lng } : null, maxBufferMin: settings.max_daily_buffer_minutes,
  });
  const send = (text: string) => withBusy(async (token) => {
    if (!pool || !text.trim()) return;
    if (saved.length || uncertainSave) throw new Error('Questo giro è salvato o ha un salvataggio da verificare. Non modificarlo durante la verifica.');
    const nextMessages: GptMessage[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(nextMessages);
    const proposalKeys = proposal?.candidates.map((c) => c.key) || [];
    const response = await runGptour({ agentId, role: actor.role, pool: pool.candidates, messages: nextMessages, intent, agentInfo: agentInfo(),
      currentTour: days.map((d) => ({ day: d.day, total: d.total, tourDate: d.plan.tourDate, area: d.plan.areaLabel, startTime: minToTime(d.plan.startMin), endTime: minToTime(d.plan.endMin), stops: d.plan.stops.map((s) => ({ key: s.candidate.key, nome: s.candidate.name, comune: s.candidate.city, tipo: s.candidate.entityType })) })),
      followUps: followUpContext(events, intent, days.map((d) => d.plan.tourDate)),
      corridorProposal: proposal?.candidates.map((c) => ({ key: c.key, nome: c.name, comune: c.city, tipo: c.entityType, fat6m: c.revenue6m })),
    });
    if (token !== epoch.current) return;
    let nextIntent = mergeIntent(response.intentReset ? DEFAULT_INTENT : intent, response.intent);
    const nextAccepted = acceptedKeysAfterIntentPatch(acceptedFillKeys, intent, response.intent, response.intentReset);
    // Rifiuto della proposta: nessuna key proposta è finita nel giro -> memorizza il "no" (parità web).
    if (proposalKeys.length) {
      const resultKeys = new Set([...response.selection.map((s) => s.key), ...response.days.flatMap((d) => d.selection.map((s) => s.key))]);
      if (!proposalKeys.some((k) => resultKeys.has(k))) nextIntent = applyRejection(nextIntent, proposalKeys);
    }
    const loaded = await loadGptourEvents(agentId, resultDays(response, todayRome()).map((d) => d.tourDate!), pool.authorizedCandidates);
    if (token !== epoch.current) return;
    const nextEvents = [...loaded, ...events.filter((e) => !loaded.some((l) => l.id === e.id))];
    const notes: string[] = []; let decided = false;
    for (const action of response.followUpActions || []) {
      const event = nextEvents.find((e) => e.id === action.followUpId && e.type === 'follow_up' && e.agentId === agentId);
      if (!event) throw new Error('Decisione AI riferita a un follow-up non verificato. Nessuna modifica effettuata.');
      decided = true;
      if (action.action !== 'reschedule') { nextIntent = mergeIntent(nextIntent, { followUpDecisions: [eventDecision(event, action.action)] }); continue; }
      // Spostamento deciso in chat: data risolta deterministicamente, scrittura validata dal backend (come nel web).
      const target = resolveRescheduleTarget(action, event, todayRome());
      if ('error' in target) { notes.push(`⚠️ ${target.error}: il follow-up resta previsto per ${formatDateIt(event.date)}.`); continue; }
      try {
        const updated = await rescheduleGptFollowUp(event, target.date, target.time || event.time, { role: actor.role, agentId, confirmed: true });
        if (token !== epoch.current) return;
        nextIntent = mergeIntent(nextIntent, { followUpDecisions: [updated.decision] });
        nextEvents.splice(nextEvents.findIndex((e) => e.id === event.id), 1, updated.event);
        notes.push(`Ho spostato il follow-up di ${event.name} da ${formatDateIt(event.date)} a ${formatDateIt(target.date)}${target.time ? ` alle ${target.time}` : ''}.`);
      } catch (e) { notes.push(`⚠️ Non sono riuscito a salvare lo spostamento del follow-up di ${event.name} (${e instanceof Error ? e.message : 'errore'}). Resta previsto per ${formatDateIt(event.date)}.`); }
    }
    const hasPlan = !response.needsInfo && (response.selection.length > 0 || response.days.length > 0);
    const base: GptMessage[] = [...nextMessages, { role: 'assistant', content: response.reply }, ...notes.map((content) => ({ role: 'assistant' as const, content }))];
    setMessages(base); setIntent(nextIntent); setAcceptedFillKeys(nextAccepted);
    // Chiarimento senza decisioni: il giro mostrato resta invariato e salvabile (parità web).
    const planResult = hasPlan ? response : decided && result ? result : null;
    if (!planResult) return;
    setEvents(nextEvents);
    const out = await rebuild(planResult, nextIntent, token, activeDay, nextAccepted, !proposalKeys.length);
    if (token !== epoch.current) return;
    // Bloccato dai follow-up: la domanda sostituisce la risposta AI, come nel web.
    setMessages(out.blocked && hasPlan ? [...nextMessages, ...notes.map((content) => ({ role: 'assistant' as const, content })), ...out.notes.map((content) => ({ role: 'assistant' as const, content }))] : [...base, ...out.notes.map((content) => ({ role: 'assistant' as const, content }))]);
  });
  const appendNotes = (notes: string[]) => { if (notes.length) setMessages((old) => [...old, ...notes.map((content) => ({ role: 'assistant' as const, content }))]); };
  const decide = (event: GptEvent, action: 'keep' | 'exclude') => decideMany([event], action);
  const decideMany = (list: GptEvent[], action: 'keep' | 'exclude') => withBusy(async (token) => {
    const next = mergeIntent(intent, { followUpDecisions: list.map((e) => eventDecision(e, action)) }); setIntent(next);
    const n = list.length, who = n === 1 ? `il follow-up di ${list[0].name}` : `${n} follow-up`;
    appendNotes([action === 'keep' ? `Mantengo ${who} nel giro come tapp${n === 1 ? 'a obbligatoria' : 'e obbligatorie'}.` : `Escludo ${who} dal giro: rest${n === 1 ? 'a' : 'ano'} in agenda nel CRM.`]);
    if (result) { const out = await rebuild(result, next, token, activeDay, action === 'exclude' ? acceptedFillKeys.filter((key) => !list.some((e) => e.key === key)) : acceptedFillKeys); if (token === epoch.current) appendNotes(out.notes); }
  });
  const confirmReschedule = (date: string, time: string) => withBusy(async (token) => {
    if (!reschedule) return;
    const updated = await rescheduleGptFollowUp(reschedule, date, time, { role: actor.role, agentId, confirmed: true });
    if (token !== epoch.current) return;
    const next = mergeIntent(intent, { followUpDecisions: [updated.decision] });
    setIntent(next); setReschedule(null); setEvents((old) => old.map((e) => e.id === updated.event.id ? updated.event : e));
    appendNotes([`Ho spostato il follow-up di ${updated.event.name} a ${formatDateIt(date)} alle ${time}. CRM aggiornato.`]);
    if (result) { const out = await rebuild(result, next, token); if (token === epoch.current) appendNotes(out.notes); }
  });
  const edit = (operation: 'remove' | 'move' | 'next' | 'add', key: string, toIndex = 0) => withBusy(async (token) => {
    if (!result || !pool || saved.length || uncertainSave) return;
    let nextIntent = intent;
    const ds = days.map((d) => ({ day: d.day, tourDate: d.plan.tourDate, startTime: minToTime(d.plan.startMin), endTime: minToTime(d.plan.endMin), area: d.plan.areaLabel, selection: d.plan.stops.map((s) => ({ key: s.candidate.key, reason: s.candidate.reason })) }));
    const list = ds[activeDay].selection, index = list.findIndex((x) => x.key === key);
    if ((operation === 'remove' || operation === 'next') && (intent.requiredStops.includes(key) || intent.followUpDecisions.some((d) => d.key === key && d.decision !== 'excluded'))) throw new Error('Tappa obbligatoria: modifica prima il vincolo o la decisione follow-up.');
    if (operation === 'remove') { list.splice(index, 1); nextIntent = mergeIntent(intent, { excludedStops: [...intent.excludedStops, key] }); }
    if (operation === 'move') { const [moved] = list.splice(index, 1); list.splice(Math.max(0, Math.min(toIndex, list.length)), 0, moved); }
    if (operation === 'next') { if (ds.length < 2) throw new Error('Non esiste un’altra giornata. Chiedi di distribuire il giro su più giorni.'); ds[(activeDay + 1) % ds.length].selection.push(list.splice(index, 1)[0]); }
    if (operation === 'add') {
      const c = pool.candidates.find((x) => x.key === key);
      if (!c || !candidateMatchesTourIntent(c, intent)) throw new Error('Il candidato non rispetta i criteri attivi.');
      list.push({ key, reason: 'Aggiunto dall’agente' });
    }
    if (!list.length) throw new Error('Il giro deve avere almeno una tappa.');
    await rebuild({ ...result, multiDay: ds.length > 1, days: ds, selection: ds.length === 1 ? ds[0].selection : [], orderImposed: operation === 'move' || result.orderImposed }, nextIntent, token, activeDay, operation === 'remove' ? acceptedFillKeys.filter((k) => k !== key) : acceptedFillKeys, false);
  });
  const acceptProposal = () => withBusy(async (token) => {
    if (!proposal?.candidates.length || !result || !pool || stale || saved.length || uncertainSave) return;
    const accepted = acceptDisplayedFillKeys(acceptedFillKeys, proposal, pool.candidates, intent);
    const ds = days.map((d, i) => ({ day: d.day, tourDate: d.plan.tourDate, area: d.plan.areaLabel, startTime: minToTime(d.plan.startMin), endTime: minToTime(d.plan.endMin), selection: (i === activeDay ? proposal.orderedKeys : d.plan.stops.map((s) => s.candidate.key)).map((key) => ({ key, reason: null })) }));
    const out = await rebuild({ ...result, multiDay: ds.length > 1, days: ds, selection: ds.length === 1 ? ds[0].selection : [] }, intent, token, activeDay, accepted, false);
    if (token === epoch.current) appendNotes([`Ho inserito ${proposal.candidates.length} tapp${proposal.candidates.length === 1 ? 'a' : 'e'} di integrazione nel giro.`, ...out.notes]);
  });
  const rejectProposal = () => { if (busy) return; const next = applyRejection(intent, proposal?.candidates.map((c) => c.key) || []); setIntent(next); setDays((old) => attachGptourContext(old, next, groupId, acceptedFillKeys)); setProposal(null); appendNotes(['Va bene, il giro resta così: finisci prima.']); };
  const chooseDay = (index: number) => withBusy(async (token) => { setActiveDay(index); setProposal(null); if (pool && days[index]) { const p = await proposeGptour(days[index].plan, days.map((d) => d.plan), pool.candidates, intent, settings, !!result?.corridor?.suggest); if (token === epoch.current) setProposal(p); } });
  const save = () => withBusy(async (token) => {
    if (uncertainSave) {
      const ids = await reconcileGptourSave(agentId, actor.id, actor.role, groupId);
      if (token === epoch.current) { setSaved(ids); setUncertainSave(false); } return;
    }
    if (stale || !days.length) throw new Error('Ricostruisci il piano prima di salvare.');
    // Parità web: la fattibilità non blocca il salvataggio, viene solo segnalata in chat.
    const feasibility = days.filter((d) => d.plan.warnings.length).map((d) => `Giorno ${d.day}: ${d.plan.warnings[0]}`);
    try {
      const ids = await saveGptourBatch(agentId, actor.id, actor.role, days.map((d) => d.plan), groupId);
      if (token === epoch.current) { setSaved(ids); setUncertainSave(false); appendNotes([`${ids.length === 1 ? 'Giro salvato' : `${ids.length} giornate salvate`} in "I miei Tour".${feasibility.length ? ` Attenzione (salvate comunque): ${feasibility.join('; ')}` : ''}`]); }
    } catch (e) { if (token === epoch.current && e instanceof Error && /esito|verificare/i.test(e.message)) setUncertainSave(true); throw e; }
  });
  const reset = async () => {
    if (busy || uncertainSave) return;
    epoch.current++; await AsyncStorage.removeItem(draftKey);
    setMessages([]); setIntent(DEFAULT_INTENT); setResult(null); setDays([]); setEvents([]); setSaved([]); setProposal(null); setGroupId(randomUUID()); setError(''); setStale(true); setDraftAvailable(false);
    setAcceptedFillKeys([]);
  };
  const retryLoad = useCallback(() => setLoadKey((k) => k + 1), []);
  return { settings, setSettings, pool, home, setHome, messages, intent, days, events, pending: pendingGptEvents(events, intent), activeDay, proposal,
    loading, busy, error, stale, saved, uncertainSave, reschedule, setReschedule, draftAvailable, send, decide, decideAll: (action: 'keep' | 'exclude') => decideMany(pendingGptEvents(events, intent), action), confirmReschedule, edit,
    acceptProposal, rejectProposal, chooseDay, save, reset, retryLoad,
    rebuild: () => withBusy(async (token) => { if (result) { const out = await rebuild(result, intent, token); if (token === epoch.current) appendNotes(out.notes); } }),
  };
}
/** Note del motore in chat (parità web): selezione, completamento "tutti", fattibilità e notti. */
function narrate(built: GptBuild, requested: GptResult): string[] {
  const notes: string[] = [];
  const dropped = built.warnings.filter((w) => /escluso|Chiave non disponibile/.test(w)), dupes = built.warnings.filter((w) => /duplicato/.test(w)), outside = built.warnings.filter((w) => /fuori dal comune/.test(w));
  if (dupes.length) notes.push(`Ho tolto ${dupes.length} doppion${dupes.length === 1 ? 'e' : 'i'} (stesso cliente/punto vendita presente con più schede): ogni soggetto compare una sola volta nel giro.`);
  if (dropped.length) notes.push(`${dropped.length === 1 ? 'Una tappa proposta non rispetta' : `${dropped.length} tappe proposte non rispettano`} i criteri o il portafoglio e ${dropped.length === 1 ? 'è stata lasciata' : 'sono state lasciate'} fuori:\n• ${dropped.slice(0, 6).join('\n• ')}${dropped.length > 6 ? `\n• … e altre ${dropped.length - 6}` : ''}`);
  if (outside.length) notes.push(`Ho mantenuto ${outside.length} tapp${outside.length === 1 ? 'a' : 'e'} fuori dal comune richiesto perché ${outside.length === 1 ? 'era stata scelta' : 'erano state scelte'} espressamente: ${outside.map((w) => w.split(':')[0]).join(', ')}.`);
  const added = built.result.days.flatMap((d) => d.selection).filter((s) => s.reason?.startsWith('Completamento deterministico')).length;
  const requestedDays = requested.multiDay ? requested.days.length : 1, newDays = Math.max(0, built.days.length - requestedDays);
  if (added > 0) notes.push(`Ho aggiunto ${added} client${added === 1 ? 'e idoneo' : 'i idonei'} ai criteri che mancavano dalla proposta${newDays ? `, creando ${newDays} giornat${newDays === 1 ? 'a aggiuntiva' : 'e aggiuntive'}` : ''}: il giro copre ora tutti i soggetti richiesti.`);
  for (const d of built.days) {
    const feasibility = d.plan.warnings.filter((w) => !/routing_unknown|instabile/.test(w));
    if (feasibility.length) notes.push(`⚠️ La giornata di ${formatDateIt(d.plan.tourDate)} (G${d.day}) ha un problema: ${feasibility.join('; ')}. Non ho rimosso nulla: dimmi quali tappe spostare a un altro giorno o togliere.`);
    if (d.nightDecision === 'routing_unknown') notes.push(`⚠️ Notte dopo G${d.day}: non sono riuscito a calcolare la distanza stradale casa → prima tappa di G${d.day + 1} (servizio percorsi non disponibile). Ho previsto il rientro a casa in via prudenziale: ricontrolla o dimmi se preferisci dormire fuori.`);
    if (d.nightDecision === 'unstable') notes.push(`⚠️ Notte dopo G${d.day}: la scelta casa/fuori cambia la prima tappa del giorno dopo e con essa la distanza. Ho previsto il rientro a casa in via prudenziale: dimmi tu se preferisci dormire fuori.`);
  }
  return notes;
}
function proposalMessage(p: GptProposal, plan: TourPlan, buffer: number, corridor: boolean, destination: string | null | undefined): string {
  const comuni = [...new Set(p.candidates.map((c) => c.city || '—'))].join(', '), n = p.candidates.length, minutes = Math.round(p.extraMinutes);
  const intro = corridor
    ? `Sul percorso${destination ? ` (${destination})` : ''} passi vicino a ${comuni}. Lungo il tragitto ho trovato ${n} punt${n === 1 ? 'o' : 'i'} compatibil${n === 1 ? 'e' : 'i'} con i criteri del giro, con circa ${minutes} minuti di deviazione complessiva.`
    : `Con queste sole tappe il giro terminerebbe circa ${plan.bufferMin >= 60 ? `${Math.floor(plan.bufferMin / 60)}h ` : ''}${Math.round(plan.bufferMin % 60)}min prima della fine della giornata (buffer massimo configurato ${buffer} min). Posso completarlo con ${n} punt${n === 1 ? 'o' : 'i'} nella zona (${comuni}), con circa ${minutes} minuti di deviazione complessiva.`;
  return `${intro} Vuoi che li inserisca? Puoi rispondermi qui (anche "solo quelli di <comune>", "solo i prospect" o "no, finisco prima") oppure usare i pulsanti sotto il piano.`;
}