import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Platform,
  ScrollView,
  FlatList,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { fetchTabaccherieInBounds, getStatusColor, getStatusLabel, searchTabaccherie } from '../../lib/api/tabaccherie';
import { Tabaccheria } from '../../types';
import { useAuthStore } from '../../store/authStore';

const ITALY_CENTER = {
  latitude: 41.9028,
  longitude: 12.4964,
};

export default function MapScreen() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [tabaccherie, setTabaccherie] = useState<Tabaccheria[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<Tabaccheria | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Tabaccheria[]>([]);
  const [searching, setSearching] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        // Load tabaccherie near user
        loadTabaccherieNearLocation(location.coords.latitude, location.coords.longitude);
      } else {
        // Load tabaccherie near Italy center
        loadTabaccherieNearLocation(ITALY_CENTER.latitude, ITALY_CENTER.longitude);
      }
    } catch (error) {
      console.log('Location permission error:', error);
      loadTabaccherieNearLocation(ITALY_CENTER.latitude, ITALY_CENTER.longitude);
    } finally {
      setLoading(false);
    }
  };

  const loadTabaccherieNearLocation = async (lat: number, lng: number) => {
    try {
      const bounds = {
        north: lat + 0.1,
        south: lat - 0.1,
        east: lng + 0.1,
        west: lng - 0.1,
      };
      const data = await fetchTabaccherieInBounds(bounds, user?.id, user?.role);
      setTabaccherie(data);
    } catch (error) {
      console.error('Error loading tabaccherie:', error);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const results = await searchTabaccherie(query);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  const selectFromSearch = (tab: Tabaccheria) => {
    setSelectedPoint(tab);
    setSearchQuery('');
    setSearchResults([]);
  };

  const getStatusIcon = (status: string | null | undefined): string => {
    switch (status) {
      case 'ordinato':
        return 'checkmark-circle';
      case 'visitato':
        return 'eye';
      default:
        return 'alert-circle';
    }
  };

  const renderTabaccheria = ({ item }: { item: Tabaccheria }) => (
    <TouchableOpacity
      style={styles.tabCard}
      onPress={() => setSelectedPoint(item)}
    >
      <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(item.stato_visita) }]} />
      <View style={styles.tabInfo}>
        <Text style={styles.tabName} numberOfLines={1}>{item.denominazione}</Text>
        <Text style={styles.tabAddress} numberOfLines={1}>{item.indirizzo}</Text>
        <Text style={styles.tabCity}>{item.comune}, {item.provincia}</Text>
      </View>
      <View style={styles.tabStatus}>
        <Ionicons 
          name={getStatusIcon(item.stato_visita) as any} 
          size={20} 
          color={getStatusColor(item.stato_visita)} 
        />
        <Text style={[styles.statusText, { color: getStatusColor(item.stato_visita) }]}>
          {getStatusLabel(item.stato_visita)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1E40AF" />
        <Text style={styles.loadingText}>Caricamento punti vendita...</Text>
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
            placeholder="Cerca tabaccheria..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Search Results Dropdown */}
        {searchResults.length > 0 && (
          <View style={styles.searchResults}>
            {searchResults.slice(0, 5).map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={styles.searchResultItem}
                onPress={() => selectFromSearch(tab)}
              >
                <View style={[styles.resultDot, { backgroundColor: getStatusColor(tab.stato_visita) }]} />
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName} numberOfLines={1}>{tab.denominazione}</Text>
                  <Text style={styles.resultAddress}>{tab.comune}, {tab.provincia}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.statText}>
            {tabaccherie.filter(t => !t.stato_visita || t.stato_visita === 'non_visitato').length} Non Visitati
          </Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: '#3B82F6' }]} />
          <Text style={styles.statText}>
            {tabaccherie.filter(t => t.stato_visita === 'visitato').length} Visitati
          </Text>
        </View>
        <View style={styles.statItem}>
          <View style={[styles.statDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.statText}>
            {tabaccherie.filter(t => t.stato_visita === 'ordinato').length} Ordinati
          </Text>
        </View>
      </View>

      {/* Info Banner for Web */}
      {Platform.OS === 'web' && (
        <View style={styles.webBanner}>
          <Ionicons name="phone-portrait-outline" size={20} color="#1E40AF" />
          <Text style={styles.webBannerText}>
            Per la mappa interattiva, usa l'app mobile
          </Text>
        </View>
      )}

      {/* Tabaccherie List */}
      <FlatList
        data={tabaccherie}
        renderItem={renderTabaccheria}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="storefront-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>Nessun punto vendita trovato</Text>
            <Text style={styles.emptySubtext}>Prova a cercare un'altra zona</Text>
          </View>
        }
        ListHeaderComponent={
          <Text style={styles.listHeader}>{tabaccherie.length} Punti Vendita</Text>
        }
      />

      {/* Selected Point Modal */}
      {selectedPoint && (
        <View style={styles.modalOverlay}>
          <View style={styles.selectedCard}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedPoint(null)}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
            
            <View style={styles.selectedHeader}>
              <View style={[styles.selectedStatusBadge, { backgroundColor: getStatusColor(selectedPoint.stato_visita) + '20' }]}>
                <Ionicons 
                  name={getStatusIcon(selectedPoint.stato_visita) as any} 
                  size={16} 
                  color={getStatusColor(selectedPoint.stato_visita)} 
                />
                <Text style={[styles.selectedStatusText, { color: getStatusColor(selectedPoint.stato_visita) }]}>
                  {getStatusLabel(selectedPoint.stato_visita)}
                </Text>
              </View>
            </View>

            <Text style={styles.selectedName}>{selectedPoint.denominazione}</Text>
            
            <View style={styles.selectedInfo}>
              <Ionicons name="location-outline" size={16} color="#6B7280" />
              <Text style={styles.selectedAddress}>{selectedPoint.indirizzo}</Text>
            </View>
            
            <View style={styles.selectedInfo}>
              <Ionicons name="business-outline" size={16} color="#6B7280" />
              <Text style={styles.selectedCity}>
                {selectedPoint.comune}, {selectedPoint.provincia} {selectedPoint.cap}
              </Text>
            </View>

            {selectedPoint.latitude && selectedPoint.longitude && (
              <View style={styles.selectedInfo}>
                <Ionicons name="navigate-outline" size={16} color="#6B7280" />
                <Text style={styles.selectedCoords}>
                  {selectedPoint.latitude.toFixed(5)}, {selectedPoint.longitude.toFixed(5)}
                </Text>
              </View>
            )}

            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={[styles.actionBtn, { backgroundColor: '#1E40AF' }]}
                onPress={() => {
                  if (selectedPoint.latitude && selectedPoint.longitude) {
                    const url = `https://www.google.com/maps/search/?api=1&query=${selectedPoint.latitude},${selectedPoint.longitude}`;
                    if (Platform.OS === 'web') {
                      window.open(url, '_blank');
                    }
                  }
                }}
              >
                <Ionicons name="navigate" size={18} color="#FFFFFF" />
                <Text style={styles.actionBtnText}>Naviga</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  searchResults: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  resultDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  resultAddress: {
    fontSize: 12,
    color: '#6B7280',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  statText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '500',
  },
  webBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
    padding: 12,
  },
  webBannerText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1E40AF',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  listHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  tabCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusIndicator: {
    width: 4,
    height: '100%',
    minHeight: 50,
    borderRadius: 2,
    marginRight: 12,
  },
  tabInfo: {
    flex: 1,
  },
  tabName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  tabAddress: {
    fontSize: 13,
    color: '#6B7280',
  },
  tabCity: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  tabStatus: {
    alignItems: 'center',
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  selectedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
    zIndex: 1,
  },
  selectedHeader: {
    marginBottom: 12,
  },
  selectedStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedStatusText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  selectedName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    paddingRight: 40,
  },
  selectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  selectedAddress: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 8,
    flex: 1,
  },
  selectedCity: {
    fontSize: 14,
    color: '#4B5563',
    marginLeft: 8,
  },
  selectedCoords: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
