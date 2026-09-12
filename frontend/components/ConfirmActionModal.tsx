import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../lib/theme';

type Props = {
  testID: string; visible: boolean; title: string; message: string;
  confirmLabel: string; onCancel: () => void; onConfirm: () => void | Promise<void>;
};

export function ConfirmActionModal({ testID, visible, title, message, confirmLabel, onCancel, onConfirm }: Props) {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const cancel = () => { if (!locked.current) { setError(''); onCancel(); } };
  const confirm = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    try { await onConfirm(); } catch { setError('Operazione non riuscita. Riprova.'); }
    finally { locked.current = false; setBusy(false); }
  };
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
    <View testID={testID} style={styles.overlay}>
      <View style={styles.card} accessibilityViewIsModal>
        <Text testID={`${testID}-title`} style={styles.title}>{title}</Text>
        <Text testID={`${testID}-message`} style={styles.message}>{message}</Text>
        {!!error && <Text testID={`${testID}-error`} accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <View style={styles.actions}>
          <Pressable testID={`${testID}-cancel`} accessibilityRole="button" disabled={busy} onPress={cancel} style={styles.button}><Text style={styles.message}>Annulla</Text></Pressable>
          <Pressable testID={`${testID}-confirm`} accessibilityRole="button" disabled={busy} onPress={confirm} style={[styles.button, styles.confirm, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.confirmText}>{confirmLabel}</Text>}
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.55)' },
  card: { width: '100%', maxWidth: 420, padding: 24, borderRadius: 20, backgroundColor: COLORS.surface },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  message: { fontSize: 16, color: COLORS.textSecondary, lineHeight: 23 },
  error: { fontSize: 14, color: COLORS.danger, marginTop: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 24 },
  button: { minHeight: 48, paddingHorizontal: 18, justifyContent: 'center', borderRadius: 12 },
  confirm: { backgroundColor: COLORS.primary },
  confirmText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.6 },
});