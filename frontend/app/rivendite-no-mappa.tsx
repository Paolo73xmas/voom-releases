import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Switch, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { uploadVisitPhotos } from '../lib/api/photos';
import { usePhotoStamper } from '../components/PhotoStamper';

interface PhotoData {
  uri: string;
  latitude: number;
  longitude: number;
}

export default function RivenditeNoMappaScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const userRole = (user as any)?.role || (user as any)?.user_metadata?.role || 'agent';

  // Wizard step
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // GPS
  const [gpsLoading, setGpsLoading] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [useManualGPS, setUseManualGPS] = useState(false);
  const { stampPhoto, StamperView } = usePhotoStamper();
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  // Form fields
  const [form, setForm] = useState({
    businessName: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    contactName: '',
    contactSurname: '',
    contactPhone: '',
    contactEmail: '',
    vatNumber: '',
    fiscalCode: '',
    pec: '',
    sdi: '',
    numOrdinale: '',
    customerType: 'retail' as 'retail' | 'horeca' | 'industry' | 'other',
    notes: '',
  });

  // Photos
  const [photos, setPhotos] = useState<PhotoData[]>([]);

  // Acquire GPS automatically
  const acquireGPS = useCallback(async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permesso GPS', 'Per favore abilita il GPS nelle impostazioni');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
      setGpsAccuracy(loc.coords.accuracy ?? null);
    } catch (e) {
      console.error('[OffMap] GPS error:', e);
      Alert.alert('Errore GPS', 'Impossibile ottenere la posizione. Usa l\'inserimento manuale.');
    } finally {
      setGpsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!useManualGPS) acquireGPS();
  }, []);

  const updateForm = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  // Take photo
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permesso Fotocamera', 'Per favore abilita la fotocamera nelle impostazioni');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets[0]) {
        const photoLat = latitude || 0;
        const photoLng = longitude || 0;
        const stamped = await stampPhoto(result.assets[0].uri);
        setPhotos(prev => [...prev, { uri: stamped, latitude: photoLat, longitude: photoLng }]);
      }
    } catch (e) {
      console.error('[OffMap] Camera error:', e);
      Alert.alert('Errore', 'Impossibile scattare la foto');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  // Gallery picker
  const pickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permesso Galleria', 'Per favore abilita l\'accesso alla galleria nelle impostazioni');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsMultipleSelection: true,
        selectionLimit: 5,
      });
      if (!result.canceled && result.assets?.length > 0) {
        const photoLat = latitude || 0;
        const photoLng = longitude || 0;
        for (const asset of result.assets) {
          const stamped = await stampPhoto(asset.uri);
          setPhotos(prev => [...prev, { uri: stamped, latitude: photoLat, longitude: photoLng }]);
        }
      }
    } catch (e) {
      console.error('[OffMap] Gallery error:', e);
      Alert.alert('Errore', 'Impossibile selezionare le foto');
    }
  };

  // Validation
  const vatRegex = /^[0-9]{11}$/;
  const fiscalRegex = /^[A-Z0-9]{16}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validateStep1 = (): boolean => {
    if (!form.businessName.trim()) { Alert.alert('Errore', 'Ragione Sociale è obbligatoria'); return false; }
    if (!form.address.trim()) { Alert.alert('Errore', 'Indirizzo è obbligatorio'); return false; }
    if (!form.city.trim()) { Alert.alert('Errore', 'Città è obbligatoria'); return false; }
    if (!form.province.trim()) { Alert.alert('Errore', 'Provincia è obbligatoria'); return false; }
    if (!form.vatNumber.trim() || !vatRegex.test(form.vatNumber)) {
      Alert.alert('Errore', 'P.IVA deve essere di 11 cifre'); return false;
    }
    if (form.fiscalCode.trim() && !fiscalRegex.test(form.fiscalCode.toUpperCase())) {
      Alert.alert('Errore', 'Codice Fiscale deve essere di 16 caratteri alfanumerici'); return false;
    }
    if (!form.contactEmail.trim() || !emailRegex.test(form.contactEmail)) {
      Alert.alert('Errore', 'Email non valida'); return false;
    }
    if (!form.pec.trim() && !form.sdi.trim()) {
      Alert.alert('Errore', 'Inserisci almeno PEC o SDI'); return false;
    }

    // GPS check
    if (useManualGPS) {
      const lat = parseFloat(manualLat);
      const lng = parseFloat(manualLng);
      if (isNaN(lat) || isNaN(lng) || lat < 35 || lat > 48 || lng < 6 || lng > 19) {
        Alert.alert('Errore', 'Coordinate GPS non valide per l\'Italia'); return false;
      }
    } else if (!latitude || !longitude) {
      Alert.alert('Errore', 'Posizione GPS non rilevata. Riprova o usa l\'inserimento manuale.'); return false;
    }

    return true;
  };

  const goToStep2 = () => {
    if (validateStep1()) setStep(2);
  };

  // Generate unique OFFMAP code
  const generateOffMapCode = async (): Promise<string> => {
    for (let i = 0; i < 5; i++) {
      const code = `OFFMAP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const { data } = await supabase.from('tabaccherie').select('id').eq('codice_rivendita', code).maybeSingle();
      if (!data) return code;
    }
    throw new Error('Impossibile generare un codice univoco');
  };

  // Submit
  const handleSubmit = async () => {
    if (photos.length < 2) {
      Alert.alert('Errore', 'Scatta almeno 2 foto prima di registrare');
      return;
    }
    if (!user) { Alert.alert('Errore', 'Utente non autenticato'); return; }

    setLoading(true);
    try {
      const finalLat = useManualGPS ? parseFloat(manualLat) : latitude!;
      const finalLng = useManualGPS ? parseFloat(manualLng) : longitude!;
      const emailValue = emailRegex.test(form.contactEmail) ? form.contactEmail : null;

      // 1. Create customer (source: off_map)
      const { data: customer, error: custErr } = await supabase.from('customers').insert({
        business_name: form.businessName,
        address: form.address,
        city: form.city,
        province: form.province,
        postal_code: form.postalCode,
        latitude: finalLat,
        longitude: finalLng,
        contact_name: form.contactName,
        contact_surname: form.contactSurname,
        contact_phone: form.contactPhone,
        contact_email: emailValue,
        vat_number: form.vatNumber,
        fiscal_code: form.fiscalCode.toUpperCase() || null,
        customer_type: form.customerType,
        category: 'prospect',
        agent_id: user.id,
        notes: form.notes,
        pec: form.pec || null,
        sdi: form.sdi.toUpperCase() || null,
        source: 'off_map',
        first_visit_date: new Date().toISOString(),
        last_visit_date: new Date().toISOString(),
      }).select().single();

      if (custErr) throw new Error(`Errore creazione cliente: ${custErr.message}`);

      // 2. Create tabaccheria (OFFMAP code for map visibility)
      const codice = await generateOffMapCode();
      const cfIva = form.vatNumber || form.fiscalCode || null;

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
        codice_fiscale: form.fiscalCode ? form.fiscalCode.toUpperCase() : null,
        cf_iva: cfIva,
        gps_lat: finalLat.toString(),
        gps_lng: finalLng.toString(),
        stato_visita: 'visitato',
        agente_id: user.id,
        customer_id: customer.id,
        ...(form.numOrdinale.trim() ? { 'Num_Ordinale': parseInt(form.numOrdinale) } : {}),
      }).select().single();

      if (tabErr) {
        // Rollback customer
        await supabase.from('customers').delete().eq('id', customer.id);
        throw new Error(`Errore creazione tabaccheria: ${tabErr.message}`);
      }

      // 3. Link customer → tabaccheria
      await supabase.from('customers').update({ tabaccheria_id: newTab.id }).eq('id', customer.id);

      // 4. Create visit
      const { data: visit } = await supabase.from('visits').insert({
        customer_id: customer.id,
        agent_id: user.id,
        visit_type: 'first_visit',
        latitude: finalLat,
        longitude: finalLng,
        gps_accuracy: useManualGPS ? 0 : (gpsAccuracy || 0),
        notes: form.notes || 'Rivendita registrata fuori mappa',
        status: 'completed',
        visit_date: new Date().toISOString(),
      }).select().single();

      // 5. Upload photos to visit_photos table
      if (photos.length > 0 && visit) {
        try {
          const photoObjects = photos.map(p => ({ uri: p.uri, latitude: p.latitude, longitude: p.longitude }));
          const photoUrls = await uploadVisitPhotos(photoObjects, user.id, customer.id, visit.id);
          console.log(`[OffMap] ${photoUrls.length}/${photos.length} foto caricate in visit_photos`);
        } catch (uploadErr) {
          console.warn('[OffMap] Errore upload foto (non bloccante):', uploadErr);
        }
      }

      Alert.alert(
        'Registrazione Completata',
        `${form.businessName} è stata registrata con successo ed è ora visibile sulla mappa.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      console.error('[OffMap] Submit error:', e);
      Alert.alert('Errore', e.message || 'Errore durante la registrazione');
    } finally {
      setLoading(false);
    }
  };

  // Customer type options
  const customerTypes = [
    { value: 'retail', label: 'Retail' },
    { value: 'horeca', label: 'HoReCa' },
    { value: 'industry', label: 'Industria' },
    { value: 'other', label: 'Altro' },
  ];

  // ==== STEP 1: ANAGRAFICA + GPS ====
  const renderStep1 = () => (
    <ScrollView style={styles.scrollContent} keyboardShouldPersistTaps="handled">
      {/* GPS Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Posizione GPS</Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Inserimento manuale coordinate</Text>
          <Switch
            value={useManualGPS}
            onValueChange={(val) => {
              setUseManualGPS(val);
              if (!val) acquireGPS();
            }}
            trackColor={{ true: '#C2410C' }}
          />
        </View>

        {useManualGPS ? (
          <View style={styles.manualGpsRow}>
            <View style={styles.gpsInputWrap}>
              <Text style={styles.inputLabel}>Latitudine</Text>
              <TextInput style={styles.input} value={manualLat} onChangeText={setManualLat}
                placeholder="es. 45.4642" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />
            </View>
            <View style={styles.gpsInputWrap}>
              <Text style={styles.inputLabel}>Longitudine</Text>
              <TextInput style={styles.input} value={manualLng} onChangeText={setManualLng}
                placeholder="es. 9.1900" placeholderTextColor="#9CA3AF" keyboardType="decimal-pad" />
            </View>
          </View>
        ) : (
          <View style={styles.gpsStatus}>
            {gpsLoading ? (
              <View style={styles.gpsLoadingRow}>
                <ActivityIndicator size="small" color="#C2410C" />
                <Text style={styles.gpsLoadingText}>Rilevamento posizione...</Text>
              </View>
            ) : latitude && longitude ? (
              <View style={styles.gpsOkRow}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.gpsOkText}>GPS rilevato: {latitude.toFixed(5)}, {longitude.toFixed(5)}</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.gpsRetryBtn} onPress={acquireGPS}>
                <Ionicons name="refresh" size={18} color="#FFF" />
                <Text style={styles.gpsRetryText}>Riprova GPS</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Anagrafica Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dati Anagrafica</Text>

        <Text style={styles.inputLabel}>Ragione Sociale *</Text>
        <TextInput style={styles.input} value={form.businessName} onChangeText={v => updateForm('businessName', v)}
          placeholder="Ragione Sociale" placeholderTextColor="#9CA3AF" autoCapitalize="words" />

        <Text style={styles.inputLabel}>N. Ordinale</Text>
        <TextInput style={styles.input} value={form.numOrdinale} onChangeText={v => updateForm('numOrdinale', v)}
          placeholder="Numero Ordinale (opzionale)" placeholderTextColor="#9CA3AF" keyboardType="numeric" />

        <Text style={styles.inputLabel}>P.IVA * (11 cifre)</Text>
        <TextInput style={styles.input} value={form.vatNumber} onChangeText={v => updateForm('vatNumber', v)}
          placeholder="12345678901" placeholderTextColor="#9CA3AF" keyboardType="numeric" maxLength={11} />

        <Text style={styles.inputLabel}>Codice Fiscale (16 caratteri)</Text>
        <TextInput style={styles.input} value={form.fiscalCode}
          onChangeText={v => updateForm('fiscalCode', v.toUpperCase())}
          placeholder="ABCDEF12G34H567I" placeholderTextColor="#9CA3AF" autoCapitalize="characters" maxLength={16} />

        <Text style={styles.inputLabel}>Indirizzo *</Text>
        <TextInput style={styles.input} value={form.address} onChangeText={v => updateForm('address', v)}
          placeholder="Via Roma 1" placeholderTextColor="#9CA3AF" autoCapitalize="words" />

        <View style={styles.row}>
          <View style={{ flex: 2 }}>
            <Text style={styles.inputLabel}>Città *</Text>
            <TextInput style={styles.input} value={form.city} onChangeText={v => updateForm('city', v)}
              placeholder="Roma" placeholderTextColor="#9CA3AF" autoCapitalize="words" />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.inputLabel}>Prov. *</Text>
            <TextInput style={styles.input} value={form.province}
              onChangeText={v => updateForm('province', v.toUpperCase())}
              placeholder="RM" placeholderTextColor="#9CA3AF" autoCapitalize="characters" maxLength={2} />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.inputLabel}>CAP</Text>
            <TextInput style={styles.input} value={form.postalCode} onChangeText={v => updateForm('postalCode', v)}
              placeholder="00100" placeholderTextColor="#9CA3AF" keyboardType="numeric" maxLength={5} />
          </View>
        </View>
      </View>

      {/* Contact Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contatto</Text>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>Nome</Text>
            <TextInput style={styles.input} value={form.contactName} onChangeText={v => updateForm('contactName', v)}
              placeholder="Mario" placeholderTextColor="#9CA3AF" autoCapitalize="words" />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.inputLabel}>Cognome</Text>
            <TextInput style={styles.input} value={form.contactSurname}
              onChangeText={v => updateForm('contactSurname', v)}
              placeholder="Rossi" placeholderTextColor="#9CA3AF" autoCapitalize="words" />
          </View>
        </View>

        <Text style={styles.inputLabel}>Telefono</Text>
        <TextInput style={styles.input} value={form.contactPhone} onChangeText={v => updateForm('contactPhone', v)}
          placeholder="333 1234567" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" />

        <Text style={styles.inputLabel}>Email *</Text>
        <TextInput style={styles.input} value={form.contactEmail} onChangeText={v => updateForm('contactEmail', v)}
          placeholder="email@esempio.com" placeholderTextColor="#9CA3AF" keyboardType="email-address" autoCapitalize="none" />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.inputLabel}>PEC</Text>
            <TextInput style={styles.input} value={form.pec} onChangeText={v => updateForm('pec', v)}
              placeholder="pec@esempio.it" placeholderTextColor="#9CA3AF" keyboardType="email-address" autoCapitalize="none" />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.inputLabel}>SDI</Text>
            <TextInput style={styles.input} value={form.sdi}
              onChangeText={v => updateForm('sdi', v.toUpperCase())}
              placeholder="ABCDE12" placeholderTextColor="#9CA3AF" autoCapitalize="characters" maxLength={7} />
          </View>
        </View>
      </View>

      {/* Customer Type */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tipo Cliente</Text>
        <View style={styles.typeRow}>
          {customerTypes.map(ct => (
            <TouchableOpacity
              key={ct.value}
              style={[styles.typeBtn, form.customerType === ct.value && styles.typeBtnActive]}
              onPress={() => updateForm('customerType', ct.value)}
            >
              <Text style={[styles.typeBtnText, form.customerType === ct.value && styles.typeBtnTextActive]}>
                {ct.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Notes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Note</Text>
        <TextInput style={[styles.input, styles.textArea]} value={form.notes}
          onChangeText={v => updateForm('notes', v)}
          placeholder="Note sulla rivendita..." placeholderTextColor="#9CA3AF"
          multiline numberOfLines={3} textAlignVertical="top" />
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );

  // ==== STEP 2: PHOTOS ====
  const renderStep2 = () => (
    <ScrollView style={styles.scrollContent}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Foto della Rivendita</Text>
        <Text style={styles.sectionDesc}>Scatta almeno 2 foto del punto vendita (fronte e interno)</Text>

        {/* Photo grid */}
        <View style={styles.photoGrid}>
          {photos.map((photo, idx) => (
            <View key={idx} style={styles.photoCard}>
              <Image source={{ uri: photo.uri }} style={styles.photoImg} contentFit="cover" cachePolicy="memory-disk" transition={150} />
              <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => removePhoto(idx)}>
                <Ionicons name="close-circle" size={24} color="#EF4444" />
              </TouchableOpacity>
              <Text style={styles.photoLabel}>Foto {idx + 1}</Text>
            </View>
          ))}

          {/* Add photo buttons */}
          <TouchableOpacity style={styles.addPhotoBtn} onPress={takePhoto}>
            <Ionicons name="camera" size={32} color="#C2410C" />
            <Text style={styles.addPhotoText}>Scatta Foto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.addPhotoBtn, { borderColor: '#3B82F6' }]} onPress={pickFromGallery}>
            <Ionicons name="images" size={32} color="#3B82F6" />
            <Text style={[styles.addPhotoText, { color: '#3B82F6' }]}>Galleria</Text>
          </TouchableOpacity>
        </View>

        {photos.length < 2 && (
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={18} color="#F59E0B" />
            <Text style={styles.warningText}>Servono almeno {2 - photos.length} {photos.length === 1 ? 'foto' : 'foto'} in più</Text>
          </View>
        )}
      </View>

      {/* Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Riepilogo</Text>
        <View style={styles.summaryCard}>
          <SummaryRow label="Ragione Sociale" value={form.businessName} />
          {form.numOrdinale.trim() ? <SummaryRow label="N. Ordinale" value={form.numOrdinale} /> : null}
          <SummaryRow label="Indirizzo" value={`${form.address}, ${form.city} (${form.province})`} />
          <SummaryRow label="P.IVA" value={form.vatNumber} />
          <SummaryRow label="Contatto" value={`${form.contactName} ${form.contactSurname}`.trim() || '-'} />
          <SummaryRow label="Email" value={form.contactEmail || '-'} />
          <SummaryRow label="Telefono" value={form.contactPhone || '-'} />
          <SummaryRow label="GPS" value={
            useManualGPS
              ? `${manualLat}, ${manualLng} (manuale)`
              : latitude && longitude ? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}` : 'Non rilevato'
          } />
          <SummaryRow label="Foto" value={`${photos.length} scattate`} />
        </View>
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StamperView />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => step === 1 ? router.back() : setStep(1)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1F2937" />
          <Text style={styles.backBtnText}>{step === 1 ? 'Indietro' : 'Step 1'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rivendita No Mappa</Text>
        <View style={{ width: 80 }} />
      </View>

      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}>
          <Text style={[styles.stepDotText, step >= 1 && styles.stepDotTextActive]}>1</Text>
        </View>
        <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
        <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]}>
          <Text style={[styles.stepDotText, step >= 2 && styles.stepDotTextActive]}>2</Text>
        </View>
      </View>
      <Text style={styles.stepLabel}>{step === 1 ? 'Anagrafica + GPS' : 'Foto e Registrazione'}</Text>

      {/* Content */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {step === 1 ? renderStep1() : renderStep2()}
      </KeyboardAvoidingView>

      {/* Bottom button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 8 }]}>
        {step === 1 ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={goToStep2}>
            <Text style={styles.primaryBtnText}>Avanti - Foto</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryBtn, (photos.length < 2 || loading) && styles.primaryBtnDisabled]}
            onPress={handleSubmit}
            disabled={photos.length < 2 || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.primaryBtnText}>Registra Rivendita</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// Summary row component
function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFF',
    borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 44, paddingRight: 8 },
  backBtnText: { fontSize: 15, color: '#1F2937', fontWeight: '500' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1F2937' },

  // Step indicator
  stepIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 16, paddingBottom: 4 },
  stepDot: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: '#C2410C' },
  stepDotText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  stepDotTextActive: { color: '#FFF' },
  stepLine: { width: 60, height: 3, backgroundColor: '#E5E7EB', marginHorizontal: 8, borderRadius: 2 },
  stepLineActive: { backgroundColor: '#C2410C' },
  stepLabel: { textAlign: 'center', fontSize: 13, color: '#6B7280', marginBottom: 8 },

  scrollContent: { flex: 1, paddingHorizontal: 16 },

  // Section
  section: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  sectionDesc: { fontSize: 13, color: '#6B7280', marginBottom: 12 },

  // Input
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 15, color: '#1F2937', backgroundColor: '#F9FAFB',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },

  // GPS
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  switchLabel: { fontSize: 14, color: '#374151' },
  manualGpsRow: { flexDirection: 'row', gap: 12 },
  gpsInputWrap: { flex: 1 },
  gpsStatus: { marginTop: 4 },
  gpsLoadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gpsLoadingText: { fontSize: 14, color: '#6B7280' },
  gpsOkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  gpsOkText: { fontSize: 13, color: '#10B981', fontWeight: '500' },
  gpsRetryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#C2410C',
    borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'flex-start',
  },
  gpsRetryText: { fontSize: 14, color: '#FFF', fontWeight: '600' },

  // Customer type
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB',
  },
  typeBtnActive: { backgroundColor: '#C2410C', borderColor: '#C2410C' },
  typeBtnText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  typeBtnTextActive: { color: '#FFF' },

  // Photos
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoCard: { width: '47%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  photoRemoveBtn: { position: 'absolute', top: 4, right: 4 },
  photoLabel: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, textAlign: 'center', color: '#FFF', fontSize: 11 },
  addPhotoBtn: {
    width: '47%', aspectRatio: 1, borderRadius: 12, borderWidth: 2, borderColor: '#D1D5DB',
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB',
  },
  addPhotoText: { fontSize: 13, color: '#C2410C', fontWeight: '600', marginTop: 6 },

  warningBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    backgroundColor: '#FFFBEB', borderRadius: 8, padding: 10,
  },
  warningText: { fontSize: 13, color: '#92400E' },

  // Summary
  summaryCard: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryLabel: { fontSize: 13, color: '#6B7280' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#1F2937', maxWidth: '60%', textAlign: 'right' },

  // Bottom bar
  bottomBar: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#C2410C', borderRadius: 12, paddingVertical: 14,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
