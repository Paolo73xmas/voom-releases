import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchCustomerById } from '../../lib/api/customers';
import { Customer } from '../../types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

export default function CustomerDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomer();
  }, [id]);

  const loadCustomer = async () => {
    try {
      const data = await fetchCustomerById(id as string);
      setCustomer(data);
    } catch (error) {
      console.error('Error loading customer:', error);
      Alert.alert('Errore', 'Impossibile caricare il cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleCall = () => {
    if (customer?.contact_phone) {
      Linking.openURL(`tel:${customer.contact_phone}`);
    }
  };

  const handleEmail = () => {
    if (customer?.contact_email) {
      Linking.openURL(`mailto:${customer.contact_email}`);
    }
  };

  const handleMap = () => {
    if (customer?.latitude && customer?.longitude) {
      const url = `https://www.google.com/maps/search/?api=1&query=${customer.latitude},${customer.longitude}`;
      Linking.openURL(url);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMMM yyyy', { locale: it });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
      </View>
    );
  }

  if (!customer) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
        <Text style={styles.errorText}>Cliente non trovato</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {customer.business_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.businessName}>{customer.business_name}</Text>
        <View style={[
          styles.categoryBadge,
          customer.category === 'client' ? styles.clientBadge : styles.prospectBadge
        ]}>
          <Text style={[
            styles.categoryText,
            customer.category === 'client' ? styles.clientText : styles.prospectText
          ]}>
            {customer.category === 'client' ? 'Cliente' : 'Prospect'}
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
            <Ionicons name="call" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.emailButton]} onPress={handleEmail}>
            <Ionicons name="mail" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.mapButton]} onPress={handleMap}>
            <Ionicons name="navigate" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Contact Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contatto</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={18} color="#6B7280" />
            <Text style={styles.infoLabel}>Nome</Text>
            <Text style={styles.infoValue}>
              {customer.contact_name} {customer.contact_surname}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={18} color="#6B7280" />
            <Text style={styles.infoLabel}>Telefono</Text>
            <Text style={styles.infoValue}>{customer.contact_phone || '-'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color="#6B7280" />
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{customer.contact_email || '-'}</Text>
          </View>
        </View>
      </View>

      {/* Address */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Indirizzo</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color="#6B7280" />
            <Text style={styles.infoLabel}>Via</Text>
            <Text style={styles.infoValue}>{customer.address || '-'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={18} color="#6B7280" />
            <Text style={styles.infoLabel}>Citt\u00e0</Text>
            <Text style={styles.infoValue}>
              {customer.city}, {customer.province} {customer.postal_code}
            </Text>
          </View>
        </View>
      </View>

      {/* Fiscal Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dati Fiscali</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="card-outline" size={18} color="#6B7280" />
            <Text style={styles.infoLabel}>P.IVA</Text>
            <Text style={styles.infoValue}>{customer.vat_number || '-'}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={18} color="#6B7280" />
            <Text style={styles.infoLabel}>C.F.</Text>
            <Text style={styles.infoValue}>{customer.fiscal_code || '-'}</Text>
          </View>
          {customer.pec && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Ionicons name="at-outline" size={18} color="#6B7280" />
                <Text style={styles.infoLabel}>PEC</Text>
                <Text style={styles.infoValue}>{customer.pec}</Text>
              </View>
            </>
          )}
          {customer.sdi && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Ionicons name="code-outline" size={18} color="#6B7280" />
                <Text style={styles.infoLabel}>SDI</Text>
                <Text style={styles.infoValue}>{customer.sdi}</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Dates */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Date</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color="#6B7280" />
            <Text style={styles.infoLabel}>Prima Visita</Text>
            <Text style={styles.infoValue}>{formatDate(customer.first_visit_date)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color="#6B7280" />
            <Text style={styles.infoLabel}>Ultima Visita</Text>
            <Text style={styles.infoValue}>{formatDate(customer.last_visit_date)}</Text>
          </View>
          {customer.conversion_date && (
            <>
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
                <Text style={styles.infoLabel}>Conversione</Text>
                <Text style={styles.infoValue}>{formatDate(customer.conversion_date)}</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Notes */}
      {customer.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Note</Text>
          <View style={styles.card}>
            <Text style={styles.notesText}>{customer.notes}</Text>
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push({
            pathname: '/inspection/new',
            params: { customerId: customer.id }
          })}
        >
          <Ionicons name="camera" size={20} color="#1E40AF" />
          <Text style={styles.secondaryButtonText}>Nuova Ispezione</Text>
        </TouchableOpacity>
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
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  businessName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 20,
  },
  clientBadge: {
    backgroundColor: '#DCFCE7',
  },
  prospectBadge: {
    backgroundColor: '#FEF3C7',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  clientText: {
    color: '#166534',
  },
  prospectText: {
    color: '#92400E',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailButton: {
    backgroundColor: '#3B82F6',
  },
  mapButton: {
    backgroundColor: '#8B5CF6',
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 12,
    width: 80,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 44,
  },
  notesText: {
    fontSize: 14,
    color: '#4B5563',
    padding: 12,
    lineHeight: 20,
  },
  actionButtons: {
    gap: 12,
    marginTop: 8,
    marginBottom: 32,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
  },
});
