import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  Switch,
  FlatList,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { uploadVisitPhotos } from '../lib/api/photos';
import { usePhotoStamper } from '../components/PhotoStamper';

type CustomerType = 'retail' | 'horeca' | 'industry' | 'other';

interface PhotoData {
  uri: string;
  gps: { lat: number; lon: number };
}

interface TabSearchResult {
  id: string;
  denominazione: string;
  indirizzo: string;
  comune: string;
  provincia: string;
  cap: string;
  telefono_mobile?: string;
  email?: string;
  cf_iva?: string;
  partita_iva?: string;
  codice_fiscale?: string;
  gps_lat?: string | number;
  gps_lng?: string | number;
  customer_id?: string;
  agente_id?: string;
  Num_Ordinale?: number | string;
}

/**
 * Web app parity (FirstVisit.tsx → parseCfIva):
 * Priority 1: dedicated `partita_iva` / `codice_fiscale` columns
 * Priority 2: legacy `cf_iva` column (auto-detect P.IVA vs Codice Fiscale)
 */
function parseCfIva(
  cfIva?: string | null,
  partitaIva?: string | null,
  codiceFiscale?: string | null
): { vatNumber: string; fiscalCode: string } {
  let vatNumber = '';
  let fiscalCode = '';

  // Priority 1: dedicated columns
  if (partitaIva && partitaIva.trim() !== '') {
    const numericValue = partitaIva.trim().replace(/\D/g, '');
    vatNumber = numericValue.padStart(11, '0');
  }
  if (codiceFiscale && codiceFiscale.trim() !== '') {
    fiscalCode = codiceFiscale.trim().toUpperCase();
  }
  if (vatNumber || fiscalCode) {
    return { vatNumber, fiscalCode };
  }

  // Priority 2: legacy cf_iva fallback
  if (!cfIva || !cfIva.trim()) return { vatNumber: '', fiscalCode: '' };
  const trimmed = cfIva.trim();
  if (/[a-zA-Z]/.test(trimmed)) {
    return { vatNumber: '', fiscalCode: trimmed.toUpperCase() };
  }
  return { vatNumber: trimmed.replace(/\D/g, '').padStart(11, '0'), fiscalCode: '' };
}

