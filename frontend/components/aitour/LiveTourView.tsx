// Modalità Live AI Tour mobile: prossima visita, sono arrivato, esito, salta, ricalcolo automatico,
// integrazione Raccolta Ordine/Ispezione/Prima Visita con chiusura automatica della tappa al ritorno.
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DS, JAKARTA, SHADOWS } from '../../lib/theme';
import { hap } from '../../lib/haptics';
import { AI_PURPLE, AI_PURPLE_SOFT, openNavigation } from './shared';
import { EsitoModal } from './EsitoModal';
import { SkipModal } from './SkipModal';
import { TourMapView, type TourMapStop } from './TourMapView';
import type { LiveState, LiveStop } from '../../lib/aitour/live';
import {
  nowMin, getCurrentPos, markArrived, completeStop, skipStop, cancelStopByRecalc,
  updateLiveSequence, addLiveStop, finishLiveTour, suggestNearby, findExternalResult, updateTourPosition,
  findTabCustomer, updateStopCustomer, recordTrackPoint,
} from '../../lib/aitour/live';
import { planTour } from '../../lib/aitour/planner';
import { buildTourReport, type TourReport } from '../../lib/aitour/report';
import type { TourCandidate, AiTourSettings, GeoPoint, DayType } from '../../lib/aitour/types';
import { minToTime, timeToMin, fmtDur, fmtEur, haversineKm, ENTITY_LABELS, ENTITY_COLORS } from '../../lib/aitour/types';

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
  const [recapOpen, setRecapOpen] = useState(false);
  const [acquireKind, setAcquireKind] = useState<'inspection' | 'order' | null>(null);
  const [busy, setBusy] = useState(false);
  const [recalcing, setRecalcing] = useState(false);
  const [report, setReport] = useState<TourReport | null>(null);
  const [showMap, setShowMap] = useState(false);
  const tour = initial.tour;
  const stopsRef = useRef(stops);
  stopsRef.current = stops;

  // Battito posizione: GPS al Monitoring admin subito e poi ogni 60s + traccia percorso reale
  useEffect(() => {
    let stopped = false;
    const beat = async () => {
      const pos = await getCurrentPos();
      if (!stopped && pos) {
        updateTourPosition(tour.id, pos.lat, pos.lng).catch(() => {});
        recordTrackPoint(tour.agent_id, pos.lat, pos.lng).catch(() => {});
      }
    };
    beat();
    const iv = setInterval(beat, 60000);
    return () => {
      stopped = true;
      clearInterval(iv);
    };
  }, [tour.id, tour.agent_id]);

  const pending = useMemo(() => stops.filter((s) => s.status === 'planned' || s.status === 'arrived'), [stops]);
  const next = pending[0] || null;
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
    async (currentStops: LiveStop[]) => {
      const remaining = currentStops.filter((s) => s.status === 'planned');
      if (remaining.length === 0) {
        setMessage('Tutte le visite sono state gestite: puoi terminare il tour.');
        return;
      }
      setRecalcing(true);
      try {
        const pos = (await getCurrentPos()) || fallbackPos();
        const start: GeoPoint = { ...pos, label: 'Posizione attuale' };
        const plan = await planTour({
          candidates: remaining.map((s) => s.candidate),
          mandatoryKeys: new Set(remaining.filter((s) => s.mandatory).map((s) => s.candidate.key)),
          start,
          end: initial.endPoint,
          tourDate: tour.tour_date,
          startMin: nowMin(),
          endMin: initial.endMin,
          dayType: tour.tour_type as DayType,
          resolvedDayType: (tour.resolved_tour_type || 'mista') as Exclude<DayType, 'ai'>,
          bufferPct: 5,
          area: { mode: 'auto' },
        });
        const keptKeys = new Set(plan.stops.map((p) => p.candidate.key));
        const dropped = remaining.filter((s) => !keptKeys.has(s.candidate.key));
        for (const d of dropped) await cancelStopByRecalc(tour.id, d.id);

        const stopByKey = new Map(remaining.map((s) => [s.candidate.key, s]));
        const updates = plan.stops.map((p, i) => {
          const s = stopByKey.get(p.candidate.key)!;
          return { stopId: s.id, seq: i + 1, arrival: minToTime(p.arrivalMin), travelMin: p.travelMinFromPrev, travelKm: p.travelKmFromPrev };
        });
        await updateLiveSequence(tour.id, updates);

        const updById = new Map(updates.map((u) => [u.stopId, u]));
        const droppedIds = new Set(dropped.map((d) => d.id));
        const merged = currentStops.map((s): LiveStop => {
          if (droppedIds.has(s.id)) return { ...s, status: 'cancelled', skipReason: 'Rimossa dal ricalcolo AI' };
          const u = updById.get(s.id);
          if (u) return { ...s, plannedArrival: u.arrival, travelMinutes: Math.round(u.travelMin), travelKm: u.travelKm };
          return s;
        });
        merged.sort((a, b) => {
          const ra = a.status === 'planned' ? (updById.get(a.id)?.seq ?? 999) : -1;
          const rb = b.status === 'planned' ? (updById.get(b.id)?.seq ?? 999) : -1;
          return ra - rb;
        });
        setStops(merged);

        let msg = `Giro ricalcolato alle ${minToTime(nowMin())}.`;
        if (dropped.length > 0) {
          msg += ` Per mantenere il rientro entro le ${minToTime(initial.endMin)} ho rimosso ${dropped.map((d) => `"${d.candidate.name}" (${d.candidate.score}/100)`).join(', ')}.`;
        }
        msg += ` ${plan.stops.length} visite rimanenti, fine prevista ${minToTime(plan.finishMin)}.`;
        setMessage(msg);

        // Recupero tempo: se resta molto margine, proponi una visita vicina
        const slack = initial.endMin - plan.finishMin;
        if (slack >= 25) {
          const exclude = new Set(currentStops.map((s) => s.candidate.tabaccheriaId).filter((x): x is string => !!x));
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
      }
    },
    [tour, initial.endMin, initial.endPoint, fallbackPos, settings]
  );

  const handleArrived = async () => {
    if (!next) return;
    hap.medium();
    setBusy(true);
    try {
      await markArrived(tour.id, next.id);
      setStops(stops.map((s) => (s.id === next.id ? { ...s, status: 'arrived', actualArrival: new Date().toISOString() } : s)));
    } catch (err) {
      console.error('[AITour][live] arrived:', err);
      setMessage('Errore nella registrazione dell\u2019arrivo');
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
            await updateStopCustomer(stop.id, custId);
            const updated = current.map((s): LiveStop =>
              s.id === stop.id ? { ...s, candidate: { ...s.candidate, customerId: custId, entityType: 'prospect' } } : s
            );
            setStops(updated);
            const nk = info.nextKind || 'inspection';
            const ctx: ExternalCtx = { tourId: tour.id, stopId: stop.id, customerId: custId, kind: nk, startedAt: new Date().toISOString() };
            await AsyncStorage.setItem(EXTERNAL_KEY, JSON.stringify(ctx));
            setMessage(`Prospect creato: "${stop.candidate.name}" collegato alla tappa`);
            if (nk === 'inspection') {
              router.push({ pathname: '/inspection/new', params: { customerId: custId } });
            } else {
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

  const handleEsito = async (outcome: string, note: string, followUpDate: string | null) => {
    if (!next) return;
    setBusy(true);
    try {
      await completeStop(tour, next, { outcome, note, followUpDate });
      const updated = stops.map((s) => (s.id === next.id ? { ...s, status: 'completed' as const, outcome } : s));
      setStops(updated);
      setEsitoOpen(false);
      hap.success();
      await runRecalc(updated);
    } catch (err) {
      console.error('[AITour][live] esito:', err);
      setMessage('Errore nella registrazione dell\u2019esito');
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = async (reason: string, note: string) => {
    if (!next) return;
    setBusy(true);
    try {
      await skipStop(tour.id, next.id, reason, note);
      const updated = stops.map((s) => (s.id === next.id ? { ...s, status: 'skipped' as const, skipReason: reason } : s));
      setStops(updated);
      setSkipOpen(false);
      await runRecalc(updated);
    } catch (err) {
      console.error('[AITour][live] skip:', err);
      setMessage('Errore nel salto della visita');
    } finally {
      setBusy(false);
    }
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

  const handleFinish = async () => {
    setBusy(true);
    try {
      await finishLiveTour(tour.id);
      setRecapOpen(false);
      hap.success();
      onExit();
    } catch (err) {
      console.error('[AITour][live] finish:', err);
      setMessage('Errore nella chiusura del tour');
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
          {tour.start_time?.slice(0, 5)}–{tour.end_time?.slice(0, 5)}
        </Text>
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
        {next && Math.abs(delayMin) > 5 && (
          <View style={[styles.delayBadge, { backgroundColor: delayMin > 0 ? '#FEE2E2' : '#D1FAE5' }]}>
            <Text style={[styles.delayText, { color: delayMin > 0 ? '#991B1B' : '#047857' }]}>
              {delayMin > 0 ? `Ritardo ${fmtDur(delayMin)}` : `Anticipo ${fmtDur(-delayMin)}`}
            </Text>
          </View>
        )}
      </View>

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
            const pendingIdx = pending.findIndex((p) => p.id === s.id);
            return {
              key: s.id,
              lat: s.candidate.lat,
              lng: s.candidate.lng,
              color: ENTITY_COLORS[s.candidate.entityType],
              label: pendingIdx >= 0 ? String(pendingIdx + 1) : '',
              mandatory: s.mandatory,
              name: s.candidate.name,
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
        />
      )}

      {message ? (
        <View style={styles.msgBox}>
          <Ionicons name="sparkles" size={13} color="#2563EB" />
          <Text style={styles.msgText}>{message}</Text>
          <TouchableOpacity onPress={() => setMessage(null)} hitSlop={8}>
            <Ionicons name="close" size={14} color="#2563EB" />
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
            <TouchableOpacity style={styles.suggDecline} onPress={() => setSuggestion(null)} activeOpacity={0.7}>
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
            {next.mandatory && (
              <View style={styles.mandBadge}>
                <Text style={styles.mandBadgeText}>Obbligatoria</Text>
              </View>
            )}
          </View>
          <Text style={styles.nextName}>{next.candidate.name}</Text>
          <Text style={styles.nextAddress}>
            <Ionicons name="location-outline" size={12} color={DS.inkMuted} /> {next.candidate.address}
            {next.candidate.city ? `, ${next.candidate.city}` : ''}
          </Text>
          <View style={styles.nextMetaRow}>
            <View style={[styles.entityBadge, { borderColor: ENTITY_COLORS[next.candidate.entityType] }]}>
              <Text style={[styles.entityBadgeText, { color: ENTITY_COLORS[next.candidate.entityType] }]}>
                {ENTITY_LABELS[next.candidate.entityType]}
              </Text>
            </View>
            <Text style={styles.nextMeta}>
              ~{distToNext.toFixed(1)} km · arrivo {next.plannedArrival ? next.plannedArrival.slice(0, 5) : '—'} · visita {next.candidate.visitMinutes} min · {next.candidate.score}/100
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
              style={[styles.actionBtn, { backgroundColor: '#2563EB' }]}
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
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#EA580C' }]} onPress={() => goExternal('order')} disabled={busy} activeOpacity={0.75}>
              <Ionicons name="cart" size={15} color="#FFF" />
              <Text style={styles.actionBtnText}>Raccolta Ordine</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#0284C7' }]} onPress={() => goExternal('inspection')} disabled={busy} activeOpacity={0.75}>
              <Ionicons name="clipboard" size={15} color="#FFF" />
              <Text style={styles.actionBtnText}>Ispezione</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#059669' }]}
              onPress={() => {
                hap.light();
                setEsitoOpen(true);
              }}
              disabled={busy}
              activeOpacity={0.75}
            >
              <Ionicons name="checkmark-circle" size={15} color="#FFF" />
              <Text style={styles.actionBtnText}>Visita terminata</Text>
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
            <View key={s.id} style={[styles.listRow, i === 0 && styles.listRowNext]}>
              <View style={[styles.listSeq, { backgroundColor: ENTITY_COLORS[s.candidate.entityType] }]}>
                <Text style={styles.listSeqText}>{i + 1}</Text>
              </View>
              <Text style={styles.listName} numberOfLines={1}>
                {s.candidate.name}
              </Text>
              <Text style={styles.listTime}>{s.plannedArrival ? s.plannedArrival.slice(0, 5) : ''}</Text>
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
                name={s.status === 'completed' ? 'checkmark-circle' : 'play-skip-forward'}
                size={15}
                color={s.status === 'completed' ? '#059669' : DS.inkMuted}
              />
              <Text style={[styles.listName, styles.listNameDone]} numberOfLines={1}>
                {s.candidate.name}
              </Text>
              <Text style={styles.listOutcome}>
                {s.status === 'completed' ? s.outcome || 'fatta' : s.status === 'cancelled' ? 'rimossa AI' : 'saltata'}
              </Text>
            </View>
          ))}
        </View>
      )}

      <EsitoModal visible={esitoOpen} stopName={next?.candidate.name || ''} saving={busy} onClose={() => setEsitoOpen(false)} onConfirm={handleEsito} />
      <SkipModal visible={skipOpen} stopName={next?.candidate.name || ''} saving={busy} onClose={() => setSkipOpen(false)} onConfirm={handleSkip} />

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
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 11,
    marginLeft: 'auto',
  },
  finishBtnText: { fontFamily: JAKARTA.semibold, fontSize: 12, color: '#FFF' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7, flexWrap: 'wrap' },
  progressText: { fontFamily: JAKARTA.medium, fontSize: 11, color: DS.inkMuted },
  delayBadge: { borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 },
  delayText: { fontFamily: JAKARTA.semibold, fontSize: 10 },
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
  nextHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextLabel: { fontFamily: JAKARTA.bold, fontSize: 10, color: AI_PURPLE, letterSpacing: 0.4 },
  mandBadge: { backgroundColor: '#DC2626', borderRadius: 5, paddingVertical: 2, paddingHorizontal: 6 },
  mandBadgeText: { fontFamily: JAKARTA.semibold, fontSize: 9, color: '#FFF' },
  nextName: { fontFamily: JAKARTA.bold, fontSize: 17, color: DS.ink, marginTop: 5 },
  nextAddress: { fontFamily: JAKARTA.regular, fontSize: 12, color: DS.inkMuted, marginTop: 3 },
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
  listSeq: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  listSeqText: { fontFamily: JAKARTA.bold, fontSize: 10, color: '#FFF' },
  listName: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink },
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
});
