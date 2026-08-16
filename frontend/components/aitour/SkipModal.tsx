// Modale salta visita (Modalità Live AI Tour) — parità con SkipDialog web
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { DS, JAKARTA } from '../../lib/theme';

const SKIP_REASONS = [
  { value: 'chiuso', label: 'Chiuso' },
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
  onClose: () => void;
  onConfirm: (reason: string, note: string) => void;
}

export function SkipModal({ visible, stopName, saving, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (visible) {
      setReason('');
      setNote('');
    }
  }, [visible]);

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
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Annulla</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (!reason || saving) && { opacity: 0.5 }]}
              onPress={() => onConfirm(reason, note)}
              disabled={!reason || saving}
              activeOpacity={0.7}
            >
              {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.confirmText}>Salta e ricalcola</Text>}
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
