// Ultimo acquisto di una tappa (web LastOrderInfo @ 2eea993): data, giorni trascorsi e numero ordine
// cliccabile → PDF (expo-print/share). Stati: senza scheda cliente, verifica in corso, errore con Riprova,
// nessun ordine visibile. La fonte è SOLO loadLatestPurchases, mai la data della scheda o snapshot.
import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DS, JAKARTA } from '../../lib/theme';
import { describeLastOrder } from '../../lib/aitour/last-order-label';
import type { TourCandidate } from '../../lib/aitour/types';
import { useOrderDownload, type TourLastOrders } from '../../hooks/useTourLastOrders';

interface Props { candidate: Pick<TourCandidate, 'customerId'>; orders: TourLastOrders; testID: string }

export function LastOrderInfo({ candidate, orders, testID }: Props) {
  const view = describeLastOrder(candidate.customerId, orders);
  const row = view.row;
  const dl = useOrderDownload();
  const clearError = dl.clearError;
  useEffect(() => { clearError(); }, [candidate.customerId, row?.id, clearError]);
  const busy = !!row && dl.busyId === row.id;
  let content: React.ReactNode;
  if (view.state === 'loading') {
    content = <View style={styles.row}><ActivityIndicator size="small" color={DS.inkMuted} /><Text testID={`${testID}-loading`} style={styles.text}>{view.text}</Text></View>;
  } else if (view.state === 'error') {
    content = <View style={styles.row}>
      <Text testID={`${testID}-error`} accessibilityRole="alert" style={styles.text}>{view.text}</Text>
      <Pressable testID={`${testID}-retry`} accessibilityRole="button" accessibilityLabel="Riprova la verifica dell’ultimo ordine" onPress={orders.refetch} hitSlop={8} style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
        <Ionicons name="refresh" size={13} color={DS.brand} /><Text style={styles.linkText}>Riprova</Text>
      </Pressable>
    </View>;
  } else if (view.state !== 'ready' || !row) {
    content = <Text testID={`${testID}-empty`} style={styles.text}>{view.text}</Text>;
  } else {
    content = <View style={styles.wrap}>
      <Text testID={`${testID}-date`} style={styles.text}>{view.text}</Text>
      <Pressable testID={`${testID}-download`} accessibilityRole="button" accessibilityLabel={`Scarica PDF ordine ${view.number || 'senza numero'}`} accessibilityState={{ busy, disabled: busy }}
        disabled={busy} onPress={() => { void dl.download(row); }} hitSlop={8} style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
        {busy ? <ActivityIndicator size="small" color={DS.brand} /> : <Ionicons name="download-outline" size={13} color={DS.brand} />}
        <Text testID={`${testID}-number`} style={styles.linkText}>{busy ? 'Download… ' : ''}{view.number ? `Ordine ${view.number}` : 'Numero non disponibile · Scarica PDF'}</Text>
      </Pressable>
      {!!dl.error && <Text testID={`${testID}-download-error`} accessibilityRole="alert" style={styles.error}>{dl.error}</Text>}
    </View>;
  }
  return <View testID={testID} style={styles.box}>{content}</View>;
}

const styles = StyleSheet.create({
  box: { marginTop: 2, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  wrap: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8 },
  text: { fontFamily: JAKARTA.regular, fontSize: 11, lineHeight: 16, color: DS.inkMuted, flexShrink: 1 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, paddingVertical: 4, paddingHorizontal: 2 },
  linkText: { fontFamily: JAKARTA.semibold, fontSize: 11, lineHeight: 16, color: DS.brand, textDecorationLine: 'underline', flexShrink: 1 },
  error: { fontFamily: JAKARTA.medium, fontSize: 11, lineHeight: 16, color: DS.error, width: '100%' },
});
