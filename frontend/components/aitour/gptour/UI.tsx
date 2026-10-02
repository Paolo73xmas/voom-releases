import React from 'react';
import { Pressable, Text, StyleSheet, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DS, JAKARTA } from '../../../lib/theme';
import type { TourIntent } from '../../../lib/aitour/gptour-intent';
import { ENTITY_LABELS } from '../../../lib/aitour/types';
type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function GptButton({ id, label, onPress, disabled = false, primary = false, danger = false, icon, small = false }: {
  id: string; label: string; onPress: () => void; disabled?: boolean; primary?: boolean; danger?: boolean; icon?: IconName; small?: boolean;
}) {
  const color = primary ? DS.surface : danger ? DS.error : DS.brand;
  return <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={6}
    style={({ pressed }) => [ui.button, small && ui.buttonSmall, primary && ui.primary, danger && ui.dangerButton, { opacity: disabled ? .4 : pressed ? .7 : 1 }]}>
    {icon && <Ionicons name={icon} size={small ? 15 : 18} color={color} />}
    <Text style={[ui.buttonText, small && ui.buttonTextSmall, { color }]}>{label}</Text>
  </Pressable>;
}
/** Pulsante solo icona 44x44: azioni frequenti senza occupare la riga. */
export function GptIcon({ id, icon, label, onPress, disabled = false, primary = false, color }: { id: string; icon: IconName; label: string; onPress: () => void; disabled?: boolean; primary?: boolean; color?: string }) {
  return <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={4}
    style={({ pressed }) => [ui.iconButton, primary && ui.primary, { opacity: disabled ? .35 : pressed ? .7 : 1 }]}>
    <Ionicons name={icon} size={20} color={color || (primary ? DS.surface : DS.brand)} />
  </Pressable>;
}
export function GptNotice({ id, text, error = false }: { id: string; text: string; error?: boolean }) {
  return <View testID={id} accessibilityRole="alert" style={[ui.notice, error && ui.errorNotice]}><Ionicons name={error ? 'alert-circle-outline' : 'information-circle-outline'} size={18} color={error ? DS.error : DS.brand} /><Text style={[ui.small, ui.flex, error && { color: DS.error }]}>{text}</Text></View>;
}
export function criteriaChips(intent: TourIntent): string[] {
  return [...intent.requestedEntityTypes.map((t) => ENTITY_LABELS[t]),
    intent.requestedArea?.comune, intent.requestedArea?.provincia, intent.requestedArea?.zona,
    intent.project, intent.minRevenue != null && `≥ €${intent.minRevenue} / 6 mesi`, intent.maxRevenue != null && `≤ €${intent.maxRevenue} / 6 mesi`,
    intent.physicalContactMinDays != null && `non visitati ≥ ${intent.physicalContactMinDays} gg`, intent.orderMinDays != null && `non ordinano ≥ ${intent.orderMinDays} gg`,
    intent.ownOrphansOnly && 'solo miei orfani', intent.wantAll && 'tutti gli idonei', intent.maxDays && `max ${intent.maxDays} giorni`,
    intent.lodgingRule && `casa se < ${intent.lodgingRule.maxKmHome} km`, intent.allowLargeBuffer && 'fine anticipata accettata',
    ...intent.allowedExpansionTypes.map((t) => `integrazioni: ${ENTITY_LABELS[t]}`)].filter((s): s is string => typeof s === 'string' && !!s);
}
/** Criteri attivi: una sola riga scorrevole, niente card. */
export function GptCriteria({ intent }: { intent: TourIntent }) {
  const chips = criteriaChips(intent);
  if (!chips.length) return null;
  return <ScrollView testID="gptour-criteria" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ui.chipRow}>
    {chips.map((text, i) => <View testID={`gptour-criterion-${i}`} key={`${text}-${i}`} style={ui.chip}><Text style={ui.chipText}>{text}</Text></View>)}
  </ScrollView>;
}
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DS.surface2 }, content: { paddingHorizontal: 14, gap: 12 },
  card: { padding: 14, borderRadius: 16, backgroundColor: DS.surface, borderWidth: 1, borderColor: DS.border, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, flex: { flex: 1 },
  title: { fontFamily: JAKARTA.bold, fontSize: 22, color: DS.ink }, heading: { fontFamily: JAKARTA.bold, fontSize: 16, color: DS.ink },
  body: { fontFamily: JAKARTA.medium, fontSize: 15, lineHeight: 21, color: DS.ink }, small: { fontFamily: JAKARTA.medium, fontSize: 13, lineHeight: 18, color: DS.ink },
  muted: { fontFamily: JAKARTA.regular, fontSize: 12, lineHeight: 17, color: DS.inkMuted },
  button: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: DS.brandSoft, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  buttonSmall: { minHeight: 36, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  iconButton: { width: 44, height: 44, borderRadius: 12, backgroundColor: DS.brandSoft, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: DS.brand }, dangerButton: { backgroundColor: DS.surface2 },
  buttonText: { fontFamily: JAKARTA.semibold, fontSize: 14, color: DS.brand, flexShrink: 1 }, buttonTextSmall: { fontSize: 13 },
  input: { minHeight: 44, borderWidth: 1, borderColor: DS.borderStrong, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: DS.ink, fontFamily: JAKARTA.regular, fontSize: 16, backgroundColor: DS.surface2 },
  notice: { borderRadius: 12, padding: 12, backgroundColor: DS.brandSoft, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }, errorNotice: { borderWidth: 1, borderColor: DS.error, backgroundColor: DS.surface },
  chipRow: { gap: 6, paddingVertical: 2 }, chip: { backgroundColor: DS.brandSoft, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6 }, chipText: { color: DS.brand, fontFamily: JAKARTA.semibold, fontSize: 12 },
  bubble: { backgroundColor: DS.surface, padding: 12, borderRadius: 16, borderBottomLeftRadius: 4, gap: 2, maxWidth: '88%', alignSelf: 'flex-start', borderWidth: 1, borderColor: DS.border },
  ownBubble: { backgroundColor: DS.brand, alignSelf: 'flex-end', borderBottomLeftRadius: 16, borderBottomRightRadius: 4, borderColor: DS.brand },
  divider: { height: 1, backgroundColor: DS.border },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: DS.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, gap: 12, maxHeight: '88%' },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: DS.borderStrong, alignSelf: 'center', marginBottom: 4 },
});
