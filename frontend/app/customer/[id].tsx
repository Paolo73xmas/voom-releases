import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchCustomerById } from '../../lib/api/customers';
import { supabase } from '../../lib/supabase';
import { Customer } from '../../types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface CustomerOrder {
  id: string;
  order_date: string;
  total_amount: number;
  status: string;
  line_total_sum?: number;
}

interface CustomerVisit {
  id: string;
  visit_date: string;
  visit_type: string;
  notes: string | null;
}

interface CustomerStats {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  totalVisits: number;
  daysSinceLastOrder: number | null;
  daysSinceLastVisit: number | null;
}

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentOrders, setRecentOrders] = useState<CustomerOrder[]>([]);
  const [recentVisits, setRecentVisits] = useState<CustomerVisit[]>([]);
  const [stats, setStats] = useState<CustomerStats>({
    totalOrders: 0, totalRevenue: 0, avgOrderValue: 0,
    totalVisits: 0, daysSinceLastOrder: null, daysSinceLastVisit: null,
  });

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [customerData, ordersRes, visitsRes] = await Promise.all([
        fetchCustomerById(id as string),
        supabase
          .from('orders')
          .select('id, order_date, total_amount, status')
          .eq('customer_id', id)
          .order('order_date', { ascending: false })
          .limit(50),
        supabase
          .from('visits')
          .select('id, visit_date, visit_type, notes')
          .eq('customer_id', id)
          .order('visit_date', { ascending: false })
          .limit(20),
      ]);

      setCustomer(customerData);

      const orders = ordersRes.data || [];
      setRecentOrders(orders.slice(0, 5));

      const visits = visitsRes.data || [];
      setRecentVisits(visits.slice(0, 5));

      // Calc stats
      const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
      const now = new Date();
      let daysSinceLastOrder: number | null = null;
      let daysSinceLastVisit: number | null = null;

      if (orders.length > 0 && orders[0].order_date) {
        daysSinceLastOrder = Math.floor((now.getTime() - new Date(orders[0].order_date).getTime()) / 86400000);
      }
      if (visits.length > 0 && visits[0].visit_date) {
        daysSinceLastVisit = Math.floor((now.getTime() - new Date(visits[0].visit_date).getTime()) / 86400000);
      }

      setStats({
        totalOrders: orders.length,
        totalRevenue,
        avgOrderValue: orders.length > 0 ? totalRevenue / orders.length : 0,
        totalVisits: visits.length,
        daysSinceLastOrder,
        daysSinceLastVisit,
      });
    } catch (error) {
      console.error('Error loading customer:', error);
      Alert.alert('Errore', 'Impossibile caricare il cliente');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return '-';
    try { return format(new Date(d), 'dd MMM yyyy', { locale: it }); }
    catch { return d; }
  };

  const fmtCurrency = (n: number) => '\u20AC ' + n.toFixed(2).replace('.', ',');

  const getStatusStyle = (status: string): { label: string; bg: string; color: string } => {
    switch (status) {
      case 'confirmed': return { label: 'Confermato', bg: '#DCFCE7', color: '#166534' };
      case 'pending': return { label: 'In Attesa', bg: '#FEF3C7', color: '#92400E' };
      case 'shipped': return { label: 'Spedito', bg: '#DBEAFE', color: '#1D4ED8' };
      case 'delivered': return { label: 'Consegnato', bg: '#D1FAE5', color: '#065F46' };
      case 'cancelled': return { label: 'Annullato', bg: '#FEE2E2', color: '#991B1B' };
      default: return { label: status, bg: '#E5E7EB', color: '#374151' };
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#C2410C' }]} edges={['top']}>
        <View style={styles.centered}><ActivityIndicator size="large" color="#C2410C" /></View>
      </SafeAreaView>
    );
  }

  if (!customer) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#C2410C' }]} edges={['top']}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Cliente non trovato</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.linkText}>Torna indietro</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#C2410C' }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{customer.business_name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <View style={[styles.catBadge, customer.category === 'client' ? styles.clientBg : styles.prospectBg]}>
              <Text style={[styles.catBadgeText, customer.category === 'client' ? styles.clientColor : styles.prospectColor]}>
                {customer.category === 'client' ? 'Cliente' : 'Prospect'}
              </Text>
            </View>
            {customer.city && (
              <Text style={styles.headerSub}>{customer.city}{customer.province ? ` (${customer.province})` : ''}</Text>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Quick Actions Bar */}
        <View style={styles.actionsBar}>
          <TouchableOpacity style={styles.actionCircle} onPress={() => customer.contact_phone && Linking.openURL(`tel:${customer.contact_phone}`)}>
            <Ionicons name="call" size={20} color="#10B981" />
            <Text style={styles.actionCircleLabel}>Chiama</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCircle} onPress={() => customer.contact_email && Linking.openURL(`mailto:${customer.contact_email}`)}>
            <Ionicons name="mail" size={20} color="#3B82F6" />
            <Text style={styles.actionCircleLabel}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCircle} onPress={() => {
            if (customer.latitude && customer.longitude) {
              Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${customer.latitude},${customer.longitude}`);
            }
          }}>
            <Ionicons name="navigate" size={20} color="#8B5CF6" />
            <Text style={styles.actionCircleLabel}>Naviga</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCircle} onPress={() => router.push(`/order-collection-v2?customerId=${encodeURIComponent(customer.id)}`)}>
            <Ionicons name="cart" size={20} color="#F59E0B" />
            <Text style={styles.actionCircleLabel}>Ordine</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionCircle} onPress={() => router.push(`/inspection/new?customerId=${encodeURIComponent(customer.id)}`)}>
            <Ionicons name="camera" size={20} color="#EF4444" />
            <Text style={styles.actionCircleLabel}>Ispezione</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: '#EEF2FF' }]}>
            <View style={styles.statInner}>
              <Ionicons name="cart-outline" size={16} color="#3B82F6" />
              <Text style={styles.statValue}>{stats.totalOrders}</Text>
            </View>
            <Text style={styles.statLabel}>Ordini</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#ECFDF5' }]}>
            <View style={styles.statInner}>
              <Ionicons name="cash-outline" size={16} color="#10B981" />
              <Text style={styles.statValue}>{fmtCurrency(stats.totalRevenue)}</Text>
            </View>
            <Text style={styles.statLabel}>Fatturato</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
            <View style={styles.statInner}>
              <Ionicons name="walk-outline" size={16} color="#F59E0B" />
              <Text style={styles.statValue}>{stats.totalVisits}</Text>
            </View>
            <Text style={styles.statLabel}>Visite</Text>
          </View>
        </View>

        {/* Days Since Row */}
        <View style={styles.daysRow}>
          <View style={styles.daysItem}>
            <Ionicons name="time-outline" size={14} color="#6B7280" />
            <Text style={styles.daysText}>
              Ultimo ordine: {stats.daysSinceLastOrder !== null ? `${stats.daysSinceLastOrder}gg fa` : 'mai'}
            </Text>
          </View>
          <View style={styles.daysItem}>
            <Ionicons name="time-outline" size={14} color="#6B7280" />
            <Text style={styles.daysText}>
              Ultima visita: {stats.daysSinceLastVisit !== null ? `${stats.daysSinceLastVisit}gg fa` : 'mai'}
            </Text>
          </View>
        </View>

        {/* Recent Orders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Ordini Recenti</Text>
            {stats.totalOrders > 5 && (
              <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
                <Text style={styles.seeAllLink}>Vedi tutti</Text>
              </TouchableOpacity>
            )}
          </View>
          {recentOrders.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="cart-outline" size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>Nessun ordine</Text>
            </View>
          ) : (
            recentOrders.map((order) => {
              const st = getStatusStyle(order.status);
              return (
                <TouchableOpacity
                  key={order.id}
                  style={styles.orderCard}
                  onPress={() => router.push(`/order/${order.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.orderCardLeft}>
                    <Text style={styles.orderDate}>{fmtDate(order.order_date)}</Text>
                    <View style={[styles.orderStatusBadge, { backgroundColor: st.bg }]}>
                      <Text style={[styles.orderStatusText, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                  <View style={styles.orderCardRight}>
                    <Text style={styles.orderAmount}>{fmtCurrency(order.total_amount || 0)}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Recent Visits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visite Recenti</Text>
          {recentVisits.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="walk-outline" size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>Nessuna visita</Text>
            </View>
          ) : (
            recentVisits.map((visit) => (
              <View key={visit.id} style={styles.visitCard}>
                <View style={styles.visitDot} />
                <View style={styles.visitContent}>
                  <View style={styles.visitRow}>
                    <Text style={styles.visitDate}>{fmtDate(visit.visit_date)}</Text>
                    <View style={styles.visitTypeBadge}>
                      <Text style={styles.visitTypeText}>{visit.visit_type || 'Visita'}</Text>
                    </View>
                  </View>
                  {visit.notes && <Text style={styles.visitNotes} numberOfLines={2}>{visit.notes}</Text>}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contatto</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="person-outline" label="Nome" value={`${customer.contact_name || ''} ${customer.contact_surname || ''}`.trim() || '-'} />
            <InfoRow icon="call-outline" label="Telefono" value={customer.contact_phone || '-'} />
            <InfoRow icon="mail-outline" label="Email" value={customer.contact_email || '-'} />
          </View>
        </View>

        {/* Address */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Indirizzo</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="location-outline" label="Via" value={customer.address || '-'} />
            <InfoRow icon="business-outline" label="Luogo" value={`${customer.city || ''}, ${customer.province || ''} ${customer.postal_code || ''}`.trim()} />
          </View>
        </View>

        {/* Fiscal */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dati Fiscali</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="card-outline" label="P.IVA" value={customer.vat_number || '-'} />
            <InfoRow icon="document-text-outline" label="C.F." value={customer.fiscal_code || '-'} />
            {customer.pec && <InfoRow icon="at-outline" label="PEC" value={customer.pec} />}
            {customer.sdi && <InfoRow icon="code-outline" label="SDI" value={customer.sdi} />}
          </View>
        </View>

        {/* Notes */}
        {customer.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Note</Text>
            <View style={styles.infoCard}>
              <Text style={styles.notesText}>{customer.notes}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon as any} size={16} color="#9CA3AF" />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: '#EF4444', marginTop: 12 },
  linkText: { fontSize: 14, color: '#3B82F6', marginTop: 8 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#C2410C',
    borderBottomWidth: 1,
    borderBottomColor: '#9A3412',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  headerSub: { fontSize: 11, color: '#FED7AA' },
  catBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  catBadgeText: { fontSize: 10, fontWeight: '600' },
  clientBg: { backgroundColor: 'rgba(255,255,255,0.2)' },
  prospectBg: { backgroundColor: 'rgba(255,255,255,0.15)' },
  clientColor: { color: '#FFFFFF' },
  prospectColor: { color: '#FED7AA' },

  body: { flex: 1, backgroundColor: '#F3F4F6' },
  bodyContent: { padding: 16 },

  // Quick Actions
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  actionCircle: { alignItems: 'center', gap: 4 },
  actionCircleLabel: { fontSize: 10, color: '#6B7280', fontWeight: '500' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statCard: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center' },
  statInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statValue: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  statLabel: { fontSize: 10, color: '#6B7280', marginTop: 2 },

  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 16,
  },
  daysItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  daysText: { fontSize: 11, color: '#6B7280' },

  // Sections
  section: { marginBottom: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#4B5563', textTransform: 'uppercase', marginBottom: 8, marginLeft: 2 },
  seeAllLink: { fontSize: 12, color: '#3B82F6', fontWeight: '600' },

  // Order cards
  orderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
  },
  orderCardLeft: { gap: 4 },
  orderDate: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  orderStatusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start' },
  orderStatusText: { fontSize: 10, fontWeight: '600' },
  orderCardRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderAmount: { fontSize: 15, fontWeight: '700', color: '#059669' },

  // Visit cards (timeline style)
  visitCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    gap: 10,
  },
  visitDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6', marginTop: 5 },
  visitContent: { flex: 1 },
  visitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  visitDate: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  visitTypeBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  visitTypeText: { fontSize: 10, fontWeight: '600', color: '#3B82F6' },
  visitNotes: { fontSize: 12, color: '#6B7280', marginTop: 4 },

  // Info cards
  infoCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 4 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  infoLabel: { fontSize: 13, color: '#6B7280', marginLeft: 10, width: 70 },
  infoValue: { flex: 1, fontSize: 13, color: '#1F2937', textAlign: 'right' },

  notesText: { fontSize: 13, color: '#4B5563', padding: 12, lineHeight: 20 },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 13, color: '#9CA3AF', marginTop: 8 },
});
