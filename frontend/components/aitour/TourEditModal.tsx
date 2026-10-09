// Pannello MODIFICA GIRO (parità web TourEditPanel): riordina, rimuovi, aggiungi
// visite (anche obbligatorie con stella rossa) e ricalcola con AI o applica la
// sequenza manuale. Le tappe di tour salvati assenti dal pool usano i candidati del piano.
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DS, JAKARTA } from '../../lib/theme';
import { hap } from '../../lib/haptics';
import type { TourPlan, TourCandidate } from '../../lib/aitour/types';
import { ENTITY_LABELS, ENTITY_COLORS } from '../../lib/aitour/types';
import { editOutsideReason, editAreaConsentKey, sameEditSubject, type EditAreaConsents } from '../../lib/aitour/edit-plan';
import { AI_PURPLE, AI_PURPLE_SOFT, AI_PURPLE_TEXT } from './shared';
import { LastOrderInfo } from './LastOrderInfo';
import { useTourLastOrders } from '../../hooks/useTourLastOrders';

interface Props {
  visible: boolean;
  onClose: () => void;
  plan: TourPlan;
  allCandidates: TourCandidate[];
  onRecalc: (keys: string[], mandatoryKeys: Set<string>, fixedOrder: boolean, consents?: EditAreaConsents) => void;
  recalcing: boolean;
  errorMsg?: string;
  onDraftChange?: () => void;
}

