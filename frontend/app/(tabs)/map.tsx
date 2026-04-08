import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Platform,
  Linking,
  Keyboard,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

// Conditionally import WebView for native platforms
let WebView: any = null;
if (Platform.OS !== 'web') {
  WebView = require('react-native-webview').WebView;
}
import { fetchTabaccherieInRadius, fetchAllTabaccherie, searchTabaccherie } from '../../lib/api/tabaccherie';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { Tabaccheria } from '../../types';

type FilterMode = 'all' | 'active' | 'not_visited';

function getMarkerColor(tab: Tabaccheria, userId?: string, userRole?: string): string {
  const isAdmin = userRole === 'admin' || userRole === 'admincustom' || userRole === 'supervisor' || userRole === 'branch_admin';

  // Gray: belongs to another agent (only for non-admin users)
  if (!isAdmin && tab.agente_id && tab.agente_id !== userId) {
    return 'gray';
  }
  if (!tab.stato_visita || tab.stato_visita === 'non_visitato') {
    return 'red';
  }
  if (tab.stato_visita === 'visitato') {
    return 'orange';
  }
  if (tab.stato_visita === 'ordinato') {
    return 'green';
  }
  return 'red';
}

function getDisplayName(tab: Tabaccheria): string {
  if (tab.customer_business_name) return tab.customer_business_name;
  if (tab.customer_id) return 'Cliente Nuovo';
  return tab.denominazione;
}

function getStatusLabel(color: string): string {
  switch (color) {
    case 'gray': return 'Altro agente';
    case 'red': return 'Non visitato';
    case 'orange': return 'Visitato';
    case 'green': return 'Ordinato';
    default: return '';
  }
}

function getStatusEmoji(color: string): string {
  switch (color) {
    case 'gray': return '\u26AB';
    case 'red': return '\uD83D\uDD34';
    case 'orange': return '\uD83D\uDFE0';
    case 'green': return '\uD83D\uDFE2';
    default: return '';
  }
}

const LEAFLET_HTML = (lat: number, lng: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; }
    .custom-marker {
      border: none !important;
      background: none !important;
    }
    .user-pulse {
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.5); }
      70% { box-shadow: 0 0 0 10px rgba(59,130,246,0); }
      100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      zoomControl: false,
      attributionControl: false
    }).setView([${lat}, ${lng}], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      maxNativeZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    var markers = [];
    var userMarker = null;

    // User location marker
    var userIcon = L.divIcon({
      className: 'custom-marker',
      html: '<div class="user-pulse" style="background:#3b82f6;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    userMarker = L.marker([${lat}, ${lng}], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);

    var ICONS = {
      gray: L.divIcon({ className:'custom-marker', html:'<div style="background:#475569;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);opacity:0.6;"></div>', iconSize:[14,14], iconAnchor:[7,7] }),
      red: L.divIcon({ className:'custom-marker', html:'<div style="background:#dc2626;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>', iconSize:[14,14], iconAnchor:[7,7] }),
      orange: L.divIcon({ className:'custom-marker', html:'<div style="background:#f97316;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>', iconSize:[14,14], iconAnchor:[7,7] }),
      green: L.divIcon({ className:'custom-marker', html:'<div style="background:#15803d;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>', iconSize:[14,14], iconAnchor:[7,7] }),
    };

    var debounceTimer = null;

    function sendMessage(msg) {
      var str = JSON.stringify(msg);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(str);
      } else if (window.parent && window.parent !== window) {
        window.parent.postMessage(str, '*');
      }
    }

    map.on('moveend', function() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        var b = map.getBounds();
        sendMessage({
          type: 'boundsChanged',
          bounds: {
            north: b.getNorth(),
            south: b.getSouth(),
            east: b.getEast(),
            west: b.getWest()
          }
        });
      }, 500);
    });

    function updateMarkers(data) {
      markers.forEach(function(m) { map.removeLayer(m); });
      markers = [];
      data.forEach(function(p) {
        if (!p.lat || !p.lng) return;
        var icon = ICONS[p.color] || ICONS.red;
        var m = L.marker([p.lat, p.lng], { icon: icon });
        m.on('click', function() {
          sendMessage({
            type: 'markerClick',
            id: p.id
          });
        });
        m.addTo(map);
        markers.push(m);
      });
    }

    function setCenter(lat, lng, zoom) {
      map.setView([lat, lng], zoom || 16);
    }

    function updateUserLocation(lat, lng) {
      if (userMarker) {
        userMarker.setLatLng([lat, lng]);
      }
    }

    // Fire initial bounds
    setTimeout(function() {
      var b = map.getBounds();
      sendMessage({
        type: 'boundsChanged',
        bounds: {
          north: b.getNorth(),
          south: b.getSouth(),
          east: b.getEast(),
          west: b.getWest()
        }
      });
    }, 500);

    // Listen for messages from RN
    document.addEventListener('message', function(e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === 'updateMarkers') updateMarkers(msg.data);
        if (msg.type === 'setCenter') setCenter(msg.lat, msg.lng, msg.zoom);
        if (msg.type === 'updateUserLocation') updateUserLocation(msg.lat, msg.lng);
      } catch(err) {}
    });
    window.addEventListener('message', function(e) {
      try {
        var msg = JSON.parse(e.data);
        if (msg.type === 'updateMarkers') updateMarkers(msg.data);
        if (msg.type === 'setCenter') setCenter(msg.lat, msg.lng, msg.zoom);
        if (msg.type === 'updateUserLocation') updateUserLocation(msg.lat, msg.lng);
      } catch(err) {}
    });
  </script>
