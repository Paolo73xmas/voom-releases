// "Dillo all'AI": l'agente descrive il giro a voce o per iscritto, l'AI interpreta
// la richiesta e mostra dei chip modificabili prima di generare il giro.
import React, { useState } from 'react';
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
} from 'react-native';
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

const API = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

const DAY_OPTIONS: { value: Exclude<TourBriefV4['dayType'], null>; label: string }[] = [
  { value: 'clienti', label: 'Clienti' },
  { value: 'sviluppo', label: 'Sviluppo' },
  { value: 'mista', label: 'Mista' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (brief: TourBriefV4) => void;
  projects: string[];
  cities: string[];
}

export function BriefModal({ visible, onClose, onConfirm, projects, cities }: Props) {
  const insets = useSafeAreaInsets();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [brief, setBrief] = useState<TourBriefV4 | null>(null);
  const [err, setErr] = useState('');

  const reset = () => {
    setText('');
    setBrief(null);
    setErr('');
    setRecording(false);
  };

  const close = () => {
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
      const t = (data.text || '').trim();
      if (!t) {
        setErr('Non ho capito l\'audio, riprova o scrivi la richiesta');
        return;
      }
      setText((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t));
    } catch (e) {
      console.warn('[BriefModal] transcribe:', e);
      setErr('Trascrizione non riuscita, scrivi pure la richiesta');
    } finally {
      setTranscribing(false);
    }
  };

  const interpret = async () => {
    if (!text.trim()) return;
    hap.medium();
    setParsing(true);
    setErr('');
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const res = await fetch(`${API}/ai-tour/parse-brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), projects, cities, today }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      setBrief(applyReturnHomeFallback(normalizeBriefV4(raw), text));
      hap.success();
    } catch (e) {
      console.warn('[BriefModal] parse:', e);
      setErr('Interpretazione non riuscita, riprova');
    } finally {
      setParsing(false);
    }
  };

  const rmCondition = (i: number) => { hap.light(); setBrief((b) => b && ({ ...b, selection: { ...b.selection, conditions: b.selection.conditions.filter((_, x) => x !== i) } })); };
  const rmExclusion = (i: number) => { hap.light(); setBrief((b) => b && ({ ...b, exclusions: b.exclusions.filter((_, x) => x !== i) })); };
  const rmPreference = (i: number) => { hap.light(); setBrief((b) => b && ({ ...b, preferences: b.preferences.filter((_, x) => x !== i) })); };
  const rmArea = (i: number) => { hap.light(); setBrief((b) => b && ({ ...b, areas: b.areas.filter((_, x) => x !== i) })); };
  const rmMandatory = (i: number) => { hap.light(); setBrief((b) => b && ({ ...b, mandatoryStops: b.mandatoryStops.filter((_, x) => x !== i) })); };
  const rmPreferred = (i: number) => { hap.light(); setBrief((b) => b && ({ ...b, preferredStops: b.preferredStops.filter((_, x) => x !== i) })); };

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

  const alerts = brief ? [...brief.interpretation.warnings, ...brief.interpretation.unresolvedEntities.map((e) => `Non riconosciuto: ${e}`)] : [];

  const busy = transcribing || parsing;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Ionicons name="sparkles" size={18} color={AI_PURPLE_TEXT} />
              <Text style={styles.title}>{"Dillo all'AI"}</Text>
            </View>
            <TouchableOpacity onPress={close} hitSlop={10}>
              <Ionicons name="close" size={24} color={DS.ink2} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.hint}>
              {'Descrivi il giro come lo diresti a un collega. Es: "Fammi un giro sui miei clienti di Voghera che non ordinano da 30 giorni".'}
            </Text>

            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={text}
                onChangeText={setText}
                placeholder="Scrivi o detta la tua richiesta..."
                placeholderTextColor={DS.inkMuted}
                multiline
                editable={!busy}
              />
              <TouchableOpacity
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
            {recording && <Text style={styles.recHint}>Sto ascoltando... tocca stop quando hai finito</Text>}
            {transcribing && <Text style={styles.recHint}>Trascrizione in corso...</Text>}
            {!!err && <Text style={styles.err}>{err}</Text>}

            <TouchableOpacity
              style={[styles.interpretBtn, (!text.trim() || busy) && styles.btnDisabled]}
              onPress={interpret}
              disabled={!text.trim() || busy}
              activeOpacity={0.85}
            >
              {parsing ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="color-wand" size={18} color="#FFF" />}
              <Text style={styles.interpretText}>{parsing ? 'Interpreto...' : 'Interpreta la richiesta'}</Text>
            </TouchableOpacity>

            {brief && (
              <View style={styles.briefBox}>
                {!!brief.summary && <Text style={styles.summary}>{brief.summary}</Text>}

                {(brief.interpretation.needsConfirmation || alerts.length > 0) && (
                  <View style={styles.alertBox}>
                    {brief.interpretation.needsConfirmation && (
                      <View style={styles.alertTitleRow}>
                        <Ionicons name="warning" size={14} color="#D97706" />
                        <Text style={styles.alertTitle}>Controlla i chip prima di generare: la richiesta ha punti ambigui</Text>
                      </View>
                    )}
                    {alerts.map((w, i) => (
                      <Text key={i} style={styles.alertText}>• {w}</Text>
                    ))}
                  </View>
                )}

                <Text style={styles.groupLabel}>Chi</Text>
                <View style={styles.chipWrap}>
                  {brief.selection.conditions.length === 0 && <Text style={styles.emptyChip}>Nessun criterio: riscrivi la richiesta</Text>}
                  {brief.selection.conditions.map((c, i) => (
                    <View key={`c${i}`} style={styles.segChip}>
                      <Text style={styles.segChipText}>{conditionLabel(c)}</Text>
                      <TouchableOpacity onPress={() => rmCondition(i)} hitSlop={8}>
                        <Ionicons name="close-circle" size={16} color={AI_PURPLE_TEXT} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {brief.exclusions.map((c, i) => (
                    <View key={`ex${i}`} style={styles.exChip}>
                      <Text style={styles.exChipText}>NO {conditionLabel(c)}</Text>
                      <TouchableOpacity onPress={() => rmExclusion(i)} hitSlop={8}>
                        <Ionicons name="close-circle" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {brief.preferences.map((p, i) => (
                    <View key={`pr${i}`} style={styles.prefChip}>
                      <Text style={styles.prefChipText}>{preferenceLabel(p)}</Text>
                      <TouchableOpacity onPress={() => rmPreference(i)} hitSlop={8}>
                        <Ionicons name="close-circle" size={16} color={AI_PURPLE_TEXT} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {(brief.mandatoryStops.length > 0 || brief.preferredStops.length > 0) && (
                  <>
                    <Text style={styles.groupLabel}>Tappe richieste <Text style={styles.groupHint}>(identificate in generazione)</Text></Text>
                    <View style={styles.chipWrap}>
                      {brief.mandatoryStops.map((s, i) => (
                        <View key={`m${i}`} style={styles.mandChip}>
                          <Ionicons name="lock-closed" size={12} color="#FFF" />
                          <Text style={styles.mandChipText}>
                            {s.rawReference}
                            {s.appointment?.time ? ` · ${s.appointment.time}` : s.appointment?.from ? ` · ${s.appointment.from}-${s.appointment.to}` : ''}
                          </Text>
                          <TouchableOpacity onPress={() => rmMandatory(i)} hitSlop={8}>
                            <Ionicons name="close-circle" size={16} color="#FFF" />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {brief.preferredStops.map((s, i) => (
                        <View key={`p${i}`} style={styles.wishChip}>
                          <Ionicons name="star" size={12} color="#D97706" />
                          <Text style={styles.wishChipText}>{s.rawReference}</Text>
                          <TouchableOpacity onPress={() => rmPreferred(i)} hitSlop={8}>
                            <Ionicons name="close-circle" size={16} color="#D97706" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </>
                )}

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
                      <TouchableOpacity onPress={() => rmArea(i)} hitSlop={8}>
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
                    style={styles.counterBtn}
                    onPress={() => setTarget(brief.visitTarget.value ? Math.max(1, brief.visitTarget.value - 5) : null)}
                    hitSlop={8}
                  >
                    <Ionicons name="remove" size={18} color={DS.ink2} />
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{brief.visitTarget.value ?? 'Auto'}</Text>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => setTarget(Math.min(60, (brief.visitTarget.value ?? 0) + 5))}
                    hitSlop={8}
                  >
                    <Ionicons name="add" size={18} color={DS.ink2} />
                  </TouchableOpacity>
                  {brief.visitTarget.value != null && (
                    <TouchableOpacity onPress={() => setTarget(null)} style={styles.autoBtn}>
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
                    value={brief.route.returnHome}
                    onValueChange={(x) => { hap.light(); setBrief({ ...brief, route: { ...brief.route, returnHome: x, returnToStart: x ? false : brief.route.returnToStart } }); }}
                    trackColor={{ true: AI_PURPLE }}
                  />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Torno al punto di partenza</Text>
                  <Switch
                    value={brief.route.returnToStart}
                    onValueChange={(x) => { hap.light(); setBrief({ ...brief, route: { ...brief.route, returnToStart: x, returnHome: x ? false : brief.route.returnHome } }); }}
                    trackColor={{ true: AI_PURPLE }}
                  />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Più giornate se serve{brief.route.maxDays ? ` (max ${brief.route.maxDays})` : ''}</Text>
                  <Switch
                    value={brief.route.splitAllowed !== false}
                    onValueChange={(x) => { hap.light(); setBrief({ ...brief, route: { ...brief.route, splitAllowed: x } }); }}
                    trackColor={{ true: AI_PURPLE }}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.generateBtn, brief.selection.conditions.length === 0 && brief.mandatoryStops.length === 0 && styles.btnDisabled]}
                  onPress={() => {
                    if (brief.selection.conditions.length === 0 && brief.mandatoryStops.length === 0) {
                      setErr('Serve almeno un criterio o una tappa richiesta');
                      return;
                    }
                    hap.medium();
                    onConfirm(brief);
                  }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="navigate" size={18} color="#FFF" />
                  <Text style={styles.generateText}>Genera il giro</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
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
  counterBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: DS.border, justifyContent: 'center', alignItems: 'center', backgroundColor: DS.surface2 },
  counterValue: { fontFamily: JAKARTA.semibold, fontSize: 16, color: DS.ink, minWidth: 54, textAlign: 'center' },
  autoBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: DS.surface2, borderWidth: 1, borderColor: DS.border },
  autoBtnText: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, minHeight: 44 },
  switchLabel: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 14, color: DS.ink },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: AI_PURPLE, borderRadius: 12, paddingVertical: 15, marginTop: 18 },
  generateText: { fontFamily: JAKARTA.bold, fontSize: 16, color: '#FFF' },
});
