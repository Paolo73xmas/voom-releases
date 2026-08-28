// Modalità Live AI Tour mobile: prossima visita, sono arrivato, esito, salta, ricalcolo automatico,
// integrazione Raccolta Ordine/Ispezione/Prima Visita con chiusura automatica della tappa al ritorno.
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, Alert, TextInput, Vibration } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { DS, JAKARTA, SHADOWS } from '../../lib/theme';
import { hap } from '../../lib/haptics';
import { AI_PURPLE, AI_PURPLE_SOFT, openNavigation } from './shared';
import { EsitoModal, type EsitoExtras } from './EsitoModal';
import { SkipModal } from './SkipModal';
import { TourMapView, type TourMapStop } from './TourMapView';
import { createTourInspection } from '../../lib/api/inspections';
import { supabase } from '../../lib/supabase';
import type { LiveState, LiveStop } from '../../lib/aitour/live';
import {
  nowMin, getCurrentPos, markArrived, completeStop, skipStop,
  updateLiveSequence, addLiveStop, finishLiveTour, suggestNearby, suggestNearbyProximity, findExternalResult, updateTourPosition,
  findTabCustomer, updateStopCustomer, recordTrackPoint, loadLiveState,
  scheduleRevisit, revisitSlotFor, isRevisitCandidate, startLunchBreak, endLunchBreak, extendTourEndTime, trashStop, TRASH_REASON,
} from '../../lib/aitour/live';
import { insertLiveStop, reorderLiveStops, extendTourVisits, areaCheckForTour, type PlacementChoice, type ReplanContext } from '../../lib/aitour/liveops';
import { AddStopModal } from './AddStopModal';
import { ReorderStopsModal } from './ReorderStopsModal';
import { OwnStaminaChip } from './OwnStaminaChip';
import { planTour } from '../../lib/aitour/planner';
import { buildTourReport, type TourReport } from '../../lib/aitour/report';
import type { TourCandidate, AiTourSettings, GeoPoint, DayType } from '../../lib/aitour/types';
import { minToTime, timeToMin, fmtDur, fmtEur, haversineKm, ENTITY_LABELS, ENTITY_COLORS, ENTITY_TEXT_COLORS } from '../../lib/aitour/types';

const EXTERNAL_KEY = 'aitour_external';
const ACQUIRE_MAX_M = 500;

interface ExternalCtx {
  tourId: string;
  stopId: string;
  customerId?: string;
  kind: 'inspection' | 'order' | 'acquisition';
  nextKind?: 'inspection' | 'order';
  tabaccheriaId?: string;
  startedAt: string;
}

interface Props {
  initial: LiveState;
  settings: AiTourSettings;
  onExit: () => void;
}

