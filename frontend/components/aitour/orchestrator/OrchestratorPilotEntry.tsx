import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../store/authStore';
import { useOrchestratorAccess } from '../../../hooks/useOrchestratorAccess';
import { orchestratorPilotEnabled } from '../../../lib/aitour/orchestrator/pilot-config';
import { DS, JAKARTA } from '../../../lib/theme';

/** No local allowlist, CRM lookup or session creation. Hidden unless the server authorizes this user. */
export function OrchestratorPilotEntry() {
  const owner = useAuthStore(s => s.user?.id ?? null), router = useRouter();
  const focused = useIsFocused();
  const access = useOrchestratorAccess(owner, focused && orchestratorPilotEnabled());
  if (access !== 'enabled') return null;
  return <Pressable testID="menu-gptour-orchestrator" accessibilityRole="button" accessibilityLabel="GPTour Orchestrator pilota"
    onPress={() => router.push('/gptour-orchestrator')} style={({ pressed }) => [s.card, pressed && s.pressed]}>
    <Ionicons name="sparkles-outline" size={24} color={DS.brand} />
    <View style={s.copy}>
      <Text testID="menu-orchestrator-title" style={s.title}>GPTour Orchestrator</Text>
      <Text testID="menu-orchestrator-description" style={s.description}>Pilota autorizzato · Pianificazione dal motore centrale</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={DS.inkMuted} />
  </Pressable>;
}
const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, minHeight: 64, marginBottom: 20,
    borderRadius: 20, backgroundColor: DS.brandSoft, borderWidth: 1, borderColor: DS.border },
  copy: { flex: 1, minWidth: 0 }, title: { color: DS.ink, fontFamily: JAKARTA.bold, fontSize: 17 },
  description: { color: DS.ink2, fontFamily: JAKARTA.regular, fontSize: 13, lineHeight: 19, marginTop: 5 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
});