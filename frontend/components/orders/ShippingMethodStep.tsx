import React from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ShippingMethod } from '../../lib/api/order-collection';
import { getShippingBaseCost } from '../../lib/order-checkout';
import { COLORS } from '../../lib/theme';

interface Props {
  methods: ShippingMethod[]; selectedId: string; onSelect: (id: string) => void;
  isForeignOrder: boolean; orderBase: number; address: string; onAddressChange: (value: string) => void;
}
const money = (value: number) => `€${value.toFixed(2)}`;

export function ShippingMethodStep(props: Props) {
  const { methods, selectedId, onSelect, isForeignOrder, orderBase, address, onAddressChange } = props;
  return <ScrollView testID="order-shipping-list" style={styles.list} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text testID="order-shipping-title" style={styles.title}>Metodo di Spedizione</Text>
    <Text testID="order-shipping-scope" style={styles.scope}>{isForeignOrder ? 'Ordine Estero · Cassiopea 3% o Ritiro in sede' : 'Ordine Italia · Spedizioni nazionali e ritiro'}</Text>
    {methods.length === 0 && <Text testID="order-shipping-empty" style={styles.scope}>Nessuna spedizione attiva compatibile con questo ordine.</Text>}
    {methods.map(method => {
      const cost = getShippingBaseCost(method, orderBase);
      return <TouchableOpacity key={method.id} testID={`order-shipping-option-${method.id}`}
        accessibilityRole="radio" accessibilityLabel={method.name} accessibilityState={{ checked: selectedId === method.id }}
        aria-checked={selectedId === method.id} activeOpacity={0.7}
        style={[styles.option, selectedId === method.id && styles.selected]} onPress={() => onSelect(method.id)}>
        <Ionicons name={selectedId === method.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={selectedId === method.id ? COLORS.primary : COLORS.textLight} />
        <View style={styles.detail}>
          <Text testID={`order-shipping-name-${method.id}`} style={styles.name}>{method.name}</Text>
          <Text testID={`order-shipping-cost-${method.id}`} style={styles.cost}>{money(cost)}{!isForeignOrder && ` (${money(cost * 1.22)} con IVA)`}</Text>
          {method.cost_type === 'percentage' && <Text testID={`order-shipping-rate-${method.id}`} style={styles.cost}>Tariffa {method.cost_percentage || 0}% · importo secondo le fasce configurate</Text>}
        </View>
      </TouchableOpacity>;
    })}
    <Text testID="order-shipping-address-title" style={styles.title}>Indirizzo di spedizione (opzionale)</Text>
    <TextInput testID="order-shipping-address" accessibilityLabel="Indirizzo di spedizione personalizzato" style={styles.address}
      placeholder="Indirizzo personalizzato..." value={address} onChangeText={onAddressChange} multiline placeholderTextColor={COLORS.textLight} />
  </ScrollView>;
}

const styles = StyleSheet.create({
  list: { flex: 1, minHeight: 0 }, content: { paddingTop: 12, paddingBottom: 24 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  scope: { fontSize: 14, lineHeight: 20, color: COLORS.textMuted, marginBottom: 16 },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 12, backgroundColor: COLORS.surface,
    borderRadius: 10, padding: 14, marginBottom: 12, borderWidth: 2, borderColor: COLORS.surface },
  selected: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft }, detail: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, lineHeight: 23, color: COLORS.text, fontWeight: '500', flexShrink: 1 },
  cost: { fontSize: 13, lineHeight: 19, color: COLORS.textMuted, marginTop: 4 },
  address: { minHeight: 88, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, backgroundColor: COLORS.surface,
    padding: 12, fontSize: 16, color: COLORS.text, textAlignVertical: 'top' },
});