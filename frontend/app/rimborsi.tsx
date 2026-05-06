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
import * as Location from 'expo-location';
import { useAuthStore } from '../store/authStore';
import {
  fetchRimborsiByAgent, fetchRimborsiCategorie, createRimborso, deleteRimborso,
  getRimborsoStatoLabel, getRimborsoStatoColor,
  type Rimborso, type RimborsoCategoria, type RimborsoStato,
} from '../lib/api/rimborsi';

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

      // Refresh GPS at capture time (so the photo is georeferenced with current location)
      try {
        let locStatus = permLocation;
        if (locStatus !== 'granted') {
          const loc = await Location.requestForegroundPermissionsAsync();
          locStatus = loc.status === 'granted' ? 'granted' : 'denied';
          setPermLocation(locStatus);
        }
        if (locStatus === 'granted') {
          setGpsLoading(true);
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setFormGps({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? undefined,
          });
        }
      } catch (e) { console.warn('[Rimborsi] GPS error:', e); }
      finally { setGpsLoading(false); }

      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.6,
        base64: true,
      });
      if (!res.canceled && res.assets[0]) {
        const asset = res.assets[0];
        const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
        setFormPhoto(dataUrl);
      }
    } catch (e) {
      console.error(e);
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
      // Refresh GPS for gallery uploads too (camera might be invoked offline)
      try {
        if (permLocation === 'granted') {
          setGpsLoading(true);
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setFormGps({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? undefined,
          });
        }
      } catch {}
      finally { setGpsLoading(false); }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.6,
        base64: true,
      });
      if (!res.canceled && res.assets[0]) {
        const asset = res.assets[0];
        const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
        setFormPhoto(dataUrl);
      }
    } catch (e) {
      console.error(e);
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
        <ActivityIndicator size="large" color="#1E40AF" />
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
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280', marginTop: 12 }}>Nessun rimborso</Text>
              <Text style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>Premi + per creare una richiesta</Text>
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
                    placeholderTextColor="#9CA3AF"
                    value={formImporto}
                    onChangeText={setFormImporto}
                    keyboardType="decimal-pad"
                  />

                  {/* Descrizione */}
                  <Text style={s.formLbl}>Descrizione</Text>
                  <TextInput
                    style={[s.input, { height: 80, textAlignVertical: 'top' }]}
                    placeholder="Dettagli della spesa..."
                    placeholderTextColor="#9CA3AF"
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
                      <TouchableOpacity style={s.photoBtn} onPress={takePhoto}>
                        <Ionicons name="camera" size={20} color="#1E40AF" />
                        <Text style={s.photoBtnTxt}>Scatta Foto</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={s.photoBtn} onPress={pickFromGallery}>
                        <Ionicons name="images" size={20} color="#1E40AF" />
                        <Text style={s.photoBtnTxt}>Galleria</Text>
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
  container: { flex: 1, backgroundColor: '#F3F4F6' },
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
    flexDirection: 'row', backgroundColor: '#FFF', margin: 16, marginBottom: 8,
    borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statLbl: { fontSize: 12, color: '#6B7280' },
  statVal: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  divider: { width: 1, backgroundColor: '#E5E7EB' },
  filters: { maxHeight: 44, marginBottom: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: '#FFF',
    marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipActive: { backgroundColor: '#1E40AF', borderColor: '#1E40AF' },
  chipTxt: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  chipTxtActive: { color: '#FFF' },
  card: {
    backgroundColor: '#FFF', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  categoria: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  dateText: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  amount: { fontSize: 24, fontWeight: '700', color: '#1E40AF', marginVertical: 6 },
  desc: { fontSize: 13, color: '#4B5563', marginTop: 4 },
  attRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderRadius: 8, padding: 8, marginTop: 10 },
  attImg: { width: 40, height: 40, borderRadius: 6, backgroundColor: '#E5E7EB' },
  attLbl: { fontSize: 12, fontWeight: '500', color: '#374151' },
  gpsLbl: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  noteAdmin: {
    flexDirection: 'row', backgroundColor: '#EFF6FF', borderRadius: 8, padding: 8, marginTop: 10, gap: 6,
  },
  noteAdminTxt: { fontSize: 12, color: '#1E40AF', flex: 1 },
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
    backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  formLbl: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 8 },
  input: {
    backgroundColor: '#F9FAFB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    borderWidth: 1, borderColor: '#E5E7EB', color: '#1F2937',
  },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, backgroundColor: '#F3F4F6',
    marginRight: 8, borderWidth: 1, borderColor: '#E5E7EB',
  },
  catChipActive: { backgroundColor: '#10B981', borderColor: '#10B981' },
  catChipTxt: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
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
    paddingVertical: 12, borderRadius: 10, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
  },
  photoBtnTxt: { fontSize: 14, fontWeight: '600', color: '#1E40AF' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#10B981', paddingVertical: 14, borderRadius: 12, marginTop: 16,
  },
  submitBtnDisabled: { backgroundColor: '#9CA3AF' },
  submitTxt: { fontSize: 16, fontWeight: '700', color: '#FFF' },
});
