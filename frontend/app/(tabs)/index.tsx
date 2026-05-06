import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Pressable,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useAuthStore } from '../../store/authStore';
import { fetchCustomers } from '../../lib/api/customers';
import { fetchOrders } from '../../lib/api/orders';
import { fetchVisits } from '../../lib/api/visits';
import { supabase } from '../../lib/supabase';
import { getDraftCount } from '../../lib/drafts';
import { getCache, setCache, clearCache } from '../../lib/memory-cache';
import { useRimborsiAccess } from '../../hooks/useRimborsiAccess';
import { Avatar } from '../../components/Avatar';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { EmptyState } from '../../components/EmptyState';
import { COLORS, GRADIENTS, FONTS, FONT_SIZE, SPACING, RADIUS, SHADOWS, getTimeGreeting } from '../../lib/theme';
import { hap } from '../../lib/haptics';

export default function Dashboard() {
  const router = useRouter();
  const { user, profile, logout } = useAuthStore();
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
  const [upcomingAppointments, setUpcomingAppointments] = useState<any[]>([]);

  const loadStats = async (force: boolean = false) => {
    if (!user) return;

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
        return;
      }
    }

    try {
      const [customers, orders, visits] = await Promise.all([
        fetchCustomers(user.id, user.role, user.branchId),
        fetchOrders(user.id, user.role, user.branchId),
        fetchVisits(user.id, user.role, user.branchId),
      ]);

      const newStats = {
        customers: customers.length,
        orders: orders.length,
        visits: visits.length,
        pendingOrders: orders.filter(o => o.status === 'confirmed' || o.status === 'processing').length,
      };
      setStats(newStats);

      // Load monthly sales (net of IVA and Accisa)
      const ms = await loadMonthlySales();

      // Cache for 60 seconds
      setCache(cacheKey, { ...newStats, monthlySales: ms }, 60_000);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadMonthlySales = async () => {
    if (!user) return null;
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const months = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
        'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
      const monthLabel = `${months[now.getMonth()]} ${now.getFullYear()}`;

      const { data: monthOrders } = await supabase
        .from('orders')
        .select('id, order_items (quantity, line_total, product:products (accisa, iva_percentage))')
        .gte('created_at', monthStart)
        .eq('agent_id', user.id);

      let netto = 0;
      let accisa = 0;
      let iva = 0;

      for (const order of (monthOrders || [])) {
        for (const item of (order.order_items || [])) {
          netto += item.line_total || 0;
          const accisaUnit = (item.product as any)?.accisa || 0;
          accisa += accisaUnit * (item.quantity || 0);
          const ivaRate = (item.product as any)?.iva_percentage || 22;
          iva += (item.line_total || 0) * (ivaRate / 100);
        }
      }

      const ms = {
        netto,
        accisa,
        iva,
        lordo: netto + accisa + iva,
        orderCount: monthOrders?.length || 0,
        monthLabel,
      };
      setMonthlySales(ms);
      return ms;
    } catch (error) {
      console.error('Error loading monthly sales:', error);
      return null;
    }
  };

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Refresh on focus: drafts + appointments always (cheap), stats from cache (60s TTL)
  useFocusEffect(
    useCallback(() => {
      getDraftCount().then(setDraftCount);
      loadUpcomingAppointments();
      // Stats: respects 60s cache, only refetches if expired
      loadStats(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id])
  );

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
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (user?.id) clearCache(`dashboard:stats:${user.id}`);
    await loadStats(true);
    const dc = await getDraftCount();
    setDraftCount(dc);
    await loadUpcomingAppointments();
    setRefreshing(false);
  };

  const { hasAccess: hasRimborsiAccess } = useRimborsiAccess();

  // Quick actions grouped by section, with gradient colors per action
  const actionGroups = [
    {
      title: 'Vendite',
      actions: [
        { title: 'Raccolta Ordine', icon: 'cart' as const, gradient: GRADIENTS.success, onPress: () => router.push('/order-collection-v2') },
        { title: 'Bozze Ordine', icon: 'document-text-outline' as const, gradient: GRADIENTS.warning, badge: draftCount, onPress: () => router.push('/drafts') },
        { title: 'Sostituzioni', icon: 'swap-horizontal-outline' as const, gradient: GRADIENTS.purple, onPress: () => router.push('/substitutions') },
        ...(hasRimborsiAccess ? [{ title: 'Rimborsi', icon: 'receipt-outline' as const, gradient: GRADIENTS.teal, onPress: () => router.push('/rimborsi') }] : []),
      ],
    },
    {
      title: 'Punti Vendita',
      actions: [
        { title: 'Nuova Ispezione', icon: 'camera' as const, gradient: GRADIENTS.ocean, onPress: () => router.push('/inspection/new') },
        { title: 'Anagrafica', icon: 'document-text' as const, gradient: GRADIENTS.danger, onPress: () => router.push('/anagrafica') },
        { title: 'No Mappa', icon: 'globe' as const, gradient: GRADIENTS.primary, onPress: () => router.push('/rivendite-no-mappa') },
        { title: 'Reclami', icon: 'flag-outline' as const, gradient: GRADIENTS.pink, onPress: () => router.push('/orphan-claims') },
      ],
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header — Avatar + greeting + logout */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
        <Avatar name={profile?.full_name} email={profile?.email} size={48} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.greeting}>{getTimeGreeting()}</Text>
          <Text style={styles.userName} numberOfLines={1}>{profile?.full_name || 'Utente'}</Text>
        </View>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            hap.light();
            Alert.alert('Logout', 'Sei sicuro di voler uscire?', [
              { text: 'Annulla', style: 'cancel' },
              { text: 'Esci', style: 'destructive', onPress: async () => { await logout(); router.replace('/login'); } },
            ]);
          }}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </Animated.View>

      {/* Stats Cards — gradient + count-up animation */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.statsGrid}>
        {[
          { label: 'Clienti', value: stats.customers, icon: 'people', gradient: GRADIENTS.primary as [string, string] },
          { label: 'Ordini', value: stats.orders, icon: 'cart', gradient: GRADIENTS.success as [string, string] },
          { label: 'Visite', value: stats.visits, icon: 'location', gradient: GRADIENTS.warning as [string, string] },
          { label: 'In Attesa', value: stats.pendingOrders, icon: 'time', gradient: GRADIENTS.danger as [string, string] },
        ].map((s, i) => (
          <LinearGradient
            key={s.label}
            colors={s.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statCard}
          >
            <View style={styles.statIconCircle}>
              <Ionicons name={s.icon as any} size={16} color="#FFF" />
            </View>
            <AnimatedNumber
              value={s.value}
              duration={700 + i * 100}
              style={styles.statNumberGrad}
            />
            <Text style={styles.statLabelGrad}>{s.label}</Text>
          </LinearGradient>
        ))}
      </Animated.View>

      {/* Quick Actions — grouped by section, with gradient icons */}
      {actionGroups.map((group, gIdx) => (
        <Animated.View key={group.title} entering={FadeInDown.delay(200 + gIdx * 80).duration(400)}>
          <Text style={styles.sectionTitle}>{group.title}</Text>
          <View style={styles.actionsGrid}>
            {group.actions.map((action, idx) => (
              <Pressable
                key={action.title}
                style={({ pressed }) => [
                  styles.actionCard,
                  pressed && { transform: [{ scale: 0.96 }], opacity: 0.85 },
                ]}
                onPress={() => { hap.light(); action.onPress(); }}
              >
                <View style={{ position: 'relative' }}>
                  <LinearGradient
                    colors={action.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.actionIconGrad}
                  >
                    <Ionicons name={action.icon} size={22} color="#FFF" />
                  </LinearGradient>
                  {(action as any).badge > 0 && (
                    <View style={styles.draftBadge}>
                      <Text style={styles.draftBadgeText}>{(action as any).badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.actionTitle}>{action.title}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      ))}

      {/* Prossimi Appuntamenti */}
      <Text style={styles.sectionTitle}>Prossimi Appuntamenti</Text>
      {upcomingAppointments.length > 0 ? (
        <View style={{ marginBottom: 16 }}>
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
                style={styles.appointmentCard}
                onPress={() => router.push('/(tabs)/calendar')}
                activeOpacity={0.7}
              >
                <View style={[styles.appointmentDateBadge, isToday && { backgroundColor: '#DC2626' }, isTomorrow && { backgroundColor: '#F59E0B' }]}>
                  <Text style={styles.appointmentDateText}>{isToday ? 'OGGI' : isTomorrow ? 'DOMANI' : dayStr.toUpperCase()}</Text>
                  <Text style={styles.appointmentTimeText}>{timeStr}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.appointmentTitle} numberOfLines={1}>{customerName}</Text>
                  <Text style={styles.appointmentSub} numberOfLines={1}>
                    {typeLabel ? `${typeLabel}` : ''}{typeLabel && customerCity ? ' · ' : ''}{customerCity}
                  </Text>
                  {apt.notes ? <Text style={styles.appointmentNotes} numberOfLines={1}>{apt.notes}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyAppointments}>
          <Ionicons name="calendar-outline" size={28} color="#D1D5DB" />
          <Text style={styles.emptyAppointmentsText}>Nessun appuntamento nei prossimi 7 giorni</Text>
        </View>
      )}

      {/* Venduto del Mese Corrente */}
      <Text style={styles.sectionTitle}>
        Venduto {monthlySales.monthLabel ? `- ${monthlySales.monthLabel}` : 'del Mese'}
      </Text>
      <View style={styles.salesCard}>
        <View style={styles.salesMainRow}>
          <View style={styles.salesMainBlock}>
            <Text style={styles.salesMainLabel}>Netto (no IVA, no Accisa)</Text>
            <Text style={styles.salesMainValue}>
              € {monthlySales.netto.toFixed(2).replace('.', ',')}
            </Text>
          </View>
          <View style={styles.salesBadge}>
            <Ionicons name="receipt-outline" size={16} color="#3B82F6" />
            <Text style={styles.salesBadgeText}>{monthlySales.orderCount} ordini</Text>
          </View>
        </View>
        <View style={styles.salesDivider} />
        <View style={styles.salesDetailsRow}>
          <View style={styles.salesDetailItem}>
            <Text style={styles.salesDetailLabel}>Accisa</Text>
            <Text style={styles.salesDetailValue}>
              € {monthlySales.accisa.toFixed(2).replace('.', ',')}
            </Text>
          </View>
          <View style={styles.salesDetailItem}>
            <Text style={styles.salesDetailLabel}>IVA</Text>
            <Text style={styles.salesDetailValue}>
              € {monthlySales.iva.toFixed(2).replace('.', ',')}
            </Text>
          </View>
          <View style={styles.salesDetailItem}>
            <Text style={styles.salesDetailLabel}>Lordo</Text>
            <Text style={[styles.salesDetailValue, { fontWeight: '700' }]}>
              € {monthlySales.lordo.toFixed(2).replace('.', ',')}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  content: {
    padding: SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : 28,
    paddingBottom: 120, // space for floating tab bar
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  greeting: {
    fontSize: FONT_SIZE.md,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  userName: {
    fontSize: FONT_SIZE.xxl,
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginTop: 2,
  },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  subtitle: {
    fontSize: FONT_SIZE.lg,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: SPACING.xl,
  },
  statCard: {
    flex: 1,
    minWidth: '22%',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    ...SHADOWS.md,
  },
  statIconCircle: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 6,
  },
  statNumberGrad: {
    fontSize: 22,
    fontFamily: FONTS.bold,
    color: '#FFF',
    letterSpacing: -0.3,
  },
  statLabelGrad: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: FONTS.semibold,
    color: COLORS.textMuted,
    marginBottom: 12,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: SPACING.lg,
  },
  actionCard: {
    flexBasis: '23%',
    flexGrow: 1,
    backgroundColor: COLORS.surface,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionIconGrad: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    ...SHADOWS.sm,
  },
  actionTitle: {
    fontSize: 11.5,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 14,
  },
  draftBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 10,
  },
  draftBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  appointmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  appointmentDateBadge: {
    backgroundColor: '#1E40AF',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 56,
  },
  appointmentDateText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  appointmentTimeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  appointmentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  appointmentSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  appointmentNotes: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 2,
  },
  emptyAppointments: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyAppointmentsText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  salesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  salesMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  salesMainBlock: {
    flex: 1,
  },
  salesMainLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  salesMainValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E40AF',
  },
  salesBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  salesBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3B82F6',
  },
  salesDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
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
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  salesDetailValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
});
