import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PaymentMethod } from '../../lib/api/order-collection';
import { COLORS } from '../../lib/theme';

interface Props {
  methods: PaymentMethod[];
  selectedId: string;
  onSelect: (id: string) => void;
  isForeignOrder: boolean;
}

/** La lista occupa solo lo spazio sopra la navigazione, anche su schermi piccoli. */
export function PaymentMethodStep({ methods, selectedId, onSelect, isForeignOrder }: Props) {
  return (
    <FlatList
      testID="order-payment-list"
      style={styles.list}
      contentContainerStyle={styles.content}
      data={methods}
      extraData={selectedId}
      keyExtractor={method => method.id}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<View>
        <Text testID="order-payment-title" style={styles.title}>Metodo di Pagamento</Text>
        <Text testID="order-payment-scope" style={styles.scope}>{isForeignOrder ? 'Ordine Estero · Pagamento in Contanti' : 'Ordine Italia · Tutti i metodi attivi'}</Text>
      </View>}
      ListEmptyComponent={<Text testID="order-payment-empty" style={styles.empty}>{isForeignOrder ? 'Contanti non è disponibile tra i metodi attivi. Impossibile proseguire con un pagamento diverso per questo ordine Estero.' : 'Nessun metodo di pagamento disponibile.'}</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity
          testID={`order-payment-option-${item.id}`}
          accessibilityRole="radio"
          accessibilityLabel={item.name}
          accessibilityState={{ checked: selectedId === item.id }}
          aria-checked={selectedId === item.id}
          activeOpacity={0.7}
          style={[styles.option, selectedId === item.id && styles.selected]}
          onPress={() => onSelect(item.id)}
        >
          <Ionicons name={selectedId === item.id ? 'radio-button-on' : 'radio-button-off'}
            size={22} color={selectedId === item.id ? COLORS.primary : COLORS.textLight} />
          <Text testID={`order-payment-name-${item.id}`} style={styles.name}>{item.name}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, minHeight: 0 },
  content: { paddingTop: 12, paddingBottom: 24 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  scope: { fontSize: 14, lineHeight: 20, color: COLORS.textMuted, marginBottom: 16 },
  empty: { fontSize: 16, lineHeight: 24, color: COLORS.textMuted, paddingVertical: 12 },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 10, padding: 14, marginBottom: 8,
    borderWidth: 2, borderColor: COLORS.surface },
  selected: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  name: { flex: 1, flexShrink: 1, fontSize: 16, lineHeight: 23, fontWeight: '500', color: COLORS.text },
});