// Overlay di avanzamento per invii "pesanti" (foto/dati): mostra una barra 0-100%
// e avvisa l'agente di NON chiudere l'app finché l'invio non è completato.
import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../lib/theme';

interface Props {
  visible: boolean;
  progress: number; // 0-100
  label?: string;
}

export function UploadProgressOverlay({ visible, progress, label }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card} testID="upload-progress-overlay">
          <View style={styles.iconRow}>
            <Ionicons name="cloud-upload" size={22} color={COLORS.primary} />
            <Text style={styles.title}>{label || 'Invio dati in corso'}</Text>
          </View>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.pctText} testID="upload-progress-pct">{pct}%</Text>
          <View style={styles.warnBox}>
            <Ionicons name="warning" size={14} color="#B45309" />
            <Text style={styles.warnText}>Non chiudere l&apos;app e resta connesso fino al 100%: l&apos;invio dei dati è in corso.</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '700', color: COLORS.text, flex: 1 },
  barTrack: { height: 10, borderRadius: 5, backgroundColor: COLORS.bgAlt, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  barFill: { height: '100%', borderRadius: 5, backgroundColor: COLORS.primary },
  pctText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, textAlign: 'center' },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 8,
  },
  warnText: { flex: 1, fontSize: 11, color: '#92400E', lineHeight: 15 },
});
