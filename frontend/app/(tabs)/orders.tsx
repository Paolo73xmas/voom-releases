import React, { useState, useCallback, memo } from 'react';
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
import { fetchOrdersPage, getOrderStatusLabel, getOrderStatusColor } from '../../lib/api/orders';
import { Order } from '../../types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { useDebounce } from '../../hooks/useDebounce';
import { SkeletonList } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { hap } from '../../lib/haptics';
import { COLORS } from '../../lib/theme';
import { usePagedHistory } from '../../hooks/usePagedHistory';
import { HistoryFooter, ReadErrorNotice } from '../../components/HistoryFeedback';

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
      testID={`order-card-${item.id}`}
      accessibilityRole="button"
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

      {!!item.customer?.city && (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color="#9CA3AF" />
          <Text style={styles.locationText}>
            {item.customer.city}, {item.customer.province}
          </Text>
        </View>
      )}

      <View style={styles.orderFooter}>
        <Text style={styles.totalLabel}>Totale</Text>
        <Text testID={`order-card-${item.id}-total`} style={styles.totalAmount}>{formatCurrency(item.total_amount)}</Text>
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
  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounce(searchText, 300);
  const query = debouncedSearch.trim().length >= 3 ? debouncedSearch.trim() : '';
  const history = usePagedHistory(user ? `${user.id}:${user.role}:${user.branchId || ''}:${query}` : '',
    offset => fetchOrdersPage(user!.id, user!.role, user!.branchId, { offset, search: query }));
  const { rows: filteredOrders, loading, refreshing, error: errorMessage } = history;
  const onRefresh = history.refresh;

  const handlePressOrder = useCallback((id: string) => {
    hap.light();
    router.push(`/order/${id}`);
  }, [router]);

  const renderOrder = useCallback(({ item }: { item: Order }) => (
    <OrderCard item={item} onPress={handlePressOrder} />
  ), [handlePressOrder]);

  const keyExtractor = useCallback((item: Order) => item.id, []);

  const unknownCount = loading || (!!errorMessage && filteredOrders.length === 0);
  const stats = { total: unknownCount ? '—' : history.count,
    delivered: unknownCount ? '—' : history.totals.delivered ?? 0,
    inProgress: unknownCount ? '—' : history.totals.inProgress ?? 0 };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#9CA3AF" />
          <TextInput
            testID="orders-search"
            style={styles.searchInput}
            placeholder="Cliente o ordine (min. 3 caratteri)..."
            placeholderTextColor={COLORS.textLight}
            value={searchText}
            onChangeText={setSearchText}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {searchText.length > 0 && (
            <TouchableOpacity testID="orders-search-clear" onPress={() => setSearchText('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
        {searchText.length > 0 && searchText.length < 3 && (
          <Text style={styles.searchHint}>Inserisci almeno 3 caratteri per cercare</Text>
        )}
        {debouncedSearch.length >= 3 && (
          <Text testID="orders-search-count" style={styles.searchResult}>
            {loading ? 'Ricerca in corso...' : `${stats.total} ordini trovati per "${debouncedSearch}"`}
          </Text>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text testID="orders-total-count" style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Totali</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text testID="orders-delivered-count" style={styles.statNumber}>{stats.delivered}</Text>
          <Text style={styles.statLabel}>Consegnati</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text testID="orders-progress-count" style={styles.statNumber}>{stats.inProgress}</Text>
          <Text style={styles.statLabel}>In Corso</Text>
        </View>
      </View>

      {/* Orders List - FlashList */}
      <ReadErrorNotice id="orders" message={errorMessage} onRetry={history.retry} busy={refreshing || history.loadingMore} />
      <FlatList
        testID="orders-list"
        data={loading ? [] : filteredOrders}
        keyboardShouldPersistTaps="handled"
        renderItem={renderOrder}
        keyExtractor={keyExtractor}
        contentContainerStyle={[styles.listContent, styles.listBottomSpace]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListFooterComponent={!errorMessage && !loading ? <HistoryFooter id="orders" loaded={filteredOrders.length} count={history.count} hasMore={history.hasMore} busy={history.loadingMore} onMore={history.loadMore} /> : null}
        ListEmptyComponent={loading ? <SkeletonList count={6} height={130} /> : !errorMessage ?
          <EmptyState
            icon="cart-outline"
            title="Nessun ordine trovato"
            message={debouncedSearch ? 'Modifica la ricerca per trovare ordini' : 'Crea il tuo primo ordine dal Dashboard'}
            iconGradient="success"
          /> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listBottomSpace: { paddingBottom: 120 },
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
