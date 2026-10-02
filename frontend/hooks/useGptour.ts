import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { getSettings } from '../lib/aitour/tours';
import { DEFAULT_SETTINGS, minToTime, type AiTourSettings, type GeoPoint } from '../lib/aitour/types';
import { loadGptourPool, type GptPool } from '../lib/aitour/gptour-data';
import { runGptour, type GptMessage, type GptResult } from '../lib/aitour/gptour-api';
import { DEFAULT_INTENT, mergeIntent, applyRejection, type TourIntent } from '../lib/aitour/gptour-intent';
import { buildGptour, prepareGptDays, resultDays, type GptDayPlan } from '../lib/aitour/gptour-engine';
import { loadGptourEvents, pendingGptEvents, eventDecision, rescheduleGptFollowUp, followUpContext, type GptEvent } from '../lib/aitour/gptour-followups';
import { attachGptourContext } from '../lib/aitour/gptour-context';
import { proposeGptour, type GptProposal } from '../lib/aitour/gptour-opportunities';
import { saveGptourBatch, reconcileGptourSave } from '../lib/aitour/gptour-save';
import { todayRome } from '../lib/aitour/gptour-dates';
import { candidateMatchesTourIntent } from '../lib/aitour/gptour-criteria';
import { acceptDisplayedFillKeys, acceptedKeysAfterIntentPatch, readAcceptedFillKeys, retainAcceptedFillKeys } from '../lib/aitour/gptour-acceptance';

