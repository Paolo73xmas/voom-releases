import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { fetchOrders, getOrderStatusLabel, getOrderStatusColor } from '../../lib/api/orders';
import { Order } from '../../types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useDebounce } from '../../hooks/useDebounce';
import { SkeletonList } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { hap } from '../../lib/haptics';
import { COLORS } from '../../lib/theme';

const formatDate = (dateString: string) => {
  try {
    return format(new Date(dateString), 'dd MMM yyyy', { locale: it });
  } catch {
    return dateString;
  }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

// Memoized row
const OrderCard = memo(function OrderCard({
  item,
  onPress,
}: {
  item: Order;
  onPress: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={() => onPress(item.id)}
    >
      <View style={styles.orderHeader}>
        <View>
          <Text style={styles.orderNumber}>#{item.order_number}</Text>
          <Text style={styles.orderDate}>{formatDate(item.order_date)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getOrderStatusColor(item.status) + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: getOrderStatusColor(item.status) }]} />
          <Text style={[styles.statusText, { color: getOrderStatusColor(item.status) }]}>
            {getOrderStatusLabel(item.status)}
          </Text>
        </View>
      </View>

      <View style={styles.customerRow}>
        <Ionicons name="business-outline" size={16} color="#6B7280" />
        <Text style={styles.customerName} numberOfLines={1}>
          {item.customer?.business_name || 'Cliente'}
        </Text>
      </View>

      {item.customer?.city && (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color="#9CA3AF" />
          <Text style={styles.locationText}>
            {item.customer.city}, {item.customer.province}
          </Text>
        </View>
      )}

      <View style={styles.orderFooter}>
        <Text style={styles.totalLabel}>Totale</Text>
        <Text style={styles.totalAmount}>{formatCurrency(item.total_amount)}</Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color="#D1D5DB"
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
});

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounce(searchText, 300);

  const loadOrders = useCallback(async (force: boolean = false) => {
    if (!user) return;
    try {
      const data = await fetchOrders(user.id, user.role, user.branchId, { force });
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadOrders(true);
    setRefreshing(false);
  }, [loadOrders]);

  // Filter orders by searching across all customer fields (min 3 chars)
  const filteredOrders = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (q.length < 3) return orders;

    return orders.filter(order => {
      const c = order.customer;
      if (!c) return false;

      const fields = [
        c.business_name, c.address, c.city, c.province, c.postal_code,
        c.contact_name, c.contact_surname, c.contact_phone, c.contact_email,
        c.vat_number, c.fiscal_code, c.pec, c.sdi, order.order_number,
      ];

      return fields.some(f => f && f.toLowerCase().includes(q));
    });
  }, [orders, debouncedSearch]);

  const handlePressOrder = useCallback((id: string) => {
    hap.light();
    router.push(`/order/${id}`);
  }, [router]);

  const renderOrder = useCallback(({ item }: { item: Order }) => (
    <OrderCard item={item} onPress={handlePressOrder} />
  ), [handlePressOrder]);

  const keyExtractor = useCallback((item: Order) => item.id, []);

  const stats = useMemo(() => ({
    total: filteredOrders.length,
    delivered: filteredOrders.filter(o => o.status === 'delivered').length,
    inProgress: filteredOrders.filter(o => ['confirmed', 'processing', 'shipped'].includes(o.status)).length,
  }), [filteredOrders]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <View style={{ flex: 1, marginLeft: 8, height: 14, backgroundColor: COLORS.border, borderRadius: 4 }} />
          </View>
        </View>
        <SkeletonList count={6} height={130} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca per cliente (min. 3 caratteri)..."
            placeholderTextColor={COLORS.textLight}
            value={searchText}
            onChangeText={setSearchText}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
        {searchText.length > 0 && searchText.length < 3 && (
          <Text style={styles.searchHint}>Inserisci almeno 3 caratteri per cercare</Text>
        )}
        {debouncedSearch.length >= 3 && (
          <Text style={styles.searchResult}>
            {filteredOrders.length} {filteredOrders.length === 1 ? 'ordine trovato' : 'ordini trovati'} per "{debouncedSearch}"
          </Text>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Totali</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.delivered}</Text>
          <Text style={styles.statLabel}>Consegnati</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.inProgress}</Text>
          <Text style={styles.statLabel}>In Corso</Text>
        </View>
      </View>

      {/* Orders List - FlashList */}
      <FlatList
        data={filteredOrders}
        renderItem={renderOrder}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="cart-outline"
            title="Nessun ordine trovato"
            message={debouncedSearch ? 'Modifica la ricerca per trovare ordini' : 'Crea il tuo primo ordine dal Dashboard'}
            iconGradient="success"
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },
  searchHint: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 4,
    marginLeft: 4,
  },
  searchResult: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '600',
    marginTop: 4,
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  orderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  orderDate: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 8,
    flex: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationText: {
    fontSize: 13,
    color: COLORS.textLight,
    marginLeft: 6,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  totalLabel: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#7C3AED',
  },
  chevron: {
    position: 'absolute',
    right: 12,
    top: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textLight,
    marginTop: 12,
  },
});