export function TourEditModal({ visible, onClose, plan, allCandidates, onRecalc, recalcing, errorMsg, onDraftChange }: Props) {
  const insets = useSafeAreaInsets();
  const [keys, setKeys] = useState<string[]>([]);
  const [mandatory, setMandatory] = useState<Set<string>>(new Set());
  const [orderTouched, setOrderTouched] = useState(false);
  const [search, setSearch] = useState('');
  const [consents, setConsents] = useState<EditAreaConsents>({});

  // Reinizializza lo stato all'apertura (il piano può essere cambiato nel frattempo)
  useEffect(() => {
    if (visible) {
      setKeys(plan.stops.map((s) => s.candidate.key));
      setMandatory(new Set(plan.stops.filter((s) => s.mandatory).map((s) => s.candidate.key)));
      setOrderTouched(false);
      setSearch('');
      setConsents({});
    }
  }, [visible, plan]);

  const byKey = useMemo(() => {
    const m = new Map(allCandidates.map((c) => [c.key, c]));
    // Tappe di tour salvati possono avere chiavi assenti dal pool: usa i candidati del piano
    for (const s of plan.stops) m.set(s.candidate.key, s.candidate);
    return m;
  }, [allCandidates, plan.stops]);
  // Ultimo acquisto delle visite nel giro (web TourEditPanel @ 2eea993): caricato solo a pannello aperto.
  const orders = useTourLastOrders(keys.flatMap((key) => (byKey.has(key) ? [byKey.get(key)!] : [])), visible);

  const available = useMemo(() => {
    const inTour = new Set(keys);
    const selected = keys.map((key) => byKey.get(key)).filter((c): c is TourCandidate => !!c);
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return allCandidates
      .filter((c) => !inTour.has(c.key) && !selected.some((other) => sameEditSubject(c, other)))
      .filter((c) => {
        if (tokens.length === 0) return true;
        const hay = `${c.name} ${c.crmName || ''} ${c.city || ''} ${c.address || ''}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [allCandidates, keys, search, byKey]);

  const move = (i: number, dir: -1 | 1) => {
    if (recalcing) return;
    const next = [...keys];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setKeys(next);
    setOrderTouched(true);
    onDraftChange?.();
    hap.light();
  };

  const remove = (key: string) => {
    if (recalcing) return;
    hap.light();
    setKeys(keys.filter((k) => k !== key));
    setOrderTouched(true);
    setConsents((old) => { const next = { ...old }; delete next[key]; return next; });
    onDraftChange?.();
    setMandatory((m) => {
      const n = new Set(m);
      n.delete(key);
      return n;
    });
  };

  const add = (key: string, asMandatory = false) => {
    if (recalcing) return;
    hap.light();
    setKeys((current) => current.includes(key) ? current : [...current, key]);
    if (asMandatory) setMandatory((m) => new Set(m).add(key));
    setOrderTouched(true);
    onDraftChange?.();
  };

  const toggleMand = (key: string) => {
    if (recalcing) return;
    hap.light();
    setMandatory((m) => {
      const n = new Set(m);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
    setOrderTouched(true);
    onDraftChange?.();
  };

  return (
    <Modal testID="aitour-edit-modal" visible={visible} animationType="slide" onRequestClose={() => { if (!recalcing) onClose(); }}>
      <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} testID="aitour-edit-panel">
        <View style={styles.header}>
          <Text testID="aitour-edit-title" style={styles.title}>Modifica giro</Text>
          <TouchableOpacity onPress={onClose} disabled={recalcing} style={styles.iconBtn} accessibilityLabel="Chiudi modifica giro" testID="aitour-edit-close">
            <Ionicons name="close" size={22} color={DS.ink} />
          </TouchableOpacity>
        </View>
        <ScrollView testID="aitour-edit-content" style={styles.scroll} contentContainerStyle={{ padding: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          <Text testID="aitour-edit-count" style={styles.hint}>Visite nel giro ({keys.length}): riordina, rimuovi o rendi obbligatorie, poi ricalcola.</Text>

          {keys.map((key, i) => {
            const c = byKey.get(key);
            if (!c) return null;
            const outside = editOutsideReason(plan, c);
            const consent = editAreaConsentKey(plan, c);
            const consented = consents[key] === consent;
            return (
              <View key={key} style={styles.stopRow} testID={`aitour-edit-stop-${i + 1}`}>
                <View style={styles.stopTop}>
                  <View style={[styles.seqDot, { backgroundColor: ENTITY_COLORS[c.entityType] }]}>
                    <Text testID={`aitour-edit-sequence-${i + 1}`} style={styles.seqDotText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                  <Text testID={`aitour-edit-name-${i + 1}`} style={styles.stopName} numberOfLines={2}>{c.name}</Text>
                  <Text testID={`aitour-edit-details-${i + 1}`} style={styles.stopSub} numberOfLines={2}>
                    {ENTITY_LABELS[c.entityType]} · {c.score}/100 · {c.city}
                  </Text>
                  <LastOrderInfo candidate={c} orders={orders} testID={`aitour-edit-last-order-${c.key}`} />
                  </View>
                </View>
                <View style={styles.stopActions}>
                <TouchableOpacity onPress={() => toggleMand(key)} disabled={recalcing} accessibilityRole="checkbox" accessibilityLabel={`Tappa obbligatoria: ${c.name}`} accessibilityState={{ checked: mandatory.has(key), disabled: recalcing }} style={styles.iconBtn} testID={`aitour-edit-mandatory-${i + 1}`}>
                  <Ionicons name={mandatory.has(key) ? 'star' : 'star-outline'} size={17} color={mandatory.has(key) ? '#DC2626' : DS.inkMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => move(i, -1)} disabled={recalcing || i === 0} accessibilityLabel={`Sposta prima ${c.name}`} style={styles.iconBtn} testID={`aitour-edit-up-${i + 1}`}>
                  <Ionicons name="arrow-up" size={16} color={i === 0 ? DS.border : DS.ink2} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => move(i, 1)} disabled={recalcing || i === keys.length - 1} accessibilityLabel={`Sposta dopo ${c.name}`} style={styles.iconBtn} testID={`aitour-edit-down-${i + 1}`}>
                  <Ionicons name="arrow-down" size={16} color={i === keys.length - 1 ? DS.border : DS.ink2} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(key)} disabled={recalcing} accessibilityLabel={`Rimuovi ${c.name}`} style={styles.iconBtn} testID={`aitour-edit-remove-${i + 1}`}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
                </View>
                {outside && <View testID={`aitour-edit-outside-${key}`} style={styles.outsideBox}>
                  <Text testID={`aitour-edit-outside-reason-${key}`} style={styles.outsideText}>{outside}. Puoi includere questa tappa come eccezione, mantenendo i vincoli di orario e l’ordine delle zone.</Text>
                  <TouchableOpacity testID={`aitour-edit-consent-${key}`} disabled={recalcing} accessibilityRole="checkbox" accessibilityState={{ checked: consented, disabled: recalcing }} style={styles.consentBtn} onPress={() => { setConsents((old) => ({ ...old, [key]: consented ? '' : consent })); setOrderTouched(true); onDraftChange?.(); }}>
                    <Ionicons name={consented ? 'checkbox' : 'square-outline'} size={20} color={AI_PURPLE_TEXT} />
                    <Text testID={`aitour-edit-consent-label-${key}`} style={styles.consentText}>{consented ? 'Eccezione fuori zona confermata' : 'Conferma eccezione fuori zona'}</Text>
                  </TouchableOpacity>
                </View>}
              </View>
            );
          })}

          <Text testID="aitour-edit-add-title" style={styles.sectionTitle}>Aggiungi visita (anche obbligatoria)</Text>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={15} color={DS.inkMuted} style={{ marginLeft: 10 }} />
            <TextInput
              style={styles.searchInput}
              value={search}
              editable={!recalcing}
              onChangeText={setSearch}
              placeholder="Cerca per nome, indirizzo o città..."
              placeholderTextColor={DS.inkMuted}
              testID="aitour-edit-search"
            />
          </View>
          {allCandidates.length === 0 ? (
            <Text testID="aitour-edit-empty" style={styles.emptyText}>Nessun candidato disponibile</Text>
          ) : (
            available.map((c) => (
              <View key={c.key} style={styles.availRow}>
                <View style={[styles.entityBadge, { borderColor: ENTITY_COLORS[c.entityType] }]}>
                  <Text testID={`aitour-edit-available-type-${c.key}`} style={[styles.entityBadgeText, { color: ENTITY_COLORS[c.entityType] }]}>{ENTITY_LABELS[c.entityType]}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text testID={`aitour-edit-available-name-${c.key}`} style={styles.stopName} numberOfLines={2}>{c.name}</Text>
                  <Text testID={`aitour-edit-available-details-${c.key}`} style={styles.stopSub} numberOfLines={2}>
                    {c.score}/100 · {[c.address, c.city].filter(Boolean).join(', ')}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => add(c.key, true)} disabled={recalcing} accessibilityLabel={`Aggiungi ${c.name} come obbligatoria`} style={styles.iconBtn} testID={`aitour-edit-add-mandatory-${c.key}`}>
                  <Ionicons name="star" size={18} color="#DC2626" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => add(c.key)} disabled={recalcing} accessibilityLabel={`Aggiungi ${c.name}`} style={styles.iconBtn} testID={`aitour-edit-add-${c.key}`}>
                  <Ionicons name="add-circle" size={20} color="#059669" />
                </TouchableOpacity>
              </View>
            ))
          )}
          <Text testID="aitour-edit-help" style={styles.footNote}>
            Stella rossa = tappa obbligatoria. Entrambi i comandi applicano le stelle e le modifiche. Conferma eventuali eccezioni fuori zona; appuntamenti e orari devono restare compatibili.
          </Text>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {!!errorMsg && <ScrollView testID="aitour-edit-error-box" style={styles.errorBox}><Text testID="aitour-edit-error" accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.errorText}>{errorMsg}</Text></ScrollView>}
          {recalcing && <Text testID="aitour-edit-progress" style={styles.hint}>Ricalcolo del percorso… Le modifiche restano conservate se il calcolo non riesce.</Text>}
          <TouchableOpacity
            style={[styles.recalcBtn, (recalcing || keys.length === 0) && { opacity: 0.5 }]}
            onPress={() => onRecalc([...keys], new Set(mandatory), false, { ...consents })}
            disabled={recalcing || keys.length === 0}
            activeOpacity={0.8}
            testID="aitour-recalc-ai-btn"
          >
            {recalcing ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="sparkles" size={15} color="#FFF" />}
            <Text testID="aitour-recalc-ai-label" style={styles.recalcBtnText}>RICALCOLA CON AI (ordine ottimale)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.applyBtn, (recalcing || keys.length === 0 || !orderTouched) && { opacity: 0.5 }]}
            onPress={() => onRecalc([...keys], new Set(mandatory), true, { ...consents })}
            disabled={recalcing || keys.length === 0 || !orderTouched}
            activeOpacity={0.8}
            testID="aitour-apply-order-btn"
          >
            <Text testID="aitour-apply-order-label" style={styles.applyBtnText}>Applica questa sequenza manuale</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  stopTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stopActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4 },
  outsideBox: { backgroundColor: AI_PURPLE_SOFT, borderRadius: 8, padding: 10, gap: 6 },
  outsideText: { color: DS.ink2, fontFamily: JAKARTA.regular, fontSize: 13, lineHeight: 19 },
  consentBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  consentText: { flex: 1, fontFamily: JAKARTA.semibold, color: AI_PURPLE_TEXT, fontSize: 13 },
  errorBox: { maxHeight: 130, backgroundColor: DS.surface, borderColor: AI_PURPLE_TEXT, borderWidth: 1, borderRadius: 10 },
  errorText: { fontFamily: JAKARTA.medium, color: DS.ink, fontSize: 14, lineHeight: 20, padding: 12 },
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
    flexDirection: 'column',
    alignItems: 'stretch',
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
  iconBtn: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
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
    backgroundColor: AI_PURPLE,
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
