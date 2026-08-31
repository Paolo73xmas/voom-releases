import React, { useState, useEffect, useRef } from 'react';
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
import { uploadSinglePhoto, ensurePhotoBucket } from '../lib/api/photos';
import { UploadProgressOverlay } from '../components/UploadProgressOverlay';
import { usePhotoStamper } from '../components/PhotoStamper';
import { COLORS } from '../lib/theme';
import { findCustomerByVat, isPlaceholderVat, parseVatGuardError, type ExistingVatCustomer } from '../lib/api/vat-guard';
import { DuplicateVatDialog } from '../components/customers/DuplicateVatDialog';
import { searchUnlinkedTabaccherie, type RegistryTabMatch } from '../lib/api/registry-search';
import { RegistryHintBox, RegistryLinkedBanner } from '../components/customers/RegistryHintBox';
import { VisitSlotWheel } from '../components/customers/VisitSlotWheel';
import { ExcludedDaysPicker } from '../components/customers/ExcludedDaysPicker';
import { searchCompany } from '../lib/api/openapi-company';

// type CustomerType non più hardcoded: ora viene letto dinamicamente da customer_types table

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
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  // Salvataggio a prova di interruzione (parità web FirstVisit): progresso in memoria per il retry
  const saveProgress = useRef<{ customerId: string | null; visitId: string | null; photosUploaded: number }>({ customerId: null, visitId: null, photosUploaded: 0 });
  // Anti-duplicati P.IVA: scheda esistente trovata + flag "forza altro punto vendita"
  const [dupVatExisting, setDupVatExisting] = useState<ExistingVatCustomer | null>(null);
  const allowDupVatRef = useRef(false);
  const [saveFailed, setSaveFailed] = useState<string | null>(null);
  const [isPhoneVisit, setIsPhoneVisit] = useState(false);
  // Avviso live: rivendita già censita nel registro (senza scheda) mentre si digita nome/indirizzo
  const [registryHints, setRegistryHints] = useState<RegistryTabMatch[]>([]);
  const [registryDismissed, setRegistryDismissed] = useState(false);
  const [registryLinkedName, setRegistryLinkedName] = useState('');
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
    customerType: 'tabaccheria' as string, notes: '',
    vatNumber: '', fiscalCode: '', pec: '', sdi: '',
    tabaccheriaId: '',
    // ✅ Web parity (nuove modifiche): progetto associato + IBAN cliente
    projectType: 'nessun_progetto', // slug del progetto, default = nessun_progetto
    iban: '',
    preferredVisitSlots: [] as string[],
    excludedVisitDays: [] as number[],
  });

  // ✅ Web parity: lista progetti disponibili (caricata da Supabase)
  type ProjectOpt = { id: string; slug: string; name: string; color: string };
  const [projects, setProjects] = useState<ProjectOpt[]>([]);
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  // ✅ Web parity: lista tipi cliente dinamica (tabella customer_types)
  // I tipi possono essere aggiunti/rinominati/eliminati lato admin web app.
  type CustomerTypeOpt = { id: string; value: string; label: string; sort_order: number };
  const [customerTypes, setCustomerTypes] = useState<CustomerTypeOpt[]>([]);
  const [showCustomerTypePicker, setShowCustomerTypePicker] = useState(false);

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

  // Recupera Anagrafica: lookup Openapi da P.IVA / Codice Fiscale
  const [lookupLoading, setLookupLoading] = useState(false);

  // Load from map params
  useEffect(() => {
    if (params.tabaccheriaId) {
      loadTabaccheriaData(params.tabaccheriaId as string);
    }
  }, [params.tabaccheriaId]);

  // ✅ Web parity: Load active projects + customer types on mount
  useEffect(() => {
    (async () => {
      try {
        const [projRes, typesRes] = await Promise.all([
          supabase.from('projects').select('id, slug, name, color').eq('is_active', true).order('sort_order', { ascending: true }),
          // ✅ Web parity: tipi cliente dinamici (admin può aggiungere/modificare in web)
          supabase.from('customer_types').select('id, value, label, sort_order').order('sort_order', { ascending: true }),
        ]);
        setProjects(projRes.data || []);
        const types = typesRes.data || [];
        setCustomerTypes(types);
        // Se il customerType corrente non esiste più nella lista, fallback al primo (default)
        if (types.length > 0) {
          setForm(prev => {
            const exists = types.some((t: any) => t.value === prev.customerType);
            return exists ? prev : { ...prev, customerType: types[0].value };
          });
        }
      } catch (e) { console.warn('[Anagrafica] projects/types load error:', e); }
    })();
  }, []);

  // Suggerimento live: rivendita già censita nel registro senza scheda cliente,
  // mentre l'agente digita nome/indirizzo (parità web 7345065)
  useEffect(() => {
    if (form.tabaccheriaId || registryDismissed) { setRegistryHints([]); return; }
    const name = form.businessName.trim();
    const addr = `${form.address} ${form.city}`.trim();
    const term = name.length >= 4 ? `${name} ${form.city}`.trim() : (addr.length >= 6 ? addr : '');
    if (!term) { setRegistryHints([]); return; }
    const timer = setTimeout(async () => {
      try {
        const rows = await searchUnlinkedTabaccherie(term, 5);
        setRegistryHints(rows.slice(0, 3));
      } catch {
        setRegistryHints([]);
      }
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.businessName, form.address, form.city, form.tabaccheriaId, registryDismissed]);

  const useRegistryMatch = async (m: RegistryTabMatch) => {
    setRegistryHints([]);
    setRegistryLinkedName(m.denominazione || 'rivendita');
    // Precompila e aggancia la tabaccheria esistente (stessa via del flusso da mappa)
    await loadTabaccheriaData(m.id);
  };

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

  // Recupera Anagrafica: cerca su Openapi (P.IVA / C.F.) e trascrive automaticamente i dati nel form
  const handleCompanyLookup = async () => {
    const queryValue = form.vatNumber || form.fiscalCode;
    if (!queryValue) {
      Alert.alert('Recupera Anagrafica', 'Inserisci prima una Partita IVA o un Codice Fiscale');
      return;
    }
    Keyboard.dismiss();
    setLookupLoading(true);
    try {
      const data = await searchCompany(queryValue);
      if (!data.start && !data.pec && !data.sdi) {
        Alert.alert('Recupera Anagrafica', data.errors[0] || `Nessun risultato trovato per: ${queryValue}`);
        return;
      }
      const updates: Partial<typeof form> = {};
      if (data.start?.companyName) updates.businessName = data.start.companyName.toUpperCase();
      if (data.start?.vatCode) updates.vatNumber = data.start.vatCode;
      if (data.start?.taxCode) updates.fiscalCode = data.start.taxCode.toUpperCase();
      if (data.pec?.pec) updates.pec = data.pec.pec.toLowerCase();
      if (data.sdi?.sdiCode) updates.sdi = data.sdi.sdiCode.toUpperCase();
      const addr = data.start?.address?.registeredOffice;
      if (addr) {
        const streetParts: string[] = [];
        if (addr.toponym) streetParts.push(addr.toponym);
        if (addr.street || addr.streetName) streetParts.push(addr.street || addr.streetName || '');
        if (addr.streetNumber) streetParts.push(addr.streetNumber);
        const formattedStreet = streetParts.join(' ').trim();
        if (formattedStreet) updates.address = formattedStreet.toUpperCase();
        if (addr.town) updates.city = addr.town.toUpperCase();
        const provCode = typeof addr.province === 'string' ? addr.province : addr.province?.code;
        if (provCode) updates.province = provCode.toUpperCase();
        if (addr.zipCode) updates.postalCode = addr.zipCode;
      }
      if (Object.keys(updates).length > 0) {
        setForm(prev => ({ ...prev, ...updates }));
        Alert.alert(
          'Anagrafica recuperata',
          `Dati inseriti nel modulo.${data.errors.length > 0 ? `\n\nAlcuni dati non trovati: ${data.errors.join('; ')}` : ''}`
        );
      } else {
        Alert.alert('Recupera Anagrafica', 'Nessun dato utile trovato per questa P.IVA / C.F.');
      }
    } catch (err) {
      Alert.alert('Errore', 'Errore durante la ricerca: ' + (err instanceof Error ? err.message : 'Errore sconosciuto'));
    } finally {
      setLookupLoading(false);
    }
  };

  const updateField = (field: string, value: string) => {
    // ❌ NON applicare value.toUpperCase() qui!
    // Su Android causava input erratico (caratteri casuali, sequenze) perché
    // mutare il testo dentro onChangeText rompe il composing dell'IME nativo.
    // L'uppercase ora viene gestito tramite autoCapitalize="characters" sui TextInput.
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Lista dei campi che devono essere visualizzati in MAIUSCOLO (gestito via autoCapitalize)
  const UPPERCASE_FIELDS = new Set(['businessName','address','city','province','contactName','contactSurname','fiscalCode','sdi']);

  const canProceed = (): boolean => {
    if (step === 1) return isPhoneVisit || photos.length >= 2;
    if (step === 2) {
      const required = form.businessName && form.address && form.city && form.province &&
        form.postalCode && form.contactName && form.contactSurname &&
        form.vatNumber && form.fiscalCode && form.notes;
      // Telefono, Email, PEC e SDI sono facoltativi: si valida solo il formato se compilati
      const emailOk = !form.contactEmail || emailRegex.test(form.contactEmail);
      const sdiOk = !form.sdi || sdiRegex.test(form.sdi.toUpperCase());
      const vatOk = vatRegex.test(form.vatNumber);
      // CF di 16 caratteri, oppure 11 cifre (società di capitali) solo se identico alla P.IVA
      const cfUp = form.fiscalCode.toUpperCase().trim();
      const cfOk = /^[0-9]{11}$/.test(cfUp) ? cfUp === form.vatNumber.trim() : fiscalCodeRegex.test(cfUp);
      return !!(required && emailOk && sdiOk && vatOk && cfOk);
    }
    return true;
  };

  // Submit
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Salva visita + foto in modo IDEMPOTENTE: al retry riprende esattamente da dove si era interrotto
  const persistVisitAndPhotos = async (customerId: string, latitude: number, longitude: number): Promise<string> => {
    if (!user) throw new Error('Utente non autenticato');
    let visitId = saveProgress.current.visitId;
    if (!visitId) {
      const { data: visit, error: visitErr } = await supabase
        .from('visits')
        .insert({
          customer_id: customerId,
          agent_id: user.id,
          visit_type: 'first_visit',
          latitude, longitude,
          gps_accuracy: gpsPosition?.accuracy || 0,
          notes: form.notes,
          visit_date: new Date().toISOString(),
        })
        .select()
        .single();
      if (visitErr) throw new Error(`Errore creazione visita: ${visitErr.message}`);
      visitId = visit.id as string;
      saveProgress.current.visitId = visitId;
    }
    if (!isPhoneVisit && photos.length > 0 && saveProgress.current.photosUploaded < photos.length) {
      if (saveProgress.current.photosUploaded === 0) await ensurePhotoBucket();
      const ts = Date.now();
      for (let i = saveProgress.current.photosUploaded; i < photos.length; i++) {
        setUploadPct(Math.max(5, Math.round((i / photos.length) * 100)));
        const p = photos[i];
        const url = await uploadSinglePhoto(p.uri, `${user.id}/${customerId}/${ts}_${i}.jpg`);
        if (!url) throw new Error(`Upload foto ${i + 1} fallito (connessione?)`);
        const { error: phErr } = await supabase.from('visit_photos').insert({
          visit_id: visitId,
          photo_url: url,
          latitude: p.gps?.lat || 0,
          longitude: p.gps?.lon || 0,
        });
        if (phErr) throw new Error(`Registrazione foto ${i + 1} fallita: ${phErr.message}`);
        saveProgress.current.photosUploaded = i + 1;
        setUploadPct(Math.round(((i + 1) / photos.length) * 100));
      }
    }
    return visitId;
  };

  // Dopo la creazione del cliente: visita+foto con RETRY automatico (3 tentativi);
  // se fallisce, schermata bloccante VISITA NON SALVATA con RIPROVA (niente perdita foto).
  const completeSubmission = async (customerId: string, latitude: number, longitude: number): Promise<void> => {
    if (!user) return;
    let visitId: string | null = null;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        visitId = await persistVisitAndPhotos(customerId, latitude, longitude);
        lastErr = null;
        break;
      } catch (err) {
        console.error(`[Anagrafica] salvataggio visita/foto fallito (tentativo ${attempt}/3):`, err);
        lastErr = err;
        if (attempt < 3) await sleep(1200 * attempt);
      }
    }
    setUploadPct(null);
    if (!visitId) {
      setSaveFailed(lastErr instanceof Error ? lastErr.message : 'Errore di connessione');
      return;
    }
    setSaveFailed(null);
    console.log('[Anagrafica] Visita creata:', visitId, '- foto:', saveProgress.current.photosUploaded);

    // Passi secondari: non devono MAI far perdere visita/foto già salvate
    try {
      const emailValue = form.contactEmail && emailRegex.test(form.contactEmail) ? form.contactEmail : null;
      if (form.tabaccheriaId) {
        await supabase.from('tabaccherie').update({
          stato_visita: 'visitato',
          agente_id: user.id,
          customer_id: customerId,
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
          customer_id: customerId,
        }).select().single();
        if (tabErr) {
          console.error('Tabaccheria insert error:', tabErr);
        } else if (newTab) {
          // Link customer back to the new tabaccheria
          await supabase.from('customers')
            .update({ tabaccheria_id: newTab.id })
            .eq('id', customerId);
        }
      }

      // Optional appointment
      if (scheduleAppointment && appointmentDate) {
        await supabase.from('appointments').insert({
          customer_id: customerId,
          agent_id: user.id,
          created_by_id: user.id,
          appointment_date: appointmentDate,
          appointment_type: 'follow_up',
          status: 'scheduled',
          notes: appointmentNotes || null,
        });
      }
    } catch (err) {
      console.warn('[Anagrafica] aggiornamenti secondari falliti (visita e foto comunque salvate):', err);
    }

    Alert.alert('Completato!', 'Anagrafica registrata con successo.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  // Bottone RIPROVA della schermata bloccante
  const retryFinalize = async () => {
    const customerId = saveProgress.current.customerId;
    if (!customerId) { setSaveFailed(null); return; }
    setSaveFailed(null);
    setLoading(true);
    try {
      const latitude = tabaccheriaGps?.lat ?? gpsPosition?.lat ?? 0;
      const longitude = tabaccheriaGps?.lng ?? gpsPosition?.lng ?? 0;
      await completeSubmission(customerId, latitude, longitude);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Validate
      if (!vatRegex.test(form.vatNumber)) { Alert.alert('Errore', 'P.IVA deve essere di 11 cifre'); return; }
      if (isPlaceholderVat(form.vatNumber)) { Alert.alert('Errore', 'P.IVA non valida: numero fittizio/segnaposto non ammesso'); return; }
      // CF di 16 caratteri, oppure 11 cifre (società di capitali) solo se identico alla P.IVA
      const cfUp = form.fiscalCode.toUpperCase().trim();
      if (/^[0-9]{11}$/.test(cfUp)) {
        if (cfUp !== form.vatNumber.trim()) { Alert.alert('Errore', 'CF di 11 cifre accettato solo se identico alla P.IVA'); return; }
      } else if (!fiscalCodeRegex.test(cfUp)) {
        Alert.alert('Errore', 'Codice Fiscale: 16 caratteri alfanumerici, oppure 11 cifre identiche alla P.IVA'); return;
      }

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

      // Cliente: riusa quello già creato in un tentativo precedente (retry idempotente)
      let customerId = saveProgress.current.customerId;
      if (customerId) {
        console.log('[Anagrafica] Cliente già creato in un tentativo precedente, riuso:', customerId);
      } else {
        // Anti-duplicati: se esiste già una scheda con questa P.IVA, chiedi conferma
        if (!allowDupVatRef.current) {
          const existingVat = await findCustomerByVat(form.vatNumber);
          if (existingVat) { setDupVatExisting(existingVat); return; }
        }
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
            contact_phone: form.contactPhone || null,
            contact_email: emailValue,
            vat_number: form.vatNumber,
            fiscal_code: form.fiscalCode,
            allow_duplicate_vat: allowDupVatRef.current,
            customer_type: form.customerType,
            category: 'prospect',
            agent_id: user.id,
            notes: customerNotes,
            pec: form.pec.trim() || null,
            sdi: form.sdi ? form.sdi.trim().toUpperCase() : null,
            tabaccheria_id: form.tabaccheriaId || null,
            // ✅ Web parity: nuove modifiche - progetto e IBAN
            project_type: form.projectType || 'nessun_progetto',
            iban: form.iban ? form.iban.trim().toUpperCase() : null,
            preferred_visit_slots: form.preferredVisitSlots.length > 0 ? form.preferredVisitSlots : null,
            excluded_visit_days: form.excludedVisitDays.length > 0 ? form.excludedVisitDays : null,
            first_visit_date: new Date().toISOString(),
            last_visit_date: new Date().toISOString(),
          })
          .select().single();

        if (custErr) {
          // Errori del vincolo DB anti-duplicati: messaggi chiari invece del codice grezzo
          const vatGuard = parseVatGuardError(custErr.message);
          if (vatGuard?.type === 'duplicate') {
            setDupVatExisting({ id: vatGuard.id, business_name: vatGuard.name, address: vatGuard.where, city: null, province: null, agent_id: null });
            return;
          }
          if (vatGuard?.type === 'placeholder') throw new Error('P.IVA non valida: numero fittizio/segnaposto non ammesso');
          throw new Error(`Errore creazione cliente: ${custErr.message}`);
        }
        customerId = customer.id as string;
        saveProgress.current.customerId = customerId;
      }

      // Visita + foto con retry automatico; passi secondari (tabaccheria/appuntamento) e navigazione inclusi
      await completeSubmission(customerId, latitude, longitude);
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
        <FormField label="Ragione Sociale *" value={form.businessName} field="businessName" onChange={updateField} autoCapitalize="characters" />
        {registryLinkedName && form.tabaccheriaId ? (
          <RegistryLinkedBanner name={registryLinkedName} />
        ) : (
          <RegistryHintBox
            hints={registryHints}
            onUse={useRegistryMatch}
            onDismiss={() => { setRegistryDismissed(true); setRegistryHints([]); }}
          />
        )}
        <FormField label="P.IVA * (11 cifre)" value={form.vatNumber} field="vatNumber" onChange={updateField} keyboardType="numeric" maxLength={11}
          error={form.vatNumber && !vatRegex.test(form.vatNumber) ? 'P.IVA deve essere di 11 cifre' : ''} />
        <FormField label="Codice Fiscale * (16 car.)" value={form.fiscalCode} field="fiscalCode" onChange={updateField} maxLength={16} autoCapitalize="characters"
          error={form.fiscalCode && !fiscalCodeRegex.test(form.fiscalCode.toUpperCase()) ? 'Codice Fiscale: 16 caratteri alfanumerici' : ''} />

        {/* Recupera Anagrafica: auto-compilazione da P.IVA / C.F. tramite Openapi */}
        <TouchableOpacity
          style={[styles.lookupBtn, (lookupLoading || (!form.vatNumber && !form.fiscalCode)) && { opacity: 0.5 }]}
          onPress={handleCompanyLookup}
          disabled={lookupLoading || (!form.vatNumber && !form.fiscalCode)}
          activeOpacity={0.75}
          testID="recupera-anagrafica-btn"
        >
          {lookupLoading ? (
            <ActivityIndicator size="small" color="#B45309" />
          ) : (
            <Ionicons name="cloud-download-outline" size={18} color="#B45309" />
          )}
          <Text style={styles.lookupBtnText}>Recupera Anagrafica</Text>
        </TouchableOpacity>
        <Text style={styles.lookupHint}>Inserisci P.IVA o C.F. e recupera automaticamente ragione sociale, sede, PEC e SDI</Text>

        <Text style={styles.sectionTitle}>Indirizzo</Text>
        <FormField label="Indirizzo *" value={form.address} field="address" onChange={updateField} autoCapitalize="characters" />
        <View style={styles.row}>
          <View style={{ flex: 2 }}><FormField label="Citta *" value={form.city} field="city" onChange={updateField} autoCapitalize="characters" /></View>
          <View style={{ flex: 1, marginLeft: 8 }}><FormField label="Prov. *" value={form.province} field="province" onChange={updateField} maxLength={2} autoCapitalize="characters" /></View>
          <View style={{ flex: 1, marginLeft: 8 }}><FormField label="CAP *" value={form.postalCode} field="postalCode" onChange={updateField} keyboardType="numeric" maxLength={5} /></View>
        </View>

        <Text style={styles.sectionTitle}>Contatto</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}><FormField label="Nome *" value={form.contactName} field="contactName" onChange={updateField} autoCapitalize="characters" /></View>
          <View style={{ flex: 1, marginLeft: 8 }}><FormField label="Cognome *" value={form.contactSurname} field="contactSurname" onChange={updateField} autoCapitalize="characters" /></View>
        </View>
        <FormField label="Telefono" value={form.contactPhone} field="contactPhone" onChange={updateField} keyboardType="phone-pad" />
        <FormField label="Email" value={form.contactEmail} field="contactEmail" onChange={updateField} keyboardType="email-address" autoCapitalize="none"
          error={form.contactEmail && !emailRegex.test(form.contactEmail) ? 'Email non valida' : ''} />

        <Text style={styles.sectionTitle}>Fatturazione (facoltativa)</Text>
        <FormField label="PEC" value={form.pec} field="pec" onChange={updateField} keyboardType="email-address" autoCapitalize="none" />
        <FormField label="SDI (7 car.)" value={form.sdi} field="sdi" onChange={updateField} maxLength={7} autoCapitalize="characters"
          error={form.sdi && !sdiRegex.test(form.sdi.toUpperCase()) ? 'SDI: 7 caratteri alfanumerici' : ''} />
        {/* ✅ Web parity: IBAN opzionale */}
        <FormField label="IBAN (opzionale)" value={form.iban} field="iban" onChange={updateField} autoCapitalize="characters" maxLength={34} />

        {/* ✅ Web parity: Progetto associato */}
        <Text style={styles.sectionTitle}>Progetto</Text>
        <TouchableOpacity
          style={styles.projectPicker}
          onPress={() => setShowProjectPicker(true)}
          activeOpacity={0.75}
        >
          {(() => {
            const selected = projects.find(p => p.slug === form.projectType);
            return (
              <>
                <View style={[styles.projectDot, { backgroundColor: selected?.color || '#9CA3AF' }]} />
                <Text style={styles.projectPickerText}>
                  {selected?.name || 'Nessun progetto'}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#6B7280" />
              </>
            );
          })()}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Fascia oraria visite preferita (facoltativa)</Text>
        <Text style={styles.validationHint}>Usata dall&apos;AI Tour per pianificare l&apos;arrivo nella fascia giusta (±30 min, pranzo rigido)</Text>
        <View style={{ alignItems: 'center', marginTop: 6 }}>
          <VisitSlotWheel
            value={form.preferredVisitSlots}
            onChange={(ids) => setForm((f) => ({ ...f, preferredVisitSlots: ids }))}
            size={210}
          />
        </View>
        <View style={{ marginTop: 10 }}>
          <ExcludedDaysPicker
            value={form.excludedVisitDays}
            onChange={(days) => setForm((f) => ({ ...f, excludedVisitDays: days }))}
          />
        </View>

        <Text style={styles.sectionTitle}>Tipo Cliente</Text>
        {/* ✅ Web parity: dropdown dinamico dal database (tabella customer_types).
            L'admin può aggiungere/modificare/eliminare tipi dalla web app. */}
        <TouchableOpacity
          style={styles.projectPicker}
          onPress={() => setShowCustomerTypePicker(true)}
          activeOpacity={0.75}
        >
          {(() => {
            const selected = customerTypes.find(t => t.value === form.customerType);
            return (
              <>
                <Ionicons name="business" size={18} color="#7C3AED" />
                <Text style={styles.projectPickerText}>
                  {selected?.label || (customerTypes.length === 0 ? 'Caricamento...' : 'Seleziona tipo')}
                </Text>
                <Ionicons name="chevron-down" size={18} color="#6B7280" />
              </>
            );
          })()}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Note *</Text>
        <TextInput style={styles.textArea} multiline numberOfLines={4} textAlignVertical="top"
          value={form.notes} onChangeText={v => updateField('notes', v)} placeholder="Note sulla visita..." placeholderTextColor={COLORS.textLight} />

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
        <SummaryRow label="Tipo" value={customerTypes.find(t => t.value === form.customerType)?.label || form.customerType} />
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
          trackColor={{ false: '#E5E7EB', true: '#DDD6FE' }} thumbColor={scheduleAppointment ? '#7C3AED' : '#9CA3AF'} />
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
                onChangeText={setSearchCity} placeholderTextColor={COLORS.textLight} autoCapitalize="characters" />
            </View>
            <View style={styles.searchInputRow}>
              <Ionicons name="home" size={18} color="#9CA3AF" />
              <TextInput style={styles.searchInput} placeholder="Indirizzo (opzionale)..." value={searchAddress}
                onChangeText={setSearchAddress} placeholderTextColor={COLORS.textLight} autoCapitalize="characters" />
            </View>
            <View style={styles.searchInputRow}>
              <Ionicons name="list-outline" size={18} color="#9CA3AF" />
              <TextInput style={styles.searchInput} placeholder="N. Ordinale (opzionale)..." value={searchNumOrdinale}
                onChangeText={setSearchNumOrdinale} placeholderTextColor={COLORS.textLight} keyboardType="numeric" />
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

      {/* ✅ Web parity: Project Picker Modal */}
      <Modal visible={showProjectPicker} animationType="fade" transparent onRequestClose={() => setShowProjectPicker(false)}>
        <TouchableOpacity style={styles.projectOverlay} activeOpacity={1} onPress={() => setShowProjectPicker(false)}>
          <View style={styles.projectSheet}>
            <Text style={styles.projectSheetTitle}>Seleziona Progetto</Text>
            <TouchableOpacity
              style={[styles.projectItem, form.projectType === 'nessun_progetto' && styles.projectItemActive]}
              onPress={() => { setForm(p => ({ ...p, projectType: 'nessun_progetto' })); setShowProjectPicker(false); }}
            >
              <View style={[styles.projectDot, { backgroundColor: '#9CA3AF' }]} />
              <Text style={styles.projectItemText}>Nessun progetto</Text>
              {form.projectType === 'nessun_progetto' && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
            </TouchableOpacity>
            {projects.map(p => (
              <TouchableOpacity
                key={p.id}
                style={[styles.projectItem, form.projectType === p.slug && styles.projectItemActive]}
                onPress={() => { setForm(prev => ({ ...prev, projectType: p.slug })); setShowProjectPicker(false); }}
              >
                <View style={[styles.projectDot, { backgroundColor: p.color }]} />
                <Text style={styles.projectItemText}>{p.name}</Text>
                {form.projectType === p.slug && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ✅ Web parity: Customer Type Picker Modal (dinamico) */}
      <Modal visible={showCustomerTypePicker} animationType="fade" transparent onRequestClose={() => setShowCustomerTypePicker(false)}>
        <TouchableOpacity style={styles.projectOverlay} activeOpacity={1} onPress={() => setShowCustomerTypePicker(false)}>
          <View style={styles.projectSheet}>
            <Text style={styles.projectSheetTitle}>Seleziona Tipo Cliente</Text>
            {customerTypes.length === 0 ? (
              <Text style={{ textAlign: 'center', color: COLORS.textLight, paddingVertical: 16 }}>
                Caricamento tipi cliente...
              </Text>
            ) : (
              customerTypes.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.projectItem, form.customerType === t.value && styles.projectItemActive]}
                  onPress={() => { setForm(prev => ({ ...prev, customerType: t.value })); setShowCustomerTypePicker(false); }}
                >
                  <Ionicons name="business-outline" size={18} color="#7C3AED" />
                  <Text style={styles.projectItemText}>{t.label}</Text>
                  {form.customerType === t.value && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
                </TouchableOpacity>
              ))
            )}
          </View>
        </TouchableOpacity>
      </Modal>
      {/* Invio foto in corso: barra 0-100%, non chiudere l'app */}
      <UploadProgressOverlay visible={uploadPct != null} progress={uploadPct ?? 0} label="Invio foto visita" />
      {/* Schermata BLOCCANTE (parità web): visita/foto non salvate, le foto sono in memoria — RIPROVA */}
      <Modal visible={!!saveFailed} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.saveFailedBackdrop} testID="first-visit-save-failed-overlay">
          <View style={styles.saveFailedCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="alert-circle" size={28} color="#DC2626" />
              <Text style={styles.saveFailedTitle} testID="first-visit-save-failed-title">VISITA NON SALVATA</Text>
            </View>
            <Text style={styles.saveFailedText}>
              La scheda cliente è stata creata, ma <Text style={{ fontWeight: '800' }}>la visita e le foto ({photos.length}) NON sono ancora state salvate</Text> per un problema di connessione.
            </Text>
            <Text style={styles.saveFailedWarn}>NON chiudere l&apos;app: le foto sono ancora in memoria e verranno reinviate.</Text>
            {saveFailed && saveFailed !== 'Errore di connessione' ? (
              <Text style={styles.saveFailedDetail} numberOfLines={3}>Dettaglio: {saveFailed}</Text>
            ) : null}
            <TouchableOpacity
              style={[styles.saveFailedBtn, loading && { opacity: 0.6 }]}
              onPress={retryFinalize}
              disabled={loading}
              activeOpacity={0.8}
              testID="first-visit-save-retry-button"
            >
              {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveFailedBtnText}>RIPROVA ADESSO</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <DuplicateVatDialog
        existing={dupVatExisting}
        onCancel={() => setDupVatExisting(null)}
        onOpenExisting={() => {
          const existingId = dupVatExisting?.id;
          setDupVatExisting(null);
          if (existingId) router.push(`/customer/${existingId}`);
        }}
        onForce={() => {
          allowDupVatRef.current = true;
          setDupVatExisting(null);
          handleSubmit();
        }}
      />
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
        placeholderTextColor={COLORS.textLight}
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
  saveFailedBackdrop: { flex: 1, backgroundColor: 'rgba(69,10,10,0.96)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  saveFailedCard: { width: '100%', maxWidth: 400, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 4, borderColor: '#DC2626', padding: 18, gap: 10 },
  saveFailedTitle: { fontSize: 20, fontWeight: '900', color: '#B91C1C', letterSpacing: 0.3 },
  saveFailedText: { fontSize: 14, color: '#1F2937', lineHeight: 20 },
  saveFailedWarn: { fontSize: 14, fontWeight: '800', color: '#B91C1C', lineHeight: 20 },
  saveFailedDetail: { fontSize: 11, color: '#6B7280' },
  saveFailedBtn: { height: 50, borderRadius: 10, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  saveFailedBtnText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  container: { flex: 1, backgroundColor: COLORS.bgAlt },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { flexDirection: 'row', alignItems: 'center', height: 44, paddingRight: 8, gap: 4 },
  backBtnText: { fontSize: 15, color: COLORS.text, fontWeight: '500' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  stepper: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 16, gap: 24 },
  stepItem: { alignItems: 'center', gap: 4 },
  stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.border, justifyContent: 'center', alignItems: 'center' },
  stepDone: { backgroundColor: '#10B981' },
  stepActive: { backgroundColor: '#7C3AED' },
  stepNum: { fontSize: 12, fontWeight: '700', color: COLORS.textLight },
  stepNumActive: { color: '#FFF' },
  stepLabel: { fontSize: 11, color: COLORS.textLight, fontWeight: '500' },
  stepLabelActive: { color: '#7C3AED', fontWeight: '700' },
  stepContent: { flex: 1, paddingHorizontal: 16 },
  // Phone toggle
  phoneToggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', borderRadius: 12, padding: 14, gap: 10, marginBottom: 12 },
  phoneToggleLabel: { flex: 1, fontSize: 14, color: '#7C3AED', fontWeight: '600' },
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DBEAFE', borderRadius: 10, padding: 12, gap: 8, marginBottom: 12 },
  infoBoxText: { flex: 1, fontSize: 12, color: '#7C3AED' },
  // GPS
  gpsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#3B82F6', borderRadius: 12, paddingVertical: 14, gap: 8, marginBottom: 12 },
  gpsButtonText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  gpsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: 8, padding: 10, gap: 6, marginBottom: 12 },
  gpsBadgeText: { fontSize: 12, color: '#065F46' },
  // Photos
  sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary, marginTop: 16, marginBottom: 8 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  photoItem: { width: 90, height: 90, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  photoThumb: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: -4, right: -4 },
  photoAdd: { width: 90, height: 90, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  photoAddText: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  photoHint: { fontSize: 12, color: '#EF4444', marginBottom: 8 },
  // Form fields
  row: { flexDirection: 'row' },
  fieldWrap: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted, marginBottom: 4 },
  fieldInput: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.text },
  fieldInputError: { borderColor: '#EF4444' },
  fieldError: { fontSize: 11, color: '#EF4444', marginTop: 2 },
  validationHint: { fontSize: 12, color: '#D97706', marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  typeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  typeBtnActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  typeBtnTextActive: { color: '#FFF' },
  textArea: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.text, minHeight: 80 },
  // Search button
  searchTabBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primarySoft, borderRadius: 12, paddingVertical: 14, gap: 8, marginBottom: 12, marginTop: 4 },
  searchTabBtnText: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
  // Recupera Anagrafica
  lookupBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#FCD34D', backgroundColor: '#FFFBEB', borderRadius: 12, paddingVertical: 12, marginTop: 2 },
  lookupBtnText: { fontSize: 14, fontWeight: '600', color: '#B45309' },
  lookupHint: { fontSize: 11, color: COLORS.textMuted, marginTop: 6, marginBottom: 4 },
  // Summary
  summaryCard: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  summaryLabel: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
  summaryValue: { fontSize: 12, color: COLORS.text, fontWeight: '500', flex: 1, textAlign: 'right', marginLeft: 12 },
  // Bottom bar
  bottomBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  prevBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 16 },
  prevBtnText: { fontSize: 14, color: COLORS.textMuted, fontWeight: '600' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7C3AED', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  nextBtnDisabled: { opacity: 0.4 },
  nextBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  submitBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  // Search Modal
  searchModalFull: { flex: 1, backgroundColor: COLORS.surface, paddingHorizontal: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingTop: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, paddingVertical: 0 },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  searchResultName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  searchResultAddr: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  registeredBadge: { backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  registeredBadgeText: { fontSize: 10, color: '#991B1B', fontWeight: '600' },
  assignedBadge: { backgroundColor: '#FEF3C7', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  assignedBadgeText: { fontSize: 10, color: '#92400E', fontWeight: '600' },
  emptySearch: { textAlign: 'center', color: COLORS.textLight, marginTop: 24, fontSize: 14 },

  // ✅ Web parity: Project picker styles
  projectPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
  projectDot: { width: 14, height: 14, borderRadius: 7 },
  projectPickerText: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: '500' },
  projectOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  projectSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 32,
  },
  projectSheetTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 12, textAlign: 'center' },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  projectItemActive: { backgroundColor: '#F0FDF4' },
  projectItemText: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: '500' },
});
