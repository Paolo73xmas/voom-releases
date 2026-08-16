// Modale esito visita (Modalità Live AI Tour) — parità con EsitoDialog web
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { DS, JAKARTA } from '../../lib/theme';
import { AI_PURPLE, AI_PURPLE_SOFT } from './shared';

export const ESITO_OPTIONS = [
  { value: 'ordine', label: 'Ordine' },
  { value: 'trattativa', label: 'Trattativa' },
  { value: 'interessato', label: 'Interessato' },
  { value: 'molto_interessato', label: 'Molto interessato' },
  { value: 'non_interessato', label: 'Non interessato' },
  { value: 'da_richiamare', label: 'Da richiamare' },
  { value: 'appuntamento_fissato', label: 'Appuntamento fissato' },
  { value: 'titolare_assente', label: 'Titolare assente' },
  { value: 'chiuso', label: 'Chiuso' },
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

function dateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  visible: boolean;
  stopName: string;
  saving: boolean;
  onClose: () => void;
  onConfirm: (outcome: string, note: string, followUpDate: string | null) => void;
}

export function EsitoModal({ visible, stopName, saving, onClose, onConfirm }: Props) {
  const [outcome, setOutcome] = useState('');
  const [note, setNote] = useState('');
  const [followUpDays, setFollowUpDays] = useState<number | null>(null);

  useEffect(() => {
    if (visible) {
      setOutcome('');
      setNote('');
      setFollowUpDays(null);
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Esito visita</Text>
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
              <Text style={styles.followUpHint}>
                Follow-up il {new Date(dateInDays(followUpDays) + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: '2-digit' })}
              </Text>
            )}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Annulla</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (!outcome || saving) && { opacity: 0.5 }]}
              onPress={() => onConfirm(outcome, note, followUpDays != null ? dateInDays(followUpDays) : null)}
              disabled={!outcome || saving}
              activeOpacity={0.7}
            >
              {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.confirmText}>Conferma esito</Text>}
            </TouchableOpacity>
          </View>
        </View>
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
  optionTextActive: { color: '#5B21B6', fontFamily: JAKARTA.semibold },
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
