import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../lib/theme';

export function ReadErrorNotice({ id, message, onRetry, busy = false }: { id: string; message: string; onRetry: () => void; busy?: boolean }) {
  if (!message) return null;
  return <View testID={`${id}-error`} style={styles.errorBox}>
    <Text testID={`${id}-error-message`} accessibilityRole="alert" style={styles.errorText}>{message}</Text>
    <TouchableOpacity testID={`${id}-retry`} accessibilityRole="button" disabled={busy} onPress={onRetry} style={styles.button}>
      <Text testID={`${id}-retry-label`} style={styles.buttonText}>Riprova</Text>
    </TouchableOpacity>
  </View>;
}

export function HistoryFooter({ id, loaded, count, hasMore, busy, onMore }: {
  id: string; loaded: number; count: number; hasMore: boolean; busy: boolean; onMore: () => void;
}) {
  return <View style={styles.footer} testID={`${id}-pagination`}>
    <Text testID={`${id}-loaded-count`} style={styles.caption}>{loaded} di {count} risultati caricati</Text>
    {hasMore && <TouchableOpacity testID={`${id}-load-more`} accessibilityRole="button" disabled={busy} onPress={onMore} style={styles.button}>
      {busy ? <ActivityIndicator testID={`${id}-more-loading`} color={COLORS.primary} /> : <Text testID={`${id}-load-more-label`} style={styles.buttonText}>Carica altri risultati</Text>}
    </TouchableOpacity>}
  </View>;
}

const styles = StyleSheet.create({
  errorBox: { padding: 14, marginHorizontal: 16, marginVertical: 8, borderWidth: 1, borderColor: COLORS.danger, borderRadius: 12, backgroundColor: COLORS.surface },
  errorText: { color: COLORS.danger, fontSize: 14, lineHeight: 20 },
  button: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  buttonText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  footer: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  caption: { color: COLORS.textMuted, fontSize: 12 },
});