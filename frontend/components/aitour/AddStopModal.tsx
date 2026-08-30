// Modale "Aggiungi tappa" a giro avviato (parità web AddStopDialog):
// ricerca punto vendita (clienti, prospect, orfani, tabaccherie libere) +
// posizionamento (Falla ORA / fascia oraria / dopo tappa X) + obbligatorietà.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DS, JAKARTA } from '../../lib/theme';
import { AI_PURPLE, AI_PURPLE_SOFT, AI_PURPLE_TEXT } from './shared';
import { loadCandidates, loadFreeTabaccherie } from '../../lib/aitour/data';
import { getVisitSlots, type VisitSlot, WEEKDAY_NAMES } from '../../lib/visit-slots';
import type { PlacementChoice } from '../../lib/aitour/liveops';
import type { TourCandidate, AiTourSettings } from '../../lib/aitour/types';
import { ENTITY_LABELS, ENTITY_TEXT_COLORS, haversineKm } from '../../lib/aitour/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  agentId: string;
  settings: AiTourSettings;
  center: { lat: number; lng: number };
  excludeCustomerIds: Set<string>;
  excludeTabIds: Set<string>;
  pendingStops: { id: string; name: string }[];
  saving: boolean;
  onConfirm: (cand: TourCandidate, placement: PlacementChoice, mandatory: boolean) => void;
}

const MODES: { id: 'now' | 'slot' | 'after'; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'now', label: 'Falla ORA', desc: 'Diventa la prossima tappa: le successive vengono ricalcolate', icon: 'flash' },
  { id: 'slot', label: 'Fascia oraria', desc: "L'AI la posiziona nel giro rispettando la fascia scelta", icon: 'time' },
  { id: 'after', label: 'Dopo una tappa', desc: 'Scegli dopo quale tappa del giro inserirla', icon: 'list' },
];

