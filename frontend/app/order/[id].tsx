import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchOrderById, getOrderStatusLabel, getOrderStatusColor } from '../../lib/api/orders';
import { Order } from '../../types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    try {
      const data = await fetchOrderById(id as string);
      setOrder(data);
    } catch (error) {
      console.error('Error loading order:', error);
      Alert.alert('Errore', 'Impossibile caricare l\'ordine');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMMM yyyy, HH:mm', { locale: it });
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={styles.errorText}>Ordine non trovato</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Order Header */}
      <View style={styles.headerCard}>
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNumber}>Ordine #{order.order_number}</Text>
            <Text style={styles.orderDate}>{formatDate(order.order_date)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getOrderStatusColor(order.status) + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: getOrderStatusColor(order.status) }]} />
            <Text style={[styles.statusText, { color: getOrderStatusColor(order.status) }]}>
              {getOrderStatusLabel(order.status)}
            </Text>
          </View>
        </View>

        {order.is_foreign && (
          <View style={styles.foreignBadge}>
            <Ionicons name="globe-outline" size={16} color="#8B5CF6" />
            <Text style={styles.foreignText}>Ordine Estero</Text>
          </View>
        )}
      </View>

      {/* Customer Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Cliente</Text>
        <View style={styles.card}>
          <View style={styles.customerRow}>
            <View style={styles.customerAvatar}>
              <Text style={styles.avatarText}>
                {order.customer?.business_name?.charAt(0)?.toUpperCase() || 'C'}
              </Text>
            </View>
            <View style={styles.customerInfo}>
              <Text style={styles.customerName}>{order.customer?.business_name || 'Cliente'}</Text>
              {order.customer?.city && (
                <Text style={styles.customerAddress}>
                  {order.customer.city}, {order.customer.province}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* Order Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Prodotti ({order.order_items?.length || 0})</Text>
        <View style={styles.card}>
          {order.order_items && order.order_items.length > 0 ? (
            order.order_items.map((item, index) => (
              <View key={item.id}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.product?.name || 'Prodotto'}</Text>
                    <Text style={styles.itemDetails}>
                      {item.quantity} x {formatCurrency(item.unit_price)}
                      {item.discount_percent > 0 && ` (-${item.discount_percent}%)`}
                    </Text>
                  </View>
                  <Text style={styles.itemTotal}>{formatCurrency(item.line_total)}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noItemsText}>Nessun prodotto</Text>
          )}
        </View>
      </View>

      {/* Order Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Riepilogo</Text>
        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotale</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(order.total_amount - order.shipping_cost)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Spedizione</Text>
            <Text style={styles.summaryValue}>{formatCurrency(order.shipping_cost)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Totale</Text>
            <Text style={styles.totalValue}>{formatCurrency(order.total_amount)}</Text>
          </View>
        </View>
      </View>

      {/* Shipping Info */}
      {order.shipping_address && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spedizione</Text>
          <View style={styles.card}>
            <View style={styles.shippingRow}>
              <Ionicons name="location-outline" size={18} color="#6B7280" />
              <Text style={styles.shippingText}>{order.shipping_address}</Text>
            </View>
            {order.expected_delivery_date && (
              <>
                <View style={styles.divider} />
                <View style={styles.shippingRow}>
                  <Ionicons name="calendar-outline" size={18} color="#6B7280" />
                  <Text style={styles.shippingText}>
                    Consegna prevista: {formatDate(order.expected_delivery_date)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {/* Notes */}
      {order.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Note</Text>
          <View style={styles.card}>
            <Text style={styles.notesText}>{order.notes}</Text>
          </View>
        </View>
      )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginTop: 12,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  orderDate: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  foreignBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  foreignText: {
    fontSize: 13,
    color: '#8B5CF6',
    fontWeight: '500',
    marginLeft: 6,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3B82F6',
  },
  customerInfo: {
    marginLeft: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  customerAddress: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  itemDetails: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  noItemsText: {
    fontSize: 14,
    color: '#9CA3AF',
    padding: 16,
    textAlign: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  summaryValue: {
    fontSize: 14,
    color: '#1F2937',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E40AF',
  },
  shippingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  shippingText: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 12,
    flex: 1,
  },
  notesText: {
    fontSize: 14,
    color: '#4B5563',
    padding: 12,
    lineHeight: 20,
  },
});
