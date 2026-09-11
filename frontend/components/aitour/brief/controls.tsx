import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DS, JAKARTA } from '../../../lib/theme';
import { AI_PURPLE_SOFT, AI_PURPLE_TEXT } from '../shared';

export function BriefButton({ id, label, onPress, disabled = false, selected = false }: { id: string; label: string; onPress: () => void; disabled?: boolean; selected?: boolean }) {
  return <TouchableOpacity testID={id} accessibilityRole="button" accessibilityState={{ disabled, selected }} onPress={onPress} disabled={disabled} activeOpacity={0.7} style={[reviewStyles.button, selected && reviewStyles.selected, disabled && reviewStyles.disabled]}>
    <Text testID={`${id}-label`} style={reviewStyles.buttonText}>{label}</Text>
  </TouchableOpacity>;
}
export const reviewStyles = StyleSheet.create({
  card: { backgroundColor: DS.surface2, borderWidth: 1, borderColor: DS.border, padding: 12, borderRadius: 12, gap: 10, marginVertical: 8 },
  title: { fontFamily: JAKARTA.bold, fontSize: 16, color: DS.ink },
  text: { fontFamily: JAKARTA.regular, fontSize: 14, lineHeight: 20, color: DS.ink2 },
  hint: { fontFamily: JAKARTA.regular, fontSize: 12, lineHeight: 18, color: DS.inkMuted },
  error: { fontFamily: JAKARTA.medium, fontSize: 13, lineHeight: 19, color: DS.ink, backgroundColor: AI_PURPLE_SOFT, padding: 10, borderRadius: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { minHeight: 46, backgroundColor: DS.surface, color: DS.ink, borderColor: DS.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  button: { minHeight: 44, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1, borderColor: DS.border, backgroundColor: DS.surface, justifyContent: 'center', flexShrink: 1 },
  buttonText: { fontFamily: JAKARTA.medium, fontSize: 13, lineHeight: 19, color: AI_PURPLE_TEXT },
  selected: { borderColor: AI_PURPLE_TEXT, backgroundColor: AI_PURPLE_SOFT },
  disabled: { opacity: 0.45 },
});