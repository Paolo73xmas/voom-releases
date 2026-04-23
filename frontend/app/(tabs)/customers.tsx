import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { fetchCustomers } from '../../lib/api/customers';
import { Customer } from '../../types';

export default function CustomersScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadCustomers = async () => {
    if (!user) return;
    try {
      const data = await fetchCustomers(user.id, user.role, user.branchId);
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [user]);

  // Derived filtered list using useMemo - no extra state/effect needed
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const term = searchQuery.toLowerCase();
    return customers.filter(c =>
      c.business_name.toLowerCase().includes(term) ||
      c.city.toLowerCase().includes(term) ||
      c.contact_name.toLowerCase().includes(term) ||
      c.contact_phone.includes(term)
    );
  }, [searchQuery, customers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadCustomers();
    setRefreshing(false);
  };

  const renderCustomer = ({ item }: { item: Customer }) => (
    <TouchableOpacity
      style={styles.customerCard}
      onPress={() => router.push(`/customer/${item.id}`)}
    >
      <View style={styles.customerHeader}>
        <View style={styles.customerAvatar}>
          <Text style={styles.avatarText}>
            {item.business_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName} numberOfLines={1}>
            {item.business_name}
          </Text>
          <Text style={styles.customerLocation} numberOfLines={1}>
            <Ionicons name="location-outline" size={12} color="#6B7280" />
            {' '}{item.city}, {item.province}
          </Text>
        </View>
        <View style={[
          styles.categoryBadge,
          item.category === 'client' ? styles.clientBadge : styles.prospectBadge
        ]}>
          <Text style={[
            styles.categoryText,
            item.category === 'client' ? styles.clientText : styles.prospectText
          ]}>
            {item.category === 'client' ? 'Cliente' : 'Prospect'}
          </Text>
        </View>
      </View>
      <View style={styles.customerDetails}>
        <View style={styles.detailItem}>
          <Ionicons name="person-outline" size={14} color="#6B7280" />
          <Text style={styles.detailText}>{item.contact_name}</Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="call-outline" size={14} color="#6B7280" />
          <Text style={styles.detailText}>{item.contact_phone}</Text>
        </View>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color="#D1D5DB"
        style={styles.chevron}
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cerca cliente..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stats + Nuovo Cliente */}
      <View style={styles.statsRow}>
        <Text style={styles.statsText}>
          {filteredCustomers.length} di {customers.length} clienti
        </Text>
        <TouchableOpacity style={styles.newClientBtn} onPress={() => router.push('/anagrafica')}>
          <Ionicons name="add-circle" size={18} color="#FFF" />
          <Text style={styles.newClientBtnText}>Nuovo Cliente</Text>
        </TouchableOpacity>
      </View>

      {/* Customer List */}
      <FlatList
        data={filteredCustomers}
        renderItem={renderCustomer}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>Nessun cliente trovato</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  newClientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
  },
  newClientBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFF',
  },
  statsText: {
    fontSize: 14,
    color: '#6B7280',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    flex: 1,
    marginLeft: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  customerLocation: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  clientBadge: {
    backgroundColor: '#DCFCE7',
  },
  prospectBadge: {
    backgroundColor: '#FEF3C7',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  clientText: {
    color: '#166534',
  },
  prospectText: {
    color: '#92400E',
  },
  customerDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  detailText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
  },
  chevron: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -10,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 12,
  },
});
