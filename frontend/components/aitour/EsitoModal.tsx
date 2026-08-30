// Modale esito ispezione (Modalità Live AI Tour) — parità con EsitoDialog web:
// esito + 2 foto obbligatorie (bucket Ispezioni) + contatti punto vendita (prefill RPC RLS-safe)
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { DS, JAKARTA, currentThemeMode } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { AI_PURPLE, AI_PURPLE_SOFT, AI_PURPLE_TEXT } from './shared';
import { VisitSlotWheel } from '../customers/VisitSlotWheel';
import { ExcludedDaysPicker } from '../customers/ExcludedDaysPicker';
import { UploadProgressOverlay } from '../UploadProgressOverlay';

const ALERT_RED = currentThemeMode === 'dark' ? '#F87171' : '#DC2626';

export const ESITO_OPTIONS = [
  { value: 'ordine', label: 'Ordine' },
  { value: 'trattativa', label: 'Trattativa' },
  { value: 'interessato', label: 'Interessato' },
  { value: 'molto_interessato', label: 'Molto interessato' },
  { value: 'non_interessato', label: 'Non interessato' },
  { value: 'da_richiamare', label: 'Da richiamare' },
  { value: 'appuntamento_fissato', label: 'Appuntamento fissato' },
  { value: 'titolare_assente', label: 'Titolare assente' },
  { value: 'chiuso', label: 'Chiuso definitivamente' },
  { value: 'non_trovato', label: 'Non trovato' },
  { value: 'altro', label: 'Altro' },
];

const FOLLOWUP_CHIPS: { label: string; days: number | null }[] = [
  { label: 'Nessuno', days: null },
  { label: 'Domani', days: 1 },
  { label: '+3 gg', days: 3 },
  { label: '+1 sett', days: 7 },
  { label: '+2 sett', days: 14 },
  { label: '+1 mese', days: 30 },
];

const TIME_CHIPS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];

function dateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Riduce la foto a max 1600px lato lungo e la ricomprime: le foto full-resolution
 * (anche 50MP sui device recenti) saturano la memoria durante il Tour Live (mappa+GPS attivi)
 * e Android può terminare l'app. Riduce anche drasticamente il peso dell'upload.
 */
async function shrinkPhoto(uri: string): Promise<string> {
  try {
    const image = await ImageManipulator.manipulate(uri).resize({ width: 1600 }).renderAsync();
    const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
    return saved.uri;
  } catch (err) {
    console.warn('[EsitoModal] shrinkPhoto:', err);
    return uri;
  }
}

interface Props {
  visible: boolean;
  stopName: string;
  stopId?: string | null;
  customerId?: string | null;
  saving: boolean;
  /** Avanzamento invio foto (0-100); null = nessun invio in corso */
  uploadPct?: number | null;
  onClose: () => void;
  onConfirm: (outcome: string, note: string, followUpDate: string | null, followUpTime: string | null, extras: EsitoExtras) => void;
}

export interface EsitoExtras {
  photos: { uri: string }[];
  mobile: string;
  email: string;
  /** Fasce orarie preferite aggiornate; null = non modificate */
  visitSlots: string[] | null;
  /** Giorni esclusi (1=lun..6=sab) aggiornati; null = non modificati */
  excludedDays: number[] | null;
}