async function generateUniqueCodiceRivendita(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = `NEW-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const { data } = await supabase.from('tabaccherie').select('id').eq('codice_rivendita', code).maybeSingle();
    if (!data) return code;
  }
  throw new Error('Impossibile generare un codice rivendita univoco');
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const vatRegex = /^[0-9]{11}$/;
const fiscalCodeRegex = /^[A-Z0-9]{16}$/;
const sdiRegex = /^[A-Z0-9]{7}$/;

export default function AnagraficaScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuthStore();
  const userRole = profile?.role || 'agent';
  const isAdmin = userRole === 'admin' || userRole === 'admincustom' || userRole === 'branch_admin';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isPhoneVisit, setIsPhoneVisit] = useState(false);
  const { stampPhoto, StamperView } = usePhotoStamper();

  // Step 1: Photos + GPS
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [gpsPosition, setGpsPosition] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [proximityVerified, setProximityVerified] = useState<boolean | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  // ✅ Web parity: tabaccheria GPS coordinates (preferred over agent device GPS when registering from map)
  const [tabaccheriaGps, setTabaccheriaGps] = useState<{ lat: number; lng: number } | null>(null);

  // Step 2: Form
  const [form, setForm] = useState({
    businessName: '', address: '', city: '', province: '', postalCode: '',
    contactName: '', contactSurname: '', contactPhone: '', contactEmail: '',
    customerType: 'retail' as CustomerType, notes: '',
    vatNumber: '', fiscalCode: '', pec: '', sdi: '',
    tabaccheriaId: '',
  });

  // Step 3: Follow-up
  const [scheduleAppointment, setScheduleAppointment] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');

  // Search modal
  const [showSearch, setShowSearch] = useState(false);
  const [searchCity, setSearchCity] = useState('');
  const [searchAddress, setSearchAddress] = useState('');
  const [searchNumOrdinale, setSearchNumOrdinale] = useState('');
  const [searchResults, setSearchResults] = useState<TabSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Load from map params
  useEffect(() => {
    if (params.tabaccheriaId) {
      loadTabaccheriaData(params.tabaccheriaId as string);
    }
  }, [params.tabaccheriaId]);

  const loadTabaccheriaData = async (tabId: string) => {
    try {
      const { data, error } = await supabase
        .from('tabaccherie').select('*').eq('id', tabId).single();
      if (error || !data) return;
      const { vatNumber, fiscalCode } = parseCfIva(data.cf_iva, data.partita_iva, data.codice_fiscale);
      setForm(prev => ({
        ...prev,
        businessName: data.denominazione || '',
        address: data.indirizzo || '',
        city: data.comune || '',
        province: data.provincia || '',
        postalCode: data.cap || '',
        contactPhone: data.telefono_mobile || '',
        contactEmail: data.email || '',
        vatNumber, fiscalCode,
        tabaccheriaId: data.id,
      }));
      // ✅ Web parity: store tabaccheria GPS coords for use during customer save
      if (data.gps_lat && data.gps_lng) {
        const lat = parseFloat(data.gps_lat);
        const lng = parseFloat(data.gps_lng);
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          setTabaccheriaGps({ lat, lng });
        }
      }
    } catch {}
  };

  // GPS
  const handleGetGPS = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permesso negato', 'Abilita la geolocalizzazione per proseguire.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const pos = { lat: loc.coords.latitude, lng: loc.coords.longitude, accuracy: loc.coords.accuracy || 0 };
      setGpsPosition(pos);

      // Proximity check
      if (!isAdmin && !isPhoneVisit && form.tabaccheriaId) {
        const { data: tab } = await supabase
          .from('tabaccherie').select('gps_lat, gps_lng')
          .eq('id', form.tabaccheriaId).single();
        if (tab?.gps_lat && tab?.gps_lng) {
          const lat = parseFloat(tab.gps_lat);
          const lng = parseFloat(tab.gps_lng);
          if (!isNaN(lat) && !isNaN(lng)) {
            const dist = calculateDistance(pos.lat, pos.lng, lat, lng);
            setDistanceMeters(dist);
            setProximityVerified(dist <= 200);
          }
        }
      }
      Alert.alert('GPS attivato', 'Posizione acquisita con successo.');
    } catch {
      Alert.alert('Errore GPS', 'Impossibile ottenere la posizione.');
    } finally {
      setGpsLoading(false);
    }
  };

  // Camera
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permesso negato', 'Abilita la fotocamera per scattare foto.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.[0]) {
        const gps = gpsPosition ? { lat: gpsPosition.lat, lon: gpsPosition.lng } : { lat: 0, lon: 0 };
        const stamped = await stampPhoto(result.assets[0].uri);
        setPhotos(prev => [...prev, { uri: stamped, gps }]);
      }
    } catch {
      Alert.alert('Errore', 'Impossibile scattare la foto.');
    }
  };

  // Gallery picker
  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permesso negato', 'Abilita l\'accesso alla galleria per selezionare foto.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsMultipleSelection: true,
        selectionLimit: 5,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const gps = gpsPosition ? { lat: gpsPosition.lat, lon: gpsPosition.lng } : { lat: 0, lon: 0 };
        for (const asset of result.assets) {
          const stamped = await stampPhoto(asset.uri);
          setPhotos(prev => [...prev, { uri: stamped, gps }]);
        }
      }
    } catch {
      Alert.alert('Errore', 'Impossibile selezionare le foto.');
    }
  };

  // Search tabaccherie
  useEffect(() => {
    if (!searchCity || searchCity.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        let query = supabase.from('tabaccherie').select('id, denominazione, indirizzo, comune, provincia, cap, telefono_mobile, email, cf_iva, partita_iva, codice_fiscale, gps_lat, gps_lng, customer_id, agente_id, "Num_Ordinale"')
          .ilike('comune', `%${searchCity}%`).order('denominazione').limit(50);
        if (searchAddress.length >= 1) query = query.ilike('indirizzo', `%${searchAddress}%`);
        if (searchNumOrdinale.length >= 1) {
          const numVal = parseInt(searchNumOrdinale);
          if (!isNaN(numVal)) {
            query = query.eq('Num_Ordinale', numVal);
          }
        }
        const { data } = await query;
        setSearchResults((data as TabSearchResult[]) || []);
      } catch {} finally { setSearchLoading(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchCity, searchAddress, searchNumOrdinale]);

  // Select tabaccheria from search
  const handleSelectTab = async (tab: TabSearchResult) => {
    // Ownership check
    if (tab.customer_id && !isAdmin) {
      Alert.alert('Non consentito', 'Questa tabaccheria è già registrata come cliente.');
      return;
    }
    if (tab.agente_id && tab.agente_id !== user?.id && !isAdmin) {
      Alert.alert('Non consentito', 'Questa tabaccheria è assegnata ad un altro agente.');
      return;
    }
    const { vatNumber, fiscalCode } = parseCfIva(tab.cf_iva, tab.partita_iva, tab.codice_fiscale);
    setForm(prev => ({
      ...prev,
      businessName: tab.denominazione || '',
      address: tab.indirizzo || '',
      city: tab.comune || '',
      province: tab.provincia || '',
      postalCode: tab.cap || '',
      contactPhone: tab.telefono_mobile || '',
      contactEmail: tab.email || '',
      vatNumber, fiscalCode,
      tabaccheriaId: tab.id,
    }));
    // ✅ Web parity: store tabaccheria GPS coords from search result
    if (tab.gps_lat && tab.gps_lng) {
      const lat = parseFloat(String(tab.gps_lat));
      const lng = parseFloat(String(tab.gps_lng));
      if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
        setTabaccheriaGps({ lat, lng });
      } else {
        setTabaccheriaGps(null);
      }
    } else {
      setTabaccheriaGps(null);
    }
    setShowSearch(false);
    setSearchCity(''); setSearchAddress(''); setSearchNumOrdinale('');
    Alert.alert('Dati caricati', 'Completa i campi mancanti per procedere.');
  };

  const updateField = (field: string, value: string) => {
    const upper = ['businessName','address','city','province','contactName','contactSurname','fiscalCode','sdi']
      .includes(field) ? value.toUpperCase() : value;
    setForm(prev => ({ ...prev, [field]: upper }));
  };

  const canProceed = (): boolean => {
    if (step === 1) return isPhoneVisit || photos.length >= 2;
    if (step === 2) {
      const required = form.businessName && form.address && form.city && form.province &&
        form.postalCode && form.contactName && form.contactSurname &&
        form.contactPhone && form.contactEmail && form.vatNumber &&
        form.fiscalCode && form.notes;
      const pecOrSdi = (form.pec && form.pec.trim()) || (form.sdi && form.sdi.trim());
      const vatOk = vatRegex.test(form.vatNumber);
      const cfOk = fiscalCodeRegex.test(form.fiscalCode.toUpperCase());
      return !!(required && pecOrSdi && vatOk && cfOk);
    }
    return true;
  };

  // Submit
  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Validate
      if (!vatRegex.test(form.vatNumber)) { Alert.alert('Errore', 'P.IVA deve essere di 11 cifre'); return; }
      if (!fiscalCodeRegex.test(form.fiscalCode.toUpperCase())) { Alert.alert('Errore', 'Codice Fiscale deve essere 16 caratteri alfanumerici'); return; }
      if (!form.pec?.trim() && !form.sdi?.trim()) { Alert.alert('Errore', 'Almeno uno tra PEC o SDI deve essere compilato'); return; }

      const emailValue = form.contactEmail && emailRegex.test(form.contactEmail) ? form.contactEmail : null;
      let customerNotes = form.notes || '';
      if (isPhoneVisit) {
        customerNotes += '\n\n[PRIMA VISITA TELEFONICA] Ordine ricevuto telefonicamente.';
      }

      // ✅ Web parity (FirstVisit.tsx): Use tabaccheria GPS coords if registering from map, else agent device GPS
      // Priority: tabaccheriaGps > agentGps (gpsPosition) > 0
      const latitude = tabaccheriaGps?.lat ?? gpsPosition?.lat ?? 0;
      const longitude = tabaccheriaGps?.lng ?? gpsPosition?.lng ?? 0;

      console.log('[Anagrafica] 📍 GPS Resolution:', {
        tabaccheriaGps,
        agentGps: gpsPosition,
        finalUsed: { latitude, longitude },
        source: tabaccheriaGps ? 'tabaccheria' : (gpsPosition ? 'agent_device' : 'none'),
      });

      // Create customer
      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .insert({
          business_name: form.businessName,
          address: form.address,
          city: form.city,
          province: form.province,
          postal_code: form.postalCode,
          latitude, longitude,
          contact_name: form.contactName,
          contact_surname: form.contactSurname,
          contact_phone: form.contactPhone,
          contact_email: emailValue,
          vat_number: form.vatNumber,
          fiscal_code: form.fiscalCode,
          customer_type: form.customerType,
          category: 'prospect',
          agent_id: user.id,
          notes: customerNotes,
          pec: form.pec || '',
          sdi: form.sdi || '',
          tabaccheria_id: form.tabaccheriaId || null,
          first_visit_date: new Date().toISOString(),
          last_visit_date: new Date().toISOString(),
        })
        .select().single();

      if (custErr) throw new Error(`Errore creazione cliente: ${custErr.message}`);

      // Create visit
      const { data: visit, error: visitErr } = await supabase
        .from('visits')
        .insert({
          customer_id: customer.id,
          agent_id: user.id,
          visit_type: 'first_visit',
          latitude, longitude,
          gps_accuracy: gpsPosition?.accuracy || 0,
          notes: form.notes,
          status: 'completed',
          visit_date: new Date().toISOString(),
        })
        .select()
        .single();
      if (visitErr) console.error('Visit insert error:', visitErr);

      // Upload photos to visit_photos table
      if (photos.length > 0 && !isPhoneVisit && visit) {
        try {
          const photoObjects = photos.map(p => ({ uri: p.uri, latitude: p.gps.lat, longitude: p.gps.lon }));
          const photoUrls = await uploadVisitPhotos(photoObjects, user.id, customer.id, visit.id);
          console.log(`[Anagrafica] ${photoUrls.length}/${photos.length} foto caricate in visit_photos`);
        } catch (uploadErr) {
          console.warn('[Anagrafica] Errore upload foto (non bloccante):', uploadErr);
        }
      }

      // Update or create tabaccheria
      if (form.tabaccheriaId) {
        await supabase.from('tabaccherie').update({
          stato_visita: 'visitato',
          agente_id: user.id,
          customer_id: customer.id,
          // Sync dedicated columns + legacy cf_iva
          partita_iva: form.vatNumber || null,
          codice_fiscale: form.fiscalCode || null,
          cf_iva: form.vatNumber || form.fiscalCode || null,
        }).eq('id', form.tabaccheriaId);
      } else {
        const codice = await generateUniqueCodiceRivendita();
        const { data: newTab, error: tabErr } = await supabase.from('tabaccherie').insert({
          codice_rivendita: codice,
          denominazione: form.businessName,
          indirizzo: form.address,
          comune: form.city,
          cap: form.postalCode,
          provincia: form.province,
          telefono_mobile: form.contactPhone || null,
          email: emailValue,
          partita_iva: form.vatNumber || null,
          codice_fiscale: form.fiscalCode || null,
          cf_iva: form.vatNumber || form.fiscalCode || null,
          gps_lat: latitude.toString(),
          gps_lng: longitude.toString(),
          stato_visita: 'visitato',
          agente_id: user.id,
          customer_id: customer.id,
        }).select().single();
        if (tabErr) {
          console.error('Tabaccheria insert error:', tabErr);
        } else if (newTab) {
          // Link customer back to the new tabaccheria
          await supabase.from('customers')
            .update({ tabaccheria_id: newTab.id })
            .eq('id', customer.id);
        }
      }

      // Optional appointment
      if (scheduleAppointment && appointmentDate) {
        await supabase.from('appointments').insert({
          customer_id: customer.id,
          agent_id: user.id,
          created_by_id: user.id,
          appointment_date: appointmentDate,
          appointment_type: 'follow_up',
          status: 'scheduled',
          notes: appointmentNotes || null,
        });
      }

      Alert.alert('Completato!', 'Anagrafica registrata con successo.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Errore', error.message || 'Impossibile completare la registrazione.');
    } finally {
      setLoading(false);
    }
  };

  const STEPS = ['Foto', 'Anagrafica', 'Riepilogo'];

  // ========== RENDERERS ==========

  const renderStep1 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      {/* Phone Visit Toggle */}
      <View style={styles.phoneToggleRow}>
        <Ionicons name="call" size={20} color="#3B82F6" />
        <Text style={styles.phoneToggleLabel}>Visita Telefonica</Text>
        <Switch value={isPhoneVisit} onValueChange={setIsPhoneVisit}
          trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
          thumbColor={isPhoneVisit ? '#3B82F6' : '#9CA3AF'} />
      </View>
      {isPhoneVisit && (
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={18} color="#3B82F6" />
          <Text style={styles.infoBoxText}>Modalita telefonica: GPS e foto non richiesti.</Text>
        </View>
      )}

      {!isPhoneVisit && (
        <>
          {/* GPS */}
          <TouchableOpacity style={styles.gpsButton} onPress={handleGetGPS} disabled={gpsLoading}>
            {gpsLoading ? <ActivityIndicator color="#FFF" size="small" /> : (
              <>
                <Ionicons name="locate" size={20} color="#FFF" />
                <Text style={styles.gpsButtonText}>{gpsPosition ? 'GPS Acquisito' : 'Attiva GPS'}</Text>
              </>
            )}
          </TouchableOpacity>
          {gpsPosition && (
            <View style={styles.gpsBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={styles.gpsBadgeText}>
                Posizione: {gpsPosition.lat.toFixed(5)}, {gpsPosition.lng.toFixed(5)}
              </Text>
            </View>
          )}
          {proximityVerified === false && distanceMeters && (
            <View style={[styles.gpsBadge, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="warning" size={16} color="#D97706" />
              <Text style={[styles.gpsBadgeText, { color: '#92400E' }]}>
                Distanza: {Math.round(distanceMeters)}m (soglia 200m)
              </Text>
            </View>
          )}

          {/* Photos */}
          <Text style={styles.sectionTitle}>Foto della visita (min. 2)</Text>
          <View style={styles.photoGrid}>
            {photos.map((p, i) => (
              <View key={i} style={styles.photoItem}>
                <Image source={{ uri: p.uri }} style={styles.photoThumb} contentFit="cover" cachePolicy="memory-disk" transition={150} />
                <TouchableOpacity style={styles.photoRemove} onPress={() => setPhotos(prev => prev.filter((_,idx) => idx !== i))}>
                  <Ionicons name="close-circle" size={22} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.photoAdd} onPress={handleTakePhoto}>
              <Ionicons name="camera" size={28} color="#6B7280" />
              <Text style={styles.photoAddText}>Scatta</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoAdd, { borderColor: '#7C3AED' }]} onPress={handlePickFromGallery}>
              <Ionicons name="images" size={28} color="#7C3AED" />
              <Text style={[styles.photoAddText, { color: '#7C3AED' }]}>Galleria</Text>
            </TouchableOpacity>
          </View>
          {photos.length < 2 && (
            <Text style={styles.photoHint}>Servono almeno 2 foto per proseguire</Text>
          )}
        </>
      )}
    </ScrollView>
  );

  const renderStep2 = () => (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Search Tabaccheria Button */}
        <TouchableOpacity style={styles.searchTabBtn} onPress={() => setShowSearch(true)}>
          <Ionicons name="search" size={18} color="#7C3AED" />
          <Text style={styles.searchTabBtnText}>Cerca Tabaccheria</Text>
        </TouchableOpacity>

        {/* Form Fields */}
        <Text style={styles.sectionTitle}>Dati Aziendali</Text>
        <FormField label="Ragione Sociale *" value={form.businessName} field="businessName" onChange={updateField} />
        <FormField label="P.IVA * (11 cifre)" value={form.vatNumber} field="vatNumber" onChange={updateField} keyboardType="numeric" maxLength={11}
          error={form.vatNumber && !vatRegex.test(form.vatNumber) ? 'P.IVA deve essere di 11 cifre' : ''} />
        <FormField label="Codice Fiscale * (16 car.)" value={form.fiscalCode} field="fiscalCode" onChange={updateField} maxLength={16} autoCapitalize="characters"
          error={form.fiscalCode && !fiscalCodeRegex.test(form.fiscalCode.toUpperCase()) ? 'Codice Fiscale: 16 caratteri alfanumerici' : ''} />

        <Text style={styles.sectionTitle}>Indirizzo</Text>
        <FormField label="Indirizzo *" value={form.address} field="address" onChange={updateField} />
        <View style={styles.row}>
          <View style={{ flex: 2 }}><FormField label="Citta *" value={form.city} field="city" onChange={updateField} /></View>
          <View style={{ flex: 1, marginLeft: 8 }}><FormField label="Prov. *" value={form.province} field="province" onChange={updateField} maxLength={2} /></View>
          <View style={{ flex: 1, marginLeft: 8 }}><FormField label="CAP *" value={form.postalCode} field="postalCode" onChange={updateField} keyboardType="numeric" maxLength={5} /></View>
        </View>

        <Text style={styles.sectionTitle}>Contatto</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><FormField label="Nome *" value={form.contactName} field="contactName" onChange={updateField} /></View>
          <View style={{ flex: 1, marginLeft: 8 }}><FormField label="Cognome *" value={form.contactSurname} field="contactSurname" onChange={updateField} /></View>
        </View>
        <FormField label="Telefono *" value={form.contactPhone} field="contactPhone" onChange={updateField} keyboardType="phone-pad" />
        <FormField label="Email *" value={form.contactEmail} field="contactEmail" onChange={updateField} keyboardType="email-address" autoCapitalize="none"
          error={form.contactEmail && !emailRegex.test(form.contactEmail) ? 'Email non valida' : ''} />

        <Text style={styles.sectionTitle}>Fatturazione (almeno PEC o SDI)</Text>
        <FormField label="PEC" value={form.pec} field="pec" onChange={updateField} keyboardType="email-address" autoCapitalize="none" />
        <FormField label="SDI (7 car.)" value={form.sdi} field="sdi" onChange={updateField} maxLength={7} autoCapitalize="characters" />
        {!form.pec?.trim() && !form.sdi?.trim() && (
          <Text style={styles.validationHint}>Almeno uno tra PEC o SDI deve essere compilato</Text>
        )}

        <Text style={styles.sectionTitle}>Tipo Cliente</Text>
        <View style={styles.typeRow}>
          {(['retail', 'horeca', 'industry', 'other'] as CustomerType[]).map(t => (
            <TouchableOpacity key={t} style={[styles.typeBtn, form.customerType === t && styles.typeBtnActive]}
              onPress={() => setForm(prev => ({ ...prev, customerType: t }))}>
              <Text style={[styles.typeBtnText, form.customerType === t && styles.typeBtnTextActive]}>
                {t === 'retail' ? 'Retail' : t === 'horeca' ? 'Horeca' : t === 'industry' ? 'Industry' : 'Altro'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Note *</Text>
        <TextInput style={styles.textArea} multiline numberOfLines={4} textAlignVertical="top"
          value={form.notes} onChangeText={v => updateField('notes', v)} placeholder="Note sulla visita..." placeholderTextColor="#9CA3AF" />

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderStep3 = () => (
    <ScrollView style={styles.stepContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionTitle}>Riepilogo Anagrafica</Text>
      <View style={styles.summaryCard}>
        <SummaryRow label="Ragione Sociale" value={form.businessName} />
        <SummaryRow label="P.IVA" value={form.vatNumber} />
        <SummaryRow label="Codice Fiscale" value={form.fiscalCode} />
        <SummaryRow label="Indirizzo" value={`${form.address}, ${form.city} (${form.province}) ${form.postalCode}`} />
        <SummaryRow label="Contatto" value={`${form.contactName} ${form.contactSurname}`} />
        <SummaryRow label="Telefono" value={form.contactPhone} />
        <SummaryRow label="Email" value={form.contactEmail} />
        {form.pec ? <SummaryRow label="PEC" value={form.pec} /> : null}
        {form.sdi ? <SummaryRow label="SDI" value={form.sdi} /> : null}
        <SummaryRow label="Tipo" value={form.customerType} />
        <SummaryRow label="Note" value={form.notes} />
        <SummaryRow label="Foto" value={isPhoneVisit ? 'Visita telefonica' : `${photos.length} foto`} />
        {gpsPosition && <SummaryRow label="GPS" value={`${gpsPosition.lat.toFixed(5)}, ${gpsPosition.lng.toFixed(5)}`} />}
      </View>

      {/* Follow-up */}
      <Text style={styles.sectionTitle}>Follow-up</Text>
      <View style={styles.phoneToggleRow}>
        <Ionicons name="calendar" size={20} color="#7C3AED" />
        <Text style={styles.phoneToggleLabel}>Pianifica appuntamento</Text>
        <Switch value={scheduleAppointment} onValueChange={setScheduleAppointment}
          trackColor={{ false: '#E5E7EB', true: '#C4B5FD' }} thumbColor={scheduleAppointment ? '#7C3AED' : '#9CA3AF'} />
      </View>
      {scheduleAppointment && (
        <View>
          <FormField label="Data appuntamento" value={appointmentDate} field="appointmentDate"
            onChange={(_, v) => setAppointmentDate(v)} placeholder="YYYY-MM-DD" />
          <FormField label="Note appuntamento" value={appointmentNotes} field="appointmentNotes"
            onChange={(_, v) => setAppointmentNotes(v)} />
        </View>
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StamperView />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1F2937" />
          <Text style={styles.backBtnText}>Indietro</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Anagrafica</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Stepper */}
      <View style={styles.stepper}>
        {STEPS.map((s, i) => (
          <View key={i} style={styles.stepItem}>
            <View style={[styles.stepCircle, step > i + 1 && styles.stepDone, step === i + 1 && styles.stepActive]}>
              {step > i + 1 ? (
                <Ionicons name="checkmark" size={14} color="#FFF" />
              ) : (
                <Text style={[styles.stepNum, (step === i + 1 || step > i + 1) && styles.stepNumActive]}>{i + 1}</Text>
              )}
            </View>
            <Text style={[styles.stepLabel, step === i + 1 && styles.stepLabelActive]}>{s}</Text>
          </View>
        ))}
      </View>

      {/* Step Content */}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}

      {/* Bottom Navigation */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        {step > 1 && (
          <TouchableOpacity style={styles.prevBtn} onPress={() => setStep(step - 1)}>
            <Ionicons name="arrow-back" size={18} color="#6B7280" />
            <Text style={styles.prevBtnText}>Indietro</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        {step < 3 ? (
          <TouchableOpacity style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
            onPress={() => setStep(step + 1)} disabled={!canProceed()}>
            <Text style={styles.nextBtnText}>Avanti</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" size="small" /> : (
              <>
                <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                <Text style={styles.submitBtnText}>Registra</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Search Tabaccheria Modal - Fullscreen with keyboard handling */}
      <Modal visible={showSearch} animationType="slide" onRequestClose={() => setShowSearch(false)}>
        <View style={[styles.searchModalFull, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Cerca Tabaccheria</Text>
            <TouchableOpacity onPress={() => { setShowSearch(false); setSearchCity(''); setSearchAddress(''); setSearchNumOrdinale(''); }} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
            <View style={styles.searchInputRow}>
              <Ionicons name="location" size={18} color="#9CA3AF" />
              <TextInput style={styles.searchInput} placeholder="Comune *..." value={searchCity}
                onChangeText={setSearchCity} placeholderTextColor="#9CA3AF" autoCapitalize="characters" />
            </View>
            <View style={styles.searchInputRow}>
              <Ionicons name="home" size={18} color="#9CA3AF" />
              <TextInput style={styles.searchInput} placeholder="Indirizzo (opzionale)..." value={searchAddress}
                onChangeText={setSearchAddress} placeholderTextColor="#9CA3AF" autoCapitalize="characters" />
            </View>
            <View style={styles.searchInputRow}>
              <Ionicons name="list-outline" size={18} color="#9CA3AF" />
              <TextInput style={styles.searchInput} placeholder="N. Ordinale (opzionale)..." value={searchNumOrdinale}
                onChangeText={setSearchNumOrdinale} placeholderTextColor="#9CA3AF" keyboardType="numeric" />
            </View>
            {searchLoading ? (
              <ActivityIndicator style={{ marginTop: 20 }} color="#7C3AED" size="large" />
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={item => item.id}
                style={{ flex: 1, marginTop: 4 }}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.searchResultItem} onPress={() => handleSelectTab(item)}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchResultName} numberOfLines={1}>
                        {item.Num_Ordinale ? `[${item.Num_Ordinale}] ` : ''}{item.denominazione}
                      </Text>
                      <Text style={styles.searchResultAddr} numberOfLines={1}>
                        {item.indirizzo}, {item.comune} ({item.provincia})
                      </Text>
                    </View>
                    {item.customer_id ? (
                      <View style={styles.registeredBadge}><Text style={styles.registeredBadgeText}>Registrato</Text></View>
                    ) : item.agente_id ? (
                      <View style={styles.assignedBadge}><Text style={styles.assignedBadgeText}>Assegnato</Text></View>
                    ) : null}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={searchCity.length >= 2 ? (
                  <Text style={styles.emptySearch}>Nessuna tabaccheria trovata</Text>
                ) : (
                  <Text style={styles.emptySearch}>Inserisci il comune per cercare</Text>
                )}
              />
            )}
          </KeyboardAvoidingView>
          <View style={{ paddingBottom: insets.bottom }} />
        </View>
      </Modal>
    </View>
  );
}

// Reusable Form Field
function FormField({ label, value, field, onChange, error, ...props }: {
  label: string; value: string; field: string;
  onChange: (field: string, value: string) => void;
  error?: string; placeholder?: string;
  keyboardType?: any; maxLength?: number; autoCapitalize?: any;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, error ? styles.fieldInputError : null]}
        value={value}
        onChangeText={v => onChange(field, v)}
        placeholderTextColor="#9CA3AF"
        {...props}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value || '-'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn: { flexDirection: 'row', alignItems: 'center', height: 44, paddingRight: 8, gap: 4 },
  backBtnText: { fontSize: 15, color: '#1F2937', fontWeight: '500' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  stepper: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, gap: 24 },
  stepItem: { alignItems: 'center', gap: 4 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
  stepDone: { backgroundColor: '#10B981' },
  stepActive: { backgroundColor: '#7C3AED' },
  stepNum: { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
  stepNumActive: { color: '#FFF' },
  stepLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  stepLabelActive: { color: '#7C3AED', fontWeight: '700' },
  stepContent: { flex: 1, paddingHorizontal: 16 },
  // Phone toggle
  phoneToggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, gap: 10, marginBottom: 12 },
  phoneToggleLabel: { flex: 1, fontSize: 14, color: '#1E40AF', fontWeight: '600' },
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE', borderRadius: 10, padding: 12, gap: 8, marginBottom: 12 },
  infoBoxText: { flex: 1, fontSize: 12, color: '#1E40AF' },
  // GPS
  gpsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3B82F6', borderRadius: 12, paddingVertical: 14, gap: 8, marginBottom: 12 },
  gpsButtonText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  gpsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: 8, padding: 10, gap: 6, marginBottom: 12 },
  gpsBadgeText: { fontSize: 12, color: '#065F46' },
  // Photos
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#374151', marginTop: 16, marginBottom: 8 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  photoItem: { width: 90, height: 90, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photoThumb: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: -4, right: -4 },
  photoAdd: { width: 90, height: 90, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  photoAddText: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  photoHint: { fontSize: 12, color: '#EF4444', marginBottom: 8 },
  // Form fields
  row: { flexDirection: 'row' },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  fieldInput: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1F2937' },
  fieldInputError: { borderColor: '#EF4444' },
  fieldError: { fontSize: 11, color: '#EF4444', marginTop: 2 },
  validationHint: { fontSize: 12, color: '#D97706', marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  typeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  typeBtnActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  typeBtnTextActive: { color: '#FFF' },
  textArea: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1F2937', minHeight: 80 },
  // Search button
  searchTabBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3E8FF', borderRadius: 12, paddingVertical: 14, gap: 8, marginBottom: 12, marginTop: 4 },
  searchTabBtnText: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
  // Summary
  summaryCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  summaryLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  summaryValue: { fontSize: 12, color: '#1F2937', fontWeight: '500', flex: 1, textAlign: 'right', marginLeft: 12 },
  // Bottom bar
  bottomBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFF' },
  prevBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 16 },
  prevBtnText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  submitBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  // Search Modal
  searchModalFull: { flex: 1, backgroundColor: '#FFF', paddingHorizontal: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingTop: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1F2937', paddingVertical: 0 },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  searchResultName: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  searchResultAddr: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  registeredBadge: { backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  registeredBadgeText: { fontSize: 10, color: '#991B1B', fontWeight: '600' },
  assignedBadge: { backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  assignedBadgeText: { fontSize: 10, color: '#92400E', fontWeight: '600' },
  emptySearch: { textAlign: 'center', color: '#9CA3AF', marginTop: 24, fontSize: 14 },
});
