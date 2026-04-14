import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { fetchCustomers } from '../../lib/api/customers';
import { fetchOrders } from '../../lib/api/orders';
import { fetchVisits } from '../../lib/api/visits';
import { supabase } from '../../lib/supabase';

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

  const loadStats = async () => {
    if (!user) return;
    
    try {
      const [customers, orders, visits] = await Promise.all([
        fetchCustomers(user.id, user.role),
        fetchOrders(user.id, user.role),
        fetchVisits(user.id, user.role),
      ]);

      setStats({
        customers: customers.length,
        orders: orders.length,
        visits: visits.length,
        pendingOrders: orders.filter(o => o.status === 'confirmed' || o.status === 'processing').length,
      });

      // Load monthly sales (net of IVA and Accisa)
      await loadMonthlySales();
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadMonthlySales = async () => {
    if (!user) return;
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

      setMonthlySales({
        netto,
        accisa,
        iva,
        lordo: netto + accisa + iva,
        orderCount: monthOrders?.length || 0,
        monthLabel,
      });
    } catch (error) {
      console.error('Error loading monthly sales:', error);
    }
  };

  useEffect(() => {
    loadStats();
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const quickActions = [
    {
      title: 'Raccolta Ordine',
      icon: 'cart',
      color: '#059669',
      onPress: () => router.push('/order-collection-v2'),
    },
    {
      title: 'Bozze Ordine',
      icon: 'document-text-outline',
      color: '#F59E0B',
      onPress: () => router.push('/drafts'),
    },
    {
      title: 'Nuova Ispezione',
      icon: 'camera',
      color: '#8B5CF6',
      onPress: () => router.push('/inspection/new'),
    },
    {
      title: 'Anagrafica',
      icon: 'document-text',
      color: '#F59E0B',
      onPress: () => router.push('/anagrafica'),
    },
    {
      title: 'Rivendite No Mappa',
      icon: 'globe',
      color: '#EF4444',
      onPress: () => router.push('/rivendite-no-mappa'),
    },
    {
      title: 'Vedi Mappa',
      icon: 'map',
      color: '#3B82F6',
      onPress: () => router.push('/(tabs)/map'),
    },
    {
      title: 'Profilo',
      icon: 'person-circle',
      color: '#6B7280',
      onPress: () => router.push('/(tabs)/profile'),
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Ciao, {profile?.full_name || 'Utente'}!</Text>
        <Text style={styles.subtitle}>Ecco il tuo riepilogo giornaliero</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: '#EEF2FF' }]}>
          <View style={styles.statRow}>
            <Ionicons name="people" size={18} color="#3B82F6" />
            <Text style={styles.statNumber}>{stats.customers}</Text>
          </View>
          <Text style={styles.statLabel}>Clienti</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#ECFDF5' }]}>
          <View style={styles.statRow}>
            <Ionicons name="cart" size={18} color="#10B981" />
            <Text style={styles.statNumber}>{stats.orders}</Text>
          </View>
          <Text style={styles.statLabel}>Ordini</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
          <View style={styles.statRow}>
            <Ionicons name="location" size={18} color="#F59E0B" />
            <Text style={styles.statNumber}>{stats.visits}</Text>
          </View>
          <Text style={styles.statLabel}>Visite</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#FEE2E2' }]}>
          <View style={styles.statRow}>
            <Ionicons name="time" size={18} color="#EF4444" />
            <Text style={styles.statNumber}>{stats.pendingOrders}</Text>
          </View>
          <Text style={styles.statLabel}>In Attesa</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Azioni Rapide</Text>
      <View style={styles.actionsGrid}>
        {quickActions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={styles.actionCard}
            onPress={action.onPress}
          >
            <View style={[styles.actionIcon, { backgroundColor: action.color + '20' }]}>
              <Ionicons name={action.icon as any} size={24} color={action.color} />
            </View>
            <Text style={styles.actionTitle}>{action.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

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
    backgroundColor: '#F3F4F6',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: '22%',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
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
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 24,
  },
  actionCard: {
    width: '47%',
    margin: '1.5%',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
    textAlign: 'center',
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