export function EsitoModal({ visible, stopName, stopId, customerId, saving, uploadPct, onClose, onConfirm }: Props) {
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState('');
  const [followUpDays, setFollowUpDays] = useState<number | null>(null);
  const [followUpTime, setFollowUpTime] = useState('09:00');
  const [photos, setPhotos] = useState<{ uri: string }[]>([]);
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [visitSlots, setVisitSlots] = useState<string[]>([]);
  const [excludedDays, setExcludedDays] = useState<number[]>([]);
  const initialContacts = useRef({ mobile: '', email: '' });
  const initialSlots = useRef<string[]>([]);
  const initialExcluded = useRef<number[]>([]);

  useEffect(() => {
    if (!visible) return;
    setOutcome('');
    setNote('');
    setFollowUpDays(null);
    setFollowUpTime('09:00');
    setPhotos([]);
    setMobile('');
    setEmail('');
    setVisitSlots([]);
    setExcludedDays([]);
    initialContacts.current = { mobile: '', email: '' };
    initialSlots.current = [];
    initialExcluded.current = [];
    if (customerId && stopId) {
      // RPC dedicato: legge i contatti anche per clienti di altri agenti (orfani), RLS-safe
      supabase.rpc('ai_tour_stop_customer_contacts', { p_stop_id: stopId })
        .then(({ data, error }) => {
          if (error) { console.warn('[EsitoModal] contatti:', error.message); return; }
          const row = Array.isArray(data) ? data[0] : data;
          if (row) {
            const m = row.contact_mobile || row.contact_phone || '';
            const e = row.contact_email || '';
            setMobile(m);
            setEmail(e);
            initialContacts.current = { mobile: m, email: e };
            const vs = Array.isArray(row.preferred_visit_slots) ? (row.preferred_visit_slots as string[]) : [];
            setVisitSlots(vs);
            initialSlots.current = vs;
            const ex = Array.isArray(row.excluded_visit_days) ? (row.excluded_visit_days as number[]) : [];
            setExcludedDays(ex);
            initialExcluded.current = ex;
          }
        });
    }
  }, [visible, customerId, stopId]);

  // Android: se il sistema ha terminato l'app mentre la fotocamera era aperta,
  // recupera la foto scattata alla riapertura del modale (getPendingResultAsync).
  useEffect(() => {
    if (!visible || Platform.OS !== 'android') return;
    ImagePicker.getPendingResultAsync()
      .then(async (pending) => {
        if (!pending || !('assets' in pending) || pending.canceled || !pending.assets?.[0]?.uri) return;
        const uri = await shrinkPhoto(pending.assets[0].uri);
        setPhotos((prev) => (prev.length >= 2 ? prev : [...prev, { uri }]));
        Alert.alert('Foto recuperata', "La foto scattata prima della chiusura dell'app è stata recuperata e allegata all'ispezione.");
      })
      .catch(() => {});
  }, [visible]);

  const takePhoto = async () => {
    if (photos.length >= 2) return;
    try {
      let perm = await ImagePicker.getCameraPermissionsAsync();
      if (!perm.granted && perm.canAskAgain) {
        perm = await ImagePicker.requestCameraPermissionsAsync();
      }
      if (!perm.granted) {
        Alert.alert(
          'Fotocamera non consentita',
          "Per allegare le foto dell'ispezione serve l'accesso alla fotocamera.",
          perm.canAskAgain
            ? [{ text: 'OK' }]
            : [
                { text: 'Annulla', style: 'cancel' },
                { text: 'Apri Impostazioni', onPress: () => Linking.openSettings() },
              ]
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.7 });
      if (!result.canceled && result.assets?.[0]) {
        const uri = await shrinkPhoto(result.assets[0].uri);
        setPhotos((prev) => (prev.length >= 2 ? prev : [...prev, { uri }]));
      }
    } catch (err) {
      console.warn('[EsitoModal] takePhoto:', err);
    }
  };

  const removePhoto = (idx: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = () => {
    const em = email.trim();
    if (em && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(em)) {
      Alert.alert('Email non valida', 'Controlla l\u2019indirizzo email del punto vendita.');
      return;
    }
    const m = mobile.trim();
    const slotsChanged = JSON.stringify([...visitSlots].sort()) !== JSON.stringify([...initialSlots.current].sort());
    const excludedChanged = JSON.stringify([...excludedDays].sort()) !== JSON.stringify([...initialExcluded.current].sort());
    onConfirm(
      outcome,
      note,
      followUpDays != null ? dateInDays(followUpDays) : null,
      followUpDays != null ? followUpTime : null,
      // Contatti inviati solo se modificati rispetto al prefill
      {
        photos,
        mobile: m !== initialContacts.current.mobile ? m : '',
        email: em !== initialContacts.current.email ? em : '',
        visitSlots: slotsChanged ? visitSlots : null,
        excludedDays: excludedChanged ? excludedDays : null,
      }
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Ispezione</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{stopName}</Text>
          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            <View style={styles.grid}>
              {ESITO_OPTIONS.map((o) => (
                <TouchableOpacity
                  key={o.value}
                  style={[styles.option, outcome === o.value && styles.optionActive]}
                  onPress={() => setOutcome(o.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.optionText, outcome === o.value && styles.optionTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Foto ispezione ({photos.length}/2, <Text style={styles.labelRequired}>obbligatorie</Text>)</Text>
            <View style={styles.photoRow}>
              {photos.map((p, i) => (
                <View key={p.uri} style={styles.photoWrap}>
                  <Image source={{ uri: p.uri }} style={styles.photoThumb} />
                  <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(i)} activeOpacity={0.7}>
                    <Ionicons name="close" size={12} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 2 && (
                <TouchableOpacity style={styles.photoAdd} onPress={takePhoto} activeOpacity={0.7}>
                  <Ionicons name="camera-outline" size={20} color={DS.inkMuted} />
                  <Text style={styles.photoAddText}>Scatta</Text>
                </TouchableOpacity>
              )}
            </View>
            {photos.length < 2 && <Text style={styles.photosRequired}>Scatta {photos.length === 0 ? '2 foto' : 'ancora 1 foto'} per confermare l&apos;esito.</Text>}
            {photos.length === 2 && <Text style={styles.followUpHint}>Le foto verranno salvate nella sezione Ispezioni.</Text>}
            {customerId ? (
              <>
                <Text style={styles.label}>Contatti punto vendita (salvati sulla scheda cliente)</Text>
                <View style={styles.contactRow}>
                  <TextInput
                    style={[styles.input, styles.contactInput]}
                    value={mobile}
                    onChangeText={setMobile}
                    placeholder="Cellulare"
                    placeholderTextColor={DS.inkMuted}
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={[styles.input, styles.contactInput]}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email"
                    placeholderTextColor={DS.inkMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <Text style={styles.label}>Fascia oraria visite preferita dal cliente (salvata sulla scheda)</Text>
                <View style={{ alignItems: 'center', marginTop: 2 }}>
                  <VisitSlotWheel value={visitSlots} onChange={setVisitSlots} size={185} />
                </View>
                <View style={{ marginTop: 10 }}>
                  <ExcludedDaysPicker value={excludedDays} onChange={setExcludedDays} />
                </View>
              </>
            ) : null}
            <Text style={styles.label}>Note (facoltative)</Text>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="Es. Interessato alle POD 0%. Richiamare dopo le ferie."
              placeholderTextColor={DS.inkMuted}
              multiline
            />
            <Text style={styles.label}>Follow-up: richiamare/rivedere il</Text>
            <View style={styles.chipRow}>
              {FOLLOWUP_CHIPS.map((c) => {
                const active = followUpDays === c.days;
                return (
                  <TouchableOpacity
                    key={c.label}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFollowUpDays(c.days)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {followUpDays != null && (
              <>
                <Text style={styles.label}>Ora dell&apos;appuntamento</Text>
                <View style={styles.chipRow}>
                  {TIME_CHIPS.map((t) => {
                    const active = followUpTime === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setFollowUpTime(t)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{t}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.followUpHint}>
                  Appuntamento in Calendario {new Date(dateInDays(followUpDays) + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: '2-digit' })} alle {followUpTime}
                </Text>
              </>
            )}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Annulla</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (!outcome || saving || photos.length < 2) && { opacity: 0.5 }]}
              onPress={handleConfirm}
              disabled={!outcome || saving || photos.length < 2}
              activeOpacity={0.7}
            >
              {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.confirmText}>Conferma esito</Text>}
            </TouchableOpacity>
          </View>
        </View>
        {/* Invio foto in corso: barra 0-100%, non chiudere l'app (modal annidato: resta sopra su iOS) */}
        <UploadProgressOverlay visible={uploadPct != null} progress={uploadPct ?? 0} label="Invio foto ispezione" />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: DS.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28 },
  title: { fontFamily: JAKARTA.bold, fontSize: 16, color: DS.ink },
  subtitle: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.inkMuted, marginTop: 2, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: {
    width: '48.5%',
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 9,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  optionActive: { borderColor: AI_PURPLE, backgroundColor: AI_PURPLE_SOFT },
  optionText: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink2 },
  optionTextActive: { color: AI_PURPLE_TEXT, fontFamily: JAKARTA.semibold },
  label: { fontFamily: JAKARTA.semibold, fontSize: 11, color: DS.ink2, marginTop: 12, marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontFamily: JAKARTA.regular,
    fontSize: 13,
    color: DS.ink,
    minHeight: 52,
    textAlignVertical: 'top',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: DS.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11 },
  chipActive: { backgroundColor: AI_PURPLE, borderColor: AI_PURPLE },
  chipText: { fontFamily: JAKARTA.medium, fontSize: 11, color: DS.ink2 },
  chipTextActive: { color: '#FFF' },
  followUpHint: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted, marginTop: 6 },
  labelRequired: { color: ALERT_RED, fontFamily: JAKARTA.bold },
  photosRequired: { fontFamily: JAKARTA.medium, fontSize: 11, color: ALERT_RED, marginTop: 6 },
  photoRow: { flexDirection: 'row', gap: 8 },
  photoWrap: { position: 'relative' },
  photoThumb: { width: 64, height: 64, borderRadius: 8, borderWidth: 1, borderColor: DS.border },
  photoRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#DC2626',
    borderRadius: 999,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: DS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddText: { fontFamily: JAKARTA.medium, fontSize: 9, color: DS.inkMuted, marginTop: 2 },
  contactRow: { flexDirection: 'row', gap: 8 },
  contactInput: { flex: 1, minHeight: 40 },
  footer: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { fontFamily: JAKARTA.semibold, fontSize: 13, color: DS.ink2 },
  confirmBtn: { flex: 2, backgroundColor: '#059669', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  confirmText: { fontFamily: JAKARTA.bold, fontSize: 13, color: '#FFF' },
});
