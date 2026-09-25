// Dettaglio ispezione con note e foto (solo le ispezioni dell'agente collegato).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Modal, Pressable, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { fetchInspectionDetail, getInspectionStatusLabel, type InspectionDetail } from '../../lib/api/inspections';
import { DS, JAKARTA } from '../../lib/theme';
import { hap } from '../../lib/haptics';

export default function InspectionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();
  const [item, setItem] = useState<InspectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !id) return;
    setLoading(true);
    setError('');
    try {
      const detail = await fetchInspectionDetail(id, user.id);
      if (!detail) setError('Ispezione non trovata tra le tue ispezioni.');
      setItem(detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore nel caricamento');
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => { load(); }, [load]);

  const width = Dimensions.get('window').width;
  const d = item ? new Date(item.inspection_date) : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity testID="inspection-detail-back" onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={DS.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Ispezione</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={DS.brand} />
      ) : error ? (
        <Text testID="inspection-detail-error" style={styles.error}>{error}</Text>
      ) : item ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
          <Text testID="inspection-detail-customer" style={styles.customer}>{item.customerName}</Text>
          {!!item.customerCity && <Text style={styles.city}>{item.customerCity}</Text>}
          <Text testID="inspection-detail-date" style={styles.date}>
            {d?.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} · {d?.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <Text style={styles.status}>{getInspectionStatusLabel(item.status)}</Text>

          <Text style={styles.sectionTitle}>Note</Text>
          <View style={styles.noteBox}>
            <Text testID="inspection-detail-notes" style={item.notes ? styles.notes : styles.notesEmpty}>
              {item.notes || 'Nessuna nota registrata'}
            </Text>
          </View>

          <Text style={styles.sectionTitle}>Foto ({item.photos.length})</Text>
          {item.photos.length === 0 ? (
            <Text testID="inspection-detail-no-photos" style={styles.notesEmpty}>Nessuna foto allegata</Text>
          ) : (
            <View style={styles.photoGrid}>
              {item.photos.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  testID={`inspection-photo-${p.id}`}
                  style={[styles.photoWrap, { width: (width - 44) / 2, height: (width - 44) / 2 }]}
                  onPress={() => { hap.light(); setZoom(p.photo_url); }}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: p.photo_url }} style={styles.photo} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {item.customerId && (
            <TouchableOpacity
              testID="inspection-detail-open-customer"
              style={styles.customerBtn}
              onPress={() => router.push(`/customer/${item.customerId}`)}
              activeOpacity={0.85}
            >
              <Ionicons name="person-outline" size={16} color="#FFF" />
              <Text style={styles.customerBtnText}>Apri scheda cliente</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : null}

      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <Pressable testID="inspection-photo-zoom" style={styles.zoomBackdrop} onPress={() => setZoom(null)}>
          {!!zoom && <Image source={{ uri: zoom }} style={styles.zoomImage} resizeMode="contain" />}
          <Text style={styles.zoomHint}>Tocca per chiudere</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: DS.surface2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8 },
  backBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: JAKARTA.bold, fontSize: 18, color: DS.ink },
  loader: { marginTop: 40 },
  error: { fontFamily: JAKARTA.medium, fontSize: 14, color: DS.error, padding: 16 },
  content: { padding: 16, gap: 4 },
  customer: { fontFamily: JAKARTA.bold, fontSize: 18, color: DS.ink },
  city: { fontFamily: JAKARTA.regular, fontSize: 13, color: DS.ink2 },
  date: { fontFamily: JAKARTA.medium, fontSize: 13, color: DS.brand, marginTop: 4 },
  status: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.inkMuted },
  sectionTitle: { fontFamily: JAKARTA.bold, fontSize: 14, color: DS.ink, marginTop: 20, marginBottom: 8 },
  noteBox: { backgroundColor: DS.surface, borderRadius: 14, borderWidth: 1, borderColor: DS.border, padding: 14 },
  notes: { fontFamily: JAKARTA.regular, fontSize: 14, color: DS.ink, lineHeight: 21 },
  notesEmpty: { fontFamily: JAKARTA.regular, fontSize: 13, color: DS.inkMuted, fontStyle: 'italic' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  photoWrap: { borderRadius: 14, overflow: 'hidden', backgroundColor: DS.surface, borderWidth: 1, borderColor: DS.border },
  photo: { width: '100%', height: '100%' },
  customerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, minHeight: 48, borderRadius: 14, backgroundColor: DS.brand },
  customerBtnText: { fontFamily: JAKARTA.semibold, fontSize: 15, color: '#FFF' },
  zoomBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center', gap: 16 },
  zoomImage: { width: '100%', height: '80%' },
  zoomHint: { fontFamily: JAKARTA.regular, fontSize: 12, color: '#FFFFFFAA' },
});
