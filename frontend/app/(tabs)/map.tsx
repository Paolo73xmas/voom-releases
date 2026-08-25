import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  Linking,
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
import { fetchTabaccherieByBounds, fetchAllTabaccherie, fetchTabaccheriaById, tabaccheriePointsInBounds } from '../../lib/api/tabaccherie';
import { MpvpSearchBar } from '../../components/map/MpvpSearchBar';
import type { MpvpCustomerResult, PlaceSuggestion } from '../../lib/api/mpvp-customer-search';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { Tabaccheria } from '../../types';
import { getMarkerColor, getDisplayName, getStatusLabel, getStatusEmoji } from '../../components/map/utils';
import { fetchOrphanMap, claimOrphanCustomer } from '../../lib/api/orphan-claims';
import { LEAFLET_HTML } from '../../components/map/leafletHtml';
import { styles } from '../../components/map/styles';
import { COLORS } from '../../lib/theme';

type FilterMode = 'all' | 'active' | 'not_visited';

export default function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Altezza dinamica della tab bar - serve a sollevare il popup sopra di essa
  // (la tab bar è position:absolute e sovrappone il contenuto del tab)
  // Calcolo manuale (useBottomTabBarHeight fa render error su iOS con expo-router)
  const tabBarBaseHeight = Platform.OS === 'ios' ? 60 : 58;
  const tabBarHeight = tabBarBaseHeight + insets.bottom;
  const { user, profile } = useAuthStore();
  const userRole = profile?.role || 'agent';
  const webViewRef = useRef<any>(null);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [tabaccherie, setTabaccherie] = useState<Tabaccheria[]>([]);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [orphanMap, setOrphanMap] = useState<Map<string, string>>(new Map());
  const orphanMapRef = useRef<Map<string, string>>(new Map());

  // Selected marker
  const [selectedTab, setSelectedTab] = useState<Tabaccheria | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  // Order data
  const [orderData, setOrderData] = useState<{ order_date: string; total_amount: number } | null>(null);
  const [loadingOrderData, setLoadingOrderData] = useState(false);
  const [showOrderDataModal, setShowOrderDataModal] = useState(false);

  // Search (MPVP unified search bar)
  const [showSearch, setShowSearch] = useState(false);

  // Legend
  const [showLegend, setShowLegend] = useState(true);

  // Puntini neri: tabaccherie del registro nell'area visualizzata (parità web Territorio)
  const [dotsCount, setDotsCount] = useState<number | null>(null);
  const dotsReqRef = useRef(0);
  const leafletDotsRef = useRef<any>(null);

  const currentBoundsRef = useRef<{ north: number; south: number; east: number; west: number } | null>(null);
  const tabaccherieRef = useRef<Tabaccheria[]>([]);
  const filterModeRef = useRef<FilterMode>('all');

  // Web-only: Leaflet direct map refs
  const leafletMapRef = useRef<any>(null);
  const leafletMarkersRef = useRef<any[]>([]);
  const leafletUserMarkerRef = useRef<any>(null);
  const leafletClusterRef = useRef<any>(null);
  const leafletReadyRef = useRef(false);

  useEffect(() => {
    tabaccherieRef.current = tabaccherie;
  }, [tabaccherie]);

  useEffect(() => {
    filterModeRef.current = filterMode;
  }, [filterMode]);

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

  // Load orphan map independently (always, regardless of bounds/filter)
  useEffect(() => {
    if (!user) return;
    fetchOrphanMap().then(oMap => {
      console.log(`[Map] Orphan map loaded: ${oMap.size} orphans`);
      setOrphanMap(oMap);
      orphanMapRef.current = oMap;
    });
  }, [user]);

  // Re-render markers when orphanMap changes
  useEffect(() => {
    if (orphanMap.size > 0 && tabaccherie.length > 0) {
      orphanMapRef.current = orphanMap;
      updateLeafletMarkers(tabaccherie);
      sendMarkersToWebView(tabaccherie);
    }
  }, [orphanMap]);

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

    // Load MarkerCluster CSS
    if (!document.getElementById('markercluster-css')) {
      const link1 = document.createElement('link');
      link1.id = 'markercluster-css';
      link1.rel = 'stylesheet';
      link1.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
      document.head.appendChild(link1);
      const link2 = document.createElement('link');
      link2.id = 'markercluster-default-css';
      link2.rel = 'stylesheet';
      link2.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
      document.head.appendChild(link2);
    }

    // Add custom styles
    if (!document.getElementById('leaflet-custom-css')) {
      const style = document.createElement('style');
      style.id = 'leaflet-custom-css';
      style.textContent = `.custom-marker{border:none!important;background:none!important}@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(59,130,246,.5)}70%{box-shadow:0 0 0 10px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}}#leaflet-map-container{position:absolute;top:0;left:0;right:0;bottom:0;z-index:0;}.marker-cluster-custom{background:rgba(30,64,175,0.2);border-radius:50%;display:flex;align-items:center;justify-content:center}.marker-cluster-custom div{background:#7C3AED;color:#fff;font-weight:700;font-size:13px;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3)}.marker-cluster-large{background:rgba(220,38,38,0.2)!important}.marker-cluster-large div{background:#DC2626!important}.marker-cluster-medium{background:rgba(249,115,22,0.2)!important}.marker-cluster-medium div{background:#F97316!important}`;
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
      // zIndexOffset negativo: il marker agente sta SOTTO i marker cliente
      // così quando coincidono, il cliente resta cliccabile
      leafletUserMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon, zIndexOffset: -1000, interactive: false }).addTo(map);

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
          loadByBounds(bounds, filterModeRef.current);
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

    if ((window as any).L && (window as any).L.markerClusterGroup) {
      // Leaflet and MarkerCluster already loaded
      setTimeout(initMap, 300);
    } else if ((window as any).L) {
      // Leaflet loaded but not MarkerCluster
      const mcScript = document.createElement('script');
      mcScript.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
      mcScript.onload = () => setTimeout(initMap, 300);
      document.head.appendChild(mcScript);
    } else {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => {
        const mcScript = document.createElement('script');
        mcScript.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
        mcScript.onload = () => setTimeout(initMap, 300);
        document.head.appendChild(mcScript);
      };
      document.head.appendChild(script);
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        leafletReadyRef.current = false;
        leafletDotsRef.current = null;
      }
    };
  }, [userLocation, loading]);

  // Web-only: Update markers when tabaccherie data changes
  useEffect(() => {
    if (Platform.OS !== 'web' || !leafletReadyRef.current || !leafletMapRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Initialize cluster group if needed
    if (!leafletClusterRef.current) {
      leafletClusterRef.current = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 16,
        iconCreateFunction: function(cluster: any) {
          var count = cluster.getChildCount();
          var size = count < 20 ? 'small' : count < 100 ? 'medium' : 'large';
          var px = count < 20 ? 36 : count < 100 ? 42 : 48;
          return L.divIcon({
            html: '<div>' + count + '</div>',
            className: 'marker-cluster-custom marker-cluster-' + size,
            iconSize: L.point(px, px)
          });
        }
      });
      leafletMapRef.current.addLayer(leafletClusterRef.current);
    }

    // Clear existing markers
    leafletClusterRef.current.clearLayers();
    leafletMarkersRef.current = [];

    const COLORS: Record<string, string> = { gray: '#475569', red: '#dc2626', orange: '#f97316', green: '#15803d', purple: '#7C3AED', yellow: '#FFD600', purple_own: '#7C3AED', yellow_own: '#FFD600' };
    const isOwnOrphan = (c: string) => c === 'purple_own' || c === 'yellow_own';

    // Icon cache — reuse divIcon instances per color to avoid GC churn
    const iconCache: Record<string, any> = {};
    const getIcon = (color: string, opacity: string) => {
      const key = `${color}:${opacity}`;
      if (iconCache[key]) return iconCache[key];
      const own = isOwnOrphan(color);
      const size = own ? 16 : 14;
      const border = own ? '3px solid #15803d' : '2px solid white';
      iconCache[key] = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background:${COLORS[color] || COLORS.red};width:${size}px;height:${size}px;border-radius:50%;border:${border};box-shadow:0 1px 4px rgba(0,0,0,${own ? '0.4' : '0.3'});opacity:${opacity};"></div>`,
        iconSize: [size, size], iconAnchor: [size / 2, size / 2],
      });
      return iconCache[key];
    };

    tabaccherie.forEach(t => {
      if (!t.latitude || !t.longitude) return;
      const color = getMarkerColor(t, user?.id, userRole, orphanMapRef.current);
      const opacity = color === 'gray' ? '0.6' : '1';
      const icon = getIcon(color, opacity);
      const marker = L.marker([t.latitude, t.longitude], { icon });
      marker.on('click', () => {
        setSelectedTab(t);
        setShowPopup(true);
      });
      leafletClusterRef.current.addLayer(marker);
      leafletMarkersRef.current.push(marker);
    });
  }, [tabaccherie, user?.id, userRole]);

  // Direct function to update Leaflet markers on web
  const updateLeafletMarkers = useCallback((data: Tabaccheria[]) => {
    if (Platform.OS !== 'web') return;
    const L = (window as any).L;
    if (!L || !leafletMapRef.current) return;

    // Initialize cluster group if needed
    if (!leafletClusterRef.current) {
      leafletClusterRef.current = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 16,
        iconCreateFunction: function(cluster: any) {
          var count = cluster.getChildCount();
          var size = count < 20 ? 'small' : count < 100 ? 'medium' : 'large';
          var px = count < 20 ? 36 : count < 100 ? 42 : 48;
          return L.divIcon({
            html: '<div>' + count + '</div>',
            className: 'marker-cluster-custom marker-cluster-' + size,
            iconSize: L.point(px, px)
          });
        }
      });
      leafletMapRef.current.addLayer(leafletClusterRef.current);
    }

    // Clear existing
    leafletClusterRef.current.clearLayers();
    leafletMarkersRef.current = [];

    const COLORS: Record<string, string> = { gray: '#475569', red: '#dc2626', orange: '#f97316', green: '#15803d', purple: '#7C3AED', yellow: '#FFD600', purple_own: '#7C3AED', yellow_own: '#FFD600' };
    const isOwnOrphan = (c: string) => c === 'purple_own' || c === 'yellow_own';

    // Icon cache — reuse divIcon instances per color
    const iconCache: Record<string, any> = {};
    const getIcon = (color: string, opacity: string) => {
      const key = `${color}:${opacity}`;
      if (iconCache[key]) return iconCache[key];
      const own = isOwnOrphan(color);
      const size = own ? 16 : 14;
      const border = own ? '3px solid #15803d' : '2px solid white';
      iconCache[key] = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background:${COLORS[color] || COLORS.red};width:${size}px;height:${size}px;border-radius:50%;border:${border};box-shadow:0 1px 4px rgba(0,0,0,${own ? '0.4' : '0.3'});opacity:${opacity};"></div>`,
        iconSize: [size, size], iconAnchor: [size / 2, size / 2],
      });
      return iconCache[key];
    };

    data.forEach(t => {
      if (!t.latitude || !t.longitude) return;
      const color = getMarkerColor(t, user?.id, userRole, orphanMapRef.current);
      const opacity = color === 'gray' ? '0.6' : '1';
      const icon = getIcon(color, opacity);
      const marker = L.marker([t.latitude, t.longitude], { icon });
      marker.on('click', () => {
        setSelectedTab(t);
        setShowPopup(true);
      });
      leafletClusterRef.current.addLayer(marker);
      leafletMarkersRef.current.push(marker);
    });
    console.log('[Map] Updated', leafletMarkersRef.current.length, 'Leaflet markers (clustered)');
  }, [user?.id, userRole]);

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
      color: getMarkerColor(t, user?.id, userRole, orphanMapRef.current),
    }));
    sendToMap({ type: 'updateMarkers', data: markers });
  }, [user?.id, userRole, sendToMap]);

  // Puntini neri: TUTTE le tabaccherie del registro nell'area visualizzata (fino a 5000),
  // layer canvas non interattivo SOTTO i marker colorati — parità web (mappa Territorio).
  const loadTabDots = useCallback(async (bounds: { north: number; south: number; east: number; west: number }) => {
    const reqId = ++dotsReqRef.current;
    try {
      const pts = await tabaccheriePointsInBounds(bounds);
      if (reqId !== dotsReqRef.current) return; // superata da un pan/zoom successivo
      console.log('[Map] puntini registro:', pts.length, 'nell\'area');
      setDotsCount(pts.length);
      if (Platform.OS === 'web') {
        const L = (window as any).L;
        if (!L || !leafletMapRef.current) return;
        if (!leafletDotsRef.current) {
          leafletDotsRef.current = {
            group: L.layerGroup().addTo(leafletMapRef.current),
            renderer: L.canvas({ padding: 0.2 }),
          };
        }
        const { group, renderer } = leafletDotsRef.current;
        group.clearLayers();
        for (const p of pts) {
          L.circleMarker([p.lat, p.lng], {
            renderer, radius: 2.5, color: '#111827', fillColor: '#111827', fillOpacity: 0.85, weight: 0, interactive: false,
          }).addTo(group);
        }
      } else {
        // WebView nativa: payload compatto (5 decimali ≈ 1 m)
        console.log('[Map] invio', pts.length, 'puntini alla WebView');
        sendToMap({
          type: 'updateDots',
          data: pts.map(p => ({ lat: Math.round(p.lat * 1e5) / 1e5, lng: Math.round(p.lng * 1e5) / 1e5 })),
        });
      }
    } catch (e) {
      console.warn('[Map] puntini registro:', e);
    }
  }, [sendToMap]);

  const loadByBounds = useCallback(async (
    bounds: { north: number; south: number; east: number; west: number },
    activeFilter?: 'all' | 'active' | 'not_visited'
  ) => {
    loadTabDots(bounds); // in parallelo, non blocca i marker colorati
    try {
      setLoadingPoints(true);
      const data = await fetchTabaccherieByBounds(bounds, user?.id, userRole, activeFilter || 'all');
      setTabaccherie(data);
      updateLeafletMarkers(data);
      sendMarkersToWebView(data);
    } catch (e) {
      console.error('[Map] Error loading by bounds:', e);
    } finally {
      setLoadingPoints(false);
    }
  }, [user?.id, userRole, updateLeafletMarkers, sendMarkersToWebView, loadTabDots]);

  const loadAll = useCallback(async () => {
    // If we have current bounds, use bounds-based loading with filter (much faster)
    if (currentBoundsRef.current) {
      return loadByBounds(currentBoundsRef.current, filterMode);
    }
    try {
      setLoadingPoints(true);
      const [data, oMap] = await Promise.all([
        fetchAllTabaccherie(user?.id, 'agent', filterMode),
        fetchOrphanMap(),
      ]);
      setTabaccherie(data);
      setOrphanMap(oMap);
      updateLeafletMarkers(data);
      sendMarkersToWebView(data);
    } catch (e) {
      console.error('[Map] Error loading all:', e);
    } finally {
      setLoadingPoints(false);
    }
  }, [user?.id, filterMode, updateLeafletMarkers, sendMarkersToWebView, loadByBounds]);

  // Handle WebView messages
  const onWebViewMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);

      if (msg.type === 'boundsChanged') {
        currentBoundsRef.current = msg.bounds;
        loadByBounds(msg.bounds, filterModeRef.current);
      }

      if (msg.type === 'mapReady') console.log('[Map] WebView pronta (script Leaflet ok)');
      if (msg.type === 'dotsRendered') console.log('[Map] WebView ha disegnato', msg.count, 'puntini registro');
      if (msg.type === 'jsError') console.warn('[Map] errore JS nella WebView:', msg.where, msg.message);

      if (msg.type === 'markerClick') {
        const tab = tabaccherieRef.current.find(t => t.id === msg.id);
        if (tab) {
          setSelectedTab(tab);
          setShowPopup(true);
        }
      }
    } catch {}
  }, [loadByBounds, loadAll]);

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

  /**
   * ✅ Web parity (MPV2.tsx): risolve l'ID cliente di una tabaccheria.
   *
   * Causa: molte tabaccherie hanno customer_id=NULL pur avendo un cliente collegato
   * in senso inverso via customers.tabaccheria_id (1072+ tabaccherie con questa situazione).
   * Usare tab.customer_id || tab.id era sbagliato perché tab.id è l'ID della tabaccheria,
   * NON un customer_id.
   *
   * Priorità: 1) tab.customer_id, 2) lookup inverso customers.tabaccheria_id, 3) null
   */
  const resolveCustomerId = useCallback(async (tab: Tabaccheria): Promise<string | null> => {
    if (tab.customer_id) return tab.customer_id;
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id')
        .eq('tabaccheria_id', tab.id)
        .order('created_at', { ascending: true })
        .limit(1);
      if (error) {
        console.error('[Map] resolveCustomerId error:', error);
        return null;
      }
      if (data && data.length > 0) {
        return data[0].id as string;
      }
    } catch (err) {
      console.error('[Map] resolveCustomerId exception:', err);
    }
    return null;
  }, []);

  const handleOrderClick = async (tab: Tabaccheria) => {
    setShowPopup(false);
    const customerName = tab.customer_business_name || tab.denominazione || '';
    // ✅ Web parity: usa resolveCustomerId per gestire customer_id NULL
    const customerId = await resolveCustomerId(tab);
    if (!customerId) {
      Alert.alert('Errore', 'Nessun cliente associato a questo punto vendita');
      return;
    }
    router.push({
      pathname: '/order-collection-v2',
      params: { customerId, customerName },
    });
  };

  const handleShowOrderData = async (tab: Tabaccheria) => {
    // ✅ Web parity: risolvi customer_id reale (anche se tab.customer_id è null)
    const customerId = await resolveCustomerId(tab);
    if (!customerId) {
      Alert.alert('Errore', 'Nessun cliente associato a questo punto vendita');
      return;
    }
    setShowOrderDataModal(true);
    setLoadingOrderData(true);
    setOrderData(null);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('order_date, total_amount')
        .eq('customer_id', customerId)
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

  // ✅ MPVP: selezione LUOGO dalla barra di ricerca unificata → zoom sulla posizione
  const handleMpvpSelectPlace = useCallback((place: PlaceSuggestion) => {
    setShowSearch(false);
    sendToMap({ type: 'setCenter', lat: place.lat, lng: place.lon, zoom: 15 });
  }, [sendToMap]);

  // ✅ MPVP: selezione CLIENTE → zoom sul punto vendita + apertura popup marker
  const handleMpvpSelectCustomer = useCallback(async (c: MpvpCustomerResult) => {
    setShowSearch(false);
    if (c.latitude == null || c.longitude == null) {
      Alert.alert('Posizione mancante', 'Questo punto vendita non ha coordinate GPS.');
      return;
    }
    sendToMap({ type: 'setCenter', lat: c.latitude, lng: c.longitude, zoom: 17 });

    // Apri il popup: prima cerca tra i punti già caricati, altrimenti fetch completo
    const existing = tabaccherieRef.current.find(t => t.id === c.id);
    if (existing) {
      setSelectedTab(existing);
      setShowPopup(true);
      return;
    }
    const full = await fetchTabaccheriaById(c.id);
    if (full) {
      setSelectedTab(full);
      setShowPopup(true);
    }
  }, [sendToMap]);

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

  const selectedColor = selectedTab ? getMarkerColor(selectedTab, user?.id, userRole, orphanMapRef.current) : 'red';
  const isOwnedByOther = selectedColor === 'gray';
  const isOrphanColor = selectedColor === 'purple' || selectedColor === 'yellow' || selectedColor === 'purple_own' || selectedColor === 'yellow_own';
  const isOwnOrphan = selectedColor === 'purple_own' || selectedColor === 'yellow_own';

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
        <View style={[styles.loadingBadge, { top: 8 }]}>
          <ActivityIndicator size="small" color="#10B981" />
          <Text style={styles.loadingBadgeText}>Caricamento...</Text>
        </View>
      )}

      {/* Counter badge with breakdown */}
      {!loadingPoints && tabaccherie.length > 0 && (
        <View style={[styles.counterBadge, { top: 8 }]}>
          <Text style={styles.counterText}>
            {tabaccherie.length} punti
            {' \u2022 '}
            <Text style={{ color: '#15803D' }}>{tabaccherie.filter(t => t.stato_visita === 'ordinato').length}</Text>
            {' \u2022 '}
            <Text style={{ color: '#F97316' }}>{tabaccherie.filter(t => t.stato_visita === 'visitato').length}</Text>
            {' \u2022 '}
            <Text style={{ color: '#DC2626' }}>{tabaccherie.filter(t => !t.stato_visita || t.stato_visita === 'non_visitato').length}</Text>
          </Text>
          {dotsCount != null && (
            <Text style={[styles.counterText, { color: '#111827' }]} testID="map-dots-count">
              {'\u25CF'} {dotsCount}{dotsCount >= 5000 ? '+' : ''} tabaccherie nell&apos;area
            </Text>
          )}
        </View>
      )}

      {/* Filter buttons */}
      <View style={[styles.filterRow, { top: 44 }]}>
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
        style={[styles.fabButton, { top: 86, right: 12 }]}
        onPress={() => setShowSearch(true)}
      >
        <Ionicons name="search" size={22} color="#7C3AED" />
      </TouchableOpacity>

      {/* Rivendite No Mappa button */}
      <TouchableOpacity
        style={[styles.fabButton, { top: 86, left: 12, backgroundColor: '#EF4444' }]}
        onPress={() => router.push('/rivendite-no-mappa')}
      >
        <Ionicons name="add" size={22} color="#FFF" />
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
            { color: '#7C3AED', label: 'Orfano A (no ordini recenti)' },
            { color: '#FFD600', label: 'Orfano B (mai ordinato)' },
            { color: '#7C3AED', borderColor: '#15803D', label: 'Tuo cliente Orfano A' },
            { color: '#FFD600', borderColor: '#15803D', label: 'Tuo cliente Orfano B' },
            { color: '#475569', label: 'Altro agente' },
            { color: '#111827', label: 'Tabaccheria (registro)' },
          ].map((item, i) => {
            const own = !!item.borderColor;
            const size = own ? 14 : 10;
            return (
              <View key={i} style={styles.legendItem}>
                <View style={{
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: item.color,
                  ...(own ? { borderWidth: 2, borderColor: item.borderColor } : {}),
                }} />
                <Text style={styles.legendLabel}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* MPVP Unified Search Bar (Clienti + Luoghi) */}
      <MpvpSearchBar
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectCustomer={handleMpvpSelectCustomer}
        onSelectPlace={handleMpvpSelectPlace}
        topInset={insets.top}
      />

      {/* Marker Popup (Bottom Sheet - NO Modal to avoid blocking Leaflet) */}
      {showPopup && selectedTab && (
        <View style={[styles.popupOverlayInline, { bottom: tabBarHeight }]}>
          <TouchableOpacity style={styles.popupOverlayBg} activeOpacity={1} onPress={() => setShowPopup(false)} />
          <View style={[styles.popupSheet, { paddingBottom: 16 }]}>
            {/* Header */}
            <View style={styles.popupHandle} />
            <View style={styles.popupHeader}>
              <View style={styles.popupHeaderLeft}>
                <View style={[styles.popupColorDot, {
                  backgroundColor: selectedColor === 'gray' ? '#475569' :
                    selectedColor === 'red' ? '#DC2626' :
                    selectedColor === 'orange' ? '#F97316' :
                    selectedColor === 'green' ? '#15803D' :
                    selectedColor === 'purple' || selectedColor === 'purple_own' ? '#7C3AED' :
                    selectedColor === 'yellow' || selectedColor === 'yellow_own' ? '#FFD600' : '#DC2626',
                  ...(isOwnOrphan ? { borderWidth: 2, borderColor: '#15803D' } : {}),
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

            {/* Quick contact row — nascosta per i clienti di altri agenti (marker grigi) */}
            {!isOwnedByOther && (selectedTab.telefono_mobile || selectedTab.telefono_fisso) && (
              <View style={styles.popupContactRow}>
                <Ionicons name="call-outline" size={14} color="#6B7280" />
                <Text style={styles.popupContactText} numberOfLines={1}>
                  {selectedTab.telefono_mobile || selectedTab.telefono_fisso}
                </Text>
                <TouchableOpacity
                  style={styles.popupCallBtn}
                  onPress={() => Linking.openURL(`tel:${selectedTab.telefono_mobile || selectedTab.telefono_fisso}`)}
                >
                  <Ionicons name="call" size={14} color="#FFFFFF" />
                  <Text style={styles.popupCallBtnText}>Chiama</Text>
                </TouchableOpacity>
              </View>
            )}

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

              {/* Red: Visit (web app says "Visita") */}
              {selectedColor === 'red' && !isOwnedByOther && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnPrimary]}
                  onPress={() => {
                    setShowPopup(false);
                    router.push({
                      pathname: '/anagrafica',
                      params: { tabaccheriaId: selectedTab.id },
                    });
                  }}
                >
                  <Ionicons name="document-text" size={18} color="#FFF" />
                  <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Visita</Text>
                </TouchableOpacity>
              )}

              {/* Orange/Green/Orphan (any): Order + Data + Inspection (web parity) */}
              {(selectedColor === 'orange' || selectedColor === 'green' || isOrphanColor) && (
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
                    <Text style={[styles.actionBtnText, { color: COLORS.textSecondary }]}>Dati</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#8B5CF6' }]}
                    onPress={async () => {
                      // ✅ Web parity: resolveCustomerId gestisce customer_id=NULL via fallback inverso
                      const custId = await resolveCustomerId(selectedTab);
                      if (!custId) {
                        Alert.alert('Errore', 'Nessun cliente associato a questo punto vendita');
                        return;
                      }
                      // Close popup first, then navigate AFTER modal has dismissed
                      setShowPopup(false);
                      setTimeout(() => {
                        router.push(`/inspection/new?customerId=${encodeURIComponent(custId)}`);
                      }, 250);
                    }}
                  >
                    <Ionicons name="camera" size={18} color="#FFF" />
                    <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Ispezione</Text>
                  </TouchableOpacity>
                </>
              )}

              {/* Gray: info message */}
              {isOwnedByOther && !isOrphanColor && (
                <View style={styles.grayInfoBox}>
                  <Ionicons name="information-circle" size={18} color="#9CA3AF" />
                  <Text style={styles.grayInfoText}>Cliente di altro agente</Text>
                </View>
              )}

              {/* Orphan (NOT owned by current agent): Reclama button — RED rose (web parity)
                  ✅ Web parity: Si mostra sempre (anche se tab.customer_id=NULL).
                  Al tap, resolveCustomerId trova il customer reale via tabaccheria_id lookup. */}
              {(selectedColor === 'purple' || selectedColor === 'yellow') && selectedTab.agente_id !== user?.id && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#E11D48' }]}
                  onPress={async () => {
                    if (!user) return;
                    const tabaccheriaId = selectedTab.id;
                    const customerName = getDisplayName(selectedTab);
                    // ✅ Web parity: risolvi customer_id reale (anche se tab.customer_id è null)
                    const customerId = await resolveCustomerId(selectedTab);
                    if (!customerId) {
                      Alert.alert('Errore', 'Nessun cliente associato a questo punto vendita');
                      return;
                    }
                    // Close popup BEFORE showing alert (web parity + Android Alert visibility fix)
                    setShowPopup(false);
                    // Small timeout so popup unmounts cleanly before Alert appears
                    setTimeout(() => {
                      Alert.alert(
                        'Reclama Cliente',
                        `Vuoi reclamare "${customerName}" come tuo cliente?\n\nLa richiesta verrà inviata all'amministratore per approvazione.`,
                        [
                          { text: 'Annulla', style: 'cancel' },
                          {
                            text: 'Reclama',
                            onPress: async () => {
                              const result = await claimOrphanCustomer(customerId, tabaccheriaId, user.id);
                              if (result.success) {
                                Alert.alert('Richiesta Inviata', 'La tua richiesta di reclamo è stata inviata. Attendi l\'approvazione dell\'amministratore.');
                              } else {
                                Alert.alert('Errore', result.error || 'Impossibile inviare la richiesta');
                              }
                            },
                          },
                        ]
                      );
                    }, 200);
                  }}
                >
                  <Ionicons name="flag" size={18} color="#FFF" />
                  <Text style={[styles.actionBtnText, { color: '#FFF' }]}>Reclama</Text>
                </TouchableOpacity>
              )}

              {/* Orphan info banners */}
              {(selectedColor === 'purple' || selectedColor === 'purple_own') && (
                <View style={[styles.grayInfoBox, { backgroundColor: '#F3E8FF', borderColor: '#C4B5FD' }]}>
                  <Ionicons name="alert-circle" size={16} color="#7C3AED" />
                  <Text style={[styles.grayInfoText, { color: '#7C3AED' }]}>
                    {isOwnOrphan ? 'Tuo cliente — Orfano A: contattalo per un nuovo ordine' : 'Orfano A: nessun ordine recente'}
                  </Text>
                </View>
              )}
              {(selectedColor === 'yellow' || selectedColor === 'yellow_own') && (
                <View style={[styles.grayInfoBox, { backgroundColor: '#FEF9C3', borderColor: '#FDE68A' }]}>
                  <Ionicons name="alert-circle" size={16} color="#A16207" />
                  <Text style={[styles.grayInfoText, { color: '#A16207' }]}>
                    {isOwnOrphan ? 'Tuo cliente — Orfano B: mai ordinato, va visitato' : 'Orfano B: mai ordinato'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

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

