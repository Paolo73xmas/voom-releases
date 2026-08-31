import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { fetchCustomers } from '../../lib/api/customers';
import { searchUnlinkedTabaccherie, type RegistryTabMatch } from '../../lib/api/registry-search';
import { Customer } from '../../types';
import { useDebounce } from '../../hooks/useDebounce';
import { SkeletonList } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { hap } from '../../lib/haptics';
import { COLORS } from '../../lib/theme';

// Memoized card — re-renders only when props change
const CustomerCard = memo(function CustomerCard({
  item,
  onPress,
}: {
  item: Customer;
  onPress: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.customerCard}
      onPress={() => onPress(item.id)}
    >
      <View style={styles.customerHeader}>
        <View style={styles.customerAvatar}>
          <Text style={styles.avatarText}>
            {item.business_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName} numberOfLines={1}>
            {item.business_name}
          </Text>
          <Text style={styles.customerLocation} numberOfLines={1}>
            <Ionicons name="location-outline" size={12} color="#6B7280" />
            {' '}{item.city}, {item.province}
          </Text>
        </View>
        <View style={[
          styles.categoryBadge,
          item.category === 'client' ? styles.clientBadge : styles.prospectBadge
        ]}>
          <Text style={[
            styles.categoryText,
            item.category === 'client' ? styles.clientText : styles.prospectText
          ]}>
            {item.category === 'client' ? 'Cliente' : 'Prospect'}
          </Text>
        </View>
      </View>
      <View style={styles.customerDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="person-outline" size={14} color="#6B7280" />
          <Text style={styles.detailText}>{item.contact_name}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="call-outline" size={14} color="#6B7280" />
          <Text style={styles.detailText}>{item.contact_phone}</Text>
        </View>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color="#D1D5DB"
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
});

export default function CustomersScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  // Rivendite del registro tabaccherie SENZA scheda cliente che corrispondono alla ricerca
  const [registryMatches, setRegistryMatches] = useState<RegistryTabMatch[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (debouncedSearch.trim().length < 3) { setRegistryMatches([]); return; }
    searchUnlinkedTabaccherie(debouncedSearch, 15)
      .then((rows) => { if (!cancelled) setRegistryMatches(rows); })
      .catch(() => { if (!cancelled) setRegistryMatches([]); });
    return () => { cancelled = true; };
  }, [debouncedSearch]);

  const loadCustomers = useCallback(async (force: boolean = false) => {
    if (!user) return;
    try {
      const data = await fetchCustomers(user.id, user.role, user.branchId, { force });
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = useMemo(() => {
    if (!debouncedSearch.trim()) return customers;
    const term = debouncedSearch.toLowerCase();
    return customers.filter(c =>
      c.business_name.toLowerCase().includes(term) ||
      c.city.toLowerCase().includes(term) ||
      c.contact_name.toLowerCase().includes(term) ||
      c.contact_phone.includes(term)
    );
  }, [debouncedSearch, customers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCustomers(true);
    setRefreshing(false);
  }, [loadCustomers]);

  const handlePressCustomer = useCallback((id: string) => {
    hap.light();
    router.push(`/customer/${id}`);
  }, [router]);

  const renderCustomer = useCallback(({ item }: { item: Customer }) => (
    <CustomerCard item={item} onPress={handlePressCustomer} />
  ), [handlePressCustomer]);

  const keyExtractor = useCallback((item: Customer) => item.id, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#6B7280" />
            <View style={{ flex: 1, marginLeft: 12, height: 16, backgroundColor: COLORS.border, borderRadius: 4 }} />
          </View>
        </View>
        <SkeletonList count={6} height={96} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca cliente..."
            placeholderTextColor={COLORS.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stats + Nuovo Cliente */}
      <View style={styles.statsRow}>
        <Text style={styles.statsText}>
          {filteredCustomers.length} di {customers.length} clienti
        </Text>
        <TouchableOpacity style={styles.bulkSlotsBtn} onPress={() => router.push('/bulk-visit-slots')}>
          <Ionicons name="time-outline" size={16} color="#7C3AED" />
          <Text style={styles.bulkSlotsBtnText}>Agg. Massivo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.newClientBtn} onPress={() => router.push('/anagrafica')}>
          <Ionicons name="add-circle" size={18} color="#FFF" />
          <Text style={styles.newClientBtnText}>Nuovo Cliente</Text>
        </TouchableOpacity>
      </View>

      {/* Customer List — FlashList for performance */}
      <FlatList
        data={filteredCustomers}
        renderItem={renderCustomer}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="Nessun cliente trovato"
            message={searchQuery ? 'Modifica la ricerca o crea un nuovo cliente' : 'Inizia aggiungendo il tuo primo cliente'}
            ctaLabel={searchQuery ? undefined : 'Nuovo Cliente'}
            onCtaPress={searchQuery ? undefined : () => router.push('/anagrafica')}
            iconGradient="primary"
          />
        }
        ListFooterComponent={
          registryMatches.length > 0 ? (
            <View style={styles.registrySection}>
              <Text style={styles.registryTitle}>
                Dal registro tabaccherie (senza scheda cliente) — crea la scheda senza doppioni
              </Text>
              {registryMatches.map((t) => (
                <View key={t.id} style={styles.registryCard}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.registryName} numberOfLines={1}>
                      {t.denominazione || 'Rivendita senza nome'}{t.Num_Ordinale ? ` — Riv. ${t.Num_Ordinale}` : ''}
                    </Text>
                    <Text style={styles.registryAddr} numberOfLines={1}>
                      {[t.indirizzo, t.comune, t.provincia ? `(${t.provincia})` : ''].filter(Boolean).join(', ')}
                      {t.gps_lat && t.gps_lng ? ' · 📍 georeferenziata' : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.registryBtn}
                    onPress={() => {
                      hap.light();
                      router.push({ pathname: '/anagrafica', params: { tabaccheriaId: t.id } });
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={13} color="#FFF" />
                    <Text style={styles.registryBtnText}>Crea scheda</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  registrySection: { marginTop: 14, gap: 8, paddingBottom: 8 },
  registryTitle: { fontSize: 11, fontWeight: '700', color: '#92400E' },
  registryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FCD34D', borderRadius: 10,
    paddingVertical: 8, paddingHorizontal: 10,
  },
  registryName: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  registryAddr: { fontSize: 11, color: '#6B7280', marginTop: 1 },
  registryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#D97706', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10,
    minHeight: 36, justifyContent: 'center',
  },
  registryBtnText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: COLORS.text,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  newClientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
  },
  bulkSlotsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#7C3AED',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 5,
    marginRight: 8,
  },
  bulkSlotsBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#7C3AED',
  },
  newClientBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  statsText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  customerCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3B82F6',
  },
  customerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  customerLocation: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  clientBadge: {
    backgroundColor: '#DCFCE7',
  },
  prospectBadge: {
    backgroundColor: '#FEF3C7',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  clientText: {
    color: '#166534',
  },
  prospectText: {
    color: '#92400E',
  },
  customerDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  detailText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginLeft: 4,
  },
  chevron: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textLight,
    marginTop: 12,
  },
});
