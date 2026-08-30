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
import { normalizeBrief, segmentLabel, type TourBrief } from '../../lib/aitour/brief';

const API = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

const DAY_OPTIONS: { value: TourBrief['dayType']; label: string }[] = [
  { value: 'clienti', label: 'Clienti' },
  { value: 'sviluppo', label: 'Sviluppo' },
  { value: 'mista', label: 'Mista' },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (brief: TourBrief) => void;
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
  const [brief, setBrief] = useState<TourBrief | null>(null);
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
      const giorni = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
      const today = `${giorni[now.getDay()]} ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const res = await fetch(`${API}/ai-tour/parse-brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), projects, cities, today }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      setBrief(normalizeBrief(raw));
      hap.success();
    } catch (e) {
      console.warn('[BriefModal] parse:', e);
      setErr('Interpretazione non riuscita, riprova');
    } finally {
      setParsing(false);
    }
  };

  const removeSegment = (i: number) => {
    if (!brief) return;
    hap.light();
    setBrief({ ...brief, segments: brief.segments.filter((_, idx) => idx !== i) });
  };

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

                <Text style={styles.groupLabel}>Cosa includo</Text>
                <View style={styles.chipWrap}>
                  {brief.segments.length === 0 && <Text style={styles.emptyChip}>Nessun filtro specifico</Text>}
                  {brief.segments.map((s, i) => (
                    <View key={`${s.type}-${i}`} style={styles.segChip}>
                      <Text style={styles.segChipText}>{segmentLabel(s)}</Text>
                      <TouchableOpacity onPress={() => removeSegment(i)} hitSlop={8}>
                        <Ionicons name="close-circle" size={16} color={AI_PURPLE_TEXT} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                <Text style={styles.groupLabel}>Zona</Text>
                <TextInput
                  style={styles.areaInput}
                  value={brief.area.value || ''}
                  onChangeText={(t) => setBrief({ ...brief, area: { kind: brief.area.kind === 'none' ? 'city' : brief.area.kind, value: t } })}
                  placeholder="Tutte le zone"
                  placeholderTextColor={DS.inkMuted}
                />

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

                <Text style={styles.groupLabel}>Giorno</Text>
                <View style={styles.chipWrap}>
                  {[{ o: 0, l: 'Oggi' }, { o: 1, l: 'Domani' }, { o: 2, l: 'Dopodomani' }].map((d) => {
                    const active = brief.dayOffset === d.o;
                    return (
                      <TouchableOpacity
                        key={d.o}
                        style={[styles.optChip, active && styles.optChipActive]}
                        onPress={() => { hap.light(); setBrief({ ...brief, dayOffset: d.o }); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.optChipText, active && styles.optChipTextActive]}>{d.l}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  {brief.dayOffset > 2 && (
                    <View style={[styles.optChip, styles.optChipActive]}>
                      <Text style={styles.optChipTextActive}>tra {brief.dayOffset} giorni</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.groupLabel}>Numero massimo di tappe</Text>
                <View style={styles.counterRow}>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => { hap.light(); setBrief({ ...brief, targetCount: brief.targetCount ? Math.max(1, brief.targetCount - 5) : null }); }}
                    hitSlop={8}
                  >
                    <Ionicons name="remove" size={18} color={DS.ink2} />
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{brief.targetCount ?? 'Auto'}</Text>
                  <TouchableOpacity
                    style={styles.counterBtn}
                    onPress={() => { hap.light(); setBrief({ ...brief, targetCount: (brief.targetCount ?? 0) + 5 }); }}
                    hitSlop={8}
                  >
                    <Ionicons name="add" size={18} color={DS.ink2} />
                  </TouchableOpacity>
                  {brief.targetCount != null && (
                    <TouchableOpacity onPress={() => { hap.light(); setBrief({ ...brief, targetCount: null }); }} style={styles.autoBtn}>
                      <Text style={styles.autoBtnText}>Auto</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[styles.toggle, brief.compact && styles.toggleActive]}
                    onPress={() => { hap.light(); setBrief({ ...brief, compact: !brief.compact }); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={brief.compact ? 'checkbox' : 'square-outline'} size={18} color={brief.compact ? AI_PURPLE_TEXT : DS.ink2} />
                    <Text style={styles.toggleText}>Tutti vicini (zona unica)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggle, brief.splitDays === 2 && styles.toggleActive]}
                    onPress={() => { hap.light(); setBrief({ ...brief, splitDays: brief.splitDays === 2 ? 1 : 2 }); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={brief.splitDays === 2 ? 'checkbox' : 'square-outline'} size={18} color={brief.splitDays === 2 ? AI_PURPLE_TEXT : DS.ink2} />
                    <Text style={styles.toggleText}>Dividi su 2 giorni</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.generateBtn}
                  onPress={() => { hap.medium(); onConfirm(brief); }}
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
  groupLabel: { fontFamily: JAKARTA.semibold, fontSize: 13, color: DS.ink2, marginBottom: 8, marginTop: 6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  segChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: AI_PURPLE_SOFT, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12 },
  segChipText: { fontFamily: JAKARTA.medium, fontSize: 13, color: AI_PURPLE_TEXT },
  emptyChip: { fontFamily: JAKARTA.regular, fontSize: 13, color: DS.inkMuted, fontStyle: 'italic' },
  areaInput: { borderWidth: 1, borderColor: DS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontFamily: JAKARTA.regular, fontSize: 15, color: DS.ink, backgroundColor: DS.surface2, marginBottom: 6 },
  optChip: { borderWidth: 1, borderColor: DS.border, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 16, backgroundColor: DS.surface2 },
  optChipActive: { borderColor: AI_PURPLE, backgroundColor: AI_PURPLE_SOFT },
  optChipText: { fontFamily: JAKARTA.medium, fontSize: 13, color: DS.ink2 },
  optChipTextActive: { color: AI_PURPLE_TEXT },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 },
  counterBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: DS.border, justifyContent: 'center', alignItems: 'center', backgroundColor: DS.surface2 },
  counterValue: { fontFamily: JAKARTA.semibold, fontSize: 16, color: DS.ink, minWidth: 54, textAlign: 'center' },
  autoBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: DS.surface2, borderWidth: 1, borderColor: DS.border },
  autoBtnText: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink2 },
  toggleRow: { gap: 10, marginTop: 10, marginBottom: 6 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  toggleActive: {},
  toggleText: { fontFamily: JAKARTA.medium, fontSize: 14, color: DS.ink },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: AI_PURPLE, borderRadius: 12, paddingVertical: 15, marginTop: 18 },
  generateText: { fontFamily: JAKARTA.bold, fontSize: 16, color: '#FFF' },
});
