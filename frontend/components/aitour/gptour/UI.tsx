import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DS, JAKARTA } from '../../../lib/theme';
import type { TourIntent } from '../../../lib/aitour/gptour-intent';
import { ENTITY_LABELS } from '../../../lib/aitour/types';
export function GptButton({ id, label, onPress, disabled = false, primary = false, icon }: {
  id: string; label: string; onPress: () => void; disabled?: boolean; primary?: boolean; icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return <Pressable testID={id} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [ui.button, primary && ui.primary, { opacity: disabled ? .4 : pressed ? .7 : 1 }]}>
    {icon && <Ionicons name={icon} size={18} color={primary ? DS.surface : DS.brand} />}
    <Text style={[ui.buttonText, primary && ui.primaryText]}>{label}</Text>
  </Pressable>;
}
export function GptNotice({ id, text, error = false }: { id: string; text: string; error?: boolean }) {
  return <View testID={id} accessibilityRole="alert" style={[ui.notice, error && ui.errorNotice]}><Ionicons name={error ? 'alert-circle-outline' : 'information-circle-outline'} size={19} color={error ? DS.error : DS.brand} /><Text style={[ui.body, ui.flex, error && { color: DS.error }]}>{text}</Text></View>;
}
export function GptCriteria({ intent }: { intent: TourIntent }) {
  const chips = [...intent.requestedEntityTypes.map((t) => ENTITY_LABELS[t]),
    intent.requestedArea?.comune, intent.requestedArea?.provincia, intent.requestedArea?.zona,
    intent.project, intent.minRevenue != null && `≥ €${intent.minRevenue} / 6 mesi`, intent.maxRevenue != null && `≤ €${intent.maxRevenue} / 6 mesi`,
    intent.physicalContactMinDays != null && `non visitati ≥ ${intent.physicalContactMinDays} gg`, intent.orderMinDays != null && `non ordinano ≥ ${intent.orderMinDays} gg`,
    intent.ownOrphansOnly && 'solo miei orfani', intent.wantAll && 'tutti gli idonei', intent.maxDays && `max ${intent.maxDays} giorni`,
    intent.lodgingRule && `casa se < ${intent.lodgingRule.maxKmHome} km`, intent.allowLargeBuffer && 'fine anticipata accettata',
    ...intent.allowedExpansionTypes.map((t) => `integrazioni: ${ENTITY_LABELS[t]}`)].filter((s): s is string => typeof s === 'string' && !!s);
  return <View testID="gptour-criteria" style={ui.card}><Text style={ui.heading}>Criteri del giro</Text><View style={ui.wrap}>
    {chips.length ? chips.map((text, i) => <View testID={`gptour-criterion-${i}`} key={`${text}-${i}`} style={ui.chip}><Text style={ui.chipText}>{text}</Text></View>) : <Text testID="gptour-no-criteria" style={ui.muted}>Descrivi chi vuoi visitare e quando.</Text>}
  </View></View>;
}
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DS.surface2 }, content: { padding: 20, gap: 20, paddingBottom: 40 },
  card: { padding: 18, borderRadius: 18, backgroundColor: DS.surface, borderWidth: 1, borderColor: DS.border, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, flex: { flex: 1 },
  title: { fontFamily: JAKARTA.bold, fontSize: 30, color: DS.ink }, heading: { fontFamily: JAKARTA.bold, fontSize: 19, color: DS.ink },
  body: { fontFamily: JAKARTA.medium, fontSize: 15, lineHeight: 22, color: DS.ink }, muted: { fontFamily: JAKARTA.regular, fontSize: 13, lineHeight: 19, color: DS.inkMuted },
  button: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, backgroundColor: DS.brandSoft, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  primary: { backgroundColor: DS.brand }, buttonText: { fontFamily: JAKARTA.semibold, fontSize: 14, color: DS.brand, flexShrink: 1 }, primaryText: { color: DS.surface },
  input: { minHeight: 48, borderWidth: 1, borderColor: DS.borderStrong, borderRadius: 12, padding: 12, color: DS.ink, fontFamily: JAKARTA.regular, fontSize: 16, backgroundColor: DS.surface2 },
  notice: { borderRadius: 12, padding: 14, backgroundColor: DS.brandSoft, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, errorNotice: { borderWidth: 1, borderColor: DS.error, backgroundColor: DS.surface },
  chip: { backgroundColor: DS.brandSoft, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 }, chipText: { color: DS.brand, fontFamily: JAKARTA.semibold, fontSize: 12 },
  bubble: { backgroundColor: DS.surface2, padding: 14, borderRadius: 14, gap: 6 }, ownBubble: { backgroundColor: DS.brandSoft },
  divider: { height: 1, backgroundColor: DS.border }, modalBackdrop: { flex: 1, backgroundColor: DS.surface2, justifyContent: 'center', padding: 20 },
});