export interface GptActor { id: string; role: string }
export function useGptour(actor: GptActor, agentId: string) {
  const [settings, setSettings] = useState<AiTourSettings>(DEFAULT_SETTINGS);
  const [pool, setPool] = useState<GptPool | null>(null), [home, setHome] = useState<GeoPoint | null>(null);
  const [messages, setMessages] = useState<GptMessage[]>([]), [intent, setIntent] = useState<TourIntent>(DEFAULT_INTENT);
  const [acceptedFillKeys, setAcceptedFillKeys] = useState<string[]>([]);
  const [result, setResult] = useState<GptResult | null>(null), [days, setDays] = useState<GptDayPlan[]>([]);
  const [events, setEvents] = useState<GptEvent[]>([]), [groupId, setGroupId] = useState(randomUUID);
  const [activeDay, setActiveDay] = useState(0), [proposal, setProposal] = useState<GptProposal | null>(null);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]), [stale, setStale] = useState(true), [saved, setSaved] = useState<string[]>([]);
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
  const rebuild = async (nextResult: GptResult, nextIntent: TourIntent, token: number, selected = activeDay, nextAccepted: readonly string[] = acceptedFillKeys) => {
    if (!pool || !home) throw new Error('Scegli Casa, Sede o posizione GPS prima di costruire il giro.');
    const requiredKeys = new Set(nextIntent.followUpDecisions.filter((d) => d.decision !== 'excluded').map((d) => d.key));
    const available = [...pool.candidates, ...pool.authorizedCandidates.filter((c) => requiredKeys.has(c.key) && !pool.candidates.some((p) => p.key === c.key))];
    setStale(true);
    const accepted = retainAcceptedFillKeys(nextAccepted, [...resultDays(nextResult, todayRome()).flatMap((d) => d.selection.map((s) => s.key)), ...nextIntent.requiredStops, ...requiredKeys]);
    const initialDates = resultDays(nextResult, todayRome()).map((d) => d.tourDate!);
    let agenda = await loadGptourEvents(agentId, initialDates, pool.authorizedCandidates);
    if (token !== epoch.current) return;
    setEvents(agenda); setResult(nextResult); setIntent(nextIntent); setAcceptedFillKeys(accepted);
    if (pendingGptEvents(agenda, nextIntent).length) { setWarnings(['Decidi quali follow-up mantenere o escludere prima di costruire il giro.']); return; }
    const prepared = prepareGptDays(nextResult, available, nextIntent, settings, todayRome(), accepted);
    const dates = prepared.days.map((d) => d.tourDate!);
    if (dates.join() !== initialDates.join()) {
      agenda = await loadGptourEvents(agentId, dates, pool.authorizedCandidates);
      if (token !== epoch.current) return;
      setEvents(agenda);
      if (pendingGptEvents(agenda, nextIntent).length) {
        setResult({ ...nextResult, multiDay: prepared.days.length > 1, days: prepared.days, selection: prepared.days.length === 1 ? prepared.days[0].selection : [] });
        setWarnings(['Sono state aggiunte giornate: conferma anche i follow-up delle nuove date.']); return;
      }
    }
    // Appointments remain appointments: don't silently convert them to follow-ups or drop commitments.
    const appointments = agenda.filter((e) => e.type !== 'follow_up' && dates.includes(e.date));
    const built = await buildGptour(nextResult, available, nextIntent, settings, home, todayRome(), undefined, appointments, accepted);
    if (token !== epoch.current) return;
    const retained = retainAcceptedFillKeys(accepted, built.days.flatMap((d) => d.plan.stops.map((s) => s.candidate.key)));
    const attached = attachGptourContext(built.days, nextIntent, groupId, retained), index = Math.min(selected, attached.length - 1);
    setAcceptedFillKeys(retained);
    setDays(attached); setResult(built.result); setWarnings(built.warnings); setActiveDay(index); setProposal(null); setStale(false); setDraftAvailable(false);
    const suggestion = await proposeGptour(attached[index].plan, attached.map((d) => d.plan), pool.candidates, nextIntent, settings, !!nextResult.corridor?.suggest);
    if (token === epoch.current) setProposal(suggestion);
  };
  const send = (text: string) => withBusy(async (token) => {
    if (!pool || !text.trim()) return;
    if (saved.length || uncertainSave) throw new Error('Questo giro è salvato o ha un salvataggio da verificare. Non modificarlo durante la verifica.');
    const nextMessages: GptMessage[] = [...messages, { role: 'user', content: text.trim() }];
    const response = await runGptour({ agentId, role: actor.role, pool: pool.candidates, messages: nextMessages, intent,
      agentInfo: { today: todayRome(), workStart: settings.work_start, workEnd: settings.work_end, home, poolComplete: pool.complete },
      currentTour: days.map((d) => ({ day: d.day, total: d.total, tourDate: d.plan.tourDate, area: d.plan.areaLabel, startTime: minToTime(d.plan.startMin), endTime: minToTime(d.plan.endMin), stops: d.plan.stops.map((s) => ({ key: s.candidate.key, nome: s.candidate.name, comune: s.candidate.city, tipo: s.candidate.entityType })) })),
      followUps: followUpContext(events, intent, days.map((d) => d.plan.tourDate)),
      corridorProposal: proposal?.candidates.map((c) => ({ key: c.key, nome: c.name, comune: c.city, tipo: c.entityType, fat6m: c.revenue6m })),
    });
    if (token !== epoch.current) return;
    let nextIntent = mergeIntent(response.intentReset ? DEFAULT_INTENT : intent, response.intent);
    const nextAccepted = acceptedKeysAfterIntentPatch(acceptedFillKeys, intent, response.intent, response.intentReset);
    const nextEvents = await loadGptourEvents(agentId, resultDays(response, todayRome()).map((d) => d.tourDate!), pool.authorizedCandidates);
    if (token !== epoch.current) return;
    for (const action of response.followUpActions || []) {
      const event = [...nextEvents, ...events].find((e) => e.id === action.followUpId && e.type === 'follow_up' && e.agentId === agentId);
      if (!event) throw new Error('Decisione AI riferita a un follow-up non verificato. Nessuna modifica effettuata.');
      if (action.action === 'reschedule') setReschedule(event); // explicit date/time confirmation, never an AI-triggered write
      else nextIntent = mergeIntent(nextIntent, { followUpDecisions: [eventDecision(event, action.action)] });
    }
    setMessages([...nextMessages, { role: 'assistant', content: response.reply }]); setIntent(nextIntent); setAcceptedFillKeys(nextAccepted);
    if (response.needsInfo) { setStale(true); setEvents(nextEvents); return; }
    await rebuild(response, nextIntent, token, activeDay, nextAccepted);
  });
  const decide = (event: GptEvent, action: 'keep' | 'exclude') => decideMany([event], action);
  const decideMany = (list: GptEvent[], action: 'keep' | 'exclude') => withBusy(async (token) => {
    const next = mergeIntent(intent, { followUpDecisions: list.map((e) => eventDecision(e, action)) }); setIntent(next);
    if (result) await rebuild(result, next, token, activeDay, action === 'exclude' ? acceptedFillKeys.filter((key) => !list.some((e) => e.key === key)) : acceptedFillKeys);
  });
  const confirmReschedule = (date: string, time: string) => withBusy(async (token) => {
    if (!reschedule) return;
    const updated = await rescheduleGptFollowUp(reschedule, date, time, { role: actor.role, agentId, confirmed: true });
    if (token !== epoch.current) return;
    const next = mergeIntent(intent, { followUpDecisions: [updated.decision] });
    setIntent(next); setReschedule(null); setEvents((old) => old.map((e) => e.id === updated.event.id ? updated.event : e));
    setMessages((old) => [...old, { role: 'assistant', content: `CRM aggiornato: ${updated.event.name}, ${date} alle ${time}.` }]);
    if (result) await rebuild(result, next, token);
  });
  const edit = (operation: 'remove' | 'up' | 'down' | 'next' | 'add', key: string) => withBusy(async (token) => {
    if (!result || !pool || saved.length || uncertainSave) return;
    let nextIntent = intent;
    const ds = days.map((d) => ({ day: d.day, tourDate: d.plan.tourDate, startTime: minToTime(d.plan.startMin), endTime: minToTime(d.plan.endMin), area: d.plan.areaLabel, selection: d.plan.stops.map((s) => ({ key: s.candidate.key, reason: s.candidate.reason })) }));
    const list = ds[activeDay].selection, index = list.findIndex((x) => x.key === key);
    if ((operation === 'remove' || operation === 'next') && (intent.requiredStops.includes(key) || intent.followUpDecisions.some((d) => d.key === key && d.decision !== 'excluded'))) throw new Error('Tappa obbligatoria: modifica prima il vincolo o la decisione follow-up.');
    if (operation === 'remove') { list.splice(index, 1); nextIntent = mergeIntent(intent, { excludedStops: [...intent.excludedStops, key] }); }
    if (operation === 'up' && index > 0) [list[index - 1], list[index]] = [list[index], list[index - 1]];
    if (operation === 'down' && index < list.length - 1) [list[index], list[index + 1]] = [list[index + 1], list[index]];
    if (operation === 'next') { if (ds.length < 2) throw new Error('Non esiste un’altra giornata. Chiedi di distribuire il giro su più giorni.'); ds[(activeDay + 1) % ds.length].selection.push(list.splice(index, 1)[0]); }
    if (operation === 'add') {
      const c = pool.candidates.find((x) => x.key === key);
      if (!c || !candidateMatchesTourIntent(c, intent)) throw new Error('Il candidato non rispetta i criteri attivi.');
      list.push({ key, reason: 'Aggiunto dall’agente' });
    }
    await rebuild({ ...result, multiDay: ds.length > 1, days: ds, selection: ds.length === 1 ? ds[0].selection : [], orderImposed: operation === 'up' || operation === 'down' || result.orderImposed }, nextIntent, token, activeDay, operation === 'remove' ? acceptedFillKeys.filter((k) => k !== key) : acceptedFillKeys);
  });
  const acceptProposal = () => withBusy(async (token) => {
    if (!proposal?.candidates.length || !result || !pool || stale || saved.length || uncertainSave) return;
    const accepted = acceptDisplayedFillKeys(acceptedFillKeys, proposal, pool.candidates, intent);
    const ds = days.map((d, i) => ({ day: d.day, tourDate: d.plan.tourDate, area: d.plan.areaLabel, startTime: minToTime(d.plan.startMin), endTime: minToTime(d.plan.endMin), selection: (i === activeDay ? proposal.orderedKeys : d.plan.stops.map((s) => s.candidate.key)).map((key) => ({ key, reason: null })) }));
    await rebuild({ ...result, multiDay: ds.length > 1, days: ds, selection: ds.length === 1 ? ds[0].selection : [] }, intent, token, activeDay, accepted);
  });
  const rejectProposal = () => { if (busy) return; const next = applyRejection(intent, proposal?.candidates.map((c) => c.key) || []); setIntent(next); setDays((old) => attachGptourContext(old, next, groupId, acceptedFillKeys)); setProposal(null); };
  const chooseDay = (index: number) => withBusy(async (token) => { setActiveDay(index); setProposal(null); if (pool && days[index]) { const p = await proposeGptour(days[index].plan, days.map((d) => d.plan), pool.candidates, intent, settings, !!result?.corridor?.suggest); if (token === epoch.current) setProposal(p); } });
  const save = () => withBusy(async (token) => {
    if (uncertainSave) {
      const ids = await reconcileGptourSave(agentId, actor.id, actor.role, groupId);
      if (token === epoch.current) { setSaved(ids); setUncertainSave(false); } return;
    }
    if (stale || !days.length) throw new Error('Ricostruisci il piano prima di salvare.');
    if (days.some((d) => d.plan.warnings.length)) throw new Error('Risolvi gli avvisi di fattibilità prima di salvare.');
    try {
      const ids = await saveGptourBatch(agentId, actor.id, actor.role, days.map((d) => d.plan), groupId);
      if (token === epoch.current) { setSaved(ids); setUncertainSave(false); }
    } catch (e) { if (token === epoch.current && e instanceof Error && /esito|verificare/i.test(e.message)) setUncertainSave(true); throw e; }
  });
  const reset = async () => {
    if (busy || uncertainSave) return;
    epoch.current++; await AsyncStorage.removeItem(draftKey);
    setMessages([]); setIntent(DEFAULT_INTENT); setResult(null); setDays([]); setEvents([]); setSaved([]); setProposal(null); setGroupId(randomUUID()); setWarnings([]); setError(''); setStale(true); setDraftAvailable(false);
    setAcceptedFillKeys([]);
  };
  const retryLoad = useCallback(() => setLoadKey((k) => k + 1), []);
  return { settings, setSettings, pool, home, setHome, messages, intent, days, events, pending: pendingGptEvents(events, intent), activeDay, proposal,
    loading, busy, error, warnings, stale, saved, uncertainSave, reschedule, setReschedule, draftAvailable, send, decide, decideAll: (action: 'keep' | 'exclude') => decideMany(pendingGptEvents(events, intent), action), confirmReschedule, edit,
    acceptProposal, rejectProposal, chooseDay, save, reset, retryLoad,
    rebuild: () => withBusy(async (token) => { if (result) await rebuild(result, intent, token); }),
  };
}