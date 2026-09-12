/**
 * Bozze Ordine — List of saved order drafts
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDrafts, deleteDraft, OrderDraft } from '../lib/drafts';
import { COLORS } from '../lib/theme';
import { ConfirmActionModal } from '../components/ConfirmActionModal';

const STEP_LABELS = ['Cliente', 'Prodotti', 'Pagamento', 'Spedizione', 'Riepilogo'];

export default function DraftsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [drafts, setDrafts] = useState<OrderDraft[]>([]);
  const [deletingDraft, setDeletingDraft] = useState<OrderDraft | null>(null);

  const loadDrafts = useCallback(async () => {
    const data = await getDrafts();
    setDrafts(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDrafts();
    }, [loadDrafts])
  );

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleDelete = (draft: OrderDraft) => {
    setDeletingDraft(draft);
  };

  const handleResume = (draft: OrderDraft) => {
    // Navigate to order-collection-v2 with draft data as params
    router.push({
      pathname: '/order-collection-v2',
      params: { draftId: draft.id },
    });
  };

  const renderDraft = ({ item }: { item: OrderDraft }) => (
    <TouchableOpacity testID={`draft-resume-${item.id}`} style={styles.card} onPress={() => handleResume(item)} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.customerName} numberOfLines={1}>{item.customerName}</Text>
          <Text style={styles.dateText}>{formatDate(item.savedAt)}</Text>
        </View>
        <TouchableOpacity testID={`draft-delete-${item.id}`} style={styles.deleteBtn} onPress={(event) => { event.stopPropagation(); handleDelete(item); }}>
          <Ionicons name="trash-outline" size={18} color="#DC2626" />
        </TouchableOpacity>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoPill}>
          <Ionicons name="cube-outline" size={14} color="#7C3AED" />
          <Text style={styles.infoPillText}>{item.productCount} prodotti</Text>
        </View>
        <View style={styles.infoPill}>
          <Ionicons name="cash-outline" size={14} color="#059669" />
          <Text testID={`draft-total-${item.id}`} style={[styles.infoPillText, { color: '#059669' }]}>{formatCurrency(item.totalAmount)}</Text>
        </View>
        <View style={[styles.infoPill, { backgroundColor: '#FEF3C7' }]}>
          <Ionicons name="navigate-outline" size={14} color="#92400E" />
          <Text style={[styles.infoPillText, { color: '#92400E' }]}>Step {item.currentStep + 1}: {STEP_LABELS[item.currentStep]}</Text>
        </View>
        {item.isForeignOrder && (
          <View style={[styles.infoPill, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="airplane" size={14} color="#DC2626" />
            <Text style={[styles.infoPillText, { color: '#DC2626' }]}>Estero</Text>
          </View>
        )}
      </View>

      <View style={styles.resumeRow}>
        <Ionicons name="play-circle" size={18} color="#7C3AED" />
        <Text style={styles.resumeText}>Tocca per riprendere</Text>
        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ConfirmActionModal testID="draft-delete-dialog" visible={!!deletingDraft} title="Elimina Bozza" message={`Vuoi eliminare la bozza per ${deletingDraft?.customerName ?? ''}?`} confirmLabel="Elimina" onCancel={() => setDeletingDraft(null)} onConfirm={async () => {
        if (!deletingDraft) return;
        await deleteDraft(deletingDraft.id); await loadDrafts(); setDeletingDraft(null);
      }} />
      <View style={styles.header}>
        <TouchableOpacity testID="drafts-back" onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bozze Ordine</Text>
        <View style={{ width: 32 }} />
      </View>

      {drafts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Nessuna bozza salvata</Text>
          <Text style={styles.emptySubtitle}>Le bozze vengono salvate automaticamente{'\n'}durante la Raccolta Ordine</Text>
        </View>
      ) : (
        <FlatList
          data={drafts}
          renderItem={renderDraft}
          keyExtractor={d => d.id}
          contentContainerStyle={{ padding: 16 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#7C3AED', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  card: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  customerName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  dateText: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  deleteBtn: { padding: 8, marginTop: -4, marginRight: -4 },
  cardBody: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  infoPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.primarySoft, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  infoPillText: { fontSize: 12, fontWeight: '600', color: '#7C3AED' },
  resumeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  resumeText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#7C3AED' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: COLORS.textMuted, marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: COLORS.textLight, marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
