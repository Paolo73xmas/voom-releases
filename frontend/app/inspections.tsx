// Elenco ispezioni eseguite dall'agente (ognuno vede solo le proprie, come il gestionale web):
// ricerca su cliente/note, filtro per intervallo date, dettaglio con foto.
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { fetchAgentInspectionPage, getInspectionStatusLabel, type AgentInspection } from '../lib/api/inspections';
import { usePagedHistory } from '../hooks/usePagedHistory';
import { useDebounce } from '../hooks/useDebounce';
import { HistoryFooter, ReadErrorNotice } from '../components/HistoryFeedback';
import { DS, JAKARTA } from '../lib/theme';
import { hap } from '../lib/haptics';

const PRESETS = [
  { key: '7', label: '7 giorni', days: 7 },
  { key: '30', label: '30 giorni', days: 30 },
  { key: '90', label: '3 mesi', days: 90 },
  { key: 'all', label: 'Tutte', days: null },
] as const;

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function InspectionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [preset, setPreset] = useState<typeof PRESETS[number]['key']>('30');
  const query = useDebounce(search.trim(), 300);
  const days = PRESETS.find(p => p.key === preset)?.days ?? null;
  const dateFrom = days ? isoDay(new Date(Date.now() - days * 86400000)) : undefined;
  const history = usePagedHistory(user ? `${user.id}:${dateFrom || 'all'}:${query}` : '',
    offset => fetchAgentInspectionPage(user!.id, { dateFrom, search: query, offset }));
  const { rows: filtered, loading, refreshing, error, count } = history;

  const renderItem = ({ item }: { item: AgentInspection }) => {
    const d = new Date(item.inspection_date);
    return (
      <TouchableOpacity
        testID={`inspection-row-${item.id}`}
        style={styles.card}
        activeOpacity={0.75}
        onPress={() => { hap.light(); router.push(`/inspection/${item.id}`); }}
      >
        <View style={styles.cardTop}>
          <Text testID={`inspection-row-${item.id}-date`} style={styles.date}>
            {d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' })} · {d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <View style={styles.photoChip}>
            <Ionicons name="images-outline" size={13} color={DS.ink2} />
            <Text testID={`inspection-row-${item.id}-photos`} style={styles.photoChipText}>{item.photoCount}</Text>
          </View>
        </View>
        <Text testID={`inspection-row-${item.id}-customer`} style={styles.name} numberOfLines={1}>{item.customerName}</Text>
        {!!item.customerCity && <Text testID={`inspection-row-${item.id}-city`} style={styles.city} numberOfLines={1}>{item.customerCity}</Text>}
        {item.notes ? (
          <Text testID={`inspection-row-${item.id}-notes`} style={styles.notes} numberOfLines={3}>{item.notes}</Text>
        ) : (
          <Text style={styles.notesEmpty}>Nessuna nota</Text>
        )}
        <Text style={styles.status}>{getInspectionStatusLabel(item.status)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity testID="inspections-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={DS.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Ispezioni</Text>
        <TouchableOpacity testID="inspections-new" onPress={() => { hap.light(); router.push('/inspection/new'); }} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="add" size={24} color={DS.brand} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color={DS.inkMuted} />
        <TextInput
          testID="inspections-search"
          style={styles.searchInput}
          placeholder="Cliente, città o note"
          placeholderTextColor={DS.inkMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
        />
        {!!search && (
          <TouchableOpacity testID="inspections-search-clear" onPress={() => setSearch('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={DS.inkMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.presetRow}>
        {PRESETS.map((p) => (
          <TouchableOpacity
            key={p.key}
            testID={`inspections-preset-${p.key}`}
            accessibilityRole="button"
            accessibilityState={{ selected: preset === p.key }}
            style={[styles.preset, preset === p.key && styles.presetOn]}
            onPress={() => { hap.light(); setPreset(p.key); }}
            activeOpacity={0.8}
          >
            <Text style={[styles.presetText, preset === p.key && styles.presetTextOn]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text testID="inspections-count" style={styles.count}>
        {loading ? 'Caricamento...' : error && !filtered.length ? 'Conteggio non disponibile' : `${count} ${count === 1 ? 'ispezione' : 'ispezioni'}`}
      </Text>
      <ReadErrorNotice id="inspections" message={error} onRetry={history.retry} busy={refreshing || history.loadingMore} />

      {loading ? (
        <ActivityIndicator style={styles.loader} color={DS.brand} />
      ) : (
        <FlatList
          testID="inspections-list"
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 32 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={history.refresh} tintColor={DS.brand} />}
          ListFooterComponent={!error ? <HistoryFooter id="inspections" loaded={filtered.length} count={count} hasMore={history.hasMore} busy={history.loadingMore} onMore={history.loadMore} /> : null}
          ListEmptyComponent={
            !error ? <View style={styles.empty}>
              <Ionicons name="clipboard-outline" size={32} color={DS.borderStrong} />
              <Text testID="inspections-empty" style={styles.emptyText}>
                {search ? 'Nessuna ispezione trovata con questa ricerca' : 'Nessuna ispezione nel periodo selezionato'}
              </Text>
            </View> : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DS.surface2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  backBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: JAKARTA.bold, fontSize: 18, color: DS.ink },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, paddingHorizontal: 12, height: 44, borderRadius: 12, backgroundColor: DS.surface, borderWidth: 1, borderColor: DS.border },
  searchInput: { flex: 1, fontFamily: JAKARTA.regular, fontSize: 14, color: DS.ink, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : null) },
  presetRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginTop: 12 },
  preset: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: DS.border, backgroundColor: DS.surface },
  presetOn: { backgroundColor: DS.brand, borderColor: DS.brand },
  presetText: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink2 },
  presetTextOn: { color: '#FFF' },
  count: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.inkMuted, paddingHorizontal: 16, marginTop: 12 },
  error: { fontFamily: JAKARTA.medium, fontSize: 13, color: DS.error, paddingHorizontal: 16, marginTop: 6 },
  loader: { marginTop: 32 },
  listContent: { padding: 16, gap: 12 },
  card: { backgroundColor: DS.surface, borderRadius: 16, borderWidth: 1, borderColor: DS.border, padding: 14, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { fontFamily: JAKARTA.semibold, fontSize: 12, color: DS.brand },
  photoChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: DS.surface2 },
  photoChipText: { fontFamily: JAKARTA.semibold, fontSize: 12, color: DS.ink2 },
  name: { fontFamily: JAKARTA.bold, fontSize: 15, color: DS.ink },
  city: { fontFamily: JAKARTA.regular, fontSize: 12, color: DS.ink2 },
  notes: { fontFamily: JAKARTA.regular, fontSize: 13, color: DS.ink, marginTop: 4, lineHeight: 19 },
  notesEmpty: { fontFamily: JAKARTA.regular, fontSize: 13, color: DS.inkMuted, marginTop: 4, fontStyle: 'italic' },
  status: { fontFamily: JAKARTA.medium, fontSize: 11, color: DS.inkMuted, marginTop: 6 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 48 },
  emptyText: { fontFamily: JAKARTA.medium, fontSize: 13, color: DS.inkMuted, textAlign: 'center', paddingHorizontal: 32 },
});
