import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { JAKARTA } from '../../lib/theme';
import { collapseInspectionReminderByDefault, loadInspectionReminderCollapsed } from '../../lib/aitour/inspection-reminder-preference';

const REMINDER_TEXT = "Ricorda: l'ispezione è sempre obbligatoria durante la visita — non serve solo se il cliente fa l'ordine o se salti la visita.";
// Il promemoria mantiene il giallo ad alto contrasto originale in entrambi i temi.
const INK = '#92400E';

export function InspectionReminder({ agentId }: { agentId?: string }) {
  return agentId ? <SavedInspectionReminder key={agentId} agentId={agentId} /> : null;
}

function SavedInspectionReminder({ agentId }: { agentId: string }) {
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const prefersCollapsed = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    loadInspectionReminderCollapsed(agentId).then(collapsed => {
      if (!active) return;
      prefersCollapsed.current = collapsed;
      setExpanded(!collapsed);
    }).catch(() => {
      if (!active) return;
      setExpanded(true);
      setError('Preferenza non disponibile. Premi la X per riprovare a salvarla.');
    }).finally(() => { if (active) setReady(true); });
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active' && prefersCollapsed.current) setExpanded(false);
    });
    return () => { active = false; mounted.current = false; subscription.remove(); };
  }, [agentId]);

  const collapse = async () => {
    if (!ready || saving) return;
    setSaving(true);
    setError('');
    try {
      await collapseInspectionReminderByDefault(agentId);
      if (!mounted.current) return;
      prefersCollapsed.current = true;
      setExpanded(false);
    } catch {
      if (mounted.current) setError('Scelta non salvata. Premi nuovamente la X per riprovare.');
    } finally { if (mounted.current) setSaving(false); }
  };

  if (!ready) return <View testID="aitour-inspection-reminder-loading" style={[styles.box, styles.compact]} accessibilityState={{ busy: true }}>
    <ActivityIndicator size="small" color={INK} />
    <Text testID="aitour-inspection-reminder-loading-label" style={styles.title}>Ispezione obbligatoria</Text>
  </View>;

  if (!expanded) return <TouchableOpacity testID="aitour-inspection-reminder-expand" style={[styles.box, styles.compact]}
    accessibilityRole="button" accessibilityLabel="Ispezione obbligatoria" accessibilityHint="Tocca per rileggere il promemoria" accessibilityState={{ expanded: false }}
    activeOpacity={0.75} onPress={() => setExpanded(true)}>
    <Ionicons name="clipboard-outline" size={14} color={INK} />
    <Text testID="aitour-inspection-reminder-title" style={styles.title}>Ispezione obbligatoria</Text>
    <Ionicons name="chevron-down" size={16} color={INK} />
  </TouchableOpacity>;

  return <View testID="aitour-inspection-reminder-expanded" style={styles.box}>
    <View style={styles.expandedRow}>
      <Ionicons name="clipboard-outline" size={13} color={INK} style={styles.icon} />
      <Text testID="aitour-inspection-reminder-text" style={styles.text}>{REMINDER_TEXT}</Text>
      <TouchableOpacity testID="aitour-inspection-reminder-collapse" style={styles.close} disabled={saving} onPress={collapse}
        accessibilityRole="button" accessibilityLabel="Comprimi il promemoria e mantienilo chiuso" accessibilityState={{ disabled: saving, busy: saving }} activeOpacity={0.7}>
        {saving ? <ActivityIndicator testID="aitour-inspection-reminder-saving" size="small" color={INK} /> : <Ionicons name="close" size={18} color={INK} />}
      </TouchableOpacity>
    </View>
    {!!error && <Text testID="aitour-inspection-reminder-error" accessibilityRole="alert" style={styles.error}>{error}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8, marginTop: 8 },
  compact: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  title: { flex: 1, fontFamily: JAKARTA.semibold, fontSize: 12, lineHeight: 18, color: INK },
  expandedRow: { flexDirection: 'row', alignItems: 'flex-start', paddingLeft: 8, gap: 6 },
  icon: { marginTop: 10 },
  text: { flex: 1, paddingVertical: 8, fontFamily: JAKARTA.medium, fontSize: 11, lineHeight: 15, color: INK },
  close: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
  error: { color: INK, fontFamily: JAKARTA.semibold, fontSize: 11, lineHeight: 16, paddingHorizontal: 8, paddingBottom: 8 },
});