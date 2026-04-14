/**
 * Bozze Ordine — List of saved order drafts
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDrafts, deleteDraft, OrderDraft } from '../lib/drafts';

const STEP_LABELS = ['Cliente', 'Prodotti', 'Pagamento', 'Spedizione', 'Riepilogo'];

export default function DraftsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [drafts, setDrafts] = useState<OrderDraft[]>([]);

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
    Alert.alert(
      'Elimina Bozza',
      `Vuoi eliminare la bozza per "${draft.customerName}"?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            await deleteDraft(draft.id);
            await loadDrafts();
          },
        },
      ]
    );
  };

  const handleResume = (draft: OrderDraft) => {
    // Navigate to order-collection-v2 with draft data as params
    router.push({
      pathname: '/order-collection-v2',
      params: { draftId: draft.id },
    });
  };

  const renderDraft = ({ item }: { item: OrderDraft }) => (
    <TouchableOpacity style={styles.card} onPress={() => handleResume(item)} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.customerName} numberOfLines={1}>{item.customerName}</Text>
          <Text style={styles.dateText}>{formatDate(item.savedAt)}</Text>
        </View>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
          <Ionicons name="trash-outline" size={18} color="#DC2626" />
        </TouchableOpacity>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoPill}>
          <Ionicons name="cube-outline" size={14} color="#1E40AF" />
          <Text style={styles.infoPillText}>{item.productCount} prodotti</Text>
        </View>
        <View style={styles.infoPill}>
          <Ionicons name="cash-outline" size={14} color="#059669" />
          <Text style={[styles.infoPillText, { color: '#059669' }]}>{formatCurrency(item.totalAmount)}</Text>
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
        <Ionicons name="play-circle" size={18} color="#1E40AF" />
        <Text style={styles.resumeText}>Tocca per riprendere</Text>
        <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
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
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1E40AF', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  customerName: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  dateText: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  deleteBtn: { padding: 8, marginTop: -4, marginRight: -4 },
  cardBody: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  infoPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  infoPillText: { fontSize: 12, fontWeight: '600', color: '#1E40AF' },
  resumeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  resumeText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1E40AF' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#6B7280', marginTop: 16 },
  emptySubtitle: { fontSize: 13, color: '#9CA3AF', marginTop: 8, textAlign: 'center', lineHeight: 20 },
});
