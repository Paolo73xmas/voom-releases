/**
 * Rimborsi (Reimbursements) Screen — Mobile
 *
 * Aligned with web app /src/pages/Rimborsi.tsx (agent view).
 * Features:
 *  - List agent's rimborsi with status badges
 *  - Filter by status & category (chips)
 *  - Pull-to-refresh
 *  - Create new rimborso (categoria, importo, descrizione, foto+GPS)
 *  - Delete (only for stato='in_attesa')
 */
import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert,
  TextInput, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { useAuthStore } from '../store/authStore';
import {
  fetchRimborsiByAgent, fetchRimborsiCategorie, createRimborso, deleteRimborso,
  getRimborsoStatoLabel, getRimborsoStatoColor,
  type Rimborso, type RimborsoCategoria, type RimborsoStato,
} from '../lib/api/rimborsi';
import { COLORS } from '../lib/theme';

const STATI: { value: 'all' | RimborsoStato; label: string }[] = [
  { value: 'all', label: 'Tutti' },
  { value: 'in_attesa', label: 'In Attesa' },
  { value: 'approvato', label: 'Approvato' },
  { value: 'pagato', label: 'Pagato' },
  { value: 'rifiutato', label: 'Rifiutato' },
];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const formatDate = (s: string) =>
  new Date(s).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