</body>
</html>
`;

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuthStore();
  const userRole = profile?.role || 'agent';
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<any>(null);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [tabaccherie, setTabaccherie] = useState<Tabaccheria[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  // Selected marker
  const [selectedTab, setSelectedTab] = useState<Tabaccheria | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  // Order data
  const [orderData, setOrderData] = useState<{ order_date: string; total_amount: number } | null>(null);
  const [loadingOrderData, setLoadingOrderData] = useState(false);
  const [showOrderDataModal, setShowOrderDataModal] = useState(false);

  // Search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Legend
  const [showLegend, setShowLegend] = useState(true);

  const currentBoundsRef = useRef<{ north: number; south: number; east: number; west: number } | null>(null);
  const tabaccherieRef = useRef<Tabaccheria[]>([]);

  // Web-only: Leaflet direct map refs
  const leafletMapRef = useRef<any>(null);
  const leafletMarkersRef = useRef<any[]>([]);
  const leafletUserMarkerRef = useRef<any>(null);
  const mapDivRef = useRef<any>(null);
  const leafletReadyRef = useRef(false);

  useEffect(() => {
    tabaccherieRef.current = tabaccherie;
  }, [tabaccherie]);

  // Get user location
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          // Fallback: Roma
          setUserLocation({ lat: 41.9028, lng: 12.4964 });
          setLoading(false);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        setUserLocation({ lat: 41.9028, lng: 12.4964 });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load data when filter changes
  useEffect(() => {
    if (!userLocation) return;
    if (filterMode !== 'all') {
      loadAll();
    } else if (currentBoundsRef.current) {
      loadByBounds(currentBoundsRef.current);
    }
  }, [filterMode]);

  // Web-only: Initialize Leaflet map directly in the DOM
  useEffect(() => {
    if (Platform.OS !== 'web' || !userLocation || loading) return;
    if (leafletMapRef.current) return; // Already initialized

    // Load Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Add custom styles
    if (!document.getElementById('leaflet-custom-css')) {
      const style = document.createElement('style');
      style.id = 'leaflet-custom-css';
      style.textContent = `.custom-marker{border:none!important;background:none!important}@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(59,130,246,.5)}70%{box-shadow:0 0 0 10px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}}#leaflet-map-container{position:absolute;top:0;left:0;right:0;bottom:0;z-index:0;}`;
      document.head.appendChild(style);
    }

    // Load Leaflet JS then init map
    const initMap = () => {
      const L = (window as any).L;
      // Find or create the map container by ID
      let container = document.getElementById('leaflet-map-container');
      if (!container) {
        console.error('[Map] No container found');
        return;
      }

      const map = L.map(container, { zoomControl: false, attributionControl: false })
        .setView([userLocation.lat, userLocation.lng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      L.control.zoom({ position: 'topright' }).addTo(map);

      // User location marker
      const userIcon = L.divIcon({
        className: 'custom-marker',
        html: '<div style="background:#3b82f6;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);animation:pulse 2s infinite;"></div>',
        iconSize: [16, 16], iconAnchor: [8, 8],
      });
      leafletUserMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(map);

      leafletMapRef.current = map;
      leafletReadyRef.current = true;
      console.log('[Map] Leaflet map initialized successfully');

      // Debounced bounds change
      let debounce: any = null;
      map.on('moveend', () => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => {
          const b = map.getBounds();
          const bounds = { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() };
          currentBoundsRef.current = bounds;
          if (filterMode === 'all') {
            loadByBounds(bounds);
          }
        }, 500);
      });

      // Initial load with slight delay to ensure everything is ready
      setTimeout(() => {
        const b = map.getBounds();
        const bounds = { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() };
        currentBoundsRef.current = bounds;
        loadByBounds(bounds);
      }, 500);

      // Force map to recalculate size
      setTimeout(() => map.invalidateSize(), 200);
    };

    if ((window as any).L) {
      // Small delay to ensure DOM is ready
      setTimeout(initMap, 300);
    } else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => setTimeout(initMap, 300);
      document.head.appendChild(script);
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        leafletReadyRef.current = false;
      }
    };
  }, [userLocation, loading]);

  // Web-only: Update markers when tabaccherie data changes
  useEffect(() => {
    if (Platform.OS !== 'web' || !leafletReadyRef.current || !leafletMapRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Remove old markers
    leafletMarkersRef.current.forEach(m => leafletMapRef.current.removeLayer(m));
    leafletMarkersRef.current = [];

    const COLORS: Record<string, string> = { gray: '#475569', red: '#dc2626', orange: '#f97316', green: '#15803d' };

    tabaccherie.forEach(t => {
      if (!t.latitude || !t.longitude) return;
      const color = getMarkerColor(t, user?.id, userRole);
      const opacity = color === 'gray' ? '0.6' : '1';
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background:${COLORS[color] || COLORS.red};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);opacity:${opacity};"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7],
      });
      const marker = L.marker([t.latitude, t.longitude], { icon }).addTo(leafletMapRef.current);
      marker.on('click', () => {
        setSelectedTab(t);
        setShowPopup(true);
      });
      leafletMarkersRef.current.push(marker);
    });
  }, [tabaccherie, user?.id, userRole]);

  // Direct function to update Leaflet markers on web
  const updateLeafletMarkers = useCallback((data: Tabaccheria[]) => {
    if (Platform.OS !== 'web') return;
    const L = (window as any).L;
    if (!L || !leafletMapRef.current) return;

    // Remove old markers
    leafletMarkersRef.current.forEach(m => leafletMapRef.current.removeLayer(m));
    leafletMarkersRef.current = [];

    const COLORS: Record<string, string> = { gray: '#475569', red: '#dc2626', orange: '#f97316', green: '#15803d' };

    data.forEach(t => {
      if (!t.latitude || !t.longitude) return;
      const color = getMarkerColor(t, user?.id, userRole);
      const opacity = color === 'gray' ? '0.6' : '1';
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background:${COLORS[color] || COLORS.red};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);opacity:${opacity};"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7],
      });
      const marker = L.marker([t.latitude, t.longitude], { icon }).addTo(leafletMapRef.current);
      marker.on('click', () => {
        setSelectedTab(t);
        setShowPopup(true);
      });
      leafletMarkersRef.current.push(marker);
    });
    console.log('[Map] Updated', leafletMarkersRef.current.length, 'Leaflet markers');
  }, [user?.id, userRole]);

  const loadByBounds = useCallback(async (bounds: { north: number; south: number; east: number; west: number }) => {
    try {
      setLoadingPoints(true);
      const centerLat = (bounds.north + bounds.south) / 2;
      const centerLng = (bounds.east + bounds.west) / 2;
      const data = await fetchTabaccherieInRadius(centerLat, centerLng, 40, user?.id, userRole);
      setTabaccherie(data);
      // Directly update Leaflet markers on web
      updateLeafletMarkers(data);
      sendMarkersToWebView(data);
    } catch (e) {
      console.error('[Map] Error loading by radius:', e);
    } finally {
      setLoadingPoints(false);
    }
  }, [user?.id, userRole, updateLeafletMarkers, sendMarkersToWebView]);

  const loadAll = useCallback(async () => {
    try {
      setLoadingPoints(true);
      const data = await fetchAllTabaccherie(user?.id, 'agent', filterMode);
      setTabaccherie(data);
      // Directly update Leaflet markers on web
      updateLeafletMarkers(data);
      sendMarkersToWebView(data);
    } catch (e) {
      console.error('[Map] Error loading all:', e);
    } finally {
      setLoadingPoints(false);
    }
  }, [user?.id, filterMode, updateLeafletMarkers, sendMarkersToWebView]);

  // Helper to send messages to map
  const sendToMap = useCallback((msg: any) => {
    if (Platform.OS === 'web') {
      // Direct Leaflet access on web - handled by useEffect on tabaccherie change
      if (msg.type === 'setCenter' && leafletMapRef.current) {
        leafletMapRef.current.setView([msg.lat, msg.lng], msg.zoom || 16);
      }
    } else {
      const str = typeof msg === 'string' ? msg : JSON.stringify(msg);
      webViewRef.current?.postMessage(str);
    }
  }, []);

  const sendMarkersToWebView = useCallback((data: Tabaccheria[]) => {
    const markers = data.map(t => ({
      id: t.id,
      lat: t.latitude,
      lng: t.longitude,
      color: getMarkerColor(t, user?.id, userRole),
    }));
    sendToMap({ type: 'updateMarkers', data: markers });
  }, [user?.id, userRole, sendToMap]);

  // Handle WebView messages
  const onWebViewMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === 'boundsChanged') {
        currentBoundsRef.current = msg.bounds;
        if (filterMode === 'all') {
          loadByBounds(msg.bounds);
        }
      }

      if (msg.type === 'markerClick') {
        const tab = tabaccherieRef.current.find(t => t.id === msg.id);
        if (tab) {
          setSelectedTab(tab);
          setShowPopup(true);
        }
      }
    } catch {}
  }, [filterMode, loadByBounds]);

  // Actions
  const openNavigation = (lat: number, lng: number) => {
    const url = Platform.select({
      ios: `maps://app?daddr=${lat},${lng}`,
      android: `google.navigation:q=${lat},${lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
    });
    setShowPopup(false);
  };

  const handleOrderClick = (tab: Tabaccheria) => {
    setShowPopup(false);
    const customerName = tab.customer_business_name || tab.denominazione || '';
    router.push({
      pathname: '/order-collection',
      params: {
        ...(tab.customer_id ? { customerId: tab.customer_id } : {}),
        customerName: customerName,
      },
    });
  };

  const handleShowOrderData = async (tab: Tabaccheria) => {
    if (!tab.customer_id) return;
    setShowOrderDataModal(true);
    setLoadingOrderData(true);
    setOrderData(null);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('order_date, total_amount')
        .eq('customer_id', tab.customer_id)
        .order('order_date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setOrderData(data || null);
    } catch (e) {
      console.error('[Map] Error fetching order data:', e);
    } finally {
      setLoadingOrderData(false);
    }
  };

  // Geocoding search
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsGeocoding(true);
    Keyboard.dismiss();
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&countrycodes=it&limit=1`,
        { headers: { 'User-Agent': 'VoomApp/1.0' } }
      );
      const results = await response.json();
      if (results.length === 0) {
        Alert.alert('Non trovato', 'Indirizzo non trovato. Prova con un formato diverso.');
        return;
      }
      const result = results[0];
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);
      sendToMap({ type: 'setCenter', lat, lng: lon, zoom: 16 });
      setShowSearch(false);
      setSearchQuery('');
    } catch {
      Alert.alert('Errore', 'Impossibile cercare l\'indirizzo.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Recenter on user
  const recenterOnUser = () => {
    if (userLocation) {
      sendToMap({
        type: 'setCenter',
        lat: userLocation.lat,
        lng: userLocation.lng,
        zoom: 13,
      });
    }
  };

  if (loading || !userLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Ottenendo posizione GPS...</Text>
      </View>
    );
  }

  const selectedColor = selectedTab ? getMarkerColor(selectedTab, user?.id, userRole) : 'red';
  const isOwnedByOther = selectedColor === 'gray';

  return (
    <View style={styles.container}>
      {/* Map rendering: direct div for web, WebView for native */}
      {Platform.OS === 'web' ? (
        <div
          id="leaflet-map-container"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 } as any}
        />
      ) : WebView ? (
        <WebView
          ref={webViewRef}
          source={{ html: LEAFLET_HTML(userLocation.lat, userLocation.lng) }}
          style={styles.webview}
          onMessage={onWebViewMessage}
          javaScriptEnabled
          domStorageEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#10B981" />
            </View>
          )}
        />
      ) : (
        <View style={styles.loadingContainer}>
          <Text>Mappa non disponibile</Text>
        </View>
      )}

      {/* Loading indicator */}
      {loadingPoints && (
        <View style={[styles.loadingBadge, { top: insets.top + 8 }]}>
          <ActivityIndicator size="small" color="#10B981" />
          <Text style={styles.loadingBadgeText}>Caricamento...</Text>
        </View>
      )}

      {/* Counter badge */}
      {!loadingPoints && tabaccherie.length > 0 && (
        <View style={[styles.counterBadge, { top: insets.top + 8 }]}>
          <Text style={styles.counterText}>{tabaccherie.length} punti</Text>
        </View>
      )}

      {/* Filter buttons */}
      <View style={[styles.filterRow, { top: insets.top + 48 }]}>
        {(['all', 'active', 'not_visited'] as FilterMode[]).map(mode => (
          <TouchableOpacity
            key={mode}
            style={[styles.filterBtn, filterMode === mode && styles.filterBtnActive]}
            onPress={() => setFilterMode(mode)}
          >
            <Text style={[styles.filterBtnText, filterMode === mode && styles.filterBtnTextActive]}>
              {mode === 'all' ? 'Tutti' : mode === 'active' ? 'Attivi' : 'Non visitati'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search button */}
      <TouchableOpacity
        style={[styles.fabButton, { top: insets.top + 90, right: 12 }]}
        onPress={() => setShowSearch(true)}
      >
        <Ionicons name="search" size={22} color="#7C3AED" />
      </TouchableOpacity>

      {/* Recenter button */}
      <TouchableOpacity
        style={[styles.fabButton, { bottom: insets.bottom + 100, right: 12 }]}
        onPress={recenterOnUser}
      >
        <Ionicons name="locate" size={22} color="#3B82F6" />
      </TouchableOpacity>

      {/* Legend toggle */}
      <TouchableOpacity
        style={[styles.fabButton, { bottom: insets.bottom + 156, right: 12 }]}
        onPress={() => setShowLegend(!showLegend)}
      >
        <Ionicons name="information-circle" size={22} color="#6B7280" />
      </TouchableOpacity>

      {/* Legend */}
      {showLegend && (
        <View style={[styles.legendBox, { bottom: insets.bottom + 212, right: 12 }]}>
          <View style={styles.legendHeader}>
            <Text style={styles.legendTitle}>Legenda</Text>
            <TouchableOpacity onPress={() => setShowLegend(false)}>
              <Ionicons name="close" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          {[
            { color: '#3B82F6', label: 'Tua posizione' },
            { color: '#DC2626', label: 'Non visitato' },
            { color: '#F97316', label: 'Visitato' },
            { color: '#15803D', label: 'Ordinato' },
            { color: '#475569', label: 'Altro agente' },
          ].map((item, i) => (
            <View key={i} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Search Modal */}
      <Modal visible={showSearch} transparent animationType="fade" onRequestClose={() => setShowSearch(false)}>
        <View style={styles.searchOverlay}>
          <View style={[styles.searchContainer, { marginTop: insets.top + 16 }]}>
            <View style={styles.searchInputRow}>
              <Ionicons name="search" size={20} color="#7C3AED" />
              <TextInput
                style={styles.searchInput}
                placeholder="Cerca indirizzo, citta..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#9CA3AF"
                autoFocus
                returnKeyType="search"
                onSubmitEditing={handleSearch}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.searchActions}>
              <TouchableOpacity style={styles.searchCancelBtn} onPress={() => { setShowSearch(false); setSearchQuery(''); }}>
                <Text style={styles.searchCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.searchGoBtn, (!searchQuery.trim() || isGeocoding) && styles.searchGoBtnDisabled]}
                onPress={handleSearch}
                disabled={!searchQuery.trim() || isGeocoding}
              >
                {isGeocoding ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.searchGoText}>Cerca</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Marker Popup (Bottom Sheet) */}
      <Modal visible={showPopup} transparent animationType="slide" onRequestClose={() => setShowPopup(false)}>
        <TouchableOpacity style={styles.popupOverlay} activeOpacity={1} onPress={() => setShowPopup(false)}>
          <View style={[styles.popupSheet, { paddingBottom: insets.bottom + 16 }]}>
            {selectedTab && (
              <>
                {/* Header */}
                <View style={styles.popupHandle} />
                <View style={styles.popupHeader}>
                  <View style={styles.popupHeaderLeft}>
                    <View style={[styles.popupColorDot, {
                      backgroundColor: selectedColor === 'gray' ? '#475569' :
                        selectedColor === 'red' ? '#DC2626' :
                        selectedColor === 'orange' ? '#F97316' :
                        selectedColor === 'green' ? '#15803D' : '#DC2626'
                    }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.popupName} numberOfLines={2}>{getDisplayName(selectedTab)}</Text>
                      <Text style={styles.popupAddress} numberOfLines={1}>{selectedTab.indirizzo}</Text>
                      <Text style={styles.popupStatus}>
                        {getStatusEmoji(selectedColor)} {getStatusLabel(selectedColor)}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setShowPopup(false)} style={styles.popupCloseBtn}>
                    <Ionicons name="close" size={22} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* Actions */}
                <View style={styles.popupActions}>
                  {/* Navigate - for all except gray */}
                  {!isOwnedByOther && selectedTab.latitude && selectedTab.longitude && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnOutline]}
                      onPress={() => openNavigation(selectedTab.latitude!, selectedTab.longitude!)}
                    >
                      <Ionicons name="navigate" size={18} color="#3B82F6" />
                      <Text style={[styles.actionBtnText, { color: '#3B82F6' }]}>Naviga</Text>
                    </TouchableOpacity>
                  )}

                  {/* Red: Visit */}
                  {selectedColor === 'red' && !isOwnedByOther && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnPrimary]}
                      onPress={() => {
                        setShowPopup(false);
                        // Navigate to first-visit would go here
                        Alert.alert('Visita', 'Navigazione alla prima visita');
                      }}
                    >
                      <Ionicons name="document-text" size={18} color="#FFF" />
                      <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Visita</Text>
                    </TouchableOpacity>
                  )}

                  {/* Orange/Green: Order + Data + Inspection */}
                  {(selectedColor === 'orange' || selectedColor === 'green') && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnPrimary]}
                        onPress={() => handleOrderClick(selectedTab)}
                      >
                        <Ionicons name="cart" size={18} color="#FFF" />
                        <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Ordine</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnSecondary]}
                        onPress={() => handleShowOrderData(selectedTab)}
                      >
                        <Ionicons name="calendar" size={18} color="#374151" />
                        <Text style={[styles.actionBtnText, { color: '#374151' }]}>Dati</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#8B5CF6' }]}
                        onPress={() => {
                          setShowPopup(false);
                          Alert.alert('Ispezione', 'Navigazione alla nuova ispezione');
                        }}
                      >
                        <Ionicons name="camera" size={18} color="#FFF" />
                        <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Ispezione</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Gray: info message */}
                  {isOwnedByOther && (
                    <View style={styles.grayInfoBox}>
                      <Ionicons name="information-circle" size={18} color="#9CA3AF" />
                      <Text style={styles.grayInfoText}>Cliente di altro agente</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Order Data Modal */}
      <Modal visible={showOrderDataModal} transparent animationType="fade" onRequestClose={() => setShowOrderDataModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.orderDataModal}>
            <View style={styles.orderDataHeader}>
              <Text style={styles.orderDataTitle}>Ultimo Ordine</Text>
              <TouchableOpacity onPress={() => setShowOrderDataModal(false)}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {loadingOrderData ? (
              <ActivityIndicator size="large" color="#10B981" style={{ marginVertical: 24 }} />
            ) : orderData ? (
              <View style={styles.orderDataContent}>
                <View style={styles.orderDataRow}>
                  <Text style={styles.orderDataLabel}>Data:</Text>
                  <Text style={styles.orderDataValue}>
                    {new Date(orderData.order_date).toLocaleDateString('it-IT')}
                  </Text>
                </View>
                <View style={styles.orderDataRow}>
                  <Text style={styles.orderDataLabel}>Importo:</Text>
                  <Text style={styles.orderDataValueBold}>
                    {'\u20AC'} {(orderData.total_amount || 0).toFixed(2)}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.orderDataEmpty}>Nessun ordine trovato per questo cliente</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingBadge: {
    position: 'absolute',
    left: '50%',
    marginLeft: -60,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 1000,
  },
  loadingBadgeText: {
    fontSize: 12,
    color: '#6B7280',
  },
  counterBadge: {
    position: 'absolute',
    left: 12,
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    zIndex: 1000,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  // Filters
  filterRow: {
    position: 'absolute',
    left: 12,
    right: 60,
    flexDirection: 'row',
    gap: 6,
    zIndex: 1000,
  },
  filterBtn: {
    backgroundColor: '#FFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 7,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  filterBtnActive: {
    backgroundColor: '#10B981',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  filterBtnTextActive: {
    color: '#FFF',
  },
  // FABs
  fabButton: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 1000,
  },
  // Legend
  legendBox: {
    position: 'absolute',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    minWidth: 160,
    zIndex: 1000,
  },
  legendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  // Search Modal
  searchOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  searchContainer: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
  },
  searchActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
  },
  searchCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  searchCancelText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },
  searchGoBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  searchGoBtnDisabled: {
    opacity: 0.5,
  },
  searchGoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  // Popup (Bottom Sheet)
  popupOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  popupSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingTop: 8,
  },
  popupHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  popupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  popupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  popupColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 4,
  },
  popupName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  popupAddress: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  popupStatus: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  popupCloseBtn: {
    padding: 4,
  },
  popupActions: {
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionBtnOutline: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  actionBtnPrimary: {
    backgroundColor: '#10B981',
  },
  actionBtnSecondary: {
    backgroundColor: '#F3F4F6',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  grayInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  grayInfoText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  // Order Data Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  orderDataModal: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    maxWidth: 340,
  },
  orderDataHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  orderDataTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  orderDataContent: {
    gap: 12,
  },
  orderDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderDataLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  orderDataValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '500',
  },
  orderDataValueBold: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: '700',
  },
  orderDataEmpty: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 14,
    marginVertical: 20,
  },
});
