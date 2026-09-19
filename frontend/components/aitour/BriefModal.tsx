// "Dillo all'AI": l'agente descrive il giro a voce o per iscritto, l'AI interpreta
// la richiesta e mostra dei chip modificabili prima di generare il giro.
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
  Alert,
  Switch,
  KeyboardAvoidingView,
} from 'react-native';
import Constants from 'expo-constants';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { DS, JAKARTA } from '../../lib/theme';
import { hap } from '../../lib/haptics';
import { AI_PURPLE, AI_PURPLE_SOFT, AI_PURPLE_TEXT } from './shared';
import {
  normalizeBriefV4,
  applyReturnHomeFallback,
  conditionLabel,
  preferenceLabel,
  targetLabel,
  dateChipLabel,
  type TourBriefV4,
} from '../../lib/aitour/brief-v4';
import { loadBriefCustomers, type BriefCustomer } from '../../lib/aitour/brief-customers';
import { briefReviewProblems, identifyBriefStops } from '../../lib/aitour/brief-review';
import { briefConsistencyIssues, briefClarifications } from '../../lib/aitour/brief-consistency';
import { briefSummary, resolveBriefDate } from '../../lib/aitour/brief-summary';
import { previewBriefCandidates, type BriefPreview } from '../../lib/aitour/brief-preview';
import { loadCandidates, type CandidatePool } from '../../lib/aitour/data';
import { scoreCandidates } from '../../lib/aitour/scoring';
import { bindSavedBriefPlaces } from '../../lib/aitour/brief-saved-places';
import { bindJourneyEnd } from '../../lib/aitour/brief-journey';
import type { AiTourSettings } from '../../lib/aitour/types';
import type { TourCandidate } from '../../lib/aitour/types';
import { BriefPlacePicker } from './brief/BriefPlacePicker';
import { BriefStopsReview } from './brief/BriefStopsReview';
import { BriefJourneyReview } from './brief/BriefJourneyReview';
import { BriefIssues } from './brief/BriefIssues';
import { BriefPreviewBox } from './brief/BriefPreviewBox';
import { reviewStyles } from './brief/controls';

