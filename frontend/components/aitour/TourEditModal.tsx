// Pannello MODIFICA GIRO (parità web TourEditPanel): riordina, rimuovi, aggiungi
// visite (anche obbligatorie con stella rossa) e ricalcola con AI o applica la
// sequenza manuale. Le tappe di tour salvati assenti dal pool usano i candidati del piano.
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DS, JAKARTA } from '../../lib/theme';
import { hap } from '../../lib/haptics';
import type { TourPlan, TourCandidate } from '../../lib/aitour/types';
import { ENTITY_LABELS, ENTITY_COLORS } from '../../lib/aitour/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  plan: TourPlan;
  allCandidates: TourCandidate[];
  onRecalc: (keys: string[], mandatoryKeys: Set<string>, fixedOrder: boolean) => void;
  recalcing: boolean;
}

export function TourEditModal({ visible, onClose, plan, allCandidates, onRecalc, recalcing }: Props) {
  const insets = useSafeAreaInsets();
  const [keys, setKeys] = useState<string[]>([]);
  const [mandatory, setMandatory] = useState<Set<string>>(new Set());
  const [orderTouched, setOrderTouched] = useState(false);
  const [search, setSearch] = useState('');

  // Reinizializza lo stato all'apertura (il piano può essere cambiato nel frattempo)
  useEffect(() => {
    if (visible) {
      setKeys(plan.stops.map((s) => s.candidate.key));
      setMandatory(new Set(plan.stops.filter((s) => s.mandatory).map((s) => s.candidate.key)));
      setOrderTouched(false);
      setSearch('');
    }
  }, [visible, plan]);

  const byKey = useMemo(() => {
    const m = new Map(allCandidates.map((c) => [c.key, c]));
    // Tappe di tour salvati possono avere chiavi assenti dal pool: usa i candidati del piano
    for (const s of plan.stops) if (!m.has(s.candidate.key)) m.set(s.candidate.key, s.candidate);
    return m;
  }, [allCandidates, plan.stops]);

  const available = useMemo(() => {
    const inTour = new Set(keys);
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return allCandidates
      .filter((c) => !inTour.has(c.key))
      .filter((c) => {
        if (tokens.length === 0) return true;
        const hay = `${c.name} ${c.crmName || ''} ${c.city || ''} ${c.address || ''}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [allCandidates, keys, search]);

  const move = (i: number, dir: -1 | 1) => {
    const next = [...keys];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setKeys(next);
    setOrderTouched(true);
    hap.light();
  };

  const remove = (key: string) => {
    hap.light();
    setKeys(keys.filter((k) => k !== key));
    setMandatory((m) => {
      const n = new Set(m);
      n.delete(key);
      return n;
    });
  };

  const add = (key: string, asMandatory = false) => {
    hap.light();
    setKeys([...keys, key]);
    if (asMandatory) setMandatory((m) => new Set(m).add(key));
    setOrderTouched(true);
  };

  const toggleMand = (key: string) => {
    hap.light();
    setMandatory((m) => {
      const n = new Set(m);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.root, { paddingTop: insets.top }]} testID="aitour-edit-panel">
        <View style={styles.header}>
          <Text style={styles.title}>Modifica giro</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} testID="aitour-edit-close">
            <Ionicons name="close" size={22} color={DS.ink} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.hint}>Visite nel giro ({keys.length}): riordina, rimuovi o rendi obbligatorie, poi ricalcola.</Text>

          {keys.map((key, i) => {
            const c = byKey.get(key);
            if (!c) return null;
            return (
              <View key={key} style={styles.stopRow} testID={`aitour-edit-stop-${i + 1}`}>
                <View style={[styles.seqDot, { backgroundColor: ENTITY_COLORS[c.entityType] }]}>
                  <Text style={styles.seqDotText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.stopName} numberOfLines={1}>{c.name}</Text>
                  <Text style={styles.stopSub} numberOfLines={1}>
                    {ENTITY_LABELS[c.entityType]} · {c.score}/100 · {c.city}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => toggleMand(key)} hitSlop={6} style={styles.iconBtn} testID={`aitour-edit-mandatory-${i + 1}`}>
                  <Ionicons name={mandatory.has(key) ? 'star' : 'star-outline'} size={17} color={mandatory.has(key) ? '#DC2626' : DS.inkMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => move(i, -1)} disabled={i === 0} hitSlop={6} style={styles.iconBtn} testID={`aitour-edit-up-${i + 1}`}>
                  <Ionicons name="arrow-up" size={16} color={i === 0 ? DS.border : DS.ink2} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => move(i, 1)} disabled={i === keys.length - 1} hitSlop={6} style={styles.iconBtn} testID={`aitour-edit-down-${i + 1}`}>
                  <Ionicons name="arrow-down" size={16} color={i === keys.length - 1 ? DS.border : DS.ink2} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(key)} hitSlop={6} style={styles.iconBtn} testID={`aitour-edit-remove-${i + 1}`}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            );
          })}

          <Text style={styles.sectionTitle}>Aggiungi visita (anche obbligatoria)</Text>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={15} color={DS.inkMuted} style={{ marginLeft: 10 }} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Cerca per nome, indirizzo o città..."
              placeholderTextColor={DS.inkMuted}
              testID="aitour-edit-search"
            />
          </View>
          {allCandidates.length === 0 ? (
            <Text style={styles.emptyText}>Nessun candidato disponibile</Text>
          ) : (
            available.map((c) => (
              <View key={c.key} style={styles.availRow}>
                <View style={[styles.entityBadge, { borderColor: ENTITY_COLORS[c.entityType] }]}>
                  <Text style={[styles.entityBadgeText, { color: ENTITY_COLORS[c.entityType] }]}>{ENTITY_LABELS[c.entityType]}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.stopName} numberOfLines={1}>{c.name}</Text>
                  <Text style={styles.stopSub} numberOfLines={1}>
                    {c.score}/100 · {[c.address, c.city].filter(Boolean).join(', ')}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => add(c.key, true)} hitSlop={6} style={styles.iconBtn} testID={`aitour-edit-add-mandatory-${c.key}`}>
                  <Ionicons name="star" size={18} color="#DC2626" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => add(c.key)} hitSlop={6} style={styles.iconBtn} testID={`aitour-edit-add-${c.key}`}>
                  <Ionicons name="add-circle" size={20} color="#059669" />
                </TouchableOpacity>
              </View>
            ))
          )}
          <Text style={styles.footNote}>
            Stella rossa = tappa obbligatoria (il ricalcolo AI non potrà rimuoverla). Dopo l&apos;aggiunta premi RICALCOLA CON AI per inserirla nel giro.
          </Text>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            style={[styles.recalcBtn, (recalcing || keys.length === 0) && { opacity: 0.5 }]}
            onPress={() => onRecalc(keys, mandatory, false)}
            disabled={recalcing || keys.length === 0}
            activeOpacity={0.8}
            testID="aitour-recalc-ai-btn"
          >
            {recalcing ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="sparkles" size={15} color="#FFF" />}
            <Text style={styles.recalcBtnText}>RICALCOLA CON AI (ordine ottimale)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.applyBtn, (recalcing || keys.length === 0 || !orderTouched) && { opacity: 0.5 }]}
            onPress={() => onRecalc(keys, mandatory, true)}
            disabled={recalcing || keys.length === 0 || !orderTouched}
            activeOpacity={0.8}
            testID="aitour-apply-order-btn"
          >
            <Text style={styles.applyBtnText}>Applica questa sequenza manuale</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DS.surface2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  title: { fontFamily: JAKARTA.bold, fontSize: 16, color: DS.ink },
  hint: { fontFamily: JAKARTA.medium, fontSize: 11, color: DS.inkMuted, marginBottom: 10 },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 8,
    marginBottom: 6,
    backgroundColor: DS.surface,
  },
  seqDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  seqDotText: { fontFamily: JAKARTA.bold, fontSize: 10, color: '#FFF' },
  stopName: { fontFamily: JAKARTA.semibold, fontSize: 12.5, color: DS.ink },
  stopSub: { fontFamily: JAKARTA.medium, fontSize: 10.5, color: DS.inkMuted, marginTop: 1 },
  iconBtn: { padding: 5 },
  sectionTitle: { fontFamily: JAKARTA.bold, fontSize: 12, color: DS.ink2, marginTop: 14, marginBottom: 6 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 10,
    backgroundColor: DS.surface,
    marginBottom: 8,
  },
  searchInput: { flex: 1, paddingVertical: 9, paddingHorizontal: 8, fontFamily: JAKARTA.medium, fontSize: 12.5, color: DS.ink },
  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: DS.border,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  entityBadge: { borderWidth: 1, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  entityBadgeText: { fontFamily: JAKARTA.bold, fontSize: 8.5 },
  emptyText: { fontFamily: JAKARTA.medium, fontSize: 11, color: DS.inkMuted, paddingVertical: 8 },
  footNote: { fontFamily: JAKARTA.medium, fontSize: 10, color: DS.inkMuted, marginTop: 6, lineHeight: 14 },
  footer: { paddingHorizontal: 14, paddingTop: 10, gap: 8, borderTopWidth: 1, borderTopColor: DS.border, backgroundColor: DS.surface2 },
  recalcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 13,
  },
  recalcBtnText: { fontFamily: JAKARTA.bold, fontSize: 12.5, color: '#FFF' },
  applyBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 12,
    paddingVertical: 12,
  },
  applyBtnText: { fontFamily: JAKARTA.semibold, fontSize: 12.5, color: DS.ink },
});
