import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuthStore } from '../../store/authStore';
import { fetchCustomerById, fetchCustomers } from '../../lib/api/customers';
import { createVisit } from '../../lib/api/visits';
import { Customer, VisitType, VisitOutcome } from '../../types';

const VISIT_TYPES: { value: VisitType; label: string; icon: string }[] = [
  { value: 'first_visit', label: 'Prima Visita', icon: 'flag' },
  { value: 'follow_up', label: 'Follow-up', icon: 'refresh' },
  { value: 'delivery', label: 'Consegna', icon: 'cube' },
  { value: 'other', label: 'Altro', icon: 'ellipsis-horizontal' },
];

const OUTCOMES: { value: VisitOutcome; label: string; color: string }[] = [
  { value: 'positive', label: 'Positivo', color: '#10B981' },
  { value: 'neutral', label: 'Neutrale', color: '#F59E0B' },
  { value: 'negative', label: 'Negativo', color: '#EF4444' },
];

export default function NewVisitScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuthStore();
  
  const [loading, setLoading] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [visitType, setVisitType] = useState<VisitType>('follow_up');
  const [outcome, setOutcome] = useState<VisitOutcome>('positive');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);

  useEffect(() => {
    loadData();
    getLocation();
  }, []);

  const loadData = async () => {
    if (!user) return;
    try {
      const data = await fetchCustomers(user.id, user.role);
      setCustomers(data);
      
      // Pre-select customer if passed in params
      if (params.customerId) {
        const customer = await fetchCustomerById(params.customerId as string);
        if (customer) {
          setSelectedCustomer(customer);
        }
      }
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permesso Negato', 'Per registrare la visita è necessario il permesso alla posizione');
        setLoadingLocation(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy || 0,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Errore GPS', 'Impossibile ottenere la posizione');
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      Alert.alert('Errore', 'Seleziona un cliente');
      return;
    }

    if (!location) {
      Alert.alert('Errore', 'Posizione GPS non disponibile');
      return;
    }

    if (!user) {
      Alert.alert('Errore', 'Utente non autenticato');
      return;
    }

    setLoading(true);
    try {
      await createVisit({
        customer_id: selectedCustomer.id,
        agent_id: user.id,
        tabaccheria_id: selectedCustomer.tabaccheria_id || undefined,
        visit_type: visitType,
        latitude: location.latitude,
        longitude: location.longitude,
        gps_accuracy: location.accuracy,
        outcome,
        notes: notes.trim() || undefined,
      });

      Alert.alert('Successo', 'Visita registrata con successo', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error: any) {
      console.error('Error creating visit:', error);
      Alert.alert('Errore', error.message || 'Impossibile registrare la visita');
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(c =>
    c.business_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* GPS Status */}
        <View style={styles.gpsCard}>
          <View style={styles.gpsHeader}>
            <Ionicons
              name={location ? 'checkmark-circle' : loadingLocation ? 'time' : 'alert-circle'}
              size={24}
              color={location ? '#10B981' : loadingLocation ? '#F59E0B' : '#EF4444'}
            />
            <Text style={styles.gpsTitle}>Posizione GPS</Text>
          </View>
          {loadingLocation ? (
            <View style={styles.gpsLoading}>
              <ActivityIndicator size="small" color="#F59E0B" />
              <Text style={styles.gpsLoadingText}>Acquisizione posizione...</Text>
            </View>
          ) : location ? (
            <Text style={styles.gpsCoords}>
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              {location.accuracy && ` (±${Math.round(location.accuracy)}m)`}
            </Text>
          ) : (
            <TouchableOpacity style={styles.retryButton} onPress={getLocation}>
              <Text style={styles.retryText}>Riprova</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Customer Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cliente *</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowCustomerPicker(!showCustomerPicker)}
          >
            {selectedCustomer ? (
              <View style={styles.selectedCustomer}>
                <View style={styles.customerAvatar}>
                  <Text style={styles.avatarText}>
                    {selectedCustomer.business_name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.customerInfo}>
                  <Text style={styles.customerName}>{selectedCustomer.business_name}</Text>
                  <Text style={styles.customerCity}>{selectedCustomer.city}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.pickerPlaceholder}>Seleziona cliente</Text>
            )}
            <Ionicons name="chevron-down" size={20} color="#6B7280" />
          </TouchableOpacity>

          {showCustomerPicker && (
            <View style={styles.customerPicker}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={18} color="#6B7280" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cerca cliente..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
              <ScrollView style={styles.customerList} nestedScrollEnabled>
                {filteredCustomers.slice(0, 20).map((customer) => (
                  <TouchableOpacity
                    key={customer.id}
                    style={styles.customerOption}
                    onPress={() => {
                      setSelectedCustomer(customer);
                      setShowCustomerPicker(false);
                      setSearchQuery('');
                    }}
                  >
                    <Text style={styles.optionName}>{customer.business_name}</Text>
                    <Text style={styles.optionCity}>{customer.city}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Visit Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tipo Visita</Text>
          <View style={styles.typeGrid}>
            {VISIT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.typeCard,
                  visitType === type.value && styles.typeCardActive
                ]}
                onPress={() => setVisitType(type.value)}
              >
                <Ionicons
                  name={type.icon as any}
                  size={24}
                  color={visitType === type.value ? '#1E40AF' : '#6B7280'}
                />
                <Text style={[
                  styles.typeLabel,
                  visitType === type.value && styles.typeLabelActive
                ]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Outcome */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Esito</Text>
          <View style={styles.outcomeRow}>
            {OUTCOMES.map((o) => (
              <TouchableOpacity
                key={o.value}
                style={[
                  styles.outcomeButton,
                  outcome === o.value && { backgroundColor: o.color + '20', borderColor: o.color }
                ]}
                onPress={() => setOutcome(o.value)}
              >
                <View style={[styles.outcomeDot, { backgroundColor: o.color }]} />
                <Text style={[
                  styles.outcomeLabel,
                  outcome === o.value && { color: o.color }
                ]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Note</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Aggiungi note sulla visita..."
            placeholderTextColor="#9CA3AF"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedCustomer || !location || loading) && styles.submitButtonDisabled
          ]}
          onPress={handleSubmit}
          disabled={!selectedCustomer || !location || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Registra Visita</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
  gpsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  gpsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  gpsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 8,
  },
  gpsLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsLoadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  gpsCoords: {
    fontSize: 13,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  retryButton: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  retryText: {
    color: '#1E40AF',
    fontWeight: '500',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  pickerButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  selectedCustomer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  customerInfo: {
    marginLeft: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  customerCity: {
    fontSize: 13,
    color: '#6B7280',
  },
  customerPicker: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 8,
    maxHeight: 250,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  customerList: {
    maxHeight: 200,
  },
  customerOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  optionName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  optionCity: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  typeCard: {
    width: '48%',
    margin: '1%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeCardActive: {
    borderColor: '#1E40AF',
    backgroundColor: '#EEF2FF',
  },
  typeLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 8,
  },
  typeLabelActive: {
    color: '#1E40AF',
    fontWeight: '600',
  },
  outcomeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  outcomeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  outcomeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  outcomeLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 100,
    color: '#1F2937',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