const API = `${Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

const DAY_OPTIONS: { value: Exclude<TourBriefV4['dayType'], null>; label: string }[] = [
  { value: 'clienti', label: 'Clienti' },
  { value: 'sviluppo', label: 'Sviluppo' },
  { value: 'mista', label: 'Mista' },
];

interface Props {
  agentId: string;
  settings: AiTourSettings;
  generationError?: string;
  visible: boolean;
  onClose: () => void;
  onConfirm: (brief: TourBriefV4) => void;
  projects: string[];
  cities: string[];
}

export function BriefModal({ visible, onClose, onConfirm, projects, cities, agentId, settings, generationError }: Props) {
  const insets = useSafeAreaInsets();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [brief, setBrief] = useState<TourBriefV4 | null>(null);
  const [err, setErr] = useState('');
  const [customers, setCustomers] = useState<BriefCustomer[]>([]);
  const [preview, setPreview] = useState<BriefPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const poolRef = useRef<{ agentId: string; pool: Promise<CandidatePool> } | null>(null);
  const epoch = useRef(0);
  const parsedRequest = useRef<AbortController | null>(null);
  useEffect(() => () => { epoch.current++; parsedRequest.current?.abort(); }, []);
  useEffect(() => { if (visible && generationError) setErr(generationError); }, [generationError, visible]);
  const reviewed = brief ? bindJourneyEnd(bindSavedBriefPlaces(brief, settings)) : null;
  // Contraddizioni interne e domande mirate: si risolvono con un tocco, senza riscrivere la richiesta.
  const issues = reviewed ? briefConsistencyIssues(reviewed, customers) : [];
  const clarifications = reviewed ? briefClarifications(reviewed) : [];
  const hidden = [...issues, ...clarifications].map((i) => i.hides).filter((h): h is string => !!h);
  const problems = reviewed ? briefReviewProblems(reviewed, customers).filter((p) => !hidden.some((h) => p.startsWith(h))) : [];
  // Riassunto rigenerato dal CRM sui chip finali: coerente con ciò che riceve il planner.
  const crmSummary = reviewed ? briefSummary(reviewed, customers) : '';
  const updateBrief = (b: TourBriefV4) => { setBrief(bindJourneyEnd(bindSavedBriefPlaces(b, settings))); setErr(''); };
  const applyFix = (fix: (b: TourBriefV4) => TourBriefV4) => { hap.light(); setBrief((current) => current ? bindJourneyEnd(bindSavedBriefPlaces(fix(bindJourneyEnd(bindSavedBriefPlaces(current, settings))), settings)) : null); setErr(''); };
  // Recupero di un escluso dai 15 giorni: diventa tappa nominata, quindi rientra nel giro.
  const includeExcluded = (c: TourCandidate) => {
    const customerId = c.customerId;
    if (!customerId) return;
    applyFix((b) => b.mandatoryStops.some((s) => s.selectedCustomerId === customerId) || b.preferredStops.some((s) => s.selectedCustomerId === customerId)
      ? b
      : { ...b, mandatoryStops: [...b.mandatoryStops, { rawReference: c.name, cityHint: c.city || null, appointment: null, priority: 2, selectedCustomerId: customerId }] });
  };

  const reset = () => {
    epoch.current++;
    parsedRequest.current?.abort();
    setParsing(false);
    setTranscribing(false);
    setText('');
    setBrief(null);
    setErr('');
    setRecording(false);
  };

  const close = () => {
    if (recording) void recorder.stop().catch(() => {});
    reset();
    onClose();
  };

  const startRecording = async () => {
    setErr('');
    try {
      let perm = await getRecordingPermissionsAsync();
      if (!perm.granted) {
        if (perm.canAskAgain) perm = await requestRecordingPermissionsAsync();
        if (!perm.granted) {
          if (!perm.canAskAgain) {
            Alert.alert(
              'Microfono disattivato',
              'Per dettare la richiesta serve il permesso microfono.',
              [
                { text: 'Annulla', style: 'cancel' },
                { text: 'Apri Impostazioni', onPress: () => Linking.openSettings() },
              ],
            );
          } else {
            setErr('Permesso microfono negato');
          }
          return;
        }
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      hap.medium();
      setRecording(true);
    } catch (e) {
      console.warn('[BriefModal] start rec:', e);
      setErr('Impossibile avviare la registrazione');
    }
  };

  const stopRecording = async () => {
    setRecording(false);
    try {
      await recorder.stop();
      hap.light();
      const uri = recorder.uri;
      if (!uri) {
        setErr('Registrazione non riuscita');
        return;
      }
      await transcribe(uri);
    } catch (e) {
      console.warn('[BriefModal] stop rec:', e);
      setErr('Registrazione non riuscita');
    }
  };

  const transcribe = async (uri: string) => {
    const token = epoch.current;
    setTranscribing(true);
    setErr('');
    try {
      const fd = new FormData();
      if (Platform.OS === 'web') {
        const blob = await (await fetch(uri)).blob();
        const ext = blob.type.includes('webm') ? 'webm' : 'm4a';
        fd.append('audio', blob, `voce.${ext}`);
      } else {
        const name = uri.split('/').pop() || 'voce.m4a';
        const ext = (name.split('.').pop() || 'm4a').toLowerCase();
        // @ts-expect-error React Native FormData file object
        fd.append('audio', { uri, name, type: `audio/${ext === 'm4a' ? 'm4a' : ext}` });
      }
      const res = await fetch(`${API}/ai-tour/transcribe`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (epoch.current !== token) return;
      const t = (data.text || '').trim();
      if (!t) {
        setErr('Non ho capito l\'audio, riprova o scrivi la richiesta');
        return;
      }
      setText((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t));
      setBrief(null);
    } catch (e) {
      console.warn('[BriefModal] transcribe:', e);
      if (epoch.current === token) setErr('Trascrizione non riuscita, scrivi pure la richiesta');
    } finally {
      if (epoch.current === token) setTranscribing(false);
    }
  };

  const interpret = async () => {
    if (!text.trim()) return;
    hap.medium();
    setParsing(true);
    setBrief(null);
    setErr('');
    const token = ++epoch.current;
    const controller = new AbortController();
    parsedRequest.current = controller;
    const timer = setTimeout(() => controller.abort(), 100000);
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const [res, portfolio] = await Promise.all([fetch(`${API}/ai-tour/parse-brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), projects, cities, today, capabilities: ['ordered_journey_v1'] }),
        signal: controller.signal,
      }), loadBriefCustomers(agentId)]);
      const raw = await res.json();
      if (!res.ok) throw new Error(raw.detail || raw.error || `HTTP ${res.status}`);
      if (token !== epoch.current) return;
      if (raw.contractVersion !== '4.1' || !raw.capabilities?.includes('ordered_journey_v1') || !raw.brief || !Object.hasOwn(raw.brief, 'journey')) throw new Error('L’interprete AI non supporta ancora questa versione del giro. Riprova più tardi.');
      const normalized = applyReturnHomeFallback(normalizeBriefV4(raw.brief), text);
      setCustomers(portfolio);
      updateBrief({ ...normalized, sourceText: text.trim(), mandatoryStops: identifyBriefStops(normalized.mandatoryStops, portfolio), preferredStops: identifyBriefStops(normalized.preferredStops, portfolio) });
      hap.success();
    } catch (e) {
      console.warn('[BriefModal] parse:', e);
      if (token === epoch.current) setErr(controller.signal.aborted ? 'Interpretazione scaduta: riprova' : e instanceof Error ? e.message : 'Interpretazione non riuscita, riprova');
    } finally {
      clearTimeout(timer);
      if (token === epoch.current) setParsing(false);
    }
  };

  const rmCondition = (i: number) => { hap.light(); setBrief((b) => b && ({ ...b, selection: { ...b.selection, conditions: b.selection.conditions.filter((_, x) => x !== i) } })); };
  const rmExclusion = (i: number) => { hap.light(); setBrief((b) => b && ({ ...b, exclusions: b.exclusions.filter((_, x) => x !== i) })); };
  const rmPreference = (i: number) => { hap.light(); setBrief((b) => b && ({ ...b, preferences: b.preferences.filter((_, x) => x !== i) })); };
  const rmArea = (i: number) => { hap.light(); setBrief((b) => b && ({ ...b, areas: b.areas.filter((_, x) => x !== i) })); };

  const setTarget = (v: number | null) => {
    if (!brief) return;
    hap.light();
    setBrief({
      ...brief,
      visitTarget: {
        ...brief.visitTarget,
        mode: v
          ? (brief.visitTarget.mode === 'unspecified' || brief.visitTarget.mode === 'all' || brief.visitTarget.mode === 'maximize' ? 'maximum' : brief.visitTarget.mode)
          : 'unspecified',
        value: v,
      },
    });
  };

  const previewKey = reviewed && !issues.length && !clarifications.length && !problems.length
    ? JSON.stringify([agentId, reviewed.selection, reviewed.exclusions, reviewed.areas, reviewed.journey?.stages, reviewed.mandatoryStops, reviewed.preferredStops, reviewed.includeAutomatic, reviewed.visitTarget, reviewed.dayType, reviewed.requestedDate, reviewed.preferences])
    : '';
  const reviewedRef = useRef(reviewed);
  reviewedRef.current = reviewed;

  useEffect(() => {
    if (!previewKey || !visible) { setPreview(null); setPreviewLoading(false); setPreviewError(null); return; }
    let alive = true;
    setPreviewLoading(true); setPreviewError(null);
    const timer = setTimeout(async () => {
      try {
        if (!poolRef.current || poolRef.current.agentId !== agentId) {
          poolRef.current = { agentId, pool: loadCandidates(agentId, settings).then((p) => { scoreCandidates([...p.clients, ...p.prospects, ...p.orphans], settings); return p; }) };
        }
        const pool = await poolRef.current.pool;
        const b = reviewedRef.current;
        if (!alive || !b) return;
        setPreview(previewBriefCandidates(b, pool, resolveBriefDate(b)));
      } catch (error) {
        poolRef.current = null;
        if (alive) setPreviewError(error instanceof Error ? error.message : 'errore di caricamento');
      } finally {
        if (alive) setPreviewLoading(false);
      }
    }, 350);
    return () => { alive = false; clearTimeout(timer); };
  }, [previewKey, visible, agentId, settings]);

  const alerts = brief ? [...brief.interpretation.warnings] : [];

  const busy = transcribing || parsing || recording;

  return (
    <Modal testID="brief-modal" visible={visible} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Ionicons name="sparkles" size={18} color={AI_PURPLE_TEXT} />
              <Text style={styles.title}>{"Dillo all'AI"}</Text>
            </View>
            <TouchableOpacity testID="brief-close" onPress={close} hitSlop={10} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="close" size={24} color={DS.ink2} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.hint}>
              {'Descrivi il giro come lo diresti a un collega. Es: "Fammi un giro sui miei clienti di Voghera che non ordinano da 30 giorni".'}
            </Text>

            <View style={styles.inputWrap}>
              <TextInput
                testID="brief-request-input"
                style={styles.input}
                value={text}
                onChangeText={(t) => { setText(t); setBrief(null); setErr(''); }}
                placeholder="Scrivi o detta la tua richiesta..."
                placeholderTextColor={DS.inkMuted}
                multiline
                editable={!busy}
              />
              <TouchableOpacity
                testID="brief-microphone"
                style={[styles.micBtn, recording && styles.micBtnActive]}
                onPress={recording ? stopRecording : startRecording}
                disabled={transcribing || parsing}
                activeOpacity={0.8}
              >
                {transcribing ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Ionicons name={recording ? 'stop' : 'mic'} size={22} color="#FFF" />
                )}
              </TouchableOpacity>
            </View>
            {recording && <Text testID="brief-recording-status" style={styles.recHint}>Sto ascoltando... tocca stop quando hai finito</Text>}
            {transcribing && <Text testID="brief-transcribing-status" style={styles.recHint}>Trascrizione in corso...</Text>}
            {!!err && <Text testID="brief-error" style={styles.err}>{err}</Text>}
            {!agentId && <Text testID="brief-session-unavailable" style={styles.err}>Attendi il caricamento della sessione prima di interpretare la richiesta.</Text>}

            <TouchableOpacity
              testID="brief-interpret"
              style={[styles.interpretBtn, (!text.trim() || busy || !agentId) && styles.btnDisabled]}
              onPress={interpret}
              disabled={!text.trim() || busy || !agentId}
              activeOpacity={0.85}
            >
              {parsing ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="color-wand" size={18} color="#FFF" />}
              <Text style={styles.interpretText}>{parsing ? 'Interpreto...' : 'Interpreta la richiesta'}</Text>
            </TouchableOpacity>

            {brief && (
              <View style={styles.briefBox}>
                {!!crmSummary && <Text testID="brief-summary" style={styles.summary}><Text style={styles.summaryLead}>Ho capito così: </Text>{crmSummary}</Text>}
                <BriefIssues issues={issues} clarifications={clarifications} onApply={applyFix} />
                {reviewed && <>
                  <BriefPlacePicker id="brief-start-place" label="Partenza" value={reviewed.route.startPlace} settings={settings} customers={customers} onChange={(p) => updateBrief({ ...reviewed, route: { ...reviewed.route, startPlace: p } })} />
                  {reviewed.journey && <BriefJourneyReview value={reviewed.journey} customers={customers} onChange={(j) => { setBrief((current) => current ? bindJourneyEnd(bindSavedBriefPlaces({ ...current, journey: j }, settings)) : null); setErr(''); }} />}
                  <BriefPlacePicker id="brief-end-place" label="Arrivo finale" value={reviewed.route.endPlace} settings={settings} customers={customers} onChange={(p) => updateBrief({ ...reviewed, route: { ...reviewed.route, endPlace: p, returnHome: p?.kind === 'home', returnToStart: false } })} />
                  {reviewed.areas.map((a, i) => a.kind === 'place' ? <BriefPlacePicker key={i} id={`brief-area-place-${i}`} label={`Centro della zona: ${a.value}`} allowSaved={false} value={{ kind: 'address', rawReference: a.value, point: a.point }} settings={settings} customers={customers} onChange={(p) => p && updateBrief({ ...reviewed, areas: reviewed.areas.map((v, k) => k === i ? { ...v, value: p.rawReference, point: p.point } : v) })} /> : null)}
                  <BriefStopsReview brief={reviewed} customers={customers} onChange={updateBrief} />
                  <View style={styles.switchRow}>
                    <Text testID="brief-automatic-label" style={styles.switchLabel}>Autorizzo altri clienti oltre a quelli nominati</Text>
                    <Switch testID="brief-include-automatic" value={reviewed.includeAutomatic !== false} onValueChange={(includeAutomatic) => updateBrief({ ...reviewed, includeAutomatic })} trackColor={{ true: AI_PURPLE }} />
                  </View>
                  <Text testID="brief-date-label" style={reviewStyles.hint}>Data del giro (AAAA-MM-GG)</Text>
                  <TextInput testID="brief-date-input" style={reviewStyles.input} value={reviewed.requestedDate.value || ''} placeholder="AAAA-MM-GG" onChangeText={(value) => updateBrief({ ...reviewed, requestedDate: { type: 'explicit', value } })} />
                  {(['startTime', 'endTime', 'finishBy'] as const).map((field) => <View key={field} style={reviewStyles.card}>
                    <Text testID={`brief-${field}-label`} style={reviewStyles.hint}>{{ startTime: 'Partenza HH:MM', endTime: 'Fine visite HH:MM', finishBy: 'Arrivo tassativo HH:MM (facoltativo)' }[field]}</Text>
                    <TextInput testID={`brief-${field}-input`} style={reviewStyles.input} value={reviewed.route[field] || ''} placeholder="HH:MM" onChangeText={(value) => updateBrief({ ...reviewed, route: { ...reviewed.route, [field]: value || null } })} />
                  </View>)}
                </>}

                {(brief.interpretation.needsConfirmation || alerts.length > 0) && (
                  <View style={styles.alertBox}>
                    {brief.interpretation.needsConfirmation && (
                      <View style={styles.alertTitleRow}>
                        <Ionicons name="warning" size={14} color="#D97706" />
                        <Text style={styles.alertTitle}>Controlla i chip prima di generare: la richiesta ha punti ambigui</Text>
                      </View>
                    )}
                    {alerts.map((w, i) => (
                      <Text testID={`brief-warning-${i}`} key={i} style={styles.alertText}>• {w}</Text>
                    ))}
                  </View>
                )}

                <Text style={styles.groupLabel}>Chi</Text>
                <View style={styles.chipWrap}>
                  {brief.selection.conditions.length === 0 && <Text style={styles.emptyChip}>Nessun criterio: riscrivi la richiesta</Text>}
                  {brief.selection.conditions.map((c, i) => (
                    <View key={`c${i}`} style={styles.segChip}>
                      <Text style={styles.segChipText}>{conditionLabel(c)}</Text>
                      <TouchableOpacity testID={`brief-remove-condition-${i}`} onPress={() => rmCondition(i)} hitSlop={8}>
                        <Ionicons name="close-circle" size={16} color={AI_PURPLE_TEXT} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {brief.exclusions.map((c, i) => (
                    <View key={`ex${i}`} style={styles.exChip}>
                      <Text style={styles.exChipText}>NO {conditionLabel(c)}</Text>
                      <TouchableOpacity testID={`brief-remove-exclusion-${i}`} onPress={() => rmExclusion(i)} hitSlop={8}>
                        <Ionicons name="close-circle" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {brief.preferences.map((p, i) => (
                    <View key={`pr${i}`} style={styles.prefChip}>
                      <Text style={styles.prefChipText}>{preferenceLabel(p)}</Text>
                      <TouchableOpacity testID={`brief-remove-preference-${i}`} onPress={() => rmPreference(i)} hitSlop={8}>
                        <Ionicons name="close-circle" size={16} color={AI_PURPLE_TEXT} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <Text style={styles.groupLabel}>Giorno e zone</Text>
                <View style={styles.chipWrap}>
                  <View style={styles.metaChip}>
                    <Ionicons name="calendar-outline" size={13} color={DS.ink2} />
                    <Text style={styles.metaChipText}>{dateChipLabel(brief.requestedDate)}</Text>
                  </View>
                  {brief.areas.map((a, i) => (
                    <View key={`a${i}`} style={a.mode === 'exclude' ? styles.exChip : styles.metaChip}>
                      <Ionicons name="location-outline" size={13} color={a.mode === 'exclude' ? '#EF4444' : DS.ink2} />
                      <Text style={a.mode === 'exclude' ? styles.exChipText : styles.metaChipText}>
                        {a.mode === 'exclude' ? 'NO ' : a.mode === 'prefer' ? 'pref. ' : ''}{a.value}
                      </Text>
                      <TouchableOpacity testID={`brief-remove-area-${i}`} onPress={() => rmArea(i)} hitSlop={8}>
                        <Ionicons name="close-circle" size={16} color={a.mode === 'exclude' ? '#EF4444' : DS.inkMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {(brief.route.startTime || brief.route.endTime || brief.route.finishBy) && (
                    <View style={styles.metaChip}>
                      <Ionicons name="time-outline" size={13} color={DS.ink2} />
                      <Text style={styles.metaChipText}>
                        {brief.route.startTime || '—'} → {brief.route.finishBy || brief.route.endTime || '—'}{brief.route.finishBy ? ' (fine tassativa)' : ''}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={styles.groupLabel}>Tipo giornata</Text>
                <View style={styles.chipWrap}>
                  {DAY_OPTIONS.map((d) => {
                    const active = brief.dayType === d.value;
                    return (
                      <TouchableOpacity
                        testID={`brief-day-type-${d.value}`}
                        key={d.value}
                        style={[styles.optChip, active && styles.optChipActive]}
                        onPress={() => { hap.light(); setBrief({ ...brief, dayType: d.value }); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.optChipText, active && styles.optChipTextActive]}>{d.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.groupLabel}>Visite: {targetLabel(brief.visitTarget)}</Text>
                <View style={styles.counterRow}>
                  <TouchableOpacity
                    testID="brief-target-decrease"
                    style={styles.counterBtn}
                    onPress={() => setTarget(brief.visitTarget.value ? Math.max(1, brief.visitTarget.value - 5) : null)}
                    hitSlop={8}
                  >
                    <Ionicons name="remove" size={18} color={DS.ink2} />
                  </TouchableOpacity>
                  <Text testID="brief-target-value" style={styles.counterValue}>{brief.visitTarget.value ?? 'Auto'}</Text>
                  <TouchableOpacity
                    testID="brief-target-increase"
                    style={styles.counterBtn}
                    onPress={() => setTarget(Math.min(60, (brief.visitTarget.value ?? 0) + 5))}
                    hitSlop={8}
                  >
                    <Ionicons name="add" size={18} color={DS.ink2} />
                  </TouchableOpacity>
                  {brief.visitTarget.value != null && (
                    <TouchableOpacity testID="brief-target-auto" onPress={() => setTarget(null)} style={styles.autoBtn}>
                      <Text style={styles.autoBtnText}>Auto</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={styles.groupLabel}>Percorso compatto</Text>
                <View style={styles.chipWrap}>
                  {([
                    { m: 'off', l: 'No' },
                    { m: 'prefer', l: 'Se possibile' },
                    { m: 'required', l: 'Vincolante' },
                  ] as const).map(({ m, l }) => {
                    const active = brief.route.compact === m;
                    return (
                      <TouchableOpacity
                        testID={`brief-compact-${m}`}
                        key={m}
                        style={[styles.optChip, active && styles.optChipActive]}
                        onPress={() => { hap.light(); setBrief({ ...brief, route: { ...brief.route, compact: m } }); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.optChipText, active && styles.optChipTextActive]}>{l}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Rientro a casa</Text>
                  <Switch
                    testID="brief-return-home"
                    value={brief.route.returnHome}
                    onValueChange={(x) => { hap.light(); updateBrief({ ...brief, route: { ...brief.route, endPlace: x ? { kind: 'home', rawReference: 'Casa' } : null, returnHome: x, returnToStart: x ? false : brief.route.returnToStart } }); }}
                    trackColor={{ true: AI_PURPLE }}
                  />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Torno al punto di partenza</Text>
                  <Switch
                    testID="brief-return-start"
                    value={brief.route.returnToStart}
                    onValueChange={(x) => { hap.light(); updateBrief({ ...brief, route: { ...brief.route, endPlace: null, returnToStart: x, returnHome: x ? false : brief.route.returnHome } }); }}
                    trackColor={{ true: AI_PURPLE }}
                  />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Più giornate se serve{brief.route.maxDays ? ` (max ${brief.route.maxDays})` : ''}</Text>
                  <Switch
                    testID="brief-allow-split"
                    disabled={!!brief.journey || brief.mandatoryStops.some((r) => r.areaDecision !== 'exclude')}
                    value={!brief.journey && !brief.mandatoryStops.some((r) => r.areaDecision !== 'exclude') && brief.route.splitAllowed !== false}
                    onValueChange={(x) => { hap.light(); setBrief({ ...brief, route: { ...brief.route, splitAllowed: x } }); }}
                    trackColor={{ true: AI_PURPLE }}
                  />
                </View>

                <BriefPreviewBox
                  preview={preview}
                  loading={previewLoading}
                  error={previewError}
                  canInclude={(c) => !!c.customerId && customers.some((x) => x.id === c.customerId)}
                  onInclude={includeExcluded}
                />

                <TouchableOpacity
                  testID="brief-generate"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy || problems.length > 0 || issues.length > 0 || clarifications.length > 0 }}
                  disabled={busy || problems.length > 0 || issues.length > 0 || clarifications.length > 0}
                  style={[styles.generateBtn, (busy || problems.length > 0 || issues.length > 0 || clarifications.length > 0) && styles.btnDisabled]}
                  onPress={() => {
                    if (!reviewed || problems.length || issues.length || clarifications.length) return;
                    if (brief.selection.conditions.length === 0 && brief.mandatoryStops.length === 0 && brief.preferredStops.length === 0 && !brief.journey && !brief.dayType) {
                      setErr('Serve almeno un criterio o una tappa richiesta');
                      return;
                    }
                    hap.medium();
                    onConfirm({ ...reviewed, modelSummary: reviewed.summary, summary: crmSummary || reviewed.summary });
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="navigate" size={18} color="#FFF" />
                  <Text style={styles.generateText}>Genera il giro</Text>
                </TouchableOpacity>
                {problems.length > 0 && <View testID="brief-blocking-errors" style={styles.alertBox}>{problems.map((p, i) => <Text testID={`brief-blocking-${i}`} key={p} style={styles.alertText}>{p}</Text>)}</View>}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: DS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 14, maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: JAKARTA.bold, fontSize: 18, color: DS.ink },
  hint: { fontFamily: JAKARTA.regular, fontSize: 13, color: DS.inkMuted, marginBottom: 12, lineHeight: 18 },
  inputWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  input: { flex: 1, minHeight: 80, maxHeight: 140, borderWidth: 1, borderColor: DS.border, borderRadius: 12, padding: 12, fontFamily: JAKARTA.regular, fontSize: 15, color: DS.ink, backgroundColor: DS.surface2, textAlignVertical: 'top' },
  micBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: AI_PURPLE, justifyContent: 'center', alignItems: 'center' },
  micBtnActive: { backgroundColor: '#DC2626' },
  recHint: { fontFamily: JAKARTA.medium, fontSize: 12, color: AI_PURPLE_TEXT, marginTop: 8 },
  err: { fontFamily: JAKARTA.medium, fontSize: 13, color: '#DC2626', marginTop: 8 },
  interpretBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: AI_PURPLE, borderRadius: 12, paddingVertical: 14, marginTop: 14 },
  interpretText: { fontFamily: JAKARTA.semibold, fontSize: 15, color: '#FFF' },
  btnDisabled: { opacity: 0.45 },
  briefBox: { marginTop: 18, borderTopWidth: 1, borderTopColor: DS.border, paddingTop: 14 },
  summary: { fontFamily: JAKARTA.medium, fontSize: 14, color: DS.ink, backgroundColor: AI_PURPLE_SOFT, borderRadius: 10, padding: 12, marginBottom: 14, lineHeight: 20 },
  summaryLead: { fontFamily: JAKARTA.bold, color: AI_PURPLE_TEXT },
  alertBox: { borderWidth: 1, borderColor: '#D97706', backgroundColor: 'rgba(217,119,6,0.10)', borderRadius: 10, padding: 10, marginBottom: 12, gap: 4 },
  alertTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  alertTitle: { flex: 1, fontFamily: JAKARTA.semibold, fontSize: 12, color: '#D97706' },
  alertText: { fontFamily: JAKARTA.regular, fontSize: 12, color: '#D97706', lineHeight: 17 },
  groupLabel: { fontFamily: JAKARTA.semibold, fontSize: 13, color: DS.ink2, marginBottom: 8, marginTop: 6 },
  groupHint: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  segChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: AI_PURPLE_SOFT, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12 },
  segChipText: { fontFamily: JAKARTA.medium, fontSize: 13, color: AI_PURPLE_TEXT },
  exChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#EF4444', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: 'rgba(239,68,68,0.08)' },
  exChipText: { fontFamily: JAKARTA.medium, fontSize: 13, color: '#EF4444' },
  prefChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: AI_PURPLE, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  prefChipText: { fontFamily: JAKARTA.medium, fontSize: 13, color: AI_PURPLE_TEXT },
  mandChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DC2626', borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12 },
  mandChipText: { fontFamily: JAKARTA.semibold, fontSize: 13, color: '#FFF' },
  wishChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#D97706', borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: 'rgba(217,119,6,0.08)' },
  wishChipText: { fontFamily: JAKARTA.medium, fontSize: 13, color: '#D97706' },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: DS.border, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: DS.surface2 },
  metaChipText: { fontFamily: JAKARTA.medium, fontSize: 13, color: DS.ink2 },
  emptyChip: { fontFamily: JAKARTA.regular, fontSize: 13, color: '#D97706', fontStyle: 'italic' },
  optChip: { borderWidth: 1, borderColor: DS.border, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 16, backgroundColor: DS.surface2 },
  optChipActive: { borderColor: AI_PURPLE, backgroundColor: AI_PURPLE_SOFT },
  optChipText: { fontFamily: JAKARTA.medium, fontSize: 13, color: DS.ink2 },
  optChipTextActive: { color: AI_PURPLE_TEXT },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 },
  counterBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: DS.border, justifyContent: 'center', alignItems: 'center', backgroundColor: DS.surface2 },
  counterValue: { fontFamily: JAKARTA.semibold, fontSize: 16, color: DS.ink, minWidth: 54, textAlign: 'center' },
  autoBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: DS.surface2, borderWidth: 1, borderColor: DS.border },
  autoBtnText: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, minHeight: 44 },
  switchLabel: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 14, color: DS.ink },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: AI_PURPLE, borderRadius: 12, paddingVertical: 15, marginTop: 18 },
  generateText: { fontFamily: JAKARTA.bold, fontSize: 16, color: '#FFF' },
});
