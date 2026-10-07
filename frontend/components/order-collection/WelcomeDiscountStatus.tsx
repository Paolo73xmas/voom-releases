import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { FirstOrderStatus } from '../../hooks/useFirstOrder';
import { COLORS } from '../../lib/theme';

export function WelcomeDiscountStatus({ status, retry }: { status: FirstOrderStatus; retry: () => Promise<void> }) {
  if (status === 'idle' || status === 'eligible') return null;
  const message = status === 'loading' ? 'Verifica del primo ordine in corso…'
    : status === 'ineligible' ? 'Non disponibile: risultano ordini precedenti per questo cliente.'
      : 'Impossibile verificare il primo ordine. Lo sconto non è applicato: riprova la verifica.';
  return <View testID="order-welcome-status" style={styles.card} accessibilityLiveRegion="polite">
    <Text testID="order-welcome-status-title" style={styles.title}>Sconto Benvenuto (25%)</Text>
    <Text testID={`order-welcome-${status}`} style={styles.message}>{message}</Text>
    {status === 'loading' && <ActivityIndicator testID="order-welcome-check-spinner" color={COLORS.primary} />}
    {status === 'error' && <TouchableOpacity testID="order-welcome-retry" accessibilityRole="button" onPress={() => void retry()} style={styles.retry} activeOpacity={0.7}>
      <Text testID="order-welcome-retry-label" style={styles.retryLabel}>Riprova verifica primo ordine</Text>
    </TouchableOpacity>}
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 12, gap: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  title: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  message: { color: COLORS.textSecondary, fontSize: 14, lineHeight: 21 },
  retry: { minHeight: 44, justifyContent: 'center', padding: 12, borderRadius: 10, backgroundColor: COLORS.primarySoft },
  retryLabel: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
});