// Contraddizioni e domande del brief con correzione a un tap (parità web BriefIssues.tsx).
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DS, JAKARTA } from '../../../lib/theme';
import type { TourBriefV4 } from '../../../lib/aitour/brief-v4';
import type { BriefIssue } from '../../../lib/aitour/brief-consistency';

interface Props {
  issues: BriefIssue[];
  clarifications: BriefIssue[];
  onApply: (apply: (b: TourBriefV4) => TourBriefV4) => void;
}

export function BriefIssues({ issues, clarifications, onApply }: Props) {
  if (!issues.length && !clarifications.length) return null;
  const render = (list: BriefIssue[], kind: 'issue' | 'clarify') => list.map((it) => (
    <View key={it.id} testID={`brief-${kind}-${it.id}`} style={styles.item}>
      <View style={styles.row}>
        <Ionicons name={kind === 'clarify' ? 'help-circle' : 'warning'} size={15} color={kind === 'clarify' ? '#0284C7' : '#D97706'} />
        <Text testID={`brief-${kind}-${it.id}-text`} style={styles.message}>{it.message}</Text>
      </View>
      <View style={styles.fixes}>
        {it.fixes.map((f, i) => (
          <TouchableOpacity
            key={`${it.id}-${i}`}
            testID={`brief-${kind}-${it.id}-fix-${i}`}
            accessibilityRole="button"
            accessibilityLabel={f.label}
            style={styles.fixBtn}
            onPress={() => onApply(f.apply)}
            activeOpacity={0.7}
          >
            <Text style={styles.fixText}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  ));
  return (
    <View testID="brief-issues" style={styles.box}>
      <Text testID="brief-issues-title" style={styles.title}>
        {issues.length ? 'Contraddizioni da risolvere' : 'Domande'} · scegli con un tocco
      </Text>
      {render(clarifications, 'clarify')}
      {render(issues, 'issue')}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: '#7DD3FC', backgroundColor: 'rgba(14,165,233,0.08)', borderRadius: 10, padding: 10, marginBottom: 12, gap: 10 },
  title: { fontFamily: JAKARTA.semibold, fontSize: 12, color: '#0369A1' },
  item: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  message: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 13, color: DS.ink, lineHeight: 18 },
  fixes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 21 },
  fixBtn: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: '#0284C7', borderRadius: 20, paddingHorizontal: 14, backgroundColor: DS.surface },
  fixText: { fontFamily: JAKARTA.medium, fontSize: 13, color: '#0369A1' },
});