const RimborsoCard = memo(function RimborsoCard({
  item, onDelete,
}: {
  item: Rimborso;
  onDelete: (id: string) => void;
}) {
  const color = getRimborsoStatoColor(item.stato);
  const canDelete = item.stato === 'in_attesa';
  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.categoria}>{item.categoria_nome}</Text>
          <Text style={s.dateText}>{formatDate(item.created_at)}</Text>
        </View>
        <View style={[s.statusBadge, { backgroundColor: color + '20' }]}>
          <View style={[s.statusDot, { backgroundColor: color }]} />
          <Text style={[s.statusText, { color }]}>{getRimborsoStatoLabel(item.stato)}</Text>
        </View>
      </View>

      <Text style={s.amount}>{formatCurrency(Number(item.importo))}</Text>

      {item.descrizione && (
        <Text style={s.desc} numberOfLines={3}>{item.descrizione}</Text>
      )}

      {item.allegati && item.allegati.length > 0 && (
        <View style={s.attRow}>
          <Image source={{ uri: item.allegati[0] }} style={s.attImg} contentFit="cover" cachePolicy="memory-disk" transition={150} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={s.attLbl}>{item.allegati.length} allegato{item.allegati.length > 1 ? 'i' : ''}</Text>
            {item.gps_lat && item.gps_lng && (
              <Text style={s.gpsLbl}>📍 GPS: {item.gps_lat.toFixed(4)}, {item.gps_lng.toFixed(4)}</Text>
            )}
          </View>
        </View>
      )}

      {item.note_admin && (
        <View style={s.noteAdmin}>
          <Ionicons name="information-circle" size={14} color="#3B82F6" />
          <Text style={s.noteAdminTxt}>{item.note_admin}</Text>
        </View>
      )}

      {canDelete && (
        <TouchableOpacity style={s.deleteBtn} onPress={() => onDelete(item.id)}>
          <Ionicons name="trash-outline" size={16} color="#DC2626" />
          <Text style={s.deleteTxt}>Elimina richiesta</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

export default function RimborsiScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const [list, setList] = useState<Rimborso[]>([]);
  const [categorie, setCategorie] = useState<RimborsoCategoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStato, setFilterStato] = useState<'all' | RimborsoStato>('all');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formCategoria, setFormCategoria] = useState('');
  const [formImporto, setFormImporto] = useState('');
  const [formDescrizione, setFormDescrizione] = useState('');
  const [formPhoto, setFormPhoto] = useState<string | null>(null);
  const [formGps, setFormGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);

  // Permissions state — requested proactively at screen mount
  const [permCamera, setPermCamera] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [permLocation, setPermLocation] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [gpsLoading, setGpsLoading] = useState(false);

  // Proactively request permissions on mount (fotocamera + GPS) so receipts are georeferenced
  useEffect(() => {
    if (Platform.OS === 'web') {
      // Skip native permission prompts on web preview
      setPermCamera('granted');
      setPermLocation('granted');
      return;
    }
    (async () => {
      try {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        setPermCamera(cam.granted ? 'granted' : 'denied');
      } catch { setPermCamera('denied'); }
      try {
        const loc = await Location.requestForegroundPermissionsAsync();
        setPermLocation(loc.status === 'granted' ? 'granted' : 'denied');
        // Pre-fetch current GPS so it's ready when user takes photo
        if (loc.status === 'granted') {
          try {
            setGpsLoading(true);
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            setFormGps({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy ?? undefined,
            });
          } catch (e) { console.warn('[Rimborsi] GPS pre-fetch error:', e); }
          finally { setGpsLoading(false); }
        }
      } catch { setPermLocation('denied'); }
    })();
  }, []);

  const openSettings = () => {
    Alert.alert(
      'Permesso negato',
      'Apri le impostazioni per concedere i permessi necessari (Fotocamera e Posizione).',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Apri Impostazioni', onPress: () => Linking.openSettings() },
      ]
    );
  };

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [rData, cData] = await Promise.all([
        fetchRimborsiByAgent(user.id, filterStato !== 'all' ? { stato: filterStato } : undefined),
        fetchRimborsiCategorie(),
      ]);
      setList(rData);
      setCategorie(cData);
    } catch (e) {
      console.error(e);
      Alert.alert('Errore', 'Impossibile caricare i rimborsi');
    } finally {
      setLoading(false);
    }
  }, [user?.id, filterStato]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert(
      'Elimina rimborso',
      'Sei sicuro di voler eliminare questa richiesta?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina', style: 'destructive',
          onPress: async () => {
            try {
              await deleteRimborso(id);
              await load();
            } catch {
              Alert.alert('Errore', 'Impossibile eliminare il rimborso');
            }
          },
        },
      ]
    );
  }, [load]);

  const totals = useMemo(() => {
    const inAttesa = list.filter(r => r.stato === 'in_attesa').reduce((s, r) => s + Number(r.importo), 0);
    const approvato = list.filter(r => r.stato === 'approvato' || r.stato === 'pagato').reduce((s, r) => s + Number(r.importo), 0);
    return { inAttesa, approvato };
  }, [list]);

  // ────────── Create form actions ──────────
  const resetForm = () => {
    setFormCategoria('');
    setFormImporto('');
    setFormDescrizione('');
    setFormPhoto(null);
    setFormGps(null);
  };

  /**
   * GPS fetch ottimizzato per i rimborsi:
   * - Balanced accuracy (più veloce di High su rete scarsa, sufficiente per georefencing)
   * - Timeout 6s: se il GPS non risponde, si prosegue comunque
   * - Non blocca il flusso scatto foto se in errore
   */
  const fetchGpsFast = async () => {
    try {
      let locStatus = permLocation;
      if (locStatus !== 'granted') {
        const loc = await Location.requestForegroundPermissionsAsync();
        locStatus = loc.status === 'granted' ? 'granted' : 'denied';
        setPermLocation(locStatus);
      }
      if (locStatus !== 'granted') return;
      setGpsLoading(true);
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
      ]);
      if (pos && 'coords' in pos) {
        setFormGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
        });
      }
    } catch (e) { console.warn('[Rimborsi] GPS error:', e); }
    finally { setGpsLoading(false); }
  };

  /**
   * Comprime e ridimensiona la foto prima di convertirla in base64.
   * Tipica riduzione: 2-5 MB → 100-300 KB (10-20× più piccolo).
   * Risultato: upload molto più rapido su reti scarse.
   */
  const compressImage = async (uri: string): Promise<string | null> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        // Ridimensiona a max 1280px lato lungo (sufficiente per scontrini leggibili)
        [{ resize: { width: 1280 } }],
        {
          compress: 0.6, // qualità 60% (buon trade-off)
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );
      if (result.base64) {
        return `data:image/jpeg;base64,${result.base64}`;
      }
      return null;
    } catch (e) {
      console.warn('[Rimborsi] image compression error:', e);
      return null;
    }
  };

  const [processingPhoto, setProcessingPhoto] = useState(false);

  const takePhoto = async () => {
    try {
      // Re-check camera permission (in case it was denied previously)
      let camGranted = permCamera === 'granted';
      if (!camGranted) {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        camGranted = cam.granted;
        setPermCamera(cam.granted ? 'granted' : 'denied');
        if (!cam.granted && !cam.canAskAgain) {
          openSettings();
          return;
        }
        if (!camGranted) {
          Alert.alert('Permesso negato', 'Concedi l\'accesso alla fotocamera per scattare la foto della ricevuta');
          return;
        }
      }

      // ✅ GPS in PARALLELO (non blocca la camera): l'utente può scattare subito,
      //    il GPS si aggiorna in background mentre la camera è attiva
      fetchGpsFast(); // intenzionalmente non awaited

      // Lancia camera SENZA base64 (lo facciamo dopo, comprimendo)
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8, // qualità camera raw alta (poi comprimiamo)
        base64: false,
      });
      if (res.canceled || !res.assets[0]) return;

      // ✅ Comprimi + resize prima di salvare in stato (riduce 10-20x la dimensione)
      setProcessingPhoto(true);
      const compressed = await compressImage(res.assets[0].uri);
      setProcessingPhoto(false);

      if (compressed) {
        setFormPhoto(compressed);
      } else {
        Alert.alert('Errore', 'Impossibile elaborare la foto. Riprova.');
      }
    } catch (e) {
      console.error(e);
      setProcessingPhoto(false);
      Alert.alert('Errore', 'Impossibile scattare la foto');
    }
  };

  const pickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        if (!perm.canAskAgain) { openSettings(); return; }
        Alert.alert('Permesso negato', 'Concedi l\'accesso alla galleria per selezionare una foto');
        return;
      }
      // GPS in parallelo (non blocca)
      fetchGpsFast();

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });
      if (res.canceled || !res.assets[0]) return;

      setProcessingPhoto(true);
      const compressed = await compressImage(res.assets[0].uri);
      setProcessingPhoto(false);

      if (compressed) {
        setFormPhoto(compressed);
      } else {
        Alert.alert('Errore', 'Impossibile elaborare la foto. Riprova.');
      }
    } catch (e) {
      console.error(e);
      setProcessingPhoto(false);
    }
  };

  const submitCreate = async () => {
    if (!user?.id || !formCategoria || !formImporto.trim()) {
      Alert.alert('Errore', 'Compila tutti i campi obbligatori (categoria + importo)');
      return;
    }
    const importoNum = parseFloat(formImporto.replace(',', '.'));
    if (isNaN(importoNum) || importoNum <= 0) {
      Alert.alert('Errore', 'Importo non valido');
      return;
    }
    const cat = categorie.find(c => c.id === formCategoria);
    if (!cat) {
      Alert.alert('Errore', 'Categoria non valida');
      return;
    }

    setCreating(true);
    try {
      await createRimborso({
        agent_id: user.id,
        agent_name: profile?.full_name || profile?.email || 'Agente',
        categoria_id: cat.id,
        categoria_nome: cat.nome,
        importo: importoNum,
        descrizione: formDescrizione || undefined,
        allegati: formPhoto ? [formPhoto] : [],
        gps_lat: formGps?.lat,
        gps_lng: formGps?.lng,
      });
      Alert.alert('Successo', 'Richiesta di rimborso creata');
      setShowCreate(false);
      resetForm();
      await load();
    } catch (e) {
      console.error(e);
      Alert.alert('Errore', 'Impossibile creare la richiesta');
    } finally {
      setCreating(false);
    }
  };

  // ────────── Render ──────────
  if (loading) {
    return (
      <View style={s.loading}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Rimborsi' }} />
      <View style={s.container}>
        {/* Permission status banner — informs user about camera/GPS access */}
        {(permCamera === 'denied' || permLocation === 'denied') && (
          <TouchableOpacity style={s.permBanner} onPress={openSettings} activeOpacity={0.85}>
            <Ionicons name="warning" size={18} color="#92400E" />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={s.permBannerTitle}>Permessi mancanti</Text>
              <Text style={s.permBannerTxt}>
                {permCamera === 'denied' && permLocation === 'denied'
                  ? 'Concedi Fotocamera + Posizione per georeferenziare gli scontrini'
                  : permCamera === 'denied'
                  ? 'Concedi accesso Fotocamera per scattare foto degli scontrini'
                  : 'Concedi Posizione per georeferenziare gli scontrini'}
              </Text>
            </View>
            <Text style={s.permBannerCta}>Apri</Text>
          </TouchableOpacity>
        )}
        {permCamera === 'granted' && permLocation === 'granted' && formGps && (
          <View style={s.gpsActiveBanner}>
            <Ionicons name="location" size={14} color="#059669" />
            <Text style={s.gpsActiveTxt}>
              GPS attivo · {formGps.lat.toFixed(4)}, {formGps.lng.toFixed(4)}
              {formGps.accuracy && ` (±${Math.round(formGps.accuracy)}m)`}
            </Text>
            {gpsLoading && <ActivityIndicator size="small" color="#059669" style={{ marginLeft: 6 }} />}
          </View>
        )}

        {/* Stats banner */}
        <View style={s.statsBanner}>
          <View style={s.statBox}>
            <Text style={s.statLbl}>In Attesa</Text>
            <Text style={[s.statVal, { color: '#F59E0B' }]}>{formatCurrency(totals.inAttesa)}</Text>
          </View>
          <View style={s.divider} />
          <View style={s.statBox}>
            <Text style={s.statLbl}>Approvato</Text>
            <Text style={[s.statVal, { color: '#10B981' }]}>{formatCurrency(totals.approvato)}</Text>
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filters} contentContainerStyle={{ paddingHorizontal: 12 }}>
          {STATI.map(st => (
            <TouchableOpacity
              key={st.value}
              style={[s.chip, filterStato === st.value && s.chipActive]}
              onPress={() => setFilterStato(st.value)}
            >
              <Text style={[s.chipTxt, filterStato === st.value && s.chipTxtActive]}>{st.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* List */}
        <FlashList
          data={list}
          renderItem={({ item }) => <RimborsoCard item={item} onDelete={handleDelete} />}
          keyExtractor={r => r.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.textMuted, marginTop: 12 }}>Nessun rimborso</Text>
              <Text style={{ fontSize: 13, color: COLORS.textLight, marginTop: 4 }}>Premi + per creare una richiesta</Text>
            </View>
          }
        />

        {/* FAB Create */}
        <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>

        {/* Create Modal */}
        <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={s.modalOverlay}>
              <View style={s.modalContent}>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>Nuova Richiesta</Text>
                  <TouchableOpacity onPress={() => { setShowCreate(false); resetForm(); }}>
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ maxHeight: '80%' }} contentContainerStyle={{ paddingBottom: 20 }}>
                  {/* Categoria */}
                  <Text style={s.formLbl}>Categoria *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                    {categorie.map(c => (
                      <TouchableOpacity
                        key={c.id}
                        style={[s.catChip, formCategoria === c.id && s.catChipActive]}
                        onPress={() => setFormCategoria(c.id)}
                      >
                        <Text style={[s.catChipTxt, formCategoria === c.id && s.catChipTxtActive]}>{c.nome}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Importo */}
                  <Text style={s.formLbl}>Importo (€) *</Text>
                  <TextInput
                    style={s.input}
                    placeholder="0,00"
                    placeholderTextColor={COLORS.textLight}
                    value={formImporto}
                    onChangeText={setFormImporto}
                    keyboardType="decimal-pad"
                  />

                  {/* Descrizione */}
                  <Text style={s.formLbl}>Descrizione</Text>
                  <TextInput
                    style={[s.input, { height: 80, textAlignVertical: 'top' }]}
                    placeholder="Dettagli della spesa..."
                    placeholderTextColor={COLORS.textLight}
                    value={formDescrizione}
                    onChangeText={setFormDescrizione}
                    multiline
                  />

                  {/* Foto */}
                  <Text style={s.formLbl}>Ricevuta / Foto</Text>
                  {formPhoto ? (
                    <View style={s.photoBox}>
                      <Image source={{ uri: formPhoto }} style={s.photoPreview} contentFit="cover" />
                      <TouchableOpacity style={s.photoRm} onPress={() => { setFormPhoto(null); setFormGps(null); }}>
                        <Ionicons name="close-circle" size={26} color="#FFF" />
                      </TouchableOpacity>
                      {formGps && (
                        <View style={s.gpsBadge}>
                          <Ionicons name="location" size={12} color="#FFF" />
                          <Text style={s.gpsBadgeTxt}>{formGps.lat.toFixed(4)}, {formGps.lng.toFixed(4)}</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity
                        style={[s.photoBtn, processingPhoto && s.photoBtnDisabled]}
                        onPress={takePhoto}
                        disabled={processingPhoto}
                      >
                        {processingPhoto ? (
                          <ActivityIndicator size="small" color="#7C3AED" />
                        ) : (
                          <Ionicons name="camera" size={20} color="#7C3AED" />
                        )}
                        <Text style={s.photoBtnTxt}>
                          {processingPhoto ? 'Elaborazione...' : 'Scatta Foto'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.photoBtn, processingPhoto && s.photoBtnDisabled]}
                        onPress={pickFromGallery}
                        disabled={processingPhoto}
                      >
                        {processingPhoto ? (
                          <ActivityIndicator size="small" color="#7C3AED" />
                        ) : (
                          <Ionicons name="images" size={20} color="#7C3AED" />
                        )}
                        <Text style={s.photoBtnTxt}>
                          {processingPhoto ? 'Elaborazione...' : 'Galleria'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>

                <TouchableOpacity
                  style={[s.submitBtn, creating && s.submitBtnDisabled]}
                  onPress={submitCreate}
                  disabled={creating}
                >
                  {creating ? <ActivityIndicator color="#FFF" /> : (
                    <>
                      <Ionicons name="send" size={18} color="#FFF" />
                      <Text style={s.submitTxt}>Invia Richiesta</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  permBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7',
    borderLeftWidth: 4, borderLeftColor: '#F59E0B',
    paddingHorizontal: 14, paddingVertical: 10, marginHorizontal: 16, marginTop: 14, borderRadius: 10,
  },
  permBannerTitle: { fontSize: 13, fontWeight: '700', color: '#92400E' },
  permBannerTxt: { fontSize: 11, color: '#92400E', marginTop: 2 },
  permBannerCta: { fontSize: 13, fontWeight: '700', color: '#92400E', marginLeft: 8 },
  gpsActiveBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5',
    borderLeftWidth: 3, borderLeftColor: '#059669',
    paddingHorizontal: 12, paddingVertical: 6, marginHorizontal: 16, marginTop: 12, borderRadius: 8,
  },
  gpsActiveTxt: { fontSize: 11, color: '#065F46', marginLeft: 6, fontWeight: '600' },
  statsBanner: {
    flexDirection: 'row', backgroundColor: COLORS.surface, margin: 16, marginBottom: 8,
    borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statLbl: { fontSize: 12, color: COLORS.textMuted },
  statVal: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  divider: { width: 1, backgroundColor: COLORS.border },
  filters: { maxHeight: 44, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: COLORS.surface,
    marginRight: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  chipTxt: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  chipTxtActive: { color: '#FFF' },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  categoria: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  dateText: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  amount: { fontSize: 24, fontWeight: '700', color: '#7C3AED', marginVertical: 6 },
  desc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  attRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgAlt, borderRadius: 8, padding: 8, marginTop: 10 },
  attImg: { width: 40, height: 40, borderRadius: 6, backgroundColor: COLORS.border },
  attLbl: { fontSize: 12, fontWeight: '500', color: COLORS.textSecondary },
  gpsLbl: { fontSize: 11, color: COLORS.textLight, marginTop: 2 },
  noteAdmin: {
    flexDirection: 'row', backgroundColor: '#EFF6FF', borderRadius: 8, padding: 8, marginTop: 10, gap: 6,
  },
  noteAdminTxt: { fontSize: 12, color: '#7C3AED', flex: 1 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, marginTop: 10, gap: 6, borderRadius: 8,
    borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2',
  },
  deleteTxt: { fontSize: 13, fontWeight: '500', color: '#DC2626' },
  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  formLbl: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: COLORS.bgAlt, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    borderWidth: 1, borderColor: COLORS.border, color: COLORS.text,
  },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: COLORS.bg,
    marginRight: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  catChipActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  catChipTxt: { fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  catChipTxtActive: { color: '#FFF' },
  photoBox: { borderRadius: 12, overflow: 'hidden', position: 'relative' },
  photoPreview: { width: '100%', height: 200 },
  photoRm: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 13 },
  gpsBadge: {
    position: 'absolute', bottom: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  gpsBadgeTxt: { fontSize: 11, color: '#FFF' },
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: 10, backgroundColor: COLORS.primarySoft, borderWidth: 1, borderColor: '#DDD6FE',
  },
  photoBtnDisabled: { opacity: 0.6, backgroundColor: COLORS.bg, borderColor: '#D1D5DB' },
  photoBtnTxt: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12, marginTop: 16,
  },
  submitBtnDisabled: { backgroundColor: '#9CA3AF' },
  submitTxt: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