export function AddStopModal({ visible, onClose, agentId, settings, center, excludeCustomerIds, excludeTabIds, pendingStops, saving, onConfirm }: Props) {
  const [loading, setLoading] = useState(false);
  const [pool, setPool] = useState<TourCandidate[]>([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<TourCandidate | null>(null);
  const [mode, setMode] = useState<'now' | 'slot' | 'after'>('now');
  const [slotDefs, setSlotDefs] = useState<VisitSlot[]>([]);
  const [slotIds, setSlotIds] = useState<string[]>([]);
  const [afterId, setAfterId] = useState('');
  const [mandatory, setMandatory] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setSelected(null);
    setQ('');
    setMode('now');
    setSlotIds([]);
    setAfterId(pendingStops[0]?.id || '');
    setMandatory(true);
    setLoading(true);
    (async () => {
      try {
        const d = 0.35; // ~35 km attorno alla posizione
        const [cands, free, slots] = await Promise.all([
          loadCandidates(agentId, settings),
          loadFreeTabaccherie(
            { minLat: center.lat - d, maxLat: center.lat + d, minLng: center.lng - d, maxLng: center.lng + d },
            excludeTabIds, settings, { refLat: center.lat, refLng: center.lng, agentId }, 300,
          ).catch(() => [] as TourCandidate[]),
          getVisitSlots(),
        ]);
        const all = [...cands.clients, ...cands.prospects, ...cands.orphans, ...free];
        const seen = new Set<string>();
        setPool(all.filter((c) => {
          if (c.customerId && excludeCustomerIds.has(c.customerId)) return false;
          if (c.tabaccheriaId && excludeTabIds.has(c.tabaccheriaId)) return false;
          if (seen.has(c.key)) return false;
          seen.add(c.key);
          return true;
        }));
        setSlotDefs(slots);
      } catch (err) {
        console.error('[AITour][addstop] load:', err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const results = useMemo(() => {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = tokens.length === 0 ? pool : pool.filter((c) => {
      const hay = `${c.name} ${c.crmName || ''} ${c.city} ${c.address}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
    // Ordinamento per vicinanza alla posizione corrente
    const withDist = list.map((c) => ({ c, km: haversineKm(center.lat, center.lng, c.lat, c.lng) }));
    withDist.sort((a, b) => a.km - b.km);
    return { items: withDist.slice(0, 30), truncated: withDist.length > 30 };
  }, [pool, q, center.lat, center.lng]);

  const selectedKm = selected ? haversineKm(center.lat, center.lng, selected.lat, selected.lng) : 0;
  const nowM = new Date().getHours() * 60 + new Date().getMinutes();
  const todayDow = new Date().getDay() || 7;

  const canConfirm = !!selected && !saving
    && (mode !== 'slot' || slotIds.length > 0)
    && (mode !== 'after' || !!afterId);

  const handleConfirm = () => {
    if (!selected) return;
    const placement: PlacementChoice = mode === 'slot'
      ? { mode, slots: slotDefs.filter((s) => slotIds.includes(s.id)) }
      : mode === 'after' ? { mode, afterStopId: afterId } : { mode };
    onConfirm(selected, placement, mandatory);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <Ionicons name="add-circle" size={17} color={AI_PURPLE_TEXT} />
            <Text style={styles.title}>Aggiungi tappa al giro</Text>
          </View>

          {!selected ? (
            <>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={15} color={DS.inkMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={q}
                  onChangeText={setQ}
                  placeholder="Cerca per nome, città o indirizzo…"
                  placeholderTextColor={DS.inkMuted}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {q.length > 0 && (
                  <TouchableOpacity onPress={() => setQ('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={15} color={DS.inkMuted} />
                  </TouchableOpacity>
                )}
              </View>
              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator color={AI_PURPLE_TEXT} />
                  <Text style={styles.loadingText}>Carico i punti vendita…</Text>
                </View>
              ) : (
                <ScrollView style={styles.resultsList} keyboardShouldPersistTaps="handled">
                  {results.items.length === 0 && <Text style={styles.emptyText}>Nessun punto vendita trovato</Text>}
                  {results.items.map(({ c, km }) => (
                    <TouchableOpacity key={c.key} style={styles.resultRow} onPress={() => setSelected(c)} activeOpacity={0.7}>
                      <View style={styles.resultTop}>
                        <Text style={styles.resultName} numberOfLines={1}>{c.name}</Text>
                        <Text style={[styles.resultKm, km > 50 && { color: '#D97706', fontFamily: JAKARTA.semibold }]}>{km.toFixed(1)} km</Text>
                        <View style={[styles.entityBadge, { borderColor: ENTITY_TEXT_COLORS[c.entityType] }]}>
                          <Text style={[styles.entityBadgeText, { color: ENTITY_TEXT_COLORS[c.entityType] }]}>{ENTITY_LABELS[c.entityType]}</Text>
                        </View>
                      </View>
                      <Text style={styles.resultAddr} numberOfLines={1}>
                        {c.address}{c.city ? `, ${c.city}` : ''}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {results.truncated && <Text style={styles.truncatedText}>Mostrati i 30 più vicini: affina la ricerca per trovarne altri</Text>}
                </ScrollView>
              )}
            </>
          ) : (
            <ScrollView style={{ maxHeight: 480 }} keyboardShouldPersistTaps="handled">
              <View style={styles.selectedCard}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.resultName} numberOfLines={1}>{selected.name}</Text>
                  <Text style={styles.resultAddr} numberOfLines={1}>
                    {selected.address}{selected.city ? `, ${selected.city}` : ''}
                  </Text>
                </View>
                <TouchableOpacity style={styles.changeBtn} onPress={() => setSelected(null)} activeOpacity={0.7}>
                  <Ionicons name="arrow-back" size={12} color={DS.ink2} />
                  <Text style={styles.changeBtnText}>Cambia</Text>
                </TouchableOpacity>
              </View>

              {selectedKm > 50 && (
                <Text style={styles.farWarning}>
                  Attenzione: questo punto vendita è a ~{Math.round(selectedKm)} km dalla posizione attuale del giro.
                </Text>
              )}

              {Array.isArray(selected.excludedDays) && selected.excludedDays.includes(todayDow) && (
                <Text style={styles.excludedWarning}>
                  Attenzione: il cliente non riceve visite il {WEEKDAY_NAMES[todayDow]}.
                </Text>
              )}

              <Text style={styles.sectionLabel}>Quando inserirla nel giro?</Text>
              {MODES.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.modeBtn, mode === m.id && styles.modeBtnActive]}
                  onPress={() => setMode(m.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.modeTop}>
                    <Ionicons name={m.icon} size={14} color={mode === m.id ? AI_PURPLE_TEXT : DS.inkMuted} />
                    <Text style={[styles.modeLabel, mode === m.id && { color: AI_PURPLE_TEXT }]}>{m.label}</Text>
                  </View>
                  <Text style={styles.modeDesc}>{m.desc}</Text>
                </TouchableOpacity>
              ))}

              {mode === 'slot' && (
                <>
                  <Text style={styles.sectionLabel}>Fascia oraria preferenziale</Text>
                  <View style={styles.slotRow}>
                    {slotDefs.map((s) => {
                      const past = s.end <= nowM;
                      const active = slotIds.includes(s.id);
                      return (
                        <TouchableOpacity
                          key={s.id}
                          disabled={past}
                          style={[styles.slotChip, past && styles.slotChipPast, active && styles.slotChipActive]}
                          onPress={() => setSlotIds((prev) => (prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]))}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.slotChipText, past && styles.slotChipTextPast, active && styles.slotChipTextActive]}>{s.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {mode === 'after' && (
                <>
                  <Text style={styles.sectionLabel}>Dopo quale tappa?</Text>
                  <View style={styles.afterList}>
                    {pendingStops.map((p, i) => {
                      const active = afterId === p.id;
                      return (
                        <TouchableOpacity key={p.id} style={[styles.afterRow, active && styles.afterRowActive]} onPress={() => setAfterId(p.id)} activeOpacity={0.7}>
                          <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={15} color={active ? AI_PURPLE_TEXT : DS.inkMuted} />
                          <Text style={[styles.afterText, active && { color: DS.ink, fontFamily: JAKARTA.semibold }]} numberOfLines={1}>
                            {i + 1}. {p.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              <View style={styles.mandRow}>
                <Text style={styles.mandLabel}>Tappa obbligatoria (il ricalcolo AI non potrà rimuoverla)</Text>
                <Switch value={mandatory} onValueChange={setMandatory} trackColor={{ true: AI_PURPLE }} />
              </View>
            </ScrollView>
          )}

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Annulla</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, !canConfirm && { opacity: 0.5 }]}
              onPress={handleConfirm}
              disabled={!canConfirm}
              activeOpacity={0.7}
            >
              {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.confirmText}>Aggiungi al giro</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: DS.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28, maxHeight: '92%' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  title: { fontFamily: JAKARTA.bold, fontSize: 16, color: DS.ink },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 11, paddingVertical: 9,
    backgroundColor: DS.surface2, borderRadius: 10, borderWidth: 1, borderColor: DS.border,
  },
  searchInput: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 13, color: DS.ink, padding: 0 },
  loadingBox: { alignItems: 'center', paddingVertical: 30, gap: 8 },
  loadingText: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.inkMuted },
  resultsList: { maxHeight: 380, marginTop: 8 },
  emptyText: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.inkMuted, textAlign: 'center', paddingVertical: 20 },
  resultRow: {
    borderWidth: 1, borderColor: DS.border, borderRadius: 9,
    paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6,
  },
  resultTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultName: { flex: 1, fontFamily: JAKARTA.semibold, fontSize: 12.5, color: DS.ink },
  resultKm: { fontFamily: JAKARTA.regular, fontSize: 10, color: DS.inkMuted },
  entityBadge: { borderWidth: 1, borderRadius: 5, paddingVertical: 1, paddingHorizontal: 5 },
  entityBadgeText: { fontFamily: JAKARTA.semibold, fontSize: 8.5 },
  resultAddr: { fontFamily: JAKARTA.regular, fontSize: 10.5, color: DS.inkMuted, marginTop: 2 },
  truncatedText: { fontFamily: JAKARTA.regular, fontSize: 10, color: DS.inkMuted, textAlign: 'center', paddingVertical: 6 },
  selectedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: DS.surface2, borderWidth: 1, borderColor: DS.border,
    borderRadius: 9, paddingVertical: 8, paddingHorizontal: 10,
  },
  changeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingVertical: 4, paddingHorizontal: 7 },
  changeBtnText: { fontFamily: JAKARTA.semibold, fontSize: 11, color: DS.ink2 },
  farWarning: {
    fontFamily: JAKARTA.medium, fontSize: 11, color: '#92400E',
    backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 8, padding: 8, marginTop: 8, lineHeight: 15,
  },
  excludedWarning: {
    fontFamily: JAKARTA.medium, fontSize: 11, color: '#991B1B',
    backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FECACA',
    borderRadius: 8, padding: 8, marginTop: 8, lineHeight: 15,
  },
  sectionLabel: { fontFamily: JAKARTA.semibold, fontSize: 11, color: DS.ink2, marginTop: 12, marginBottom: 6 },
  modeBtn: {
    borderWidth: 1, borderColor: DS.border, borderRadius: 9,
    paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6,
  },
  modeBtnActive: { borderColor: AI_PURPLE, backgroundColor: AI_PURPLE_SOFT },
  modeTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeLabel: { fontFamily: JAKARTA.semibold, fontSize: 12.5, color: DS.ink },
  modeDesc: { fontFamily: JAKARTA.regular, fontSize: 10.5, color: DS.inkMuted, marginTop: 2 },
  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  slotChip: { borderWidth: 1, borderColor: DS.border, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 11, backgroundColor: DS.surface },
  slotChipActive: { backgroundColor: AI_PURPLE, borderColor: AI_PURPLE },
  slotChipPast: { backgroundColor: DS.surface2, borderColor: DS.border, opacity: 0.5 },
  slotChipText: { fontFamily: JAKARTA.medium, fontSize: 11, color: DS.ink2 },
  slotChipTextActive: { color: '#FFF' },
  slotChipTextPast: { textDecorationLine: 'line-through' },
  afterList: { gap: 4 },
  afterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: DS.border, borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 10,
  },
  afterRowActive: { borderColor: AI_PURPLE, backgroundColor: AI_PURPLE_SOFT },
  afterText: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink2 },
  mandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  mandLabel: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 11.5, color: DS.ink2, lineHeight: 15 },
  footer: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: DS.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontFamily: JAKARTA.semibold, fontSize: 13, color: DS.ink2 },
  confirmBtn: { flex: 2, backgroundColor: '#7C3AED', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  confirmText: { fontFamily: JAKARTA.bold, fontSize: 13, color: '#FFF' },
});
