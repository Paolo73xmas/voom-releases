// Selettore dei giorni della settimana in cui il cliente NON riceve visite
// (es. mercoledì mercato): l'AI Tour esclude il cliente dai giri di quei giorni.
// Parità web: src/components/customers/ExcludedDaysPicker.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DS, JAKARTA } from '../../lib/theme';
import { WEEKDAYS } from '../../lib/visit-slots';

interface Props {
  value: number[];
  onChange: (v: number[]) => void;
  showLabel?: boolean;
}

export function ExcludedDaysPicker({ value, onChange, showLabel = true }: Props) {
  const toggle = (id: number) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <View>
      {showLabel && (
        <Text style={styles.label}>
          Giorni in cui il cliente <Text style={styles.labelRed}>non riceve</Text> visite (l&apos;AI Tour lo escluderà in quei giorni):
        </Text>
      )}
      <View style={styles.row}>
        {WEEKDAYS.map((d) => {
          const ex = value.includes(d.id);
          return (
            <TouchableOpacity
              key={d.id}
              style={[styles.chip, ex && styles.chipActive]}
              onPress={() => toggle(d.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, ex && styles.chipTextActive]}>{d.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted, marginBottom: 6, lineHeight: 15 },
  labelRed: { color: '#DC2626', fontFamily: JAKARTA.bold },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1,
    borderColor: DS.border,
    backgroundColor: DS.surface,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipActive: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  chipText: { fontFamily: JAKARTA.medium, fontSize: 11, color: DS.ink2 },
  chipTextActive: { color: '#FFF', textDecorationLine: 'line-through' },
});
