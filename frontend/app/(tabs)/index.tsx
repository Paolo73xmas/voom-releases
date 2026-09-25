import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { setStatusBarStyle } from 'expo-status-bar';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useAuthStore } from '../../store/authStore';
import { fetchCustomers } from '../../lib/api/customers';
import { fetchOrderCounts } from '../../lib/api/orders';
import { fetchMonthlySales } from '../../lib/api/monthly-sales';
import { fetchVisits } from '../../lib/api/visits';
import { supabase } from '../../lib/supabase';
import { getDraftCount } from '../../lib/drafts';
import { getCache, setCache, clearCache } from '../../lib/memory-cache';
import { fetchScadenziarioCached, ScadenziarioKpi } from '../../lib/api/scadenziario';
import { fetchOverdueFollowUps, type OverdueFollowUp } from '../../lib/aitour/followups';
import { fetchAgentInspections, type AgentInspection } from '../../lib/api/inspections';
import { useRimborsiAccess } from '../../hooks/useRimborsiAccess';
import { Avatar } from '../../components/Avatar';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { LogoutButton } from '../../components/LogoutButton';
import { Skeleton } from '../../components/Skeleton';
import { DS, JAKARTA, getTimeGreeting, COLORS, currentThemeMode } from '../../lib/theme';
import { setThemeAndReload } from '../../lib/themeToggle';
import { hap } from '../../lib/haptics';

