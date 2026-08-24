// Agg. Massivo — assegnazione massiva della fascia oraria visite preferita (parità web BulkVisitSlots).
// L'agente vede i SUOI clienti (di default quelli senza fascia), li seleziona con ricerca fuzzy
// e assegna le fasce con la ruota grafica.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { getVisitSlots, slotsFromIds, type VisitSlot } from '../lib/visit-slots';
import { VisitSlotWheel } from '../components/customers/VisitSlotWheel';
import { ExcludedDaysPicker } from '../components/customers/ExcludedDaysPicker';
import { openNavigation } from '../components/aitour/shared';
import { DS, JAKARTA } from '../lib/theme';

interface CustomerRow {
  id: string;
  business_name: string;
  contact_name: string | null;
  contact_surname: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  preferred_visit_slots: unknown;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Match fuzzy: ogni token della query deve comparire come sottostringa
// oppure come sottosequenza ordinata nel testo del cliente
function fuzzyMatch(query: string, haystack: string): boolean {
  const h = norm(haystack);
  return norm(query).split(/\s+/).filter(Boolean).every((tok) => {
    if (h.includes(tok)) return true;
    if (tok.length < 4) return false;
    let i = 0;
    for (const ch of h) {
      if (ch === tok[i]) i++;
      if (i === tok.length) return true;
    }
    return false;
  });
}

export default function BulkVisitSlotsScreen() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<'senza' | 'tutti'>('senza');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<string[]>([]);
  const [excludedDays, setExcludedDays] = useState<number[]>([]);
  const [slotDefs, setSlotDefs] = useState<VisitSlot[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth?.user?.id;
      if (!uid) return;
      const rows: CustomerRow[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('customers')
          .select('id, business_name, contact_name, contact_surname, address, city, latitude, longitude, preferred_visit_slots')
          .eq('agent_id', uid)
          .order('business_name')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...((data || []) as CustomerRow[]));
        if (!data || data.length < PAGE) break;
      }
      setCustomers(rows);
    } catch (err) {
      console.error('[BulkVisitSlots] load:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    getVisitSlots().then(setSlotDefs);
  }, [load]);

  const withoutSlots = useMemo(
    () => customers.filter((c) => !Array.isArray(c.preferred_visit_slots) || c.preferred_visit_slots.length === 0),
    [customers]
  );

  const visible = useMemo(() => {
    const base = scope === 'senza' ? withoutSlots : customers;
    const q = search.trim();
    if (!q) return base;
    return base.filter((c) =>
      fuzzyMatch(q, `${c.business_name} ${c.contact_name || ''} ${c.contact_surname || ''} ${c.city || ''} ${c.address || ''}`)
    );
  }, [customers, withoutSlots, scope, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const allSelected = visible.length > 0 && visible.every((c) => prev.has(c.id));
      if (allSelected) return new Set();
      return new Set(visible.map((c) => c.id));
    });
  };

  const save = async () => {
    if (selectedIds.size === 0 || slots.length === 0) return;
    setSaving(true);
    try {
      const ids = [...selectedIds];
      const payload: { preferred_visit_slots: string[]; excluded_visit_days?: number[] } = { preferred_visit_slots: slots };
      if (excludedDays.length > 0) payload.excluded_visit_days = excludedDays;
      for (let i = 0; i < ids.length; i += 200) {
        const batch = ids.slice(i, i + 200);
        const { error } = await supabase
          .from('customers')
          .update(payload)
          .in('id', batch);
        if (error) throw error;
      }
      Alert.alert('Preferenze assegnate', `Preferenze salvate su ${ids.length} clienti.`);
      setSelectedIds(new Set());
      setSlots([]);
      setExcludedDays([]);
      await load();
    } catch (err) {
      console.error('[BulkVisitSlots] save:', err);
      Alert.alert('Errore', 'Salvataggio non riuscito. Riprova.');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }: { item: CustomerRow }) => {
    const sel = selectedIds.has(item.id);
    const existing = slotsFromIds(item.preferred_visit_slots, slotDefs);
    return (
      <TouchableOpacity style={[styles.row, sel && styles.rowSelected]} onPress={() => toggleSelect(item.id)} activeOpacity={0.7}>
        <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={20} color={sel ? '#7C3AED' : DS.inkMuted} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName} numberOfLines={1}>{item.business_name}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>
            {[item.address, item.city].filter(Boolean).join(', ') || '—'}
          </Text>
          {existing.length > 0 && (
            <Text style={styles.rowSlots} numberOfLines={1}>
              Fascia attuale: {existing.map((s) => s.label).join(', ')}
            </Text>
          )}
        </View>
        {item.latitude != null && item.longitude != null && (
          <TouchableOpacity
            style={styles.mapBtn}
            onPress={() => openNavigation(Number(item.latitude), Number(item.longitude), item.business_name)}
            activeOpacity={0.7}
          >
            <Ionicons name="location-outline" size={17} color="#7C3AED" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const allVisibleSelected = visible.length > 0 && visible.every((c) => selectedIds.has(c.id));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={DS.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Agg. Massivo</Text>
          <Text style={styles.headerSub}>Fascia oraria visite preferita</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={17} color={DS.inkMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca cliente (anche fuzzy)…"
          placeholderTextColor={DS.inkMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={17} color={DS.inkMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.scopeRow}>
        <TouchableOpacity
          style={[styles.scopeChip, scope === 'senza' && styles.scopeChipActive]}
          onPress={() => setScope('senza')}
          activeOpacity={0.7}
        >
          <Text style={[styles.scopeText, scope === 'senza' && styles.scopeTextActive]}>Senza fascia ({withoutSlots.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.scopeChip, scope === 'tutti' && styles.scopeChipActive]}
          onPress={() => setScope('tutti')}
          activeOpacity={0.7}
        >
          <Text style={[styles.scopeText, scope === 'tutti' && styles.scopeTextActive]}>Tutti ({customers.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.selectAllBtn} onPress={selectAllVisible} activeOpacity={0.7}>
          <Text style={styles.selectAllText}>{allVisibleSelected ? 'Deseleziona' : 'Seleziona tutti'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#7C3AED" /></View>
      ) : (
        <FlatList
          data={visible}
          renderItem={renderItem}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: 12 }}
          ListEmptyComponent={<Text style={styles.empty}>Nessun cliente {scope === 'senza' ? 'senza fascia' : ''} trovato.</Text>}
        />
      )}

      <View style={styles.footer}>
        <VisitSlotWheel value={slots} onChange={setSlots} size={150} />
        <View style={{ flex: 1, gap: 8 }}>
          <ExcludedDaysPicker value={excludedDays} onChange={setExcludedDays} showLabel={false} />
          <Text style={styles.footerInfo}>
            {selectedIds.size} clienti selezionati{slots.length > 0 ? ` · ${slots.length} fasce scelte` : ''}{excludedDays.length > 0 ? ` · ${excludedDays.length} giorn${excludedDays.length === 1 ? 'o' : 'i'} esclus${excludedDays.length === 1 ? 'o' : 'i'}` : ''}
          </Text>
          <TouchableOpacity
            style={[styles.saveBtn, (selectedIds.size === 0 || slots.length === 0 || saving) && { opacity: 0.5 }]}
            onPress={save}
            disabled={selectedIds.size === 0 || slots.length === 0 || saving}
            activeOpacity={0.75}
          >
            {saving ? <ActivityIndicator size="small" color="#FFF" /> : (
              <>
                <Ionicons name="time-outline" size={15} color="#FFF" />
                <Text style={styles.saveText}>Assegna fascia</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.surface2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 10 },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: JAKARTA.bold, fontSize: 18, color: DS.ink },
  headerSub: { fontFamily: JAKARTA.medium, fontSize: 11.5, color: DS.inkMuted },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    marginHorizontal: 12, paddingHorizontal: 11, paddingVertical: 9,
    backgroundColor: DS.surface, borderRadius: 10, borderWidth: 1, borderColor: DS.border,
  },
  searchInput: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 13.5, color: DS.ink, padding: 0 },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginHorizontal: 12, marginTop: 9, marginBottom: 5 },
  scopeChip: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: DS.surface, borderWidth: 1, borderColor: DS.border,
  },
  scopeChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  scopeText: { fontFamily: JAKARTA.semibold, fontSize: 11.5, color: DS.ink2 },
  scopeTextActive: { color: '#FFF' },
  selectAllBtn: { marginLeft: 'auto', paddingVertical: 6, paddingHorizontal: 4 },
  selectAllText: { fontFamily: JAKARTA.semibold, fontSize: 11.5, color: '#7C3AED' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: JAKARTA.medium, fontSize: 12.5, color: DS.inkMuted, textAlign: 'center', marginTop: 30 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 12, marginTop: 7, padding: 11,
    backgroundColor: DS.surface, borderRadius: 10, borderWidth: 1, borderColor: DS.border,
  },
  rowSelected: { borderColor: '#7C3AED' },
  rowName: { fontFamily: JAKARTA.semibold, fontSize: 13.5, color: DS.ink },
  rowSub: { fontFamily: JAKARTA.regular, fontSize: 11.5, color: DS.inkMuted, marginTop: 1 },
  rowSlots: { fontFamily: JAKARTA.medium, fontSize: 10.5, color: '#B45309', marginTop: 2 },
  mapBtn: { padding: 6, borderRadius: 8, backgroundColor: DS.surface2 },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: DS.border, backgroundColor: DS.surface,
  },
  footerInfo: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink2 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#7C3AED', borderRadius: 10, paddingVertical: 11,
  },
  saveText: { fontFamily: JAKARTA.bold, fontSize: 13.5, color: '#FFF' },
});