export function LiveTourView({ initial, settings, onExit }: Props) {
  const router = useRouter();
  const [stops, setStops] = useState<LiveStop[]>(initial.stops);
  const [message, setMessage] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ cand: TourCandidate; slack: number } | null>(null);
  const [esitoOpen, setEsitoOpen] = useState(false);
  const [skipOpen, setSkipOpen] = useState(false);
  const [reassigned, setReassigned] = useState<{ name: string; prevAgent: string } | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);
  const [acquireKind, setAcquireKind] = useState<'inspection' | 'order' | null>(null);
  const [busy, setBusy] = useState(false);
  const [recalcing, setRecalcing] = useState(false);
  const [report, setReport] = useState<TourReport | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [reorderOpen, setReorderOpen] = useState(false);
  // "Più Visite": fine giro corrente (posticipabile) + dialog visite aggiuntive
  const [endMin, setEndMin] = useState(initial.endMin);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendEndTime, setExtendEndTime] = useState('');
  const [extendError, setExtendError] = useState<string | null>(null);
  // Cestinare una visita: conferma prima di rimuoverla dal giro
  const [trashTarget, setTrashTarget] = useState<LiveStop | null>(null);
  const [trashing, setTrashing] = useState(false);
  // Dettaglio tappa (tap sul nome in elenco o sul segnaposto in mappa) con "Fallo Ora"
  const [detailStop, setDetailStop] = useState<LiveStop | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  // Stato GPS per il chip nella barra live (aggiornato dal battito posizione)
  const [gpsOk, setGpsOk] = useState<boolean | null>(null);
  // Orologio reattivo (30s) per l'avviso "oltre orario di fine giro"
  const [nowTick, setNowTick] = useState(nowMin());
  const [overtimeEnd, setOvertimeEnd] = useState('');
  const tour = initial.tour;
  const stopsRef = useRef(stops);
  stopsRef.current = stops;
  // Cestino sempre disponibile: se un ricalcolo è in corso, la cestinatura viene
  // comunque salvata subito e il riallineamento orari parte a fine ricalcolo
  const recalcingRef = useRef(false);
  const pendingTrashRecalcRef = useRef(false);
  // Vero mentre l'agente sta compilando un dialog o c'è un'operazione in corso: il sync non deve strappare la vista
  const uiBusyRef = useRef(false);
  uiBusyRef.current = busy || recalcing || esitoOpen || skipOpen || recapOpen || !!acquireKind || !!trashTarget || !!detailStop || addOpen || reorderOpen || extendOpen;

  // Retry di rete per le azioni critiche del live: 3 tentativi con attesa crescente (dati mai persi in silenzio)
  const withRetry = useCallback(async <T,>(fn: () => Promise<T>, label: string): Promise<T> => {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        console.warn(`[AITour][live] ${label}: tentativo ${attempt}/3 fallito`, err);
        if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    throw lastErr;
  }, []);

  // Avviso di prossimità: tabaccheria da acquisire a <3 km dalla posizione o dal percorso
  const [proxSuggestion, setProxSuggestion] = useState<(TourCandidate & { distKm: number }) | null>(null);
  const proxSuggestionRef = useRef(proxSuggestion);
  proxSuggestionRef.current = proxSuggestion;
  const suggestionRef = useRef(suggestion);
  suggestionRef.current = suggestion;
  const proxDismissedRef = useRef<Set<string>>(new Set());
  const proxBusyRef = useRef(false);
  const areaCheckRef = useRef<((c: { lat: number; lng: number; province?: string; city?: string }) => boolean) | null>(null);
  const pingPlayerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(`aitour_prox_dismissed_${tour.id}`).then((raw) => {
      if (raw) {
        try { proxDismissedRef.current = new Set(JSON.parse(raw)); } catch { /* storage corrotto: riparte vuoto */ }
      }
    }).catch(() => {});
    return () => {
      try { pingPlayerRef.current?.remove(); } catch { /* già rilasciato */ }
    };
  }, [tour.id]);

  // Suono + vibrazione per l'avviso di prossimità
  const notifyProximity = () => {
    try { Vibration.vibrate([0, 250, 120, 250]); } catch { /* non supportata */ }
    try {
      if (!pingPlayerRef.current) pingPlayerRef.current = createAudioPlayer(require('../../assets/sounds/proximity-ping.wav'));
      pingPlayerRef.current.seekTo(0).catch(() => {});
      pingPlayerRef.current.play();
    } catch { /* audio non disponibile */ }
  };

  const checkProximity = async (pos: { lat: number; lng: number }) => {
    if (proxBusyRef.current || proxSuggestionRef.current) return;
    proxBusyRef.current = true;
    try {
      let inArea = areaCheckRef.current;
      if (!inArea) {
        const pendingRefs = stopsRef.current.filter((s) => s.status === 'planned').map((s) => ({ candidate: s.candidate }));
        inArea = await areaCheckForTour(tour, pendingRefs);
        areaCheckRef.current = inArea;
      }
      const exclude = new Set<string>(proxDismissedRef.current);
      for (const s of stopsRef.current) if (s.candidate.tabaccheriaId) exclude.add(s.candidate.tabaccheriaId);
      // Dedup: lo stesso punto vendita non deve comparire su due banner (margine + prossimità)
      if (suggestionRef.current?.cand.tabaccheriaId) exclude.add(suggestionRef.current.cand.tabaccheriaId);
      const route = stopsRef.current
        .filter((s) => s.status === 'planned')
        .map((s) => ({ lat: s.candidate.lat, lng: s.candidate.lng }));
      const sugg = await suggestNearbyProximity(pos, route, exclude, settings, inArea);
      if (sugg && !proxSuggestionRef.current) {
        setProxSuggestion(sugg);
        notifyProximity();
      }
    } catch (err) {
      console.warn('[AITour][live] check prossimita:', err);
    } finally {
      proxBusyRef.current = false;
    }
  };
  const checkProximityRef = useRef(checkProximity);
  checkProximityRef.current = checkProximity;

  // Pausa Pranzo: una sola volta al giorno; se si rientra nella vista durante la pausa, riprende il countdown
  const lunchMinutes = Math.max(5, Number(settings.lunch_break_minutes) || 30);
  const [lunch, setLunch] = useState<{ start: number; minutes: number } | null>(() => {
    if (!initial.tour.lunch_break_start || initial.tour.lunch_break_end) return null;
    const start = new Date(initial.tour.lunch_break_start).getTime();
    const mins = initial.tour.lunch_break_minutes || 30;
    return Date.now() < start + mins * 60000 ? { start, minutes: mins } : null;
  });
  const [lunchUsed, setLunchUsed] = useState<boolean>(!!initial.tour.lunch_break_start);
  const [lunchOpen, setLunchOpen] = useState(false);
  const [lunchTick, setLunchTick] = useState(Date.now());

  // Battito posizione: GPS al Monitoring admin subito e poi ogni 60s + traccia percorso reale
  // + controllo di prossimità: tabaccherie da acquisire a <3 km -> avviso immediato
  useEffect(() => {
    let stopped = false;
    const beat = async () => {
      const pos = await getCurrentPos();
      if (stopped) return;
      setGpsOk(!!pos);
      if (pos) {
        updateTourPosition(tour.id, pos.lat, pos.lng).catch(() => {});
        recordTrackPoint(tour.agent_id, pos.lat, pos.lng).catch(() => {});
        checkProximityRef.current(pos).catch(() => {});
      }
    };
    beat();
    const iv = setInterval(beat, 60000);
    return () => {
      stopped = true;
      clearInterval(iv);
    };
  }, [tour.id, tour.agent_id]);

  // Sincronizzazione con l'admin (60s): chiusura giro dal Monitoring o tappa
  // obbligatoria inserita dall'admin -> avviso e riallineamento della vista live.
  useEffect(() => {
    let stopped = false;
    const sync = async () => {
      try {
        const { data: t } = await supabase.from('ai_tours').select('status').eq('id', tour.id).maybeSingle();
        if (stopped || !t) return;
        if (t.status !== 'active') {
          Alert.alert('Giro chiuso', "Il giro è stato chiuso dall'amministratore.");
          onExit();
          return;
        }
        const { data: ids } = await supabase.from('ai_tour_stops').select('id,status').eq('tour_id', tour.id);
        if (stopped || !ids) return;
        const known = new Map(stopsRef.current.map((s) => [s.id, s.status]));
        const hasNew = ids.some((r) => !known.has(r.id as string));
        const hasChanged = ids.some((r) => known.has(r.id as string) && known.get(r.id as string) !== (r.status as string));
        if (hasNew || hasChanged) {
          if (uiBusyRef.current) return; // dialog aperto o operazione in corso: riallinea al prossimo giro
          const st = await loadLiveState(tour);
          if (stopped) return;
          setStops(st.stops);
          setMessage(hasNew
            ? "L'amministratore ha aggiunto una tappa al tuo giro: percorso aggiornato"
            : "Il tuo giro è stato aggiornato dall'amministratore: percorso riallineato");
        }
      } catch {
        // sync silenziosa: riprova al prossimo giro
      }
    };
    const iv = setInterval(sync, 60000);
    return () => {
      stopped = true;
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.id]);

  const pending = useMemo(() => stops.filter((s) => s.status === 'planned' || s.status === 'arrived'), [stops]);
  const next = pending[0] || null;

  // Avviso "oltre orario di fine giro": orologio reattivo + orario di posticipo predefinito (+1h)
  useEffect(() => {
    const iv = setInterval(() => setNowTick(nowMin()), 30000);
    return () => clearInterval(iv);
  }, []);
  const overTime = nowTick >= endMin && pending.length > 0;
  useEffect(() => {
    if (overTime && !overtimeEnd) setOvertimeEnd(minToTime(Math.min(nowTick + 60, 23 * 60 + 59)));
  }, [overTime, nowTick, overtimeEnd]);
  // Numerazione STABILE del giro: ogni tappa mantiene il proprio numero progressivo
  // anche dopo esiti/salti (la successiva alla n.1 resta n.2, non torna n.1)
  const stopNumbers = useMemo(() => new Map(stops.map((s, i) => [s.id, i + 1])), [stops]);
  const doneCount = stops.filter((s) => s.status === 'completed').length;
  const skipCount = stops.filter((s) => s.status === 'skipped' || s.status === 'cancelled').length;

  const fallbackPos = useCallback((): { lat: number; lng: number } => {
    const lastDone = [...stops].reverse().find((s) => s.status === 'completed' || s.status === 'skipped');
    if (lastDone) return { lat: lastDone.candidate.lat, lng: lastDone.candidate.lng };
    if (tour.start_lat != null) return { lat: tour.start_lat, lng: tour.start_lng as number };
    return next ? { lat: next.candidate.lat, lng: next.candidate.lng } : { lat: 45.46, lng: 9.19 };
  }, [stops, tour, next]);

  const delayMin = next?.plannedArrival && next.status === 'planned' ? nowMin() - timeToMin(next.plannedArrival) : 0;

  const runRecalc = useCallback(
    async (currentStops: LiveStop[], reasonPrefix?: string, startOffsetMin = 0, endOverride?: number) => {
      const effEnd = endOverride ?? endMin;
      const remaining = currentStops.filter((s) => s.status === 'planned');
      if (remaining.length === 0) {
        setMessage('Tutte le visite sono state gestite: puoi terminare il tour.');
        return;
      }
      // Guardia: oltre l'orario di fine tour il ricalcolo azzererebbe il giro (tutte
      // le tappe risulterebbero "fuori orario"). Non tocchiamo nulla: l'agente decide.
      if (nowMin() + startOffsetMin >= effEnd) {
        setMessage(`Sei oltre l'orario di fine tour (${minToTime(effEnd)}): il giro non viene ricalcolato. Le ${remaining.length} tappe restano attive — posticipa la fine giro dal riquadro rosso, prosegui manualmente o termina il tour.`);
        return;
      }
      setRecalcing(true);
      recalcingRef.current = true;
      try {
        const pos = (await getCurrentPos()) || fallbackPos();
        const start: GeoPoint = { ...pos, label: 'Posizione attuale' };
        // Il ricalcolo NON rimuove mai le tappe previste (tutte obbligatorie):
        // alleggerire il giro spetta all'agente col cestino rosso o "Salta".
        const plan = await planTour({
          candidates: remaining.map((s) => s.candidate),
          mandatoryKeys: new Set(remaining.map((s) => s.candidate.key)),
          start,
          end: initial.endPoint,
          tourDate: tour.tour_date,
          startMin: nowMin() + startOffsetMin,
          endMin: effEnd,
          dayType: tour.tour_type as DayType,
          resolvedDayType: (tour.resolved_tour_type || 'mista') as Exclude<DayType, 'ai'>,
          bufferPct: 5,
          bufferMaxMin: settings.buffer_max_min,
          area: { mode: 'auto' },
          skipDayExclusion: true,
        });
        // Guardia anti-azzeramento: se il planner non restituisce nulla non toccare il giro
        if (plan.stops.length === 0) {
          setMessage(`Tempo residuo insufficiente per ripianificare entro le ${minToTime(effEnd)}: il giro non viene modificato. Le ${remaining.length} tappe restano attive — prosegui manualmente o termina il tour.`);
          return;
        }

        const stopByKey = new Map(remaining.map((s) => [s.candidate.key, s]));
        const updates = plan.stops.map((p, i) => {
          const s = stopByKey.get(p.candidate.key)!;
          return { stopId: s.id, seq: i + 1, arrival: minToTime(p.arrivalMin), travelMin: p.travelMinFromPrev, travelKm: p.travelKmFromPrev };
        });
        await updateLiveSequence(tour.id, updates);

        const updById = new Map(updates.map((u) => [u.stopId, u]));
        // Aggiornamento FUNZIONALE sullo stato più recente: una tappa cestinata o gestita
        // MENTRE il ricalcolo era in corso non deve tornare nel giro (orari applicati solo alle planned)
        setStops((prev) => {
          const merged = prev.map((s): LiveStop => {
            const u = updById.get(s.id);
            if (u && s.status === 'planned') return { ...s, plannedArrival: u.arrival, travelMinutes: Math.round(u.travelMin), travelKm: u.travelKm };
            return s;
          });
          merged.sort((a, b) => {
            const ra = a.status === 'planned' ? (updById.get(a.id)?.seq ?? 999) : -1;
            const rb = b.status === 'planned' ? (updById.get(b.id)?.seq ?? 999) : -1;
            return ra - rb;
          });
          return merged;
        });

        let msg = `${reasonPrefix ? `${reasonPrefix} — ` : ''}Giro ricalcolato alle ${minToTime(nowMin())}.`;
        msg += ` ${plan.stops.length} visite rimanenti, fine prevista ${minToTime(plan.finishMin)}.`;
        if (plan.finishMin > effEnd) {
          msg += ` Attenzione: la fine prevista supera le ${minToTime(effEnd)} — nessuna tappa è stata rimossa: se vuoi alleggerire il giro usa il cestino rosso o "Salta".`;
        }
        setMessage(msg);

        // Recupero tempo: se resta molto margine, proponi una visita vicina
        const slack = effEnd - plan.finishMin;
        if (slack >= 25) {
          const exclude = new Set(currentStops.map((s) => s.candidate.tabaccheriaId).filter((x): x is string => !!x));
          // Dedup: niente ripetizione dei punti vendita rifiutati o già suggeriti in prossimità
          for (const id of proxDismissedRef.current) exclude.add(id);
          if (proxSuggestionRef.current?.tabaccheriaId) exclude.add(proxSuggestionRef.current.tabaccheriaId);
          const sugg = await suggestNearby(pos, exclude, settings);
          if (sugg) setSuggestion({ cand: sugg, slack: Math.round(slack) });
        } else {
          setSuggestion(null);
        }
      } catch (err) {
        console.error('[AITour][live] recalc:', err);
        setMessage('Errore nel ricalcolo del giro');
      } finally {
        setRecalcing(false);
        recalcingRef.current = false;
        // Cestinature arrivate DURANTE il ricalcolo: riallinea subito gli orari sul giro aggiornato
        if (pendingTrashRecalcRef.current) {
          pendingTrashRecalcRef.current = false;
          setTimeout(() => runRecalcRef.current(stopsRef.current, 'Aggiornamento dopo la cestinatura'), 400);
        }
      }
    },
    [tour, endMin, initial.endPoint, fallbackPos, settings]
  );
  const runRecalcRef = useRef(runRecalc);
  runRecalcRef.current = runRecalc;

  // Ricalcolo AUTOMATICO: controllo ogni minuto; se il ritardo sulla prossima tappa
  // supera la soglia, l'AI ricalcola il giro da sola (orari, sequenza, eventuali tagli
  // e suggerimento tappa extra se resta margine). Dopo il ricalcolo gli orari ripartono
  // da adesso, quindi il controllo si riarma solo se si accumula nuovo ritardo.
  const AUTO_RECALC_DELAY_MIN = 15;
  useEffect(() => {
    const iv = setInterval(() => {
      if (busy || recalcing || esitoOpen || skipOpen || recapOpen || acquireKind || addOpen || reorderOpen) return;
      if (lunch) return; // in pausa pranzo: il ritardo e' voluto, niente ricalcolo automatico
      if (nowMin() >= endMin) return; // oltre fine tour: il ricalcolo azzererebbe il giro
      const current = stopsRef.current;
      const nx = current.find((s) => s.status === 'planned' || s.status === 'arrived');
      if (!nx || nx.status !== 'planned' || !nx.plannedArrival) return;
      const delay = nowMin() - timeToMin(nx.plannedArrival);
      if (delay >= AUTO_RECALC_DELAY_MIN) {
        runRecalc(current, `Ritardo di ${fmtDur(delay)} rilevato`);
      }
    }, 60000);
    return () => clearInterval(iv);
  }, [busy, recalcing, esitoOpen, skipOpen, recapOpen, acquireKind, addOpen, reorderOpen, lunch, runRecalc, endMin]);

  // Countdown pausa pranzo: al termine naturale registra la fine e riparte
  useEffect(() => {
    if (!lunch) return;
    const iv = setInterval(() => {
      const now = Date.now();
      setLunchTick(now);
      if (now >= lunch.start + lunch.minutes * 60000) {
        setLunch(null);
        endLunchBreak(tour.id, lunch.minutes).catch((err) => console.warn('[AITour][live] fine pausa:', err));
        setMessage('Pausa pranzo terminata: si riparte!');
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [lunch, tour.id]);

  const handleLunchStart = async () => {
    setBusy(true);
    try {
      await startLunchBreak(tour.id, tour.agent_id, lunchMinutes);
      setLunchUsed(true);
      setLunch({ start: Date.now(), minutes: lunchMinutes });
      setLunchOpen(false);
      hap.success();
      // Se il giro è in anticipo e la pausa rientra nel margine, gli orari restano validi (mai anticiparli)
      const nextPlanned = stopsRef.current.find((s) => s.status === 'planned');
      const fitsInSlack = nextPlanned?.plannedArrival ? nowMin() + lunchMinutes <= timeToMin(nextPlanned.plannedArrival) : false;
      if (fitsInSlack) {
        setMessage(`Pausa pranzo di ${lunchMinutes} min: rientra nel margine disponibile, gli orari delle tappe restano invariati.`);
      } else {
        await runRecalc(stopsRef.current, 'Pausa pranzo', lunchMinutes);
      }
    } catch (err) {
      console.error('[AITour][live] pausa pranzo:', err);
      setLunchOpen(false);
      setMessage(err instanceof Error && err.message.includes('già') ? err.message : "Errore nell'avvio della pausa");
    } finally {
      setBusy(false);
    }
  };

  const handleLunchResume = async () => {
    if (!lunch) return;
    setBusy(true);
    try {
      const actual = Math.max(1, Math.floor((Date.now() - lunch.start) / 60000));
      await endLunchBreak(tour.id, actual);
      setLunch(null);
      const nextPlanned = stopsRef.current.find((s) => s.status === 'planned');
      const stillOk = nextPlanned?.plannedArrival ? nowMin() <= timeToMin(nextPlanned.plannedArrival) : true;
      if (stillOk) {
        setMessage(`Pausa terminata dopo ${actual} min: gli orari delle tappe restano validi.`);
      } else {
        await runRecalc(stopsRef.current, 'Ripresa dalla pausa');
      }
    } catch (err) {
      console.error('[AITour][live] ripresa pausa:', err);
      setMessage('Errore nella ripresa dalla pausa');
    } finally {
      setBusy(false);
    }
  };

  const handleArrived = async () => {
    if (!next) return;
    hap.medium();
    setBusy(true);
    try {
      await withRetry(() => markArrived(tour.id, next.id), 'sono arrivato');
      setStops(stops.map((s) => (s.id === next.id ? { ...s, status: 'arrived', actualArrival: new Date().toISOString() } : s)));
    } catch (err) {
      console.error('[AITour][live] arrived:', err);
      setMessage('Arrivo NON registrato (problema di connessione?). Riprova.');
    } finally {
      setBusy(false);
    }
  };

  // Apre Raccolta Ordine / Ispezione sul cliente della tappa, con chiusura automatica al ritorno.
  // Tappa senza scheda cliente → flusso acquisizione prospect (solo di persona, verifica GPS).
  const goExternal = async (kind: 'inspection' | 'order') => {
    if (!next) return;
    hap.light();
    if (!next.candidate.customerId) {
      setAcquireKind(kind);
      return;
    }
    try {
      if (next.status === 'planned') await markArrived(tour.id, next.id);
    } catch (err) {
      console.warn('[AITour][live] markArrived pre-external:', err);
    }
    const ctx: ExternalCtx = {
      tourId: tour.id,
      stopId: next.id,
      customerId: next.candidate.customerId,
      kind,
      startedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(EXTERNAL_KEY, JSON.stringify(ctx));
    if (kind === 'inspection') {
      router.push({ pathname: '/inspection/new', params: { customerId: next.candidate.customerId } });
    } else {
      router.push({ pathname: '/order-collection-v2', params: { customerId: next.candidate.customerId, customerName: next.candidate.name } });
    }
  };

  // Acquisizione prospect: consentita solo sul posto (GPS entro 500m), poi Prima Visita precompilata
  const startAcquisition = async () => {
    if (!next || !acquireKind || !next.candidate.tabaccheriaId) return;
    setBusy(true);
    try {
      const pos = await getCurrentPos();
      if (!pos) {
        setMessage("GPS non disponibile: l'acquisizione è consentita solo di persona sul posto");
        setAcquireKind(null);
        return;
      }
      const distM = Math.round(haversineKm(pos.lat, pos.lng, next.candidate.lat, next.candidate.lng) * 1000);
      if (distM > ACQUIRE_MAX_M) {
        const distLabel = distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${distM} m`;
        setMessage(`Sei a ~${distLabel} dalla tabaccheria: l'acquisizione è consentita solo di persona. In alternativa solo un admin può riassegnarla.`);
        setAcquireKind(null);
        return;
      }
      try {
        if (next.status === 'planned') await markArrived(tour.id, next.id);
      } catch (err) {
        console.warn('[AITour][live] markArrived pre-acquisition:', err);
      }
      const ctx: ExternalCtx = {
        tourId: tour.id,
        stopId: next.id,
        kind: 'acquisition',
        nextKind: acquireKind,
        tabaccheriaId: next.candidate.tabaccheriaId,
        startedAt: new Date().toISOString(),
      };
      await AsyncStorage.setItem(EXTERNAL_KEY, JSON.stringify(ctx));
      setAcquireKind(null);
      router.push({ pathname: '/anagrafica', params: { tabaccheriaId: next.candidate.tabaccheriaId } });
    } finally {
      setBusy(false);
    }
  };

  // Al ritorno del focus da Raccolta Ordine/Ispezione/Prima Visita: gestisce l'esito e prosegue
  const processingExternal = useRef(false);
  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (processingExternal.current) return;
        const raw = await AsyncStorage.getItem(EXTERNAL_KEY);
        if (!raw) return;
        processingExternal.current = true;
        await AsyncStorage.removeItem(EXTERNAL_KEY);
        let info: ExternalCtx;
        try {
          info = JSON.parse(raw);
        } catch {
          processingExternal.current = false;
          return;
        }
        if (info.tourId !== tour.id) {
          processingExternal.current = false;
          return;
        }
        const current = stopsRef.current;
        const stop = current.find((s) => s.id === info.stopId);
        if (!stop || (stop.status !== 'planned' && stop.status !== 'arrived')) {
          processingExternal.current = false;
          return;
        }

        setBusy(true);
        try {
          if (info.kind === 'acquisition') {
            const custId = info.tabaccheriaId ? await findTabCustomer(info.tabaccheriaId) : null;
            if (!custId) {
              setMessage(`Prospect non creato per "${stop.candidate.name}": la tappa resta aperta`);
              return;
            }
            await updateStopCustomer(stop.id, custId, stop.candidate.entityType);
            const newType = stop.candidate.entityType === 'free' || stop.candidate.entityType === 'never' ? 'prospect' : stop.candidate.entityType;
            const updated = current.map((s): LiveStop =>
              s.id === stop.id ? { ...s, candidate: { ...s.candidate, customerId: custId, entityType: newType } } : s
            );
            setStops(updated);
            const nk = info.nextKind || 'inspection';
            if (nk === 'inspection') {
              // Ispezione unificata: al rientro dall'acquisizione si apre direttamente l'esito
              setMessage(
                `Prospect creato: "${stop.candidate.name}" collegato alla tappa. Registra ora l'esito: se chiudi la schermata senza salvare, premi di nuovo ISPEZIONE per concludere la tappa.`
              );
              setEsitoOpen(true);
            } else {
              setMessage(`Prospect creato: "${stop.candidate.name}" collegato alla tappa`);
              const ctx: ExternalCtx = { tourId: tour.id, stopId: stop.id, customerId: custId, kind: nk, startedAt: new Date().toISOString() };
              await AsyncStorage.setItem(EXTERNAL_KEY, JSON.stringify(ctx));
              router.push({ pathname: '/order-collection-v2', params: { customerId: custId, customerName: stop.candidate.name } });
            }
            return;
          }

          if (!info.customerId) return;
          const found = await findExternalResult(info.kind, info.customerId, info.startedAt);
          if (!found) {
            setMessage(
              info.kind === 'order'
                ? `Nessun ordine registrato per "${stop.candidate.name}": la tappa resta aperta`
                : `Nessuna ispezione registrata per "${stop.candidate.name}": la tappa resta aperta`
            );
            return;
          }
          const outcome = info.kind === 'order' ? 'ordine' : 'ispezione';
          await completeStop(tour, stop, {
            outcome,
            note: info.kind === 'order' ? 'Ordine raccolto dalla sezione Raccolta Ordine' : 'Ispezione effettuata dalla sezione Ispezioni',
            followUpDate: null,
          });
          const updated = current.map((s): LiveStop => (s.id === stop.id ? { ...s, status: 'completed', outcome } : s));
          setStops(updated);
          hap.success();
          await runRecalc(updated);
        } catch (err) {
          console.error('[AITour][live] external return:', err);
          setMessage('Errore nella chiusura automatica della tappa');
        } finally {
          setBusy(false);
          processingExternal.current = false;
        }
      })();
    }, [tour, router, runRecalc])
  );

  // Report fine giornata: caricato all'apertura del consuntivo
  useEffect(() => {
    if (!recapOpen) return;
    setReport(null);
    buildTourReport(tour.id).then(setReport).catch(() => {});
  }, [recapOpen, tour.id]);

  const handleEsito = async (outcome: string, note: string, followUpDate: string | null, followUpTime: string | null, extras: EsitoExtras) => {
    if (!next) return;
    if (!next.candidate.customerId) {
      // Nessuna scheda cliente: l'esito con foto non può essere registrato (le foto andrebbero perse).
      // Stesso percorso del tasto Ispezione: prima l'anagrafica (Prima Visita), poi di nuovo Ispezione.
      setEsitoOpen(false);
      setAcquireKind('inspection');
      setMessage("Questa tappa non ha una scheda cliente: completa prima l'anagrafica (Prima Visita). Al termine premi di nuovo ISPEZIONE per registrare l'esito con le foto.");
      return;
    }
    setBusy(true);
    try {
      await withRetry(() => completeStop(tour, next, { outcome, note, followUpDate, followUpTime }), 'registrazione esito');
      const customerId = next.candidate.customerId;
      if (customerId) {
        // 1) Cliente ORFANO ispezionato di persona -> riassegnazione PRIMA di tutto
        //    (dopo la riassegnazione le RLS permettono di scrivere contatti/ispezione)
        if (next.candidate.entityType === 'orphan') {
          try {
            const pos = await getCurrentPos();
            const distM = pos ? Math.round(haversineKm(pos.lat, pos.lng, next.candidate.lat, next.candidate.lng) * 1000) : null;
            if (distM !== null && distM <= ACQUIRE_MAX_M) {
              const { data: rr, error: rrErr } = await supabase.rpc('ai_tour_reassign_orphan', { p_stop_id: next.id });
              if (rrErr) {
                console.warn('[AITour][live] riassegnazione orfano fallita:', rrErr.message);
              } else if (rr?.reassigned) {
                setReassigned({ name: next.candidate.name, prevAgent: rr.previous_agent_name || '' });
              }
            } else {
              setMessage('Cliente orfano non riassegnato: posizione GPS non verificata sul posto');
            }
          } catch (err) {
            console.warn('[AITour][live] riassegnazione orfano:', err);
          }
        }
        // 2) Contatti punto vendita -> scheda cliente (solo se modificati)
        const contactUpdates: Record<string, unknown> = {};
        if (extras.mobile) contactUpdates.contact_mobile = extras.mobile;
        if (extras.email) contactUpdates.contact_email = extras.email;
        if (extras.visitSlots) contactUpdates.preferred_visit_slots = extras.visitSlots.length > 0 ? extras.visitSlots : null;
        if (extras.excludedDays) contactUpdates.excluded_visit_days = extras.excludedDays.length > 0 ? extras.excludedDays : null;
        if (Object.keys(contactUpdates).length > 0) {
          const { error: cErr } = await supabase.from('customers').update(contactUpdates).eq('id', customerId);
          if (cErr) setMessage('Contatti non salvati sulla scheda cliente');
        }
        // 3) Foto (obbligatorie) -> ispezione nella sezione Ispezioni (bucket inspection_photos)
        if (extras.photos.length > 0) {
          try {
            setUploadPct(5);
            const pos = await getCurrentPos();
            const gps = pos ? { lat: pos.lat, lon: pos.lng } : { lat: next.candidate.lat, lon: next.candidate.lng };
            const insp = await withRetry(() => createTourInspection({
              customer_id: customerId,
              agent_id: tour.agent_id,
              notes: `[AI Tour] Esito: ${outcome}${note ? ` — ${note}` : ''}`,
              latitude: gps.lat,
              longitude: gps.lon,
              photos: extras.photos,
              gps,
              onProgress: (done, total) => setUploadPct(Math.max(5, Math.round((done / total) * 100))),
            }), 'ispezione con foto');
            if (insp.photoFailures > 0) {
              setMessage(`ATTENZIONE: ${insp.photoFailures} foto su ${extras.photos.length} NON salvate (connessione). Rifalle dalla scheda cliente nella sezione Ispezioni.`);
            }
          } catch (err) {
            console.warn('[AITour][live] registrazione ispezione con foto fallita:', err);
            setMessage('FOTO NON SALVATE nella sezione Ispezioni (esito comunque registrato): rifalle dalla scheda cliente');
          } finally {
            setUploadPct(null);
          }
        }
        // 4) Orfano / mai visitato / prospect -> torna cliente o prospect in base agli ordini
        if (['orphan', 'never', 'prospect'].includes(next.candidate.entityType)) {
          try {
            const { data: rs, error: rsErr } = await supabase.rpc('ai_tour_refresh_customer_status', { p_stop_id: next.id });
            if (rsErr) console.warn('[AITour][live] refresh categoria cliente:', rsErr.message);
            else if (rs?.updated) setMessage(rs.category === 'client' ? 'Il punto vendita risulta ora tra i tuoi CLIENTI (ha già ordinato)' : 'Il punto vendita risulta ora tra i tuoi PROSPECT (nessun ordine ancora)');
          } catch (err) {
            console.warn('[AITour][live] refresh categoria cliente:', err);
          }
        }
      }
      const updated = stops.map((s) => (s.id === next.id ? { ...s, status: 'completed' as const, outcome } : s));
      setStops(updated);
      setEsitoOpen(false);
      hap.success();
      await runRecalc(updated);
    } catch (err) {
      console.error('[AITour][live] esito:', err);
      setMessage('Esito NON registrato (problema di connessione?). I dati e le foto sono ancora qui: riprova tra qualche secondo.');
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = async (reason: string, note: string, revisitTime: string | null) => {
    if (!next) return;
    setBusy(true);
    try {
      if (revisitTime) {
        // Ripasso in giornata: la tappa resta nel giro con finestra oraria attorno all'ora scelta
        await withRetry(() => scheduleRevisit(tour.id, next.id, revisitTime, reason), 'ripasso in giornata');
        const slot = revisitSlotFor(revisitTime);
        const updated = stops.map((s) => (s.id === next.id
          ? { ...s, status: 'planned' as const, actualArrival: null, candidate: { ...s.candidate, preferredSlots: [slot] } }
          : s));
        setStops(updated);
        setSkipOpen(false);
        hap.success();
        await runRecalc(updated, `Ripasso "${next.candidate.name}" alle ${revisitTime}`);
        return;
      }
      await withRetry(() => skipStop(tour.id, next.id, reason, note), 'salto tappa');
      const updated = stops.map((s) => (s.id === next.id ? { ...s, status: 'skipped' as const, skipReason: reason } : s));
      setStops(updated);
      setSkipOpen(false);
      await runRecalc(updated);
    } catch (err) {
      console.error('[AITour][live] skip:', err);
      setMessage('Salto NON registrato (problema di connessione?). La tappa è ancora nel giro: riprova.');
    } finally {
      setBusy(false);
    }
  };

  // Rifiuto del suggerimento "tempo di margine": memorizzato come i suggerimenti di prossimità,
  // così lo stesso punto vendita non viene riproposto nel resto del giro (né duplicato su due banner)
  const declineSuggestion = () => {
    if (suggestion?.cand.tabaccheriaId) {
      proxDismissedRef.current.add(suggestion.cand.tabaccheriaId);
      AsyncStorage.setItem(`aitour_prox_dismissed_${tour.id}`, JSON.stringify([...proxDismissedRef.current])).catch(() => {});
    }
    setSuggestion(null);
  };

  const acceptSuggestion = async () => {
    if (!suggestion) return;
    setBusy(true);
    try {
      const id = await addLiveStop(tour, suggestion.cand, stops.length + 1);
      const newStop: LiveStop = {
        id,
        candidate: suggestion.cand,
        status: 'planned',
        mandatory: false,
        plannedArrival: null,
        travelMinutes: 0,
        travelKm: 0,
        actualArrival: null,
        outcome: null,
        skipReason: null,
        addedLive: true,
        addedByAdmin: false,
      };
      const updated = [...stops, newStop];
      setStops(updated);
      setSuggestion(null);
      await runRecalc(updated);
    } catch (err) {
      console.error('[AITour][live] add suggestion:', err);
      setMessage("Errore nell'aggiunta della visita");
    } finally {
      setBusy(false);
    }
  };

  // Visita cestinata: la scrittura su DB avviene SUBITO (anche durante un ricalcolo,
  // così nessuna cestinatura va persa); il ricalcolo orari parte subito o viene accodato.
  const handleTrash = async () => {
    if (!trashTarget || trashing) return;
    const target = trashTarget;
    // Stato dedicato (non "busy"): la conferma deve funzionare ANCHE mentre
    // gira il ricalcolo di una cestinatura precedente, altrimenti il tap va perso
    setTrashing(true);
    try {
      await withRetry(() => trashStop(tour.id, target.id, target.candidate.name), 'cestino visita');
      const updated = stopsRef.current.map((s): LiveStop => (s.id === target.id ? { ...s, status: 'cancelled', skipReason: TRASH_REASON } : s));
      setStops(updated);
      setTrashTarget(null);
      hap.success();
      if (recalcingRef.current) {
        // ricalcolo già in corso: la tappa è comunque FUORI dal giro,
        // il riallineamento orari parte automaticamente appena finisce
        pendingTrashRecalcRef.current = true;
        setMessage(`"${target.candidate.name}" cestinata: non verrà più riproposta in questo giro. Orari in aggiornamento a fine ricalcolo.`);
      } else {
        setTrashing(false);
        await runRecalc(updated, `"${target.candidate.name}" cestinata (non verrà più riproposta in questo giro)`);
      }
    } catch (err) {
      console.error('[AITour][live] cestino:', err);
      setMessage(`ATTENZIONE: cestino NON riuscito, "${target.candidate.name}" è ancora nel giro. Riprova.`);
    } finally {
      setTrashing(false);
    }
  };

  // Avviso prossimità: aggiungi al giro o scarta (non riproposta per il resto del giro)
  const acceptProxSuggestion = async () => {
    if (!proxSuggestion) return;
    setBusy(true);
    try {
      const id = await addLiveStop(tour, proxSuggestion, stops.length + 1);
      const newStop: LiveStop = {
        id,
        candidate: proxSuggestion,
        status: 'planned',
        mandatory: false,
        plannedArrival: null,
        travelMinutes: 0,
        travelKm: 0,
        actualArrival: null,
        outcome: null,
        skipReason: null,
        addedLive: true,
        addedByAdmin: false,
      };
      const updated = [...stops, newStop];
      setStops(updated);
      setProxSuggestion(null);
      hap.success();
      await runRecalc(updated, `"${proxSuggestion.name}" aggiunta al giro`);
    } catch (err) {
      console.error('[AITour][live] prox add:', err);
      setMessage("Errore nell'aggiunta della visita");
    } finally {
      setBusy(false);
    }
  };

  const declineProxSuggestion = () => {
    if (!proxSuggestion) return;
    if (proxSuggestion.tabaccheriaId) {
      proxDismissedRef.current.add(proxSuggestion.tabaccheriaId);
      AsyncStorage.setItem(`aitour_prox_dismissed_${tour.id}`, JSON.stringify([...proxDismissedRef.current])).catch(() => {});
    }
    setProxSuggestion(null);
  };

  // "Più Visite": posticipa (opzionale) la fine giro e chiede all'AI di riempire
  // il tempo disponibile con nuove visite, senza toccare gli impegni esistenti.
  const handleExtend = async () => {
    const t = extendEndTime.trim();
    if (t && !/^([01]?\d|2[0-3]):[0-5]\d$/.test(t)) {
      setExtendError('Formato orario non valido: usa HH:MM (es. 18:30)');
      return;
    }
    const newEndMin = t ? timeToMin(t) : endMin;
    if (newEndMin <= nowMin()) {
      setExtendError("L'orario di fine deve essere successivo all'ora attuale");
      return;
    }
    if (newEndMin < endMin) {
      setExtendError(`Puoi solo posticipare la fine giro (attuale ${minToTime(endMin)}), non anticiparla`);
      return;
    }
    setExtendError(null);
    setBusy(true);
    try {
      if (newEndMin !== endMin) {
        await extendTourEndTime(tour.id, minToTime(newEndMin));
        setEndMin(newEndMin);
      }
      const ctx = { ...(await buildCtx()), endMin: newEndMin };
      const pendingPlanned = stops.filter((s) => s.status === 'planned');
      const res = await extendTourVisits(
        ctx,
        pendingPlanned,
        new Set(stops.map((s) => s.candidate.customerId).filter((x): x is string => !!x)),
        new Set(stops.map((s) => s.candidate.tabaccheriaId).filter((x): x is string => !!x)),
      );
      await reloadFromDb();
      setExtendOpen(false);
      if (res.addedNames.length > 0) {
        hap.success();
        setMessage(
          `${res.addedNames.length === 1 ? 'Visita aggiunta' : `${res.addedNames.length} visite aggiunte`} al giro: ${res.addedNames.join(', ')}. ` +
          `Orari rimodulati fino alle ${minToTime(newEndMin)}${res.finishMin ? `, fine prevista ${minToTime(res.finishMin)}` : ''} ` +
          `(le tappe con vincoli orari restano nelle loro finestre).${res.warnings.length > 0 ? ` ${res.warnings.join(' ')}` : ''}`
        );
      } else {
        setMessage(res.warnings[0] || 'Nessuna visita aggiunta');
      }
    } catch (err) {
      console.error('[AITour][live] estensione visite:', err);
      setMessage("Errore nell'aggiunta delle visite");
    } finally {
      setBusy(false);
    }
  };

  // Contesto di ripianificazione per le operazioni live (aggiunta tappa / riordino)
  const buildCtx = async (): Promise<ReplanContext> => ({
    tour,
    startPos: (await getCurrentPos()) || fallbackPos(),
    endPoint: initial.endPoint,
    startMin: nowMin(),
    endMin,
    settings,
    seqBase: stops.filter((s) => s.status !== 'planned').length,
  });

  const reloadFromDb = async () => {
    const st = await loadLiveState(tour);
    setStops(st.stops);
  };

  const handleAddStop = async (cand: TourCandidate, placement: PlacementChoice, mandatory: boolean) => {
    setBusy(true);
    try {
      const ctx = await buildCtx();
      const pendingPlanned = stops.filter((s) => s.status === 'planned');
      const res = await insertLiveStop(ctx, pendingPlanned, cand, placement, { mandatory });
      await reloadFromDb();
      setAddOpen(false);
      hap.success();
      const parts: string[] = [`"${cand.name}" aggiunta al giro.`];
      if (res.droppedNames.length > 0) parts.push(`Per restare nei tempi ho rimosso: ${res.droppedNames.join(', ')}.`);
      parts.push(...res.warnings);
      setMessage(parts.join(' '));
    } catch (err) {
      console.error('[AITour][live] aggiunta tappa:', err);
      setMessage("Errore nell'aggiunta della tappa");
    } finally {
      setBusy(false);
    }
  };

  const handleReorder = async (orderedIds: string[]) => {
    setBusy(true);
    try {
      const ctx = await buildCtx();
      const byId = new Map(stops.map((s) => [s.id, s]));
      const ordered = orderedIds.map((id) => byId.get(id)).filter((s): s is LiveStop => !!s);
      const res = await reorderLiveStops(ctx, ordered);
      await reloadFromDb();
      setReorderOpen(false);
      hap.success();
      setMessage(res.warnings.length > 0 ? `Ordine tappe aggiornato. ${res.warnings.join(' ')}` : 'Ordine tappe aggiornato: percorso e orari ricalcolati.');
    } catch (err) {
      console.error('[AITour][live] riordino tappe:', err);
      setMessage('Errore nel riordino delle tappe');
    } finally {
      setBusy(false);
    }
  };

  // "Fallo Ora": la tappa scelta diventa immediatamente la prossima visita e il giro si ricalcola
  const handleDoNow = async (s: LiveStop) => {
    setDetailStop(null);
    setBusy(true);
    try {
      const ctx = await buildCtx();
      const ordered = [s, ...pending.filter((p) => p.id !== s.id)];
      const res = await withRetry(() => reorderLiveStops(ctx, ordered), 'fallo ora');
      await reloadFromDb();
      hap.success();
      setMessage(res.warnings.length > 0 ? `"${s.candidate.name}" è ora la prossima visita. ${res.warnings.join(' ')}` : `"${s.candidate.name}" è ora la prossima visita: percorso e orari ricalcolati.`);
    } catch (err) {
      console.error('[AITour][live] fallo ora:', err);
      setMessage('Operazione NON riuscita (problema di connessione?). Riprova.');
    } finally {
      setBusy(false);
    }
  };

  const handleFinish = async () => {
    setBusy(true);
    try {
      await withRetry(() => finishLiveTour(tour.id), 'termina tour');
      setRecapOpen(false);
      hap.success();
      onExit();
    } catch (err) {
      console.error('[AITour][live] finish:', err);
      setMessage('Chiusura NON registrata (problema di connessione?). Riprova.');
    } finally {
      setBusy(false);
    }
  };

  // Posticipa la fine giro quando si è oltre l'orario con tappe rimanenti
  const handlePostponeEnd = async () => {
    const newEnd = overtimeEnd ? timeToMin(overtimeEnd) : 0;
    if (!overtimeEnd || newEnd <= nowMin()) {
      setMessage('Indica un orario di fine successivo ad adesso (formato HH:MM)');
      return;
    }
    setBusy(true);
    try {
      await withRetry(() => extendTourEndTime(tour.id, overtimeEnd), 'posticipo fine giro');
      setEndMin(newEnd);
      hap.success();
      await runRecalc(stopsRef.current, 'Fine giro posticipata', 0, newEnd);
    } catch (err) {
      console.error('[AITour][live] posticipo fine giro:', err);
      setMessage('Posticipo NON registrato (problema di connessione?). Riprova.');
    } finally {
      setBusy(false);
    }
  };

  const distToNext = next ? haversineKm(fallbackPos().lat, fallbackPos().lng, next.candidate.lat, next.candidate.lng) * 1.3 : 0;
  const esiti = stops.filter((s) => s.status === 'completed');
  const countEsito = (k: string) => esiti.filter((s) => s.outcome === k).length;
  const handled = stops.filter((s) => s.status === 'completed' || s.status === 'skipped' || s.status === 'cancelled');

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header stato */}
      <View style={styles.headerRow}>
        <View style={styles.liveBadge}>
          <Ionicons name="radio" size={11} color="#FFF" />
          <Text style={styles.liveBadgeText}>TOUR LIVE</Text>
        </View>
        <Text style={styles.headerTime}>
          {tour.start_time?.slice(0, 5)}–{minToTime(endMin)}
        </Text>
        <TouchableOpacity
          style={styles.exitBtn}
          onPress={() => {
            hap.light();
            onExit();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={13} color={DS.ink2} />
          <Text style={styles.exitBtnText}>Esci</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.finishBtn}
          onPress={() => {
            hap.light();
            setRecapOpen(true);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="flag" size={13} color="#FFF" />
          <Text style={styles.finishBtnText}>Termina</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {doneCount} fatte · {skipCount} saltate · {pending.length} rimanenti
        </Text>
        <OwnStaminaChip />
        <View
          style={[styles.gpsChip, { backgroundColor: gpsOk === false ? '#FEE2E2' : gpsOk ? '#D1FAE5' : DS.surface2 }]}
          testID="aitour-live-gps-chip"
        >
          <Ionicons name="location" size={10} color={gpsOk === false ? '#991B1B' : gpsOk ? '#047857' : DS.inkMuted} />
          <Text style={[styles.gpsChipText, { color: gpsOk === false ? '#991B1B' : gpsOk ? '#047857' : DS.inkMuted }]}>
            {gpsOk === false ? 'GPS assente' : gpsOk ? 'GPS OK' : 'GPS...'}
          </Text>
        </View>
        {next && Math.abs(delayMin) > 5 && (
          <View style={[styles.delayBadge, { backgroundColor: delayMin > 0 ? '#FEE2E2' : '#D1FAE5' }]}>
            <Text style={[styles.delayText, { color: delayMin > 0 ? '#991B1B' : '#047857' }]}>
              {delayMin > 0 ? `Ritardo ${fmtDur(delayMin)}` : `Anticipo ${fmtDur(-delayMin)}`}
            </Text>
          </View>
        )}
      </View>

      {/* Oltre l'orario di fine giro con tappe rimanenti: posticipa o termina */}
      {overTime && (
        <View style={styles.overtimeBox} testID="aitour-live-overtime">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="time" size={14} color="#DC2626" />
            <Text style={styles.overtimeTitle}>Oltre l&apos;orario di fine giro ({minToTime(endMin)})</Text>
          </View>
          <Text style={styles.overtimeText}>
            Hai ancora {pending.length} {pending.length === 1 ? 'tappa rimanente' : 'tappe rimanenti'}. Posticipa la fine per continuare con orari ricalcolati, oppure termina il tour.
          </Text>
          <View style={styles.overtimeRow}>
            <TextInput
              style={styles.overtimeInput}
              value={overtimeEnd}
              onChangeText={setOvertimeEnd}
              placeholder="HH:MM"
              placeholderTextColor={DS.inkMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              testID="aitour-live-overtime-time"
            />
            <TouchableOpacity
              style={[styles.overtimeBtn, (busy || recalcing) && { opacity: 0.5 }]}
              onPress={handlePostponeEnd}
              disabled={busy || recalcing}
              activeOpacity={0.7}
              testID="aitour-live-overtime-extend-btn"
            >
              <Text style={styles.overtimeBtnText}>Posticipa fine giro</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.overtimeGhostBtn, busy && { opacity: 0.5 }]}
              onPress={() => setRecapOpen(true)}
              disabled={busy}
              activeOpacity={0.7}
              testID="aitour-live-overtime-finish-btn"
            >
              <Text style={styles.overtimeGhostText}>Termina Tour</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Operazioni live sul giro: pausa pranzo, aggiungi tappa, riordina */}
      <View style={styles.liveOpsRow}>
        {!lunchUsed && !lunch && (
          <TouchableOpacity
            style={[styles.opsBtn, { borderColor: '#FDBA74' }]}
            onPress={() => {
              hap.light();
              setLunchOpen(true);
            }}
            disabled={busy}
            activeOpacity={0.7}
          >
            <Ionicons name="cafe-outline" size={14} color="#EA580C" />
            <Text style={[styles.opsBtnText, { color: '#EA580C' }]}>Pausa Pranzo</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.opsBtn}
          onPress={() => {
            hap.light();
            setAddOpen(true);
          }}
          disabled={busy}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={15} color={AI_PURPLE} />
          <Text style={styles.opsBtnText}>Tappa</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.opsBtn, { borderColor: '#6EE7B7' }]}
          onPress={() => {
            hap.light();
            setExtendEndTime(minToTime(endMin));
            setExtendError(null);
            setExtendOpen(true);
          }}
          disabled={busy || recalcing}
          activeOpacity={0.7}
          testID="aitour-live-extend-btn"
        >
          <Ionicons name="sparkles" size={14} color="#059669" />
          <Text style={[styles.opsBtnText, { color: '#059669' }]}>Più Visite</Text>
        </TouchableOpacity>
        {stops.filter((s) => s.status === 'planned').length > 1 && (
          <TouchableOpacity
            style={styles.opsBtn}
            onPress={() => {
              hap.light();
              setReorderOpen(true);
            }}
            disabled={busy}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-vertical" size={14} color={AI_PURPLE} />
            <Text style={styles.opsBtnText}>Ordine</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Pausa pranzo in corso: countdown + ripresa anticipata */}
      {lunch && (
        <View style={styles.lunchBanner}>
          <Ionicons name="cafe" size={15} color="#EA580C" />
          <Text style={styles.lunchText}>
            <Text style={{ fontFamily: JAKARTA.bold }}>Pausa pranzo in corso</Text> — riprendi tra{' '}
            <Text style={{ fontFamily: JAKARTA.bold }}>
              {(() => {
                const ms = Math.max(0, lunch.start + lunch.minutes * 60000 - lunchTick);
                return `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
              })()}
            </Text>
            . Il giro riprende alla fine della pausa.
          </Text>
          <TouchableOpacity style={styles.lunchResumeBtn} onPress={handleLunchResume} disabled={busy} activeOpacity={0.7}>
            <Text style={styles.lunchResumeText}>Riprendi ora</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Mappa del giro */}
      <TouchableOpacity
        style={styles.mapToggle}
        onPress={() => {
          hap.light();
          setShowMap((x) => !x);
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="map-outline" size={15} color={AI_PURPLE} />
        <Text style={styles.mapToggleText}>Mappa del giro</Text>
        <Ionicons name={showMap ? 'chevron-up' : 'chevron-down'} size={15} color={DS.inkMuted} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>
      {showMap && (
        <TourMapView
          stops={stops.map((s): TourMapStop => {
            const isPending = s.status === 'planned' || s.status === 'arrived';
            return {
              key: s.id,
              lat: s.candidate.lat,
              lng: s.candidate.lng,
              color: ENTITY_COLORS[s.candidate.entityType],
              label: isPending ? String(stopNumbers.get(s.id)) : '',
              mandatory: s.mandatory,
              name: s.candidate.name,
              crmName: s.candidate.crmName,
              entity: ENTITY_LABELS[s.candidate.entityType],
              line1:
                s.status === 'completed'
                  ? `Completata${s.outcome ? ` · ${s.outcome}` : ''}`
                  : s.status === 'skipped' || s.status === 'cancelled'
                    ? 'Saltata'
                    : `Arrivo ${s.plannedArrival ? s.plannedArrival.slice(0, 5) : '—'} · visita ${s.candidate.visitMinutes} min · ${s.candidate.score}/100`,
              reason: s.status === 'planned' || s.status === 'arrived' ? s.candidate.reason : undefined,
              status: s.status,
            };
          })}
          geometry={[]}
          start={{ lat: tour.start_lat ?? stops[0]?.candidate.lat ?? 41.9, lng: tour.start_lng ?? stops[0]?.candidate.lng ?? 12.49, label: tour.start_label || 'Partenza' }}
          end={initial.endPoint}
          height={380}
          onStopSelect={(key) => {
            const s = stopsRef.current.find((x) => x.id === key);
            if (s) setDetailStop(s);
          }}
        />
      )}

      {message ? (
        <View style={styles.msgBox}>
          <Ionicons name="sparkles" size={13} color="#7C3AED" />
          <Text style={styles.msgText}>{message}</Text>
          <TouchableOpacity onPress={() => setMessage(null)} hitSlop={8}>
            <Ionicons name="close" size={14} color="#7C3AED" />
          </TouchableOpacity>
        </View>
      ) : null}

      {suggestion ? (
        <View style={styles.suggBox}>
          <Text style={styles.suggText}>
            Hai circa {suggestion.slack} minuti di margine. Nelle vicinanze c&apos;è{' '}
            <Text style={{ fontFamily: JAKARTA.bold }}>{suggestion.cand.name}</Text> ({suggestion.cand.city}), tabaccheria da acquisire.
            Vuoi aggiungerla al giro?
          </Text>
          <View style={styles.suggBtns}>
            <TouchableOpacity style={styles.suggAccept} onPress={acceptSuggestion} disabled={busy} activeOpacity={0.7}>
              <Text style={styles.suggAcceptText}>Aggiungi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.suggDecline} onPress={declineSuggestion} activeOpacity={0.7}>
              <Text style={styles.suggDeclineText}>No, grazie</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {proxSuggestion ? (
        <View style={styles.proxBox} testID="aitour-live-prox-suggestion">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="notifications" size={14} color="#B45309" />
            <Text style={styles.proxTitle}>Opportunità a {proxSuggestion.distKm} km</Text>
          </View>
          <Text style={styles.proxText}>
            A <Text style={{ fontFamily: JAKARTA.bold }}>{proxSuggestion.distKm} km</Text> da te o dal percorso c&apos;è{' '}
            <Text style={{ fontFamily: JAKARTA.bold }}>{proxSuggestion.name}</Text>
            {proxSuggestion.city ? ` (${proxSuggestion.city})` : ''}, tabaccheria da acquisire non nel giro. Vuoi aggiungerla?
          </Text>
          <View style={styles.suggBtns}>
            <TouchableOpacity style={styles.proxAccept} onPress={acceptProxSuggestion} disabled={busy} activeOpacity={0.7} testID="aitour-prox-accept">
              <Text style={styles.suggAcceptText}>Aggiungi</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.suggDecline} onPress={declineProxSuggestion} activeOpacity={0.7} testID="aitour-prox-decline">
              <Text style={styles.suggDeclineText}>No, grazie</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Prossima visita */}
      {next ? (
        <View style={styles.nextCard}>
          <View style={styles.nextHeader}>
            <Text style={styles.nextLabel}>PROSSIMA VISITA{next.status === 'arrived' ? ' — SEI SUL POSTO' : ''}</Text>
            <View style={styles.nextBadges}>
              {next.mandatory && (
                <View style={styles.mandBadge}>
                  <Text style={styles.mandBadgeText}>Obbligatoria</Text>
                </View>
              )}
              {next.addedByAdmin && (
                <View style={[styles.mandBadge, { backgroundColor: '#EA580C' }]}>
                  <Text style={styles.mandBadgeText}>Inserita dall&apos;admin</Text>
                </View>
              )}
              {next.addedLive && !next.addedByAdmin && (
                <View style={[styles.mandBadge, { backgroundColor: '#0D9488' }]}>
                  <Text style={styles.mandBadgeText}>Aggiunta live</Text>
                </View>
              )}
              {isRevisitCandidate(next.candidate) && (
                <View style={[styles.mandBadge, { backgroundColor: '#2563EB' }]}>
                  <Text style={styles.mandBadgeText}>{(next.candidate.preferredSlots || [])[0]?.label || 'Ripasso'}</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.nextName}>{next.candidate.name}</Text>
          {next.candidate.crmName && next.candidate.crmName !== next.candidate.name ? (
            <Text style={styles.nextCrmName}>
              Scheda CRM: <Text style={{ fontFamily: JAKARTA.bold }}>{next.candidate.crmName}</Text>
            </Text>
          ) : null}
          <Text style={styles.nextAddress}>
            <Ionicons name="location-outline" size={12} color={DS.inkMuted} /> {next.candidate.address}
            {next.candidate.city ? `, ${next.candidate.city}` : ''}
          </Text>
          {(next.candidate.preferredSlots?.length || 0) > 0 ? (
            <Text style={styles.nextSlots}>
              <Ionicons name="time-outline" size={11} color="#B45309" /> Fascia visite preferita: {(next.candidate.preferredSlots || []).map((s) => s.label).join(', ')}
            </Text>
          ) : null}
          <View style={styles.nextMetaRow}>
            <View style={[styles.entityBadge, { borderColor: ENTITY_TEXT_COLORS[next.candidate.entityType] }]}>
              <Text style={[styles.entityBadgeText, { color: ENTITY_TEXT_COLORS[next.candidate.entityType] }]}>
                {ENTITY_LABELS[next.candidate.entityType]}
              </Text>
            </View>
            <Text style={styles.nextMeta}>
              ~{distToNext.toFixed(1)} km · arrivo {next.plannedArrival ? next.plannedArrival.slice(0, 5) : '—'} · visita {next.candidate.visitMinutes} min
              {next.candidate.visitLearnedSamples ? ' (durata appresa)' : ''} · {next.candidate.score}/100
            </Text>
          </View>
          {next.candidate.reason ? <Text style={styles.nextReason}>{next.candidate.reason}</Text> : null}
          <View style={styles.inspectReminder}>
            <Ionicons name="clipboard-outline" size={13} color="#92400E" />
            <Text style={styles.inspectReminderText}>
              Ricorda: l&apos;ispezione è sempre obbligatoria durante la visita — non serve solo se il cliente fa l&apos;ordine o se salti la visita.
            </Text>
          </View>
          {!next.candidate.customerId && (
            <Text style={styles.noCustomerHint}>
              Nessuna scheda cliente: con Ispezione o Raccolta Ordine acquisisci il punto vendita come prospect (solo di persona, verifica GPS).
            </Text>
          )}

          {/* Azioni */}
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#7C3AED' }]}
              onPress={() => {
                hap.light();
                openNavigation(next.candidate.lat, next.candidate.lng, next.candidate.name);
              }}
              activeOpacity={0.75}
            >
              <Ionicons name="navigate" size={15} color="#FFF" />
              <Text style={styles.actionBtnText}>Navigatore</Text>
            </TouchableOpacity>
            {next.status === 'planned' ? (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#0891B2' }]} onPress={handleArrived} disabled={busy} activeOpacity={0.75}>
                <Ionicons name="location" size={15} color="#FFF" />
                <Text style={styles.actionBtnText}>Sono arrivato</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: DS.surface3 }]}
                onPress={() => next.candidate.customerId && router.push(`/customer/${next.candidate.customerId}`)}
                disabled={!next.candidate.customerId}
                activeOpacity={0.75}
              >
                <Ionicons name="person-outline" size={15} color={DS.ink2} />
                <Text style={[styles.actionBtnText, { color: DS.ink2 }]}>Scheda</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#8B5CF6' }]} onPress={() => goExternal('order')} disabled={busy} activeOpacity={0.75}>
              <Ionicons name="cart" size={15} color="#FFF" />
              <Text style={styles.actionBtnText}>Raccolta Ordine</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#059669' }]}
              onPress={() => {
                hap.light();
                if (next.candidate.customerId) setEsitoOpen(true);
                else setAcquireKind('inspection');
              }}
              disabled={busy}
              activeOpacity={0.75}
            >
              <Ionicons name="clipboard" size={15} color="#FFF" />
              <Text style={styles.actionBtnText}>Ispezione</Text>
            </TouchableOpacity>
            {!next.mandatory && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnOutline]}
                onPress={() => {
                  hap.light();
                  setSkipOpen(true);
                }}
                disabled={busy}
                activeOpacity={0.75}
              >
                <Ionicons name="play-skip-forward" size={15} color={DS.ink2} />
                <Text style={[styles.actionBtnText, { color: DS.ink2 }]}>Salta visita</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.doneCard}>
          <Ionicons name="checkmark-done-circle" size={36} color="#059669" />
          <Text style={styles.doneText}>Nessuna visita rimanente: termina il tour per il consuntivo.</Text>
        </View>
      )}

      {recalcing && (
        <View style={styles.recalcRow}>
          <ActivityIndicator size="small" color={AI_PURPLE} />
          <Text style={styles.recalcText}>Ricalcolo del giro in corso...</Text>
        </View>
      )}

      {/* Rimanenti */}
      {pending.length > 0 && (
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>VISITE RIMANENTI</Text>
          {pending.map((s, i) => (
            <View key={s.id} style={[styles.listRow, i === 0 && styles.listRowNext, s.addedByAdmin && styles.listRowAdmin]}>
              <View style={[styles.listSeq, { backgroundColor: s.addedByAdmin ? '#EA580C' : ENTITY_COLORS[s.candidate.entityType] }]}>
                <Text style={styles.listSeqText}>{stopNumbers.get(s.id)}</Text>
              </View>
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => setDetailStop(s)}
                disabled={busy || recalcing}
                activeOpacity={0.6}
                testID={`aitour-live-pending-name-${i + 1}`}
              >
                <Text style={[styles.listName, styles.listNameLink]} numberOfLines={1}>
                  {s.candidate.name}
                </Text>
              </TouchableOpacity>
              {s.addedByAdmin && (
                <View style={[styles.tinyBadge, { backgroundColor: '#EA580C' }]}>
                  <Text style={styles.tinyBadgeText}>admin</Text>
                </View>
              )}
              {s.addedLive && !s.addedByAdmin && (
                <View style={[styles.tinyBadge, { backgroundColor: '#0D9488' }]}>
                  <Text style={styles.tinyBadgeText}>live</Text>
                </View>
              )}
              {isRevisitCandidate(s.candidate) && (
                <View style={[styles.tinyBadge, { backgroundColor: '#2563EB' }]}>
                  <Text style={styles.tinyBadgeText}>{(s.candidate.preferredSlots || [])[0]?.label || 'ripasso'}</Text>
                </View>
              )}
              <Text style={styles.listTime}>{s.plannedArrival ? s.plannedArrival.slice(0, 5) : ''}</Text>
              <TouchableOpacity
                onPress={() => {
                  hap.light();
                  setTrashTarget(s);
                }}
                hitSlop={8}
                style={{ padding: 2 }}
                testID={`aitour-live-trash-${i + 1}`}
              >
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Gestite */}
      {handled.length > 0 && (
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>GESTITE</Text>
          {handled.map((s) => (
            <View key={s.id} style={styles.listRow}>
              <Ionicons
                name={s.status === 'completed' ? 'checkmark-circle' : s.skipReason === TRASH_REASON ? 'trash' : 'play-skip-forward'}
                size={15}
                color={s.status === 'completed' ? '#059669' : s.skipReason === TRASH_REASON ? '#F87171' : DS.inkMuted}
              />
              <Text style={[styles.listName, styles.listNameDone]} numberOfLines={1}>
                {s.candidate.name}
              </Text>
              <Text style={styles.listOutcome}>
                {s.status === 'completed'
                  ? s.outcome || 'fatta'
                  : s.status === 'cancelled'
                    ? s.skipReason === TRASH_REASON
                      ? 'cestinata'
                      : 'rimossa'
                    : 'saltata'}
              </Text>
            </View>
          ))}
        </View>
      )}

      <EsitoModal visible={esitoOpen} stopName={next?.candidate.name || ''} stopId={next?.id || null} customerId={next?.candidate.customerId || null} saving={busy} uploadPct={uploadPct} onClose={() => setEsitoOpen(false)} onConfirm={handleEsito} />

      {/* Dettaglio tappa: informazioni cliente + Fallo Ora */}
      <Modal visible={!!detailStop} animationType="fade" transparent onRequestClose={() => setDetailStop(null)}>
        <View style={styles.centerBackdrop}>
          <View style={styles.dialog} testID="aitour-stop-detail-dialog">
            {detailStop && (
              <>
                <Text style={styles.dialogTitle} testID="aitour-stop-detail-name">{detailStop.candidate.name}</Text>
                {!!detailStop.candidate.crmName && detailStop.candidate.crmName !== detailStop.candidate.name && (
                  <Text style={styles.detailCrm}>Scheda CRM: {detailStop.candidate.crmName}</Text>
                )}
                <Text style={styles.dialogText}>
                  {detailStop.candidate.address}
                  {detailStop.candidate.city ? `, ${detailStop.candidate.city}` : ''}
                  {detailStop.candidate.province ? ` (${detailStop.candidate.province})` : ''}
                </Text>
                <View style={styles.detailBadgeRow}>
                  <View style={[styles.detailBadge, { borderColor: ENTITY_COLORS[detailStop.candidate.entityType] }]}>
                    <Text style={[styles.detailBadgeText, { color: ENTITY_COLORS[detailStop.candidate.entityType] }]}>{ENTITY_LABELS[detailStop.candidate.entityType]}</Text>
                  </View>
                  {!!detailStop.plannedArrival && (
                    <Text style={styles.dialogText}>arrivo previsto {detailStop.plannedArrival.slice(0, 5)}</Text>
                  )}
                  {!!(detailStop.candidate.preferredSlots || [])[0] && (
                    <View style={[styles.tinyBadge, { backgroundColor: '#2563EB' }]}>
                      <Text style={styles.tinyBadgeText}>{(detailStop.candidate.preferredSlots || [])[0].label}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.detailGrid}>
                  <Text style={styles.detailGridItem}>Ultima visita: <Text style={styles.detailGridBold}>{detailStop.candidate.lastVisitDate ? new Date(detailStop.candidate.lastVisitDate).toLocaleDateString('it-IT') : 'mai'}</Text></Text>
                  <Text style={styles.detailGridItem}>Ultimo ordine: <Text style={styles.detailGridBold}>{detailStop.candidate.lastOrderDate ? new Date(detailStop.candidate.lastOrderDate).toLocaleDateString('it-IT') : 'mai'}</Text></Text>
                  <Text style={styles.detailGridItem}>Ordini totali: <Text style={styles.detailGridBold}>{detailStop.candidate.orderCount || 0}</Text></Text>
                  <Text style={styles.detailGridItem}>Fatturato 6 mesi: <Text style={styles.detailGridBold}>€ {Math.round(detailStop.candidate.revenue6m || 0)}</Text></Text>
                </View>
                {!detailStop.candidate.customerId && (
                  <Text style={styles.detailProspect}>Nessuna scheda cliente: da acquisire come prospect.</Text>
                )}
                {!pending.some((p) => p.id === detailStop.id) ? (
                  <Text style={styles.detailHandled}>Tappa già gestita ({detailStop.status === 'completed' ? 'completata' : 'saltata/cestinata'}).</Text>
                ) : detailStop.id === next?.id ? (
                  <Text style={styles.detailIsNext}>È già la prossima visita del giro.</Text>
                ) : (
                  <Text style={styles.dialogText}>Con <Text style={styles.detailGridBold}>Fallo Ora</Text> questa diventa subito la prossima visita e il giro viene ricalcolato.</Text>
                )}
                <View style={styles.dialogFooter}>
                  <TouchableOpacity style={styles.dialogCancel} onPress={() => setDetailStop(null)} activeOpacity={0.7} testID="aitour-stop-detail-close">
                    <Text style={styles.dialogCancelText}>Chiudi</Text>
                  </TouchableOpacity>
                  {detailStop.id !== next?.id && pending.some((p) => p.id === detailStop.id) && (
                    <TouchableOpacity
                      style={[styles.dialogConfirm, { backgroundColor: AI_PURPLE }, (busy || recalcing) && { opacity: 0.6 }]}
                      onPress={() => handleDoNow(detailStop)}
                      disabled={busy || recalcing}
                      activeOpacity={0.75}
                      testID="aitour-stop-detail-donow"
                    >
                      {busy ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.dialogConfirmText}>Fallo Ora</Text>}
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Avviso esplicito: cliente orfano riassegnato all'agente */}
      <Modal visible={!!reassigned} transparent animationType="fade" onRequestClose={() => setReassigned(null)}>
        <View style={styles.reassignOverlay}>
          <View style={styles.reassignCard}>
            <View style={styles.reassignHeader}>
              <Ionicons name="person-add" size={18} color="#059669" />
              <Text style={styles.reassignTitle}>Cliente riassegnato a te</Text>
            </View>
            <Text style={styles.reassignText}>
              <Text style={styles.reassignName}>{reassigned?.name}</Text> era un cliente orfano
              {reassigned?.prevAgent ? <Text> (prima assegnato a <Text style={styles.reassignName}>{reassigned.prevAgent}</Text>)</Text> : null}.
            </Text>
            <View style={styles.reassignBox}>
              <Text style={styles.reassignBoxText}>Avendo eseguito l&apos;ispezione di persona, il cliente è stato <Text style={styles.reassignName}>riassegnato a te</Text>: da ora lo trovi tra i tuoi clienti.</Text>
            </View>
            <TouchableOpacity style={styles.reassignBtn} onPress={() => setReassigned(null)} activeOpacity={0.75}>
              <Text style={styles.reassignBtnText}>Ho capito</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <SkipModal visible={skipOpen} stopName={next?.candidate.name || ''} saving={busy} endMin={endMin} onClose={() => setSkipOpen(false)} onConfirm={handleSkip} />

      {/* Aggiungi tappa a giro avviato */}
      <AddStopModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        agentId={tour.agent_id}
        settings={settings}
        center={fallbackPos()}
        excludeCustomerIds={new Set(stops.map((s) => s.candidate.customerId).filter((x): x is string => !!x))}
        excludeTabIds={new Set(stops.map((s) => s.candidate.tabaccheriaId).filter((x): x is string => !!x))}
        pendingStops={stops.filter((s) => s.status === 'planned').map((s) => ({ id: s.id, name: s.candidate.name }))}
        saving={busy}
        onConfirm={handleAddStop}
      />

      {/* Riordino manuale delle tappe rimanenti */}
      <ReorderStopsModal
        visible={reorderOpen}
        onClose={() => setReorderOpen(false)}
        items={stops.filter((s) => s.status === 'planned').map((s) => ({ id: s.id, name: s.candidate.name, arrival: s.plannedArrival, mandatory: s.mandatory, addedByAdmin: s.addedByAdmin }))}
        saving={busy}
        onConfirm={handleReorder}
      />

      {/* Conferma Pausa Pranzo */}
      <Modal visible={lunchOpen} animationType="fade" transparent onRequestClose={() => setLunchOpen(false)}>
        <View style={styles.centerBackdrop}>
          <View style={styles.dialog}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Ionicons name="cafe" size={17} color="#EA580C" />
              <Text style={styles.dialogTitle}>Pausa Pranzo</Text>
            </View>
            <Text style={styles.dialogText}>
              Metti in pausa il giro per <Text style={{ fontFamily: JAKARTA.bold }}>{lunchMinutes} minuti</Text>: se necessario gli orari delle tappe
              rimanenti vengono ricalcolati (mai anticipati). Puoi riprendere in anticipo quando vuoi.
            </Text>
            <Text style={styles.lunchOnceText}>La Pausa Pranzo è utilizzabile una sola volta al giorno.</Text>
            <View style={styles.dialogFooter}>
              <TouchableOpacity style={styles.dialogCancel} onPress={() => setLunchOpen(false)} activeOpacity={0.7}>
                <Text style={styles.dialogCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dialogConfirm, { backgroundColor: '#EA580C' }]} onPress={handleLunchStart} disabled={busy} activeOpacity={0.7}>
                {busy ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.dialogConfirmText}>Inizia pausa ({lunchMinutes} min)</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Acquisizione prospect */}
      <Modal visible={!!acquireKind} animationType="fade" transparent onRequestClose={() => setAcquireKind(null)}>
        <View style={styles.centerBackdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Acquisisci come prospect</Text>
            {next && (
              <>
                <Text style={styles.dialogName}>{next.candidate.name}</Text>
                <Text style={styles.dialogText}>
                  Questa tappa non ha ancora una scheda cliente. Verrà avviata la Prima Visita con i dati della tabaccheria precompilati: al termine il
                  prospect sarà collegato alla tappa e proseguirai con {acquireKind === 'order' ? 'la Raccolta Ordine' : "l'Ispezione"}.
                </Text>
                <View style={[styles.dialogWarn, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]} testID="aitour-acquire-repress-warning">
                  <Ionicons name="alert-circle" size={13} color="#DC2626" />
                  <Text style={[styles.dialogWarnText, { color: '#991B1B', fontFamily: JAKARTA.bold }]}>
                    IMPORTANTE: finita la raccolta dell&apos;anagrafica tornerai al giro e{' '}
                    {acquireKind === 'order' ? 'si aprirà la Raccolta Ordine' : 'si aprirà la schermata di esito'}. Se NON si apre da sola (o la chiudi
                    senza salvare), premi di nuovo il tasto {acquireKind === 'order' ? 'RACCOLTA ORDINE' : 'ISPEZIONE'} per concludere correttamente
                    l&apos;operazione: altrimenti la tappa resta aperta.
                  </Text>
                </View>
                <View style={styles.dialogWarn}>
                  <Ionicons name="location" size={13} color="#92400E" />
                  <Text style={styles.dialogWarnText}>
                    L&apos;acquisizione è consentita solo di persona: verifico che il tuo GPS sia entro {ACQUIRE_MAX_M} m dalla tabaccheria.
                  </Text>
                </View>
              </>
            )}
            <View style={styles.dialogFooter}>
              <TouchableOpacity style={styles.dialogCancel} onPress={() => setAcquireKind(null)} activeOpacity={0.7}>
                <Text style={styles.dialogCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dialogConfirm} onPress={startAcquisition} disabled={busy} activeOpacity={0.7}>
                {busy ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.dialogConfirmText}>Verifica GPS e procedi</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Conferma cestinatura visita */}
      <Modal visible={!!trashTarget} animationType="fade" transparent onRequestClose={() => setTrashTarget(null)}>
        <View style={styles.centerBackdrop}>
          <View style={styles.dialog} testID="aitour-trash-dialog">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Ionicons name="trash" size={17} color="#DC2626" />
              <Text style={styles.dialogTitle}>Cestina visita</Text>
            </View>
            <Text style={styles.dialogText}>
              Vuoi cestinare <Text style={{ fontFamily: JAKARTA.bold }}>{trashTarget?.candidate.name}</Text>? La visita esce dal giro,
              viene segnalata come cestinata e gli orari delle altre tappe vengono ricalcolati.
            </Text>
            <View style={styles.dialogFooter}>
              <TouchableOpacity style={styles.dialogCancel} onPress={() => setTrashTarget(null)} activeOpacity={0.7} testID="aitour-trash-cancel">
                <Text style={styles.dialogCancelText}>No, mantieni la visita</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dialogConfirm, { backgroundColor: '#DC2626' }]} onPress={handleTrash} disabled={trashing} activeOpacity={0.7} testID="aitour-trash-confirm">
                {trashing ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.dialogConfirmText}>Sì, cestina la visita</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* "Più Visite": visite aggiuntive fino all'orario di fine giro */}
      <Modal visible={extendOpen} animationType="fade" transparent onRequestClose={() => setExtendOpen(false)}>
        <View style={styles.centerBackdrop}>
          <View style={styles.dialog} testID="aitour-extend-dialog">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Ionicons name="sparkles" size={17} color="#059669" />
              <Text style={styles.dialogTitle}>Più visite nel giro</Text>
            </View>
            <Text style={styles.dialogText}>
              L&apos;AI aggiunge visite <Text style={{ fontFamily: JAKARTA.bold }}>vicine al percorso rimanente</Text> riempiendo il tempo
              disponibile fino all&apos;orario di fine giro. Le tappe già previste restano tutte nel giro: vengono rimodulati solo gli orari,
              tranne quelli delle tappe con <Text style={{ fontFamily: JAKARTA.bold }}>vincoli orari</Text> (ripassi a un&apos;ora precisa e
              fasce scelte), che restano nelle loro finestre.
            </Text>
            <Text style={styles.extendLabel}>Fine giro (posticipabile) — attuale {minToTime(endMin)}</Text>
            <TextInput
              style={styles.extendInput}
              value={extendEndTime}
              onChangeText={(v) => {
                setExtendEndTime(v);
                setExtendError(null);
              }}
              placeholder="HH:MM"
              placeholderTextColor={DS.inkMuted}
              maxLength={5}
              testID="aitour-extend-end-time"
            />
            <View style={styles.extendChips}>
              {[30, 60, 120].map((d) => (
                <TouchableOpacity
                  key={d}
                  style={styles.extendChip}
                  onPress={() => {
                    setExtendEndTime(minToTime(Math.min(endMin + d, 23 * 60 + 59)));
                    setExtendError(null);
                  }}
                  activeOpacity={0.7}
                  testID={`aitour-extend-plus-${d}`}
                >
                  <Text style={styles.extendChipText}>{d < 60 ? `+${d} min` : d === 60 ? '+1 ora' : `+${d / 60} ore`}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {extendError ? <Text style={styles.extendError}>{extendError}</Text> : null}
            <View style={styles.dialogFooter}>
              <TouchableOpacity style={styles.dialogCancel} onPress={() => setExtendOpen(false)} activeOpacity={0.7}>
                <Text style={styles.dialogCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogConfirm, { backgroundColor: '#059669' }]}
                onPress={handleExtend}
                disabled={busy || recalcing}
                activeOpacity={0.7}
                testID="aitour-extend-confirm"
              >
                {busy ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.dialogConfirmText}>Aggiungi visite</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Consuntivo */}
      <Modal visible={recapOpen} animationType="slide" transparent onRequestClose={() => setRecapOpen(false)}>
        <View style={styles.centerBackdrop}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>
              Consuntivo AI Tour — {new Date(tour.tour_date + 'T12:00:00').toLocaleDateString('it-IT')}
            </Text>
            <View style={styles.recapGrid}>
              {[
                { label: 'Tappe completate', value: `${doneCount} / ${stops.length}` },
                { label: 'Saltate / rimosse', value: `${skipCount}` },
                { label: 'Ordini', value: `${countEsito('ordine')}` },
                { label: 'Ispezioni', value: `${countEsito('ispezione')}` },
                { label: 'Trattative', value: `${countEsito('trattativa')}` },
                { label: 'Interessati', value: `${countEsito('interessato') + countEsito('molto_interessato')}` },
                { label: 'Follow-up / richiami', value: `${countEsito('da_richiamare') + countEsito('appuntamento_fissato')}` },
              ].map((k) => (
                <View key={k.label} style={styles.recapCell}>
                  <Text style={styles.recapLabel}>{k.label}</Text>
                  <Text style={styles.recapValue}>{k.value}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.reportTitle}>REPORT GIORNATA</Text>
            {report ? (
              <View style={styles.recapGrid}>
                <View style={styles.recapCell}>
                  <Text style={styles.recapLabel}>Ordini raccolti</Text>
                  <Text style={styles.recapValue}>
                    {report.ordersCount} {report.ordersTotal > 0 ? `· ${fmtEur(report.ordersTotal)}` : ''}
                  </Text>
                </View>
                <View style={styles.recapCell}>
                  <Text style={styles.recapLabel}>Km percorsi {report.kmSource === 'gps' ? '(GPS)' : report.kmSource === 'planned' ? '(pianificati)' : ''}</Text>
                  <Text style={styles.recapValue}>{report.km != null ? `${report.km}` : '—'}</Text>
                </View>
                <View style={styles.recapCell}>
                  <Text style={styles.recapLabel}>Durata</Text>
                  <Text style={styles.recapValue}>{report.durationMin != null ? fmtDur(report.durationMin) : '—'}</Text>
                </View>
              </View>
            ) : (
              <ActivityIndicator size="small" color={AI_PURPLE} style={{ marginVertical: 8 }} />
            )}
            {pending.length > 0 && (
              <Text style={styles.recapWarn}>
                {pending.length} visite non ancora effettuate
                {pending.filter((s) => s.candidate.score >= 60).length > 0
                  ? `, di cui ad alta priorità: ${pending
                      .filter((s) => s.candidate.score >= 60)
                      .map((s) => s.candidate.name)
                      .slice(0, 3)
                      .join(', ')}. Suggerisco di inserirle nel prossimo giro.`
                  : '.'}
              </Text>
            )}
            <View style={styles.dialogFooter}>
              <TouchableOpacity style={styles.dialogCancel} onPress={() => setRecapOpen(false)} activeOpacity={0.7}>
                <Text style={styles.dialogCancelText}>Continua il giro</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dialogConfirm, { backgroundColor: '#DC2626' }]} onPress={handleFinish} disabled={busy} activeOpacity={0.7}>
                {busy ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.dialogConfirmText}>Termina definitivamente</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  liveBadgeText: { fontFamily: JAKARTA.bold, fontSize: 10, color: '#FFF', letterSpacing: 0.5 },
  headerTime: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink2 },
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: DS.surface2,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 11,
    marginLeft: 'auto',
  },
  exitBtnText: { fontFamily: JAKARTA.semibold, fontSize: 12, color: DS.ink2 },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  finishBtnText: { fontFamily: JAKARTA.semibold, fontSize: 12, color: '#FFF' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' },
  progressText: { fontFamily: JAKARTA.medium, fontSize: 11, color: DS.inkMuted },
  gpsChip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 },
  gpsChipText: { fontFamily: JAKARTA.semibold, fontSize: 10 },
  overtimeBox: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 10, padding: 10, marginTop: 8, gap: 6 },
  overtimeTitle: { fontFamily: JAKARTA.bold, fontSize: 12.5, color: '#991B1B' },
  overtimeText: { fontFamily: JAKARTA.regular, fontSize: 11.5, color: '#7F1D1D', lineHeight: 16 },
  overtimeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  overtimeInput: { borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, fontFamily: JAKARTA.semibold, fontSize: 13, color: '#7F1D1D', backgroundColor: '#FFF', width: 76, textAlign: 'center' },
  overtimeBtn: { backgroundColor: '#DC2626', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  overtimeBtnText: { fontFamily: JAKARTA.bold, fontSize: 11.5, color: '#FFF' },
  overtimeGhostBtn: { borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#FFF' },
  overtimeGhostText: { fontFamily: JAKARTA.semibold, fontSize: 11.5, color: '#991B1B' },
  delayBadge: { borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 },
  delayText: { fontFamily: JAKARTA.semibold, fontSize: 10 },
  liveOpsRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 9, flexWrap: 'wrap' },
  opsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: DS.surface,
    borderWidth: 1,
    borderColor: '#C4B5FD',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 11,
  },
  opsBtnText: { fontFamily: JAKARTA.semibold, fontSize: 12, color: AI_PURPLE },
  lunchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  lunchText: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 11, color: '#9A3412', lineHeight: 16 },
  lunchResumeBtn: { backgroundColor: '#EA580C', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10 },
  lunchResumeText: { fontFamily: JAKARTA.bold, fontSize: 11, color: '#FFF' },
  lunchOnceText: { fontFamily: JAKARTA.semibold, fontSize: 11, color: '#C2410C', marginTop: 8 },
  mapToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: DS.surface,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  mapToggleText: { fontFamily: JAKARTA.semibold, fontSize: 12, color: DS.ink2 },
  msgBox: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  msgText: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 11, color: '#1E3A8A', lineHeight: 16 },
  suggBox: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  suggText: { fontFamily: JAKARTA.medium, fontSize: 11, color: '#134E4A', lineHeight: 16 },
  suggBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  suggAccept: { backgroundColor: '#0D9488', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 16 },
  suggAcceptText: { fontFamily: JAKARTA.semibold, fontSize: 12, color: '#FFF' },
  suggDecline: { borderWidth: 1, borderColor: DS.border, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 16 },
  suggDeclineText: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink2 },
  nextCard: {
    backgroundColor: DS.surface,
    borderWidth: 2,
    borderColor: '#C4B5FD',
    borderRadius: 14,
    padding: 13,
    marginTop: 12,
    ...SHADOWS.sm,
  },
  nextHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  nextLabel: { fontFamily: JAKARTA.bold, fontSize: 10, color: AI_PURPLE, letterSpacing: 0.4 },
  nextBadges: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  mandBadge: { backgroundColor: '#DC2626', borderRadius: 5, paddingVertical: 2, paddingHorizontal: 6 },
  mandBadgeText: { fontFamily: JAKARTA.semibold, fontSize: 9, color: '#FFF' },
  nextName: { fontFamily: JAKARTA.bold, fontSize: 17, color: DS.ink, marginTop: 5 },
  nextCrmName: { fontFamily: JAKARTA.medium, fontSize: 11, color: '#3B82F6', marginTop: 2 },
  nextAddress: { fontFamily: JAKARTA.regular, fontSize: 12, color: DS.inkMuted, marginTop: 3 },
  nextSlots: { fontFamily: JAKARTA.medium, fontSize: 11, color: '#B45309', marginTop: 3 },
  nextMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 7, flexWrap: 'wrap' },
  entityBadge: { borderWidth: 1, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 },
  entityBadgeText: { fontFamily: JAKARTA.semibold, fontSize: 10 },
  nextMeta: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted, flexShrink: 1 },
  nextReason: {
    fontFamily: JAKARTA.regular,
    fontSize: 11,
    color: '#6D28D9',
    fontStyle: 'italic',
    borderLeftWidth: 2,
    borderLeftColor: '#C4B5FD',
    paddingLeft: 7,
    marginTop: 8,
    lineHeight: 16,
  },
  noCustomerHint: {
    fontFamily: JAKARTA.medium,
    fontSize: 11,
    color: '#0F766E',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    lineHeight: 15,
  },
  inspectReminder: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  inspectReminderText: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 11, color: '#92400E', lineHeight: 15 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 11,
    width: '48.5%',
  },
  actionBtnOutline: { backgroundColor: DS.surface, borderWidth: 1, borderColor: DS.border },
  actionBtnText: { fontFamily: JAKARTA.semibold, fontSize: 12, color: '#FFF' },
  doneCard: {
    backgroundColor: DS.surface,
    borderRadius: 14,
    padding: 24,
    marginTop: 12,
    alignItems: 'center',
    gap: 8,
  },
  doneText: { fontFamily: JAKARTA.medium, fontSize: 13, color: DS.ink2, textAlign: 'center' },
  recalcRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  recalcText: { fontFamily: JAKARTA.medium, fontSize: 12, color: AI_PURPLE },
  listSection: { backgroundColor: DS.surface, borderRadius: 12, padding: 10, marginTop: 12 },
  listTitle: { fontFamily: JAKARTA.bold, fontSize: 10, color: DS.inkMuted, letterSpacing: 0.4, marginBottom: 6 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  listRowNext: { backgroundColor: AI_PURPLE_SOFT },
  listRowAdmin: { backgroundColor: 'rgba(234,88,12,0.10)' },
  tinyBadge: { borderRadius: 4, paddingVertical: 1.5, paddingHorizontal: 5 },
  tinyBadgeText: { fontFamily: JAKARTA.semibold, fontSize: 8.5, color: '#FFF' },
  listSeq: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  listSeqText: { fontFamily: JAKARTA.bold, fontSize: 10, color: '#FFF' },
  listName: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink },
  listNameLink: { flex: undefined, textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  listNameDone: { color: DS.inkMuted, textDecorationLine: 'line-through' },
  listTime: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted },
  listOutcome: { fontFamily: JAKARTA.regular, fontSize: 10, color: DS.inkMuted },
  centerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  dialog: { backgroundColor: DS.surface, borderRadius: 16, padding: 16 },
  dialogTitle: { fontFamily: JAKARTA.bold, fontSize: 15, color: DS.ink },
  dialogName: { fontFamily: JAKARTA.semibold, fontSize: 14, color: DS.ink, marginTop: 8 },
  dialogText: { fontFamily: JAKARTA.regular, fontSize: 12, color: DS.ink2, marginTop: 6, lineHeight: 17 },
  dialogWarn: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  dialogWarnText: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 11, color: '#92400E', lineHeight: 15 },
  dialogFooter: { flexDirection: 'row', gap: 10, marginTop: 14 },
  dialogCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  dialogCancelText: { fontFamily: JAKARTA.semibold, fontSize: 12, color: DS.ink2 },
  dialogConfirm: { flex: 2, backgroundColor: '#0D9488', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  dialogConfirmText: { fontFamily: JAKARTA.bold, fontSize: 12, color: '#FFF' },
  detailCrm: { fontFamily: JAKARTA.semibold, fontSize: 12, color: '#2563EB', marginTop: 6 },
  detailBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  detailBadge: { borderWidth: 1, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 },
  detailBadgeText: { fontFamily: JAKARTA.semibold, fontSize: 10 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, rowGap: 3 },
  detailGridItem: { width: '50%', fontFamily: JAKARTA.regular, fontSize: 11, color: DS.ink2 },
  detailGridBold: { fontFamily: JAKARTA.bold, color: DS.ink },
  detailProspect: { fontFamily: JAKARTA.semibold, fontSize: 11.5, color: '#B45309', marginTop: 8 },
  detailHandled: { fontFamily: JAKARTA.semibold, fontSize: 11.5, color: DS.inkMuted, marginTop: 8 },
  detailIsNext: { fontFamily: JAKARTA.semibold, fontSize: 11.5, color: '#047857', marginTop: 8 },
  recapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  recapCell: { backgroundColor: DS.surface2, borderRadius: 8, padding: 8, minWidth: '47%', flexGrow: 1 },
  recapLabel: { fontFamily: JAKARTA.regular, fontSize: 10, color: DS.inkMuted },
  recapValue: { fontFamily: JAKARTA.bold, fontSize: 15, color: DS.ink, marginTop: 1 },
  reportTitle: { fontFamily: JAKARTA.bold, fontSize: 10, color: DS.inkMuted, letterSpacing: 0.4, marginTop: 12 },
  recapWarn: {
    fontFamily: JAKARTA.medium,
    fontSize: 11,
    color: '#92400E',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 8,
    marginTop: 10,
    lineHeight: 15,
  },
  reassignOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  reassignCard: { backgroundColor: DS.surface, borderRadius: 16, padding: 18, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: DS.border },
  reassignHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  reassignTitle: { fontFamily: JAKARTA.bold, fontSize: 15, color: DS.ink },
  reassignText: { fontFamily: JAKARTA.regular, fontSize: 12.5, color: DS.ink, lineHeight: 18 },
  reassignName: { fontFamily: JAKARTA.bold },
  reassignBox: { backgroundColor: 'rgba(5,150,105,0.12)', borderWidth: 1, borderColor: 'rgba(5,150,105,0.4)', borderRadius: 8, padding: 10, marginTop: 10 },
  reassignBoxText: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink, lineHeight: 17 },
  reassignBtn: { backgroundColor: '#059669', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 14, minHeight: 44, justifyContent: 'center' },
  reassignBtnText: { fontFamily: JAKARTA.bold, fontSize: 13, color: '#FFF' },
  proxBox: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FCD34D', borderRadius: 10, padding: 10, marginTop: 8 },
  proxTitle: { fontFamily: JAKARTA.bold, fontSize: 12, color: '#92400E' },
  proxText: { fontFamily: JAKARTA.medium, fontSize: 11, color: '#78350F', lineHeight: 16, marginTop: 4 },
  proxAccept: { backgroundColor: '#D97706', borderRadius: 8, paddingVertical: 7, paddingHorizontal: 16 },
  extendLabel: { fontFamily: JAKARTA.semibold, fontSize: 11, color: DS.ink2, marginTop: 12 },
  extendInput: {
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    fontFamily: JAKARTA.semibold,
    fontSize: 14,
    color: DS.ink,
    marginTop: 6,
  },
  extendChips: { flexDirection: 'row', gap: 8, marginTop: 8 },
  extendChip: { borderWidth: 1, borderColor: '#6EE7B7', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  extendChipText: { fontFamily: JAKARTA.semibold, fontSize: 11, color: '#059669' },
  extendError: { fontFamily: JAKARTA.medium, fontSize: 11, color: '#DC2626', marginTop: 8 },
});
