import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { getLeads, getProvinces, getLeadsColorInfoBatch } from '../../lib/api/laservideo';
import type {
  LaserVideoLead,
  LaserVideoLeadFilters,
  LaserVideoLeadStatus,
  LeadColorInfo,
  LeadColorStatus,
} from '../../types/laservideo';
import { LEAD_STATUS_CONFIG, KIT_CONFIG, LEAD_COLOR_CONFIG } from '../../types/laservideo';

type SortKey = 'ragione_sociale' | 'comune' | 'stato' | 'data_installazione';
type SortDir = 'asc' | 'desc';

export default function LaserVideoLeadsScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'admincustom';

  const [leads, setLeads] = useState<LaserVideoLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [provinces, setProvinces] = useState<string[]>([]);
  const [colorData, setColorData] = useState<Map<string, LeadColorInfo>>(new Map());

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterProvincia, setFilterProvincia] = useState<string | undefined>(undefined);
  const [filterStato, setFilterStato] = useState<LaserVideoLeadStatus | undefined>(undefined);
  const [filterKit, setFilterKit] = useState<'500' | '1000' | undefined>(undefined);
  const [colorFilter, setColorFilter] = useState<LeadColorStatus | 'all'>('all');

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('ragione_sociale');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Modals
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const buildFilters = useCallback((): LaserVideoLeadFilters => {
    const f: LaserVideoLeadFilters = {};
    if (!isAdmin && user?.id) f.agente_id = user.id;
    if (filterProvincia) f.provincia = filterProvincia;
    if (filterStato) f.stato = filterStato;
    if (filterKit) f.tipo_kit = filterKit;
    if (debouncedSearch) f.search = debouncedSearch;
    return f;
  }, [isAdmin, user?.id, filterProvincia, filterStato, filterKit, debouncedSearch]);

  const loadData = useCallback(async () => {
    try {
      const filters = buildFilters();
      const [leadsData, provincesData] = await Promise.all([
        getLeads(filters),
        getProvinces(),
      ]);
      setLeads(leadsData);
      setProvinces(provincesData);

      // Load color data
      const tabIds = leadsData
        .map((l) => l.tabaccheria_id)
        .filter((id): id is string => !!id);
      if (tabIds.length > 0) {
        const colors = await getLeadsColorInfoBatch(tabIds);
        setColorData(colors);
      }
    } catch (err) {
      console.error('Error loading leads:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildFilters]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Filtered by color
  const filteredLeads = useMemo(() => {
    if (colorFilter === 'all') return leads;
    return leads.filter((lead) => {
      if (!lead.tabaccheria_id) return colorFilter === 'none';
      const info = colorData.get(lead.tabaccheria_id);
      return info?.color === colorFilter;
    });
  }, [leads, colorFilter, colorData]);

  // Sorted
  const sortedLeads = useMemo(() => {
    const arr = [...filteredLeads];
    const mult = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let aVal = '';
      let bVal = '';
      switch (sortKey) {
        case 'ragione_sociale':
          aVal = (a.ragione_sociale || '').toLowerCase();
          bVal = (b.ragione_sociale || '').toLowerCase();
          break;
        case 'comune':
          aVal = (a.comune || '').toLowerCase();
          bVal = (b.comune || '').toLowerCase();
          break;
        case 'stato':
          aVal = a.stato || '';
          bVal = b.stato || '';
          break;
        case 'data_installazione':
          aVal = a.data_installazione || '';
          bVal = b.data_installazione || '';
          break;
      }
      return aVal.localeCompare(bVal, 'it') * mult;
    });
    return arr;
  }, [filteredLeads, sortKey, sortDir]);

  const getLeadColor = (lead: LaserVideoLead): LeadColorInfo => {
    if (!lead.tabaccheria_id) {
      return { color: 'none', label: 'N/D', description: '', ordersCount: 0, totalValue: 0, daysSinceLastOrder: null };
    }
    return colorData.get(lead.tabaccheria_id) || { color: 'none', label: '...', description: '', ordersCount: 0, totalValue: 0, daysSinceLastOrder: null };
  };

  const activeFilterCount = [filterProvincia, filterStato, filterKit, colorFilter !== 'all' ? colorFilter : null].filter(Boolean).length;

  const clearFilters = () => {
    setFilterProvincia(undefined);
    setFilterStato(undefined);
    setFilterKit(undefined);
    setColorFilter('all');
    setShowFilters(false);
  };

  const renderLeadCard = ({ item }: { item: LaserVideoLead }) => {
    const statusConf = LEAD_STATUS_CONFIG[item.stato];
    const kitConf = item.tipo_kit ? KIT_CONFIG[item.tipo_kit] : null;
    const colorInfo = getLeadColor(item);
    const colorConf = LEAD_COLOR_CONFIG[colorInfo.color];

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => router.push(`/laservideo/${item.id}`)}
      >
        <View style={styles.cardRow}>
          {/* Color dot */}
          <View style={[styles.colorDot, { backgroundColor: colorConf.bg }]}>
            {colorInfo.ordersCount > 0 && (
              <Text style={[styles.colorDotText, { color: colorConf.color }]}>{colorInfo.ordersCount}</Text>
            )}
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardName} numberOfLines={1}>{item.ragione_sociale}</Text>
            <View style={styles.cardMeta}>
              {item.comune && (
                <View style={styles.metaItem}>
                  <Ionicons name="location-outline" size={12} color="#6B7280" />
                  <Text style={styles.metaText}>{item.comune}{item.provincia ? ` (${item.provincia})` : ''}</Text>
                </View>
              )}
              {item.matricola && (
                <View style={styles.metaItem}>
                  <Ionicons name="barcode-outline" size={12} color="#6B7280" />
                  <Text style={styles.metaText}>{item.matricola}</Text>
                </View>
              )}
            </View>
            {/* Badges row */}
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: statusConf.bg }]}>
                <Text style={[styles.badgeText, { color: statusConf.color }]}>{statusConf.label}</Text>
              </View>
              {kitConf && (
                <View style={[styles.badge, { backgroundColor: kitConf.bg }]}>
                  <Text style={[styles.badgeText, { color: kitConf.color }]}>{kitConf.label}</Text>
                </View>
              )}
              {item.tabaccheria?.denominazione && (
                <View style={[styles.badge, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="link" size={10} color="#059669" />
                  <Text style={[styles.badgeText, { color: '#059669', marginLeft: 3 }]} numberOfLines={1}>
                    {item.tabaccheria.denominazione.length > 15
                      ? item.tabaccheria.denominazione.substring(0, 15) + '...'
                      : item.tabaccheria.denominazione}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Progetto LaserVideo</Text>
          <Text style={styles.headerSubtitle}>
            {sortedLeads.length} lead{!isAdmin ? ' (assegnati a te)' : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={22} color="#3B82F6" />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca nome, matricola, comune..."
            placeholderTextColor="#9CA3AF"
            value={searchTerm}
            onChangeText={setSearchTerm}
            returnKeyType="search"
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="filter" size={18} color={activeFilterCount > 0 ? '#FFFFFF' : '#6B7280'} />
          {activeFilterCount > 0 && <Text style={styles.filterCount}>{activeFilterCount}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.sortBtn} onPress={() => setShowSort(true)}>
          <Ionicons name="swap-vertical" size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>

      {/* Color legend - horizontal scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorBar} contentContainerStyle={styles.colorBarContent}>
        <TouchableOpacity
          style={[styles.colorChip, colorFilter === 'all' && styles.colorChipActive]}
          onPress={() => setColorFilter('all')}
        >
          <Text style={[styles.colorChipText, colorFilter === 'all' && styles.colorChipTextActive]}>Tutti</Text>
        </TouchableOpacity>
        {(Object.keys(LEAD_COLOR_CONFIG) as LeadColorStatus[]).map((key) => {
          const conf = LEAD_COLOR_CONFIG[key];
          const isActive = colorFilter === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.colorChip, isActive && styles.colorChipActive]}
              onPress={() => setColorFilter(isActive ? 'all' : key)}
            >
              <View style={[styles.colorChipDot, { backgroundColor: conf.bg }]} />
              <Text style={[styles.colorChipText, isActive && styles.colorChipTextActive]}>{conf.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Lead list */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Caricamento lead...</Text>
        </View>
      ) : (
        <FlatList
          data={sortedLeads}
          keyExtractor={(item) => item.id}
          renderItem={renderLeadCard}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>Nessun lead trovato</Text>
              {activeFilterCount > 0 && (
                <TouchableOpacity onPress={clearFilters}>
                  <Text style={styles.clearLink}>Rimuovi filtri</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      {/* Filter Modal */}
      <Modal visible={showFilters} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowFilters(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Filtri</Text>

            {/* Provincia */}
            <Text style={styles.filterLabel}>Provincia</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, !filterProvincia && styles.chipActive]}
                onPress={() => setFilterProvincia(undefined)}
              >
                <Text style={[styles.chipText, !filterProvincia && styles.chipTextActive]}>Tutte</Text>
              </TouchableOpacity>
              {provinces.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.chip, filterProvincia === p && styles.chipActive]}
                  onPress={() => setFilterProvincia(filterProvincia === p ? undefined : p)}
                >
                  <Text style={[styles.chipText, filterProvincia === p && styles.chipTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Stato */}
            <Text style={styles.filterLabel}>Stato</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, !filterStato && styles.chipActive]}
                onPress={() => setFilterStato(undefined)}
              >
                <Text style={[styles.chipText, !filterStato && styles.chipTextActive]}>Tutti</Text>
              </TouchableOpacity>
              {(Object.keys(LEAD_STATUS_CONFIG) as LaserVideoLeadStatus[]).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, filterStato === s && styles.chipActive]}
                  onPress={() => setFilterStato(filterStato === s ? undefined : s)}
                >
                  <Text style={[styles.chipText, filterStato === s && styles.chipTextActive]}>
                    {LEAD_STATUS_CONFIG[s].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Kit */}
            <Text style={styles.filterLabel}>Tipo Kit</Text>
            <View style={styles.chipRowWrap}>
              <TouchableOpacity
                style={[styles.chip, !filterKit && styles.chipActive]}
                onPress={() => setFilterKit(undefined)}
              >
                <Text style={[styles.chipText, !filterKit && styles.chipTextActive]}>Tutti</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, filterKit === '500' && styles.chipActive]}
                onPress={() => setFilterKit(filterKit === '500' ? undefined : '500')}
              >
                <Text style={[styles.chipText, filterKit === '500' && styles.chipTextActive]}>KIT 500</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, filterKit === '1000' && styles.chipActive]}
                onPress={() => setFilterKit(filterKit === '1000' ? undefined : '1000')}
              >
                <Text style={[styles.chipText, filterKit === '1000' && styles.chipTextActive]}>KIT 1000</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
                <Text style={styles.clearBtnText}>Pulisci filtri</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={() => setShowFilters(false)}>
                <Text style={styles.applyBtnText}>Applica</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Sort Modal */}
      <Modal visible={showSort} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowSort(false)}>
          <Pressable style={styles.sortModal} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Ordinamento</Text>
            {([
              { key: 'ragione_sociale', label: 'Ragione Sociale' },
              { key: 'comune', label: 'Comune' },
              { key: 'stato', label: 'Stato' },
              { key: 'data_installazione', label: 'Data Installazione' },
            ] as { key: SortKey; label: string }[]).map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sortOption, sortKey === opt.key && styles.sortOptionActive]}
                onPress={() => {
                  if (sortKey === opt.key) {
                    setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortKey(opt.key);
                    setSortDir('asc');
                  }
                  setShowSort(false);
                }}
              >
                <Text style={[styles.sortOptionText, sortKey === opt.key && styles.sortOptionTextActive]}>
                  {opt.label}
                </Text>
                {sortKey === opt.key && (
                  <Ionicons
                    name={sortDir === 'asc' ? 'arrow-up' : 'arrow-down'}
                    size={16}
                    color="#3B82F6"
                  />
                )}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937' },
  headerSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  refreshBtn: { padding: 8 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1F2937' },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtnActive: { backgroundColor: '#3B82F6' },
  filterCount: { position: 'absolute', top: 2, right: 2, fontSize: 10, color: '#FFFFFF', fontWeight: '700' },
  sortBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  colorBar: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  colorBarContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 6, flexDirection: 'row' },
  colorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    gap: 5,
  },
  colorChipActive: { backgroundColor: '#1E40AF' },
  colorChipDot: { width: 10, height: 10, borderRadius: 5 },
  colorChipText: { fontSize: 12, color: '#4B5563', fontWeight: '500' },
  colorChipTextActive: { color: '#FFFFFF' },

  listContent: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorDotText: { fontSize: 11, fontWeight: '700' },
  cardContent: { flex: 1 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#1F2937', marginBottom: 4 },
  cardMeta: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: '#6B7280' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: '600' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6B7280' },

  emptyContainer: { alignItems: 'center', marginTop: 80 },
  emptyText: { fontSize: 16, color: '#9CA3AF', marginTop: 12 },
  clearLink: { fontSize: 14, color: '#3B82F6', marginTop: 8, fontWeight: '500' },

  // Filter modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '80%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 16 },
  filterLabel: { fontSize: 13, fontWeight: '600', color: '#4B5563', marginTop: 12, marginBottom: 8 },
  chipRow: { marginBottom: 4 },
  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 6,
  },
  chipActive: { backgroundColor: '#1E40AF' },
  chipText: { fontSize: 13, color: '#4B5563', fontWeight: '500' },
  chipTextActive: { color: '#FFFFFF' },

  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  clearBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  clearBtnText: { fontSize: 15, fontWeight: '600', color: '#6B7280' },
  applyBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
  },
  applyBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },

  // Sort modal
  sortModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sortOptionActive: {},
  sortOptionText: { fontSize: 15, color: '#4B5563' },
  sortOptionTextActive: { color: '#1E40AF', fontWeight: '600' },
});
