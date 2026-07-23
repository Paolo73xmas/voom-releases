/**
 * Scadenziario — fatture da incassare con scadenze programmate, KPI,
 * proiezione incassi e azioni sollecito (Chiamata + download fattura PDF).
 * Vista Agente: solo fatture dei propri ordini. Vista Admin: tutte.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  RefreshControl, ActivityIndicator, Alert, Linking, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import {
  fetchScadenziarioCached, fetchInvoiceForPdf, logSollecito, ScadenziarioData, ScadenzaRow,
} from '../lib/api/scadenziario';
import { generateAndShareInvoicePdf } from '../lib/pdf/invoice-pdf';
import { EmptyState } from '../components/EmptyState';
import { SkeletonList } from '../components/Skeleton';
import { DS, JAKARTA } from '../lib/theme';
import { hap } from '../lib/haptics';

const eur = (n: number) => `€ ${(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: string | Date | null) => {
  if (!d) return '—';
  const dd = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(dd.getTime()) ? '—' : dd.toLocaleDateString('it-IT');
};

function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

export default function ScadenziarioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuthStore();
  const [data, setData] = useState<ScadenziarioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [sharingId, setSharingId] = useState<string | null>(null);

  const load = useCallback(async (force: boolean = false) => {
    if (!user) return;
    try {
      const result = await fetchScadenziarioCached(user.id, user.role, force);
      setData(result);
    } catch (e) {
      console.error('[Scadenziario] Errore caricamento:', e);
      Alert.alert('Errore', 'Impossibile caricare lo scadenziario. Riprova.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const rows = useMemo(() => data?.rows || [], [data]);
  const kpi = data?.kpi;
  const isAdminView = data?.isAdminView || false;

  const filteredRows = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      r.invoiceNumber.toLowerCase().includes(t) ||
      r.customerName.toLowerCase().includes(t) ||
      (r.agentName || '').toLowerCase().includes(t)
    );
  }, [rows, search]);

  // Proiezione incassi: ogni scadenza (rata) pesa residuo / n. scadenze — come web
  const projection = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    const buckets = new Map<string, { label: string; sortKey: number; amount: number; count: number }>();
    for (const r of rows) {
      if (r.scadDates.length === 0) continue;
      const portion = r.residuo / r.scadDates.length;
      for (const iso of r.scadDates) {
        const d = new Date(iso);
        let key: string, label: string, sortKey: number;
        if (d.getTime() < todayMs) {
          key = 'overdue'; label = 'Scaduto'; sortKey = -1;
        } else if (viewMode === 'week') {
          const mon = mondayOf(d);
          const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
          key = mon.toISOString().slice(0, 10);
          label = `${mon.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })} – ${sun.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}`;
          sortKey = mon.getTime();
        } else {
          key = `${d.getFullYear()}-${d.getMonth()}`;
          const l = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
          label = l.charAt(0).toUpperCase() + l.slice(1);
          sortKey = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        }
        const b = buckets.get(key) || { label, sortKey, amount: 0, count: 0 };
        b.amount += portion;
        b.count += 1;
        buckets.set(key, b);
      }
    }
    return [...buckets.values()].sort((a, b) => a.sortKey - b.sortKey);
  }, [rows, viewMode]);

  const handleCall = (row: ScadenzaRow) => {
    if (!row.phone) {
      Alert.alert('Nessun numero', 'Il cliente non ha un numero di telefono registrato.');
      return;
    }
    hap.light();
    const tel = row.phone.replace(/[^\d+]/g, '');
    Linking.openURL(`tel:${tel}`).catch(() =>
      Alert.alert('Errore', `Impossibile avviare la chiamata al numero ${row.phone}`)
    );
  };

  const handlePdf = async (row: ScadenzaRow) => {
    hap.light();
    setSharingId(row.invoiceId);
    try {
      const inv = await fetchInvoiceForPdf(row.invoiceId);
      await generateAndShareInvoicePdf(inv, {
        paymentMethodName: row.paymentMethodName,
        scadDates: row.scadDates.map((d) => new Date(d)),
        paid: row.paid,
        residuo: row.residuo,
        agentName: row.agentName || profile?.full_name || null,
      });
      // Best-effort: registra il sollecito nello storico (RLS può bloccare gli agenti)
      const logged = await logSollecito(
        row.invoiceId, row.invoiceNumber, row.phone || row.customerName,
        user?.id, profile?.full_name || user?.email
      );
      if (logged) {
        setData((prev) => prev ? {
          ...prev,
          rows: prev.rows.map((r) => r.invoiceId === row.invoiceId
            ? { ...r, lastSollecito: logged, sollecitoCount: r.sollecitoCount + 1 }
            : r),
        } : prev);
      }
      hap.success();
    } catch (e) {
      console.error('[Scadenziario] Errore PDF:', e);
      Alert.alert('Errore', 'Impossibile generare il PDF della fattura. Riprova.');
    } finally {
      setSharingId(null);
    }
  };

  const renderRow = ({ item: row }: { item: ScadenzaRow }) => {
    const isLate = row.daysLate > 0;
    const lastScadMs = row.lastScad ? new Date(row.lastScad).getTime() : null;
    const dueSoon = !isLate && lastScadMs !== null && lastScadMs <= Date.now() + 7 * 86400000;

    return (
      <View style={[styles.card, isLate && styles.cardLate]}>
        <View style={styles.cardTop}>
          <Text style={styles.invNumber}>{row.invoiceNumber}</Text>
          <Text style={[styles.residuo, isLate && { color: DS.error }]}>{eur(row.residuo)}</Text>
        </View>
        <Text style={styles.customer} numberOfLines={1}>{row.customerName}</Text>
        {isAdminView && row.agentName ? (
          <Text style={styles.agentName} numberOfLines={1}>Agente: {row.agentName}</Text>
        ) : null}

        <View style={styles.metaRow}>
          <Ionicons name="document-text-outline" size={13} color={DS.inkMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {fmtDate(row.invoiceDate)}{row.paymentMethodName ? ` · ${row.paymentMethodName}` : ''}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={13} color={isLate ? DS.error : DS.inkMuted} />
          <Text style={[styles.metaText, isLate && { color: DS.error, fontFamily: JAKARTA.semibold }]}>
            Scad. {row.scadDates.length > 0 ? row.scadDates.map(fmtDate).join(' + ') : '—'}
          </Text>
          {isLate ? (
            <View style={styles.lateBadge}>
              <Text style={styles.lateBadgeText}>{row.daysLate} gg ritardo</Text>
            </View>
          ) : dueSoon ? (
            <View style={styles.soonBadge}>
              <Text style={styles.soonBadgeText}>in scadenza</Text>
            </View>
          ) : null}
        </View>

        {row.paid > 0 && (
          <Text style={styles.paidText}>Incassato {eur(row.paid)} di {eur(row.totale)}</Text>
        )}
        {row.lastSollecito && (
          <View style={styles.sollRow}>
            <Ionicons name="paper-plane-outline" size={12} color={DS.inkMuted} />
            <Text style={styles.sollText}>
              Ultimo sollecito: {fmtDate(row.lastSollecito.sentAt)} ({row.lastSollecito.channel === 'email' ? 'Email' : 'WhatsApp'})
              {row.sollecitoCount > 1 ? ` · ${row.sollecitoCount} totali` : ''}
            </Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.callBtn, !row.phone && styles.btnDisabled]}
            onPress={() => handleCall(row)}
            activeOpacity={0.7}
          >
            <Ionicons name="call-outline" size={17} color={row.phone ? DS.success : DS.inkMuted} />
            <Text style={[styles.callBtnText, !row.phone && { color: DS.inkMuted }]}>Chiama</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pdfBtn}
            onPress={() => handlePdf(row)}
            disabled={sharingId !== null}
            activeOpacity={0.7}
          >
            {sharingId === row.invoiceId ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="download-outline" size={17} color="#FFFFFF" />
            )}
            <Text style={styles.pdfBtnText}>Fattura PDF</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const listHeader = (
    <View>
      {/* KPI 2x2 */}
      <View style={styles.kpiGrid}>
        <View style={[styles.kpiCard, styles.kpiCardRed]}>
          <View style={styles.kpiLabelRow}>
            <Ionicons name="alert-circle-outline" size={13} color={DS.error} />
            <Text style={[styles.kpiLabel, { color: DS.error }]}>Scaduto</Text>
          </View>
          <Text style={[styles.kpiValue, { color: DS.error }]}>{kpi ? eur(kpi.overdue) : '—'}</Text>
          <Text style={styles.kpiSub}>{kpi ? `${kpi.overdueCount} fatture` : ''}</Text>
        </View>
        <View style={[styles.kpiCard, styles.kpiCardAmber]}>
          <View style={styles.kpiLabelRow}>
            <Ionicons name="alarm-outline" size={13} color={DS.warning} />
            <Text style={[styles.kpiLabel, { color: DS.warning }]}>Entro 7 gg</Text>
          </View>
          <Text style={[styles.kpiValue, { color: DS.warning }]}>{kpi ? eur(kpi.due7) : '—'}</Text>
        </View>
        <View style={styles.kpiCard}>
          <View style={styles.kpiLabelRow}>
            <Ionicons name="trending-up-outline" size={13} color={DS.inkMuted} />
            <Text style={styles.kpiLabel}>8-30 gg</Text>
          </View>
          <Text style={styles.kpiValue}>{kpi ? eur(kpi.due30) : '—'}</Text>
        </View>
        <View style={styles.kpiCard}>
          <View style={styles.kpiLabelRow}>
            <Ionicons name="wallet-outline" size={13} color={DS.inkMuted} />
            <Text style={styles.kpiLabel}>Totale</Text>
          </View>
          <Text style={styles.kpiValue}>{kpi ? eur(kpi.total) : '—'}</Text>
          <Text style={styles.kpiSub}>{kpi ? `${kpi.openCount} fatture aperte` : ''}</Text>
        </View>
      </View>

      {/* Proiezione incassi */}
      <View style={styles.projHeader}>
        <Text style={styles.sectionTitle}>Proiezione incassi</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'week' && styles.toggleBtnOn]}
            onPress={() => { hap.light(); setViewMode('week'); }}
          >
            <Text style={[styles.toggleText, viewMode === 'week' && styles.toggleTextOn]}>Settimana</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === 'month' && styles.toggleBtnOn]}
            onPress={() => { hap.light(); setViewMode('month'); }}
          >
            <Text style={[styles.toggleText, viewMode === 'month' && styles.toggleTextOn]}>Mese</Text>
          </TouchableOpacity>
        </View>
      </View>
      {projection.length === 0 ? (
        <Text style={styles.projEmpty}>Nessun incasso previsto: tutte le fatture risultano saldate.</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projRow}>
          {projection.map((b) => (
            <View key={b.label} style={[styles.projChip, b.sortKey === -1 && styles.projChipRed]}>
              <Text style={[styles.projChipLabel, b.sortKey === -1 && { color: DS.error }]}>{b.label}</Text>
              <Text style={[styles.projChipValue, b.sortKey === -1 && { color: DS.error }]}>{eur(b.amount)}</Text>
              <Text style={styles.projChipSub}>{b.count} {b.count === 1 ? 'rata' : 'rate'}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Ricerca */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={DS.inkMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={isAdminView ? 'Cerca fattura, cliente, agente...' : 'Cerca fattura o cliente...'}
          placeholderTextColor={DS.inkMuted}
          autoCorrect={false}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={DS.inkMuted} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.listCount}>
        {filteredRows.length} {filteredRows.length === 1 ? 'fattura aperta' : 'fatture aperte'}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scadenziario</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={{ padding: 16 }}>
          <SkeletonList count={5} height={140} />
        </View>
      ) : (
        <FlatList
          data={filteredRows}
          renderItem={renderRow}
          keyExtractor={(r) => r.invoiceId}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <EmptyState
              icon="checkmark-done-circle-outline"
              title={search ? 'Nessun risultato' : 'Nessuna fattura aperta'}
              message={search
                ? 'Nessuna fattura corrisponde alla ricerca.'
                : isAdminView
                  ? 'Tutte le fatture risultano incassate.'
                  : 'Tutte le fatture dei tuoi ordini risultano incassate.'}
            />
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.brand} />
          }
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.surface2 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: DS.brand, paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { fontSize: 18, fontFamily: JAKARTA.bold, color: '#FFFFFF' },
  listContent: { padding: 16, paddingBottom: 40 },

  // KPI
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  kpiCard: {
    flexBasis: '47%', flexGrow: 1, backgroundColor: DS.surface,
    borderRadius: 16, padding: 12, borderWidth: 1, borderColor: DS.border,
  },
  kpiCardRed: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  kpiCardAmber: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  kpiLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  kpiLabel: {
    fontSize: 10, fontFamily: JAKARTA.semibold, color: DS.inkMuted,
    textTransform: 'uppercase', letterSpacing: 0.6,
  },
  kpiValue: { fontSize: 18, fontFamily: JAKARTA.bold, color: DS.ink, letterSpacing: -0.3 },
  kpiSub: { fontSize: 11, fontFamily: JAKARTA.regular, color: DS.inkMuted, marginTop: 2 },

  // Proiezione
  projHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12, fontFamily: JAKARTA.semibold, color: DS.inkMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  toggleRow: { flexDirection: 'row', backgroundColor: DS.surface3, borderRadius: 10, padding: 2 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  toggleBtnOn: { backgroundColor: DS.surface },
  toggleText: { fontSize: 12, fontFamily: JAKARTA.medium, color: DS.inkMuted },
  toggleTextOn: { color: DS.ink, fontFamily: JAKARTA.semibold },
  projEmpty: { fontSize: 12, fontFamily: JAKARTA.regular, color: DS.inkMuted, marginBottom: 20 },
  projRow: { gap: 10, paddingRight: 8, marginBottom: 20 },
  projChip: {
    backgroundColor: DS.surface, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    minWidth: 130, borderWidth: 1, borderColor: DS.border,
  },
  projChipRed: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  projChipLabel: {
    fontSize: 10, fontFamily: JAKARTA.semibold, color: DS.inkMuted,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  projChipValue: { fontSize: 15, fontFamily: JAKARTA.bold, color: DS.ink, marginTop: 3 },
  projChipSub: { fontSize: 10, fontFamily: JAKARTA.regular, color: DS.inkMuted, marginTop: 1 },

  // Ricerca
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: DS.surface, borderRadius: 12, paddingHorizontal: 12,
    height: 44, borderWidth: 1, borderColor: DS.border, marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: JAKARTA.regular, color: DS.ink },
  listCount: { fontSize: 12, fontFamily: JAKARTA.medium, color: DS.inkMuted, marginBottom: 12 },

  // Card fattura
  card: {
    backgroundColor: DS.surface, borderRadius: 18, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: DS.border,
  },
  cardLate: { borderColor: '#FECACA' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  invNumber: { fontSize: 12, fontFamily: JAKARTA.semibold, color: DS.inkMuted, letterSpacing: 0.3 },
  residuo: { fontSize: 17, fontFamily: JAKARTA.bold, color: DS.ink, letterSpacing: -0.3 },
  customer: { fontSize: 15, fontFamily: JAKARTA.semibold, color: DS.ink, marginBottom: 2 },
  agentName: { fontSize: 12, fontFamily: JAKARTA.medium, color: DS.brand, marginBottom: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' },
  metaText: { fontSize: 12, fontFamily: JAKARTA.regular, color: DS.inkMuted, flexShrink: 1 },
  lateBadge: {
    backgroundColor: '#FEE2E2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
  },
  lateBadgeText: { fontSize: 10, fontFamily: JAKARTA.bold, color: DS.error },
  soonBadge: {
    backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
  },
  soonBadgeText: { fontSize: 10, fontFamily: JAKARTA.bold, color: DS.warning },
  paidText: { fontSize: 12, fontFamily: JAKARTA.medium, color: DS.success, marginTop: 6 },
  sollRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  sollText: { fontSize: 11, fontFamily: JAKARTA.regular, color: DS.inkMuted },

  // Azioni
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  callBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, borderRadius: 12, borderWidth: 1.5, borderColor: DS.success,
    backgroundColor: '#F0FDF4',
  },
  callBtnText: { fontSize: 14, fontFamily: JAKARTA.semibold, color: DS.success },
  btnDisabled: { borderColor: DS.border, backgroundColor: DS.surface2 },
  pdfBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 44, borderRadius: 12, backgroundColor: DS.brand,
  },
  pdfBtnText: { fontSize: 14, fontFamily: JAKARTA.semibold, color: '#FFFFFF' },
});
