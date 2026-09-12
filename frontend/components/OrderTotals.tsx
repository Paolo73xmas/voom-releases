import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Order } from '../types';
import { orderBreakdown } from '../lib/order-totals';
import { COLORS } from '../lib/theme';

const currency = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
export function OrderTotals({ order }: { order: Order }) {
  const totals = orderBreakdown(order);
  const rows = [
    ['net', 'Imponibile prodotti', totals.net],
    ['excise', 'Accisa totale', totals.excise],
    ['vat', 'IVA prodotti', totals.vat],
    ['shipping', order.is_foreign ? 'Spedizione' : 'Spedizione IVA inclusa', totals.shipping],
    ['gross', 'Totale calcolato', totals.gross],
    ['stored', 'Importo registrato', order.total_amount],
  ] as const;
  return <View testID="order-totals" style={styles.card}>
    {rows.map(([key, label, value]) => <View key={key} style={styles.row}>
      <Text testID={`order-totals-${key}-label`} style={styles.label}>{label}</Text>
      <Text testID={`order-totals-${key}-value`} style={styles.value}>{currency(value)}</Text>
    </View>)}
    {(order.rottamazione_amount ?? 0) > 0 && <Text testID="order-rottamazione-note" style={styles.note}>Rottamazione applicata: {currency(order.rottamazione_amount ?? 0)}. Già inclusa nei prezzi delle righe.</Text>}
    {(order.cashback_used ?? 0) > 0 && <Text testID="order-cashback-note" style={styles.note}>Cashback applicato: {currency(order.cashback_used ?? 0)}. Già incluso nei prezzi delle righe.</Text>}
    <Text testID="order-totals-disclaimer" style={styles.note}>Calcolo informativo con accisa e aliquote del catalogo attuale. L’importo registrato non viene modificato; per i valori fiscali definitivi fa fede la fattura.</Text>
  </View>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  label: { color: COLORS.textSecondary, fontSize: 14, flex: 1 },
  value: { color: COLORS.text, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  note: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18, marginTop: 12 },
});