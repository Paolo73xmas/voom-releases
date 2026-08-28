// Modale salta visita (Modalità Live AI Tour) — parità con SkipDialog web,
// con opzione "Ripassa oggi alle HH:MM": la tappa resta nel giro e l'AI la
// riposiziona vicino all'orario scelto (finestra strict, mai rimossa dai ricalcoli).
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DS, JAKARTA } from '../../lib/theme';

const SKIP_REASONS = [
  { value: 'chiuso', label: 'Chiuso ora (orario/ferie)' },
  { value: 'titolare_assente', label: 'Titolare assente' },
  { value: 'non_disponibile', label: 'Non disponibile' },
  { value: 'gia_visitato', label: 'Già visitato' },
  { value: 'appuntamento_spostato', label: 'Appuntamento spostato' },
  { value: 'non_oggi', label: 'Non voglio visitarlo oggi' },
  { value: 'parcheggio', label: 'Problema parcheggio/accesso' },
  { value: 'altro', label: 'Altro' },
];

interface Props {
  visible: boolean;
  stopName: string;
  saving: boolean;
  /** Fine giro in minuti dalla mezzanotte: il ripasso deve restare entro l'orario */
  endMin?: number;
  onClose: () => void;
  onConfirm: (reason: string, note: string, revisitTime: string | null) => void;
}

export function SkipModal({ visible, stopName, saving, endMin, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [revisit, setRevisit] = useState('');

  useEffect(() => {
    if (visible) {
      setReason('');
      setNote('');
      setRevisit('');
    }
  }, [visible]);

  // Orari di ripasso proponibili: da ~20 min da adesso, ogni 30 min, entro la fine del giro
  const revisitOptions = useMemo(() => {
    if (!visible) return [] as string[];
    const now = new Date();
    let m = Math.ceil((now.getHours() * 60 + now.getMinutes() + 20) / 30) * 30;
    const limit = endMin != null ? endMin : 1140;
    const out: string[] = [];
    while (m < limit && out.length < 8) {
      out.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
      m += 30;
    }
    return out;
  }, [visible, endMin]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Salta visita</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{stopName}</Text>
          <View style={styles.grid}>
            {SKIP_REASONS.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={[styles.option, reason === r.value && styles.optionActive]}
                onPress={() => setReason(r.value)}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionText, reason === r.value && styles.optionTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {reason === 'altro' && (
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="Specifica il motivo..."
              placeholderTextColor={DS.inkMuted}
              multiline
            />
          )}
          <View style={styles.revisitBox}>
            <View style={styles.revisitLabelRow}>
              <Ionicons name="time-outline" size={13} color="#2563EB" />
              <Text style={styles.revisitLabel}>Ripassa oggi (facoltativo)</Text>
            </View>
            <Text style={styles.revisitHint}>
              Se indichi un orario, la tappa <Text style={{ fontFamily: JAKARTA.bold }}>resta nel giro</Text> e l&apos;AI la riposiziona vicino a quell&apos;ora.
            </Text>
            {revisitOptions.length === 0 ? (
              <Text style={styles.revisitHint}>Nessun orario disponibile entro la fine del giro.</Text>
            ) : (
              <View style={styles.revisitChips}>
                {revisitOptions.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.revisitChip, revisit === t && styles.revisitChipActive]}
                    onPress={() => setRevisit(revisit === t ? '' : t)}
                    activeOpacity={0.7}
                    testID={`revisit-chip-${t}`}
                  >
                    <Text style={[styles.revisitChipText, revisit === t && styles.revisitChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Annulla</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, revisit ? styles.confirmBtnRevisit : null, (!reason || saving) && { opacity: 0.5 }]}
              onPress={() => onConfirm(reason, note, revisit || null)}
              disabled={!reason || saving}
              activeOpacity={0.7}
            >
              {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.confirmText}>{revisit ? `Ripassa alle ${revisit}` : 'Salta e ricalcola'}</Text>}
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
  optionActive: { borderColor: '#D97706', backgroundColor: '#FEF3C7' },
  optionText: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink2 },
  optionTextActive: { color: '#92400E', fontFamily: JAKARTA.semibold },
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
    marginTop: 10,
    textAlignVertical: 'top',
  },
  footer: { flexDirection: 'row', gap: 10, marginTop: 16 },
  revisitBox: { borderTopWidth: 1, borderTopColor: DS.border, marginTop: 12, paddingTop: 10 },
  revisitLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  revisitLabel: { fontFamily: JAKARTA.semibold, fontSize: 12, color: DS.ink },
  revisitHint: { fontFamily: JAKARTA.regular, fontSize: 10.5, color: DS.inkMuted, marginTop: 3, lineHeight: 14 },
  revisitChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  revisitChip: { borderWidth: 1, borderColor: DS.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: DS.surface },
  revisitChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  revisitChipText: { fontFamily: JAKARTA.medium, fontSize: 11.5, color: DS.ink2 },
  revisitChipTextActive: { color: '#FFF', fontFamily: JAKARTA.semibold },
  confirmBtnRevisit: { backgroundColor: '#2563EB' },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: { fontFamily: JAKARTA.semibold, fontSize: 13, color: DS.ink2 },
  confirmBtn: { flex: 2, backgroundColor: '#D97706', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  confirmText: { fontFamily: JAKARTA.bold, fontSize: 13, color: '#FFF' },
});
