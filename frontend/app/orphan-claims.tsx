/**
 * I Miei Reclami — Agent's orphan claim requests
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { getAgentOrphanClaims, OrphanClaimWithDetails } from '../lib/api/orphan-claims';

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: 'In Attesa', color: '#92400E', bg: '#FEF3C7', icon: 'time-outline' },
  approved: { label: 'Approvata', color: '#065F46', bg: '#D1FAE5', icon: 'checkmark-circle-outline' },
  rejected: { label: 'Rifiutata', color: '#991B1B', bg: '#FEE2E2', icon: 'close-circle-outline' },
};

export default function OrphanClaimsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [claims, setClaims] = useState<OrphanClaimWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadClaims = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await getAgentOrphanClaims(user.id);
      setClaims(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { loadClaims(); }, [loadClaims]));
  const onRefresh = async () => { setRefreshing(true); await loadClaims(); setRefreshing(false); };

  const pending = claims.filter(c => c.status === 'pending').length;
  const approved = claims.filter(c => c.status === 'approved').length;
  const rejected = claims.filter(c => c.status === 'rejected').length;

  const renderClaim = ({ item }: { item: OrphanClaimWithDetails }) => {
    const cfg = STATUS_CFG[item.status] || STATUS_CFG.pending;
    return (
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Text style={s.cardCustomer} numberOfLines={1}>{item.customer_business_name || item.tabaccheria_denominazione}</Text>
          <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
            <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <Text style={s.cardAddress} numberOfLines={1}>{item.tabaccheria_indirizzo}, {item.tabaccheria_comune}</Text>
        <View style={s.cardFooter}>
          <Text style={s.cardDate}>{new Date(item.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
          {item.current_agent_name && item.current_agent_name !== 'Nessuno' && (
            <Text style={s.cardAgent}>Titolare: {item.current_agent_name}</Text>
          )}
        </View>
        {item.status === 'approved' && item.customer_id && (
          <TouchableOpacity
            style={s.orderBtn}
            onPress={() => router.push('/order-collection-v2')}
          >
            <Ionicons name="cart" size={16} color="#FFF" />
            <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Crea Ordine</Text>
          </TouchableOpacity>
        )}
        {item.reviewed_at && (
          <Text style={s.reviewDate}>Revisione: {new Date(item.reviewed_at).toLocaleDateString('it-IT')}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>I Miei Reclami</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={[s.statCard, { backgroundColor: '#FEF3C7' }]}>
          <Text style={[s.statNum, { color: '#92400E' }]}>{pending}</Text>
          <Text style={[s.statLabel, { color: '#92400E' }]}>In Attesa</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: '#D1FAE5' }]}>
          <Text style={[s.statNum, { color: '#065F46' }]}>{approved}</Text>
          <Text style={[s.statLabel, { color: '#065F46' }]}>Approvate</Text>
        </View>
        <View style={[s.statCard, { backgroundColor: '#FEE2E2' }]}>
          <Text style={[s.statNum, { color: '#991B1B' }]}>{rejected}</Text>
          <Text style={[s.statLabel, { color: '#991B1B' }]}>Rifiutate</Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#1E40AF" />
        </View>
      ) : (
        <FlatList
          data={claims}
          renderItem={renderClaim}
          keyExtractor={c => c.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Ionicons name="flag-outline" size={48} color="#D1D5DB" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280', marginTop: 12 }}>Nessun reclamo</Text>
              <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Reclama clienti orfani dalla Mappa</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1E40AF', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  statCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardCustomer: { fontSize: 14, fontWeight: '700', color: '#1F2937', flex: 1, marginRight: 8 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardAddress: { fontSize: 12, color: '#6B7280', marginBottom: 6 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontSize: 11, color: '#9CA3AF' },
  cardAgent: { fontSize: 11, color: '#6B7280' },
  orderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#059669', borderRadius: 10, paddingVertical: 10, marginTop: 10 },
  reviewDate: { fontSize: 10, color: '#9CA3AF', marginTop: 6, fontStyle: 'italic' },
});
