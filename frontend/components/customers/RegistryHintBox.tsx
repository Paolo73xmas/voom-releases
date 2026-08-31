// Box "Rivendita già censita nel registro? Usala per non creare doppioni" —
// suggerimenti live mentre si digita nome/indirizzo in Prima Visita e Rivendite No Mappa.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RegistryTabMatch } from '../../lib/api/registry-search';

interface Props {
  hints: RegistryTabMatch[];
  onUse: (m: RegistryTabMatch) => void;
  onDismiss: () => void;
}

export function RegistryHintBox({ hints, onUse, onDismiss }: Props) {
  if (hints.length === 0) return null;
  return (
    <View style={styles.box}>
      <View style={styles.headRow}>
        <Ionicons name="alert-circle" size={14} color="#92400E" />
        <Text style={styles.headText}>Rivendita già censita nel registro? Usala per non creare doppioni</Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={8}>
          <Text style={styles.dismiss}>Ignora</Text>
        </TouchableOpacity>
      </View>
      {hints.map((m) => (
        <View key={m.id} style={styles.hintRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.hintName} numberOfLines={1}>
              {m.denominazione || 'Rivendita senza nome'}{m.Num_Ordinale ? ` — Riv. ${m.Num_Ordinale}` : ''}
            </Text>
            <Text style={styles.hintAddr} numberOfLines={1}>
              {[m.indirizzo, m.comune, m.provincia ? `(${m.provincia})` : ''].filter(Boolean).join(', ')}
              {m.gps_lat && m.gps_lng ? ' · 📍 georeferenziata' : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.useBtn} onPress={() => onUse(m)} activeOpacity={0.8}>
            <Text style={styles.useText}>Usa questa</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

export function RegistryLinkedBanner({ name, numOrdinale, onUnlink }: { name: string; numOrdinale?: number | null; onUnlink?: () => void }) {
  return (
    <View style={styles.linkedBox}>
      <Text style={styles.linkedText} numberOfLines={2}>
        ✓ Agganciata a rivendita censita: <Text style={styles.linkedBold}>{name}</Text>
        {numOrdinale ? ` — Riv. ${numOrdinale}` : ''}
      </Text>
      {onUnlink ? (
        <TouchableOpacity onPress={onUnlink} hitSlop={8}>
          <Text style={styles.unlink}>Rimuovi aggancio</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: '#FCD34D', backgroundColor: '#FFFBEB', borderRadius: 10, padding: 9, gap: 7, marginTop: 8, marginBottom: 4 },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
  headText: { flex: 1, fontSize: 11, fontWeight: '700', color: '#92400E', lineHeight: 15 },
  dismiss: { fontSize: 11, color: '#B45309', textDecorationLine: 'underline' },
  hintRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8,
  },
  hintName: { fontSize: 12, fontWeight: '600', color: '#1F2937' },
  hintAddr: { fontSize: 10.5, color: '#6B7280', marginTop: 1 },
  useBtn: { backgroundColor: '#D97706', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10, minHeight: 34, justifyContent: 'center' },
  useText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  linkedBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#6EE7B7', backgroundColor: '#ECFDF5', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 10, marginTop: 8, marginBottom: 4,
  },
  linkedText: { flex: 1, fontSize: 11.5, color: '#065F46' },
  linkedBold: { fontWeight: '700' },
  unlink: { fontSize: 11, color: '#047857', textDecorationLine: 'underline' },
});
