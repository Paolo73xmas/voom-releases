// Anteprima candidati prima di generare (parità web BriefPreviewBox.tsx).
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DS, JAKARTA } from '../../../lib/theme';
import { RECENT_CONTACT_DAYS } from '../../../lib/aitour/scoring';
import type { BriefPreview } from '../../../lib/aitour/brief-preview';

interface Props { preview: BriefPreview | null; loading: boolean; error: string | null }

export function BriefPreviewBox({ preview, loading, error }: Props) {
  const [showExcluded, setShowExcluded] = useState(false);
  if (loading) return (
    <View testID="brief-preview-loading" accessibilityRole="progressbar" style={styles.loadingRow}>
      <ActivityIndicator size="small" color={DS.ink2} />
      <Text style={styles.loadingText}>Conto i clienti idonei...</Text>
    </View>
  );
  if (error) return <Text testID="brief-preview-error" style={styles.errorText}>Anteprima non disponibile: {error}</Text>;
  if (!preview) return null;
  const ex = preview.recentlyExcluded;
  return (
    <View testID="brief-preview" style={styles.box}>
      <View style={styles.titleRow}>
        <Ionicons name="people" size={14} color="#047857" />
        <Text style={styles.title}>Anteprima prima di generare</Text>
      </View>
      <Text testID="brief-preview-counts" style={styles.text}>
        <Text style={styles.strong}>{preview.eligible}</Text> clienti idonei
        {preview.named > 0 ? <Text> + <Text style={styles.strong}>{preview.named}</Text> {preview.named === 1 ? 'nominato' : 'nominati'}</Text> : null}
        {' → fino a '}
        <Text testID="brief-preview-planned" style={styles.strong}>{preview.planned}</Text> visite proposte
      </Text>
      {preview.registryPending && <Text testID="brief-preview-registry" style={styles.note}>Le tabaccherie del registro per lo sviluppo vengono caricate in generazione.</Text>}
      {preview.newAroundPending && <Text testID="brief-preview-new-around" style={styles.note}>I nuovi punti vendita nel raggio vengono cercati in generazione.</Text>}
      {ex.length > 0 && (
        <View style={styles.excludedWrap}>
          <Text testID="brief-preview-excluded" style={styles.note}>
            <Text style={styles.strong}>{ex.length}</Text> esclusi perché visitati o con ordine negli ultimi {RECENT_CONTACT_DAYS} giorni.
          </Text>
          <TouchableOpacity
            testID="brief-preview-excluded-toggle"
            accessibilityRole="button"
            accessibilityState={{ expanded: showExcluded }}
            style={styles.toggleBtn}
            onPress={() => setShowExcluded((x) => !x)}
            activeOpacity={0.7}
          >
            <Text style={styles.toggleText}>{showExcluded ? 'Nascondi' : 'Vedi chi'}</Text>
          </TouchableOpacity>
          {showExcluded && (
            <Text testID="brief-preview-excluded-list" style={styles.excludedList}>
              {ex.slice(0, 12).map((c) => `${c.name}${c.city ? ` (${c.city})` : ''}`).join(' · ')}
              {ex.length > 12 ? ` · +${ex.length - 12}` : ''} — per includerne uno, nominalo nella richiesta.
            </Text>
          )}
        </View>
      )}
      {preview.eligible === 0 && preview.named === 0 && !preview.registryPending && !preview.newAroundPending && (
        <Text testID="brief-preview-empty" style={styles.empty}>Nessun cliente idoneo con questi criteri: correggi zona o filtri prima di generare.</Text>
      )}
      {preview.warnings.map((w, i) => <Text key={i} testID={`brief-preview-warning-${i}`} style={styles.warning}>• {w}</Text>)}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderColor: '#A7F3D0', backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 10, padding: 10, marginTop: 12, gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontFamily: JAKARTA.semibold, fontSize: 12, color: '#047857' },
  text: { fontFamily: JAKARTA.regular, fontSize: 13, color: DS.ink, lineHeight: 19 },
  strong: { fontFamily: JAKARTA.bold, color: DS.ink },
  note: { fontFamily: JAKARTA.regular, fontSize: 12, color: DS.ink2, lineHeight: 17 },
  excludedWrap: { gap: 4 },
  toggleBtn: { minHeight: 44, justifyContent: 'center' },
  toggleText: { fontFamily: JAKARTA.medium, fontSize: 13, color: '#0369A1', textDecorationLine: 'underline' },
  excludedList: { fontFamily: JAKARTA.regular, fontSize: 12, color: DS.inkMuted, lineHeight: 17 },
  empty: { fontFamily: JAKARTA.semibold, fontSize: 13, color: '#DC2626', lineHeight: 18 },
  warning: { fontFamily: JAKARTA.regular, fontSize: 12, color: '#D97706', lineHeight: 17 },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  loadingText: { fontFamily: JAKARTA.regular, fontSize: 12, color: DS.ink2 },
  errorText: { fontFamily: JAKARTA.regular, fontSize: 12, color: '#D97706', marginTop: 12 },
});