export default function Dashboard() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    customers: 0,
    orders: 0,
    visits: 0,
    pendingOrders: 0,
  });
  const [monthlySales, setMonthlySales] = useState({
    netto: 0,
    accisa: 0,
    iva: 0,
    lordo: 0,
    orderCount: 0,
    monthLabel: '',
  });
  const [draftCount, setDraftCount] = useState(0);
  const [aiTourBadge, setAiTourBadge] = useState(0);
  const [scadKpi, setScadKpi] = useState<ScadenziarioKpi | null>(null);
  const [upcomingAppointments, setUpcomingAppointments] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');
  const [aptsLoaded, setAptsLoaded] = useState(false);
  // Follow-up scaduti mai gestiti (ultimi 60 giorni): promemoria in dashboard
  const [overdueFu, setOverdueFu] = useState<OverdueFollowUp[]>([]);
  const [overdueExpanded, setOverdueExpanded] = useState(false);
  // Ultime ispezioni eseguite dall'agente (ognuno vede solo le proprie)
  const [lastInspections, setLastInspections] = useState<AgentInspection[]>([]);
  const [inspLoaded, setInspLoaded] = useState(false);
  const [inspectionsError, setInspectionsError] = useState('');
  const [inspectionsBusy, setInspectionsBusy] = useState(false);
  const statsRequest = useRef(0);
  const inspectionsRequest = useRef(0);
  const scopeRef = useRef(user?.id);
  scopeRef.current = user?.id;

  const loadStats = async (force: boolean = false) => {
    if (!user) return;
    const request = ++statsRequest.current;
    const current = () => request === statsRequest.current && scopeRef.current === user.id;

    // Cache hit (TTL 60s) — instant load, no flicker
    const cacheKey = `dashboard:stats:${user.id}`;
    if (!force) {
      const cached = getCache<typeof stats & { monthlySales: typeof monthlySales }>(cacheKey);
      if (cached) {
        setStats({
          customers: cached.customers,
          orders: cached.orders,
          visits: cached.visits,
          pendingOrders: cached.pendingOrders,
        });
        if (cached.monthlySales) setMonthlySales(cached.monthlySales);
        setStatsLoading(false);
        return;
      }
    }

    setStatsError('');
    try {
      const [customers, orders, visits] = await Promise.all([
        fetchCustomers(user.id, user.role, user.branchId, { force }),
        fetchOrderCounts(user.id, user.role, user.branchId),
        fetchVisits(user.id, user.role, user.branchId, { force }),
      ]);

      const newStats = {
        customers: customers.length,
        orders: orders.total,
        visits: visits.length,
        pendingOrders: orders.pending,
      };
      // Load monthly sales (net of IVA and Accisa)
      const ms = await fetchMonthlySales(user.id);
      if (!current()) return;
      setStats(newStats);
      setMonthlySales(ms);

      // Cache for 60 seconds
      setCache(cacheKey, { ...newStats, monthlySales: ms }, 60_000);
    } catch (error) {
      console.error('Error loading stats:', error);
      if (current()) setStatsError('Impossibile aggiornare i riepiloghi. I valori mostrati potrebbero non essere aggiornati.');
    } finally {
      if (current()) setStatsLoading(false);
    }
  };

  const loadScadenziario = async (force: boolean = false) => {
    if (!user) return;
    try {
      const data = await fetchScadenziarioCached(user.id, user.role, force);
      setScadKpi(data.kpi);
    } catch (e) {
      console.error('[Dashboard] Scadenziario error:', e);
    }
  };

  useEffect(() => {
    setLastInspections([]);
    setInspLoaded(false);
    setInspectionsError('');
    loadStats();
    loadScadenziario();
    return () => { statsRequest.current += 1; inspectionsRequest.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Refresh on focus: drafts + appointments always (cheap), stats from cache (60s TTL)
  useFocusEffect(
    useCallback(() => {
      // Status bar scura su sfondo chiaro (solo su questa schermata)
      setStatusBarStyle('dark');
      getDraftCount().then(setDraftCount);
      loadUpcomingAppointments();
      loadAiTourBadge();
      loadOverdueFollowUps();
      loadLastInspections();
      // Stats: respects 60s cache, only refetches if expired
      loadStats(false);
      return () => setStatusBarStyle('light');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id])
  );

  // Badge giri AI Tour pianificati non ancora avviati (assegnati dall'admin o salvati dall'agente)
  const loadAiTourBadge = async () => {
    if (!user) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { count, error } = await supabase
        .from('ai_tours')
        .select('id', { count: 'exact', head: true })
        .eq('agent_id', user.id)
        .eq('status', 'planned')
        .gte('tour_date', today);
      if (!error) setAiTourBadge(count || 0);
    } catch (e) {
      console.warn('[Dashboard] AI Tour badge error:', e);
    }
  };

  // Follow-up dei giorni passati mai gestiti (status ancora 'scheduled'): nessun cliente dimenticato
  const loadOverdueFollowUps = async () => {
    if (!user) return;
    try {
      setOverdueFu(await fetchOverdueFollowUps(user.id));
    } catch (e) {
      console.warn('[Dashboard] follow-up scaduti:', e);
    }
  };

  const loadLastInspections = async () => {
    if (!user) return;
    const request = ++inspectionsRequest.current;
    const current = () => request === inspectionsRequest.current && scopeRef.current === user.id;
    setInspectionsBusy(true);
    try {
      const rows = await fetchAgentInspections(user.id, { limit: 5 });
      if (!current()) return;
      setLastInspections(rows);
      setInspectionsError('');
    } catch (e) {
      console.warn('[Dashboard] ispezioni:', e);
      if (current()) setInspectionsError('Impossibile aggiornare le ispezioni. Controlla la connessione e riprova.');
    } finally {
      if (current()) { setInspLoaded(true); setInspectionsBusy(false); }
    }
  };


  const loadUpcomingAppointments = async () => {
    if (!user) return;
    try {
      const now = new Date().toISOString();
      const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      let query = supabase
        .from('appointments')
        .select('id, appointment_date, duration_minutes, customer_id, notes, status, appointment_type, quick_customer_name, quick_customer_city, customers:customer_id (business_name, city)')
        .gte('appointment_date', now)
        .lte('appointment_date', sevenDaysLater)
        .not('status', 'in', '("cancelled","completed")')
        .order('appointment_date', { ascending: true })
        .limit(5);

      // Agent sees only their appointments
      if (user.role !== 'admin' && user.role !== 'supervisor' && user.role !== 'admincustom') {
        query = query.eq('agent_id', user.id);
      }

      const { data, error } = await query;
      if (!error && data) {
        setUpcomingAppointments(data);
      } else if (error) {
        console.error('[Dashboard] Appointments error:', error);
      }
    } catch (e) {
      console.error('[Dashboard] Error loading appointments:', e);
    } finally {
      setAptsLoaded(true);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (user?.id) clearCache(`dashboard:stats:${user.id}`);
      await Promise.all([loadStats(true), getDraftCount().then(setDraftCount), loadUpcomingAppointments(),
        loadScadenziario(true), loadOverdueFollowUps(), loadLastInspections(), loadAiTourBadge()]);
    } finally { setRefreshing(false); }
  };

  const { hasAccess: hasRimborsiAccess } = useRimborsiAccess();

  // Quick actions grouped by section
  const actionGroups = [
    {
      title: 'Vendite',
      actions: [
        { title: 'AI Tour', icon: 'sparkles-outline' as const, badge: aiTourBadge, onPress: () => router.push('/ai-tour') },
        { title: 'Raccolta Ordine', icon: 'cart-outline' as const, onPress: () => router.push('/order-collection-v2') },
        { title: 'Bozze Ordine', icon: 'document-text-outline' as const, badge: draftCount, onPress: () => router.push('/drafts') },
        { title: 'Sostituzioni', icon: 'swap-horizontal-outline' as const, onPress: () => router.push('/substitutions') },
        ...(hasRimborsiAccess ? [{ title: 'Rimborsi', icon: 'receipt-outline' as const, onPress: () => router.push('/rimborsi') }] : []),
      ],
    },
    {
      title: 'Punti Vendita',
      actions: [
        { title: 'Nuova Ispezione', icon: 'camera-outline' as const, onPress: () => router.push('/inspection/new') },
        { title: 'Anagrafica', icon: 'clipboard-outline' as const, onPress: () => router.push('/anagrafica') },
        { title: 'No Mappa', icon: 'globe-outline' as const, onPress: () => router.push('/rivendite-no-mappa') },
        { title: 'Reclami', icon: 'flag-outline' as const, onPress: () => router.push('/orphan-claims') },
      ],
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={DS.brand} />
      }
    >
      {/* Header — Avatar + greeting + logout */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <Avatar name={profile?.full_name} email={profile?.email} size={48} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.greeting}>{getTimeGreeting()}</Text>
          <Text style={styles.userName} numberOfLines={1}>{profile?.full_name || 'Utente'}</Text>
        </View>
        <TouchableOpacity testID="dashboard-refresh" accessibilityRole="button" accessibilityLabel="Aggiorna dashboard"
          disabled={refreshing} style={styles.logoutBtn} onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={20} color={refreshing ? DS.borderStrong : DS.inkMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            hap.light();
            setThemeAndReload(currentThemeMode === 'dark' ? 'light' : 'dark');
          }}
        >
          <Ionicons name={currentThemeMode === 'dark' ? 'sunny-outline' : 'moon-outline'} size={20} color={DS.inkMuted} />
        </TouchableOpacity>
        <LogoutButton testID="dashboard-logout" style={styles.logoutBtn} color={DS.inkMuted} />
      </Animated.View>

      {/* Prossimi Appuntamenti — scroll orizzontale in cima */}
      <Animated.View entering={FadeInDown.delay(80).duration(400)}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Prossimi appuntamenti</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/calendar')} hitSlop={8}>
            <Text style={styles.sectionLink}>Calendario</Text>
          </TouchableOpacity>
        </View>
        {!aptsLoaded ? (
          <View style={styles.aptRow}>
            <Skeleton width={250} height={100} borderRadius={20} />
            <Skeleton width={250} height={100} borderRadius={20} />
          </View>
        ) : upcomingAppointments.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.aptRow}>
            {upcomingAppointments.map((apt) => {
              const startDate = new Date(apt.appointment_date);
              const dayStr = startDate.toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: 'short' });
              const timeStr = startDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
              const customerName = (apt.customers as any)?.business_name || apt.quick_customer_name || 'Cliente';
              const customerCity = (apt.customers as any)?.city || apt.quick_customer_city || '';
              const isToday = startDate.toDateString() === new Date().toDateString();
              const isTomorrow = startDate.toDateString() === new Date(Date.now() + 86400000).toDateString();
              const typeLabels: Record<string, string> = {
                first_visit: 'Prima visita',
                follow_up: 'Follow-up',
                delivery: 'Consegna',
                other: 'Altro',
              };
              const typeLabel = apt.appointment_type ? typeLabels[apt.appointment_type] : null;

              return (
                <TouchableOpacity
                  key={apt.id}
                  style={styles.aptCard}
                  onPress={() => router.push('/(tabs)/calendar')}
                  activeOpacity={0.7}
                >
                  <View style={styles.aptTopRow}>
                    <View style={[styles.aptChip, isToday && styles.aptChipToday, isTomorrow && styles.aptChipTomorrow]}>
                      <Text style={[styles.aptChipText, (isToday || isTomorrow) && styles.aptChipTextOn]}>
                        {isToday ? 'OGGI' : isTomorrow ? 'DOMANI' : dayStr.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.aptTime}>{timeStr}</Text>
                  </View>
                  <Text style={styles.aptName} numberOfLines={1}>{customerName}</Text>
                  <Text style={styles.aptSub} numberOfLines={1}>
                    {typeLabel ? `${typeLabel}` : ''}{typeLabel && customerCity ? ' · ' : ''}{customerCity}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : (
          <View style={styles.aptEmpty}>
            <Ionicons name="calendar-outline" size={22} color={DS.inkMuted} />
            <Text style={styles.aptEmptyText}>Nessun appuntamento nei prossimi 7 giorni</Text>
          </View>
        )}
      </Animated.View>

      {/* Follow-up SCADUTI mai gestiti — promemoria per non dimenticare nessun cliente */}
      {overdueFu.length > 0 && (
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.odCard} testID="dashboard-overdue-panel">
          <View style={styles.odHeader}>
            <View style={styles.odIconChip}>
              <Ionicons name="alarm-outline" size={16} color="#DC2626" />
            </View>
            <Text style={styles.odTitle}>
              {overdueFu.length === 1 ? '1 follow-up scaduto' : `${overdueFu.length} follow-up scaduti`} da gestire
            </Text>
            <View style={styles.odCountBadge}>
              <Text style={styles.odCountText}>{overdueFu.length}</Text>
            </View>
          </View>
          <Text style={styles.odHint}>Promemoria in agenda mai gestiti negli ultimi 60 giorni. Tocca un cliente per aprire la scheda.</Text>
          {(overdueExpanded ? overdueFu : overdueFu.slice(0, 3)).map((o) => (
            <TouchableOpacity
              key={o.customerId}
              style={styles.odRow}
              onPress={() => {
                hap.light();
                router.push(`/customer/${o.customerId}`);
              }}
              activeOpacity={0.7}
              testID={`dashboard-overdue-item-${o.customerId}`}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.odRowName} numberOfLines={1}>
                  {o.businessName}
                  {o.city ? <Text style={styles.odRowCity}> · {o.city}</Text> : null}
                </Text>
                {o.reason ? (
                  <Text style={styles.odRowReason} numberOfLines={1}>{o.reason}</Text>
                ) : null}
              </View>
              <Text style={styles.odRowDate}>
                era per il {new Date(`${o.date}T12:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
              </Text>
              <Ionicons name="chevron-forward" size={15} color={DS.inkMuted} />
            </TouchableOpacity>
          ))}
          {overdueFu.length > 3 && (
            <TouchableOpacity
              onPress={() => {
                hap.light();
                setOverdueExpanded(!overdueExpanded);
              }}
              activeOpacity={0.7}
              hitSlop={8}
            >
              <Text style={styles.odExpand}>
                {overdueExpanded ? 'Mostra meno' : `Mostra tutti (${overdueFu.length})`}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.odCta}
            onPress={() => {
              hap.medium();
              router.push('/ai-tour');
            }}
            activeOpacity={0.8}
            testID="dashboard-overdue-cta"
          >
            <Ionicons name="sparkles" size={14} color="#FFF" />
            <Text style={styles.odCtaText}>Recuperali in un giro con AI Tour</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Panoramica — griglia stats 2x2 */}
      <Text style={styles.sectionTitle}>Panoramica</Text>
      {!!statsError && <View style={styles.readErrorBox} testID="dashboard-stats-error">
        <Text testID="dashboard-stats-error-message" style={styles.readErrorText} accessibilityRole="alert">{statsError}</Text>
        <TouchableOpacity testID="dashboard-stats-retry" style={styles.readRetry} onPress={() => loadStats(true)}><Text style={styles.readRetryText}>Riprova</Text></TouchableOpacity>
      </View>}
      {statsLoading ? (
        <View style={styles.statsGrid}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width="47%" height={108} borderRadius={20} style={{ flexGrow: 1 }} />
          ))}
        </View>
      ) : (
        <Animated.View entering={FadeInDown.delay(140).duration(400)} style={styles.statsGrid}>
          {[
            { label: 'Clienti', value: stats.customers, icon: 'people-outline' },
            { label: 'Ordini', value: stats.orders, icon: 'cart-outline' },
            { label: 'Visite', value: stats.visits, icon: 'location-outline' },
            { label: 'In attesa', value: stats.pendingOrders, icon: 'time-outline' },
          ].map((s, i) => (
            <View key={s.label} style={styles.statCard}>
              <View style={styles.statIconChip}>
                <Ionicons name={s.icon as any} size={17} color={DS.brand} />
              </View>
              <AnimatedNumber testID={`dashboard-stat-${i}-value`} value={s.value} duration={700 + i * 100} style={styles.statNumber} />
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* Venduto del Mese — hero card brand */}
      <Text style={styles.sectionTitle}>
        Venduto {monthlySales.monthLabel ? `— ${monthlySales.monthLabel}` : 'del mese'}
      </Text>
      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.salesCard}>
        <View style={styles.salesMainRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.salesMainLabel}>Netto (no IVA, no Accisa)</Text>
            <Text testID="dashboard-sales-net" style={styles.salesMainValue}>
              € {monthlySales.netto.toFixed(2).replace('.', ',')}
            </Text>
          </View>
          <View style={styles.salesBadge}>
            <Ionicons name="receipt-outline" size={14} color="#FFFFFF" />
            <Text testID="dashboard-sales-count" style={styles.salesBadgeText}>{monthlySales.orderCount} ordini</Text>
          </View>
        </View>
        <View style={styles.salesDivider} />
        <View style={styles.salesDetailsRow}>
          <View style={styles.salesDetailItem}>
            <Text style={styles.salesDetailLabel}>Accisa</Text>
            <Text testID="dashboard-sales-excise" style={styles.salesDetailValue}>
              € {monthlySales.accisa.toFixed(2).replace('.', ',')}
            </Text>
          </View>
          <View style={styles.salesDetailItem}>
            <Text style={styles.salesDetailLabel}>IVA</Text>
            <Text testID="dashboard-sales-vat" style={styles.salesDetailValue}>
              € {monthlySales.iva.toFixed(2).replace('.', ',')}
            </Text>
          </View>
          <View style={styles.salesDetailItem}>
            <Text style={styles.salesDetailLabel}>Lordo merce</Text>
            <Text testID="dashboard-sales-gross" style={[styles.salesDetailValue, { fontFamily: JAKARTA.bold }]}>
              € {monthlySales.lordo.toFixed(2).replace('.', ',')}
            </Text>
          </View>
        </View>
        <Text testID="dashboard-sales-basis" style={styles.salesBasis}>Spedizioni e ordini annullati esclusi</Text>
      </Animated.View>

      {/* Scadenziario — fatture da incassare */}
      <Text style={styles.sectionTitle}>Scadenziario</Text>
      <Animated.View entering={FadeInDown.delay(230).duration(400)}>
        <Pressable
          style={({ pressed }) => [styles.scadCard, pressed && styles.actionPressed]}
          onPress={() => { hap.light(); router.push('/scadenziario'); }}
        >
          <View style={styles.scadCol}>
            <Text style={[styles.scadLabel, { color: DS.error }]}>Scaduto</Text>
            <Text style={[styles.scadValue, { color: DS.error }]}>
              {scadKpi ? `€ ${scadKpi.overdue.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
            </Text>
            <Text style={styles.scadSub}>{scadKpi ? `${scadKpi.overdueCount} fatture` : 'caricamento...'}</Text>
          </View>
          <View style={styles.scadDivider} />
          <View style={styles.scadCol}>
            <Text style={styles.scadLabel}>Da incassare</Text>
            <Text style={styles.scadValue}>
              {scadKpi ? `€ ${scadKpi.total.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
            </Text>
            <Text style={styles.scadSub}>{scadKpi ? `${scadKpi.openCount} fatture aperte` : ''}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={DS.borderStrong} />
        </Pressable>
      </Animated.View>

      {/* Ispezioni — ultime eseguite dall'agente, con le note */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Ispezioni</Text>
        <TouchableOpacity testID="dashboard-inspections-all" onPress={() => { hap.light(); router.push('/inspections'); }} hitSlop={8}>
          <Text style={styles.sectionLink}>Vedi tutte</Text>
        </TouchableOpacity>
      </View>
      {!!inspectionsError && <View testID="dashboard-inspections-error" style={styles.readErrorBox}>
        <Text testID="dashboard-inspections-error-message" accessibilityRole="alert" style={styles.readErrorText}>{inspectionsError}</Text>
        <TouchableOpacity testID="dashboard-inspections-retry" style={styles.readRetry} disabled={inspectionsBusy} onPress={loadLastInspections}><Text style={styles.readRetryText}>Riprova</Text></TouchableOpacity>
      </View>}
      <Animated.View entering={FadeInDown.delay(245).duration(400)}>
        {!inspLoaded ? (
          <Skeleton width="100%" height={80} borderRadius={16} />
        ) : lastInspections.length === 0 && inspectionsError ? null : lastInspections.length === 0 ? (
          <Pressable
            testID="dashboard-inspections-empty"
            style={({ pressed }) => [styles.inspEmpty, pressed && styles.actionPressed]}
            onPress={() => { hap.light(); router.push('/inspection/new'); }}
          >
            <Ionicons name="camera-outline" size={18} color={DS.inkMuted} />
            <Text style={styles.inspEmptyText}>Nessuna ispezione registrata · tocca per crearne una</Text>
          </Pressable>
        ) : (
          <View style={styles.inspList}>
            {lastInspections.map((insp) => {
              const d = new Date(insp.inspection_date);
              return (
                <Pressable
                  key={insp.id}
                  testID={`dashboard-inspection-${insp.id}`}
                  style={({ pressed }) => [styles.inspCard, pressed && styles.actionPressed]}
                  onPress={() => { hap.light(); router.push(`/inspection/${insp.id}`); }}
                >
                  <View style={styles.inspTop}>
                    <Text style={styles.inspDate}>
                      {d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })} · {d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <View style={styles.inspPhotoChip}>
                      <Ionicons name="images-outline" size={12} color={DS.ink2} />
                      <Text style={styles.inspPhotoText}>{insp.photoCount}</Text>
                    </View>
                  </View>
                  <Text style={styles.inspName} numberOfLines={1}>
                    {insp.customerName}{insp.customerCity ? ` · ${insp.customerCity}` : ''}
                  </Text>
                  <Text style={insp.notes ? styles.inspNotes : styles.inspNotesEmpty} numberOfLines={2}>
                    {insp.notes || 'Nessuna nota'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Animated.View>

      {/* Azioni rapide — griglia 2 colonne per sezione */}
      {actionGroups.map((group, gIdx) => (
        <Animated.View key={group.title} entering={FadeInDown.delay(260 + gIdx * 80).duration(400)}>
          <Text style={styles.sectionTitle}>{group.title}</Text>
          <View style={styles.actionsGrid}>
            {group.actions.map((action) => (
              <Pressable
                key={action.title}
                style={({ pressed }) => [styles.actionCard, pressed && styles.actionPressed]}
                onPress={() => { hap.light(); action.onPress(); }}
              >
                <View style={styles.actionIconChip}>
                  <Ionicons name={action.icon} size={20} color={DS.brand} />
                  {(action as any).badge > 0 && (
                    <View style={styles.draftBadge}>
                      <Text style={styles.draftBadgeText}>{(action as any).badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.actionTitle} numberOfLines={2}>{action.title}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  readErrorBox: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: DS.error, backgroundColor: DS.surface, marginBottom: 12 },
  readErrorText: { color: DS.error, fontFamily: JAKARTA.medium, fontSize: 13, lineHeight: 19 },
  readRetry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 8 },
  readRetryText: { color: DS.brand, fontFamily: JAKARTA.semibold, fontSize: 14 },
  salesBasis: { color: '#FFFFFFCC', fontSize: 11, fontFamily: JAKARTA.regular, marginTop: 14 },
  container: {
    flex: 1,
    backgroundColor: DS.surface,
  },
  content: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 64 : 32,
    paddingBottom: 120, // space for floating tab bar
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  greeting: {
    fontSize: 13,
    fontFamily: JAKARTA.medium,
    color: DS.inkMuted,
    letterSpacing: 0.2,
  },
  userName: {
    fontSize: 24,
    fontFamily: JAKARTA.bold,
    color: DS.ink,
    marginTop: 2,
    letterSpacing: -0.4,
  },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: DS.surface2,
  },

  // Sezioni
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: JAKARTA.semibold,
    color: DS.inkMuted,
    marginBottom: 12,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  sectionTitleInline: {
    marginBottom: 0,
    marginTop: 0,
  },
  sectionLink: {
    fontSize: 13,
    fontFamily: JAKARTA.semibold,
    color: DS.brand,
  },

  // Appuntamenti (scroll orizzontale)
  aptRow: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 8,
    marginBottom: 28,
  },
  aptCard: {
    width: 250,
    backgroundColor: DS.surface2,
    borderRadius: 20,
    padding: 14,
  },
  aptTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  aptChip: {
    backgroundColor: DS.brandTint,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  aptChipToday: {
    backgroundColor: DS.brand,
  },
  aptChipTomorrow: {
    backgroundColor: DS.warning,
  },
  aptChipText: {
    fontSize: 10,
    fontFamily: JAKARTA.bold,
    color: DS.brand,
    letterSpacing: 0.6,
  },
  aptChipTextOn: {
    color: '#FFFFFF',
  },
  aptTime: {
    fontSize: 13,
    fontFamily: JAKARTA.semibold,
    color: DS.ink2,
  },
  aptName: {
    fontSize: 15,
    fontFamily: JAKARTA.semibold,
    color: DS.ink,
  },
  aptSub: {
    fontSize: 12,
    fontFamily: JAKARTA.regular,
    color: DS.inkMuted,
    marginTop: 3,
  },
  aptEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: DS.surface2,
    borderRadius: 20,
    padding: 18,
    marginBottom: 28,
  },
  aptEmptyText: {
    fontSize: 13,
    fontFamily: JAKARTA.regular,
    color: DS.inkMuted,
    flex: 1,
  },

  // Follow-up scaduti (promemoria)
  odCard: {
    backgroundColor: DS.surface,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 20,
    padding: 14,
    marginBottom: 28,
  },
  odHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  odIconChip: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  odTitle: { flex: 1, fontFamily: JAKARTA.bold, fontSize: 14, color: DS.ink },
  odCountBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  odCountText: { fontFamily: JAKARTA.bold, fontSize: 12, color: '#FFF' },
  odHint: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted, marginTop: 5, marginBottom: 4, lineHeight: 15 },
  odRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.border,
  },
  odRowName: { fontFamily: JAKARTA.semibold, fontSize: 13, color: DS.ink },
  odRowCity: { fontFamily: JAKARTA.regular, color: DS.inkMuted },
  odRowReason: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted, marginTop: 1 },
  odRowDate: { fontFamily: JAKARTA.bold, fontSize: 11, color: '#DC2626' },
  odExpand: { fontFamily: JAKARTA.semibold, fontSize: 12, color: DS.brand, marginTop: 8, textAlign: 'center' },
  odCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 10,
  },
  odCtaText: { fontFamily: JAKARTA.bold, fontSize: 12.5, color: '#FFF', letterSpacing: 0.2 },

  // Stats 2x2
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: DS.surface2,
    borderRadius: 20,
    padding: 16,
  },
  statIconChip: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
  },
  statNumber: {
    fontSize: 26,
    fontFamily: JAKARTA.bold,
    color: DS.ink,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: JAKARTA.medium,
    color: DS.inkMuted,
    marginTop: 2,
  },

  // Venduto hero card
  salesCard: {
    backgroundColor: DS.brand,
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
  },
  salesMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  salesMainLabel: {
    fontSize: 12,
    fontFamily: JAKARTA.medium,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 6,
  },
  salesMainValue: {
    fontSize: 32,
    fontFamily: JAKARTA.bold,
    color: '#FFFFFF',
    letterSpacing: -0.8,
  },
  salesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 5,
  },
  salesBadgeText: {
    fontSize: 12,
    fontFamily: JAKARTA.semibold,
    color: '#FFFFFF',
  },
  salesDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginVertical: 16,
  },
  salesDetailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  salesDetailItem: {
    alignItems: 'center',
    flex: 1,
  },
  salesDetailLabel: {
    fontSize: 11,
    fontFamily: JAKARTA.medium,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  salesDetailValue: {
    fontSize: 15,
    fontFamily: JAKARTA.semibold,
    color: '#FFFFFF',
  },

  // Scadenziario card
  scadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.surface2,
    borderRadius: 20,
    padding: 16,
    marginBottom: 28,
    gap: 12,
  },
  scadCol: {
    flex: 1,
  },
  scadLabel: {
    fontSize: 11,
    fontFamily: JAKARTA.semibold,
    color: DS.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  scadValue: {
    fontSize: 19,
    fontFamily: JAKARTA.bold,
    color: DS.ink,
    letterSpacing: -0.4,
  },
  inspList: { gap: 10 },
  inspCard: { backgroundColor: DS.surface, borderRadius: 16, borderWidth: 1, borderColor: DS.border, padding: 12, gap: 3 },
  inspTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inspDate: { fontFamily: JAKARTA.semibold, fontSize: 11, color: DS.brand },
  inspPhotoChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 9, backgroundColor: DS.surface2 },
  inspPhotoText: { fontFamily: JAKARTA.semibold, fontSize: 11, color: DS.ink2 },
  inspName: { fontFamily: JAKARTA.bold, fontSize: 14, color: DS.ink },
  inspNotes: { fontFamily: JAKARTA.regular, fontSize: 12.5, color: DS.ink2, lineHeight: 18 },
  inspNotesEmpty: { fontFamily: JAKARTA.regular, fontSize: 12.5, color: DS.inkMuted, fontStyle: 'italic' },
  inspEmpty: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, paddingHorizontal: 14, borderRadius: 16, backgroundColor: DS.surface, borderWidth: 1, borderColor: DS.border },
  inspEmptyText: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 12.5, color: DS.inkMuted },

  scadSub: {
    fontSize: 11,
    fontFamily: JAKARTA.regular,
    color: DS.inkMuted,
    marginTop: 2,
  },
  scadDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: DS.borderStrong,
    opacity: 0.5,
  },

  // Azioni rapide — 2 colonne
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 28,
  },
  actionCard: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: DS.surface2,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 64,
  },
  actionPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.85,
  },
  actionIconChip: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  actionTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: JAKARTA.semibold,
    color: DS.ink,
    lineHeight: 17,
  },
  draftBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: DS.brand,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: DS.surface2,
    zIndex: 10,
  },
  draftBadgeText: {
    fontSize: 10,
    fontFamily: JAKARTA.bold,
    color: '#FFFFFF',
  },
});
