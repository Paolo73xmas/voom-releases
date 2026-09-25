import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchCustomerInspectionNotes, type InspectionNote } from '../../lib/api/inspections';
import { ReadErrorNotice } from '../HistoryFeedback';
import { DS, JAKARTA } from '../../lib/theme';

export function InspectionNotesDialog({ agentId, customerId, name, onClose }: {
  agentId: string; customerId: string; name: string; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<InspectionNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    setError('');
    try {
      const rows = await fetchCustomerInspectionNotes(customerId, agentId);
      if (request === sequence.current) setItems(rows);
    } catch {
      if (request === sequence.current) setError('Impossibile caricare le note. Controlla la connessione e riprova.');
    } finally { if (request === sequence.current) setLoading(false); }
  }, [agentId, customerId]);
  useEffect(() => { void load(); return () => { sequence.current += 1; }; }, [load]);

  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <View style={[styles.backdrop, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <View testID="aitour-inspection-notes-dialog" style={styles.dialog}>
        <Text testID="aitour-inspection-notes-title" style={styles.title}>Note da Ispezioni</Text>
        <Text testID="aitour-inspection-notes-customer" style={styles.customer} numberOfLines={2}>{name}</Text>
        <ReadErrorNotice id="aitour-inspection-notes" message={error} onRetry={load} busy={loading} />
        {loading ? <ActivityIndicator testID="aitour-inspection-notes-loading" style={styles.loading} color={DS.brand} /> :
          <FlatList testID="aitour-inspection-notes-scroll" style={styles.list} data={items} keyExtractor={item => item.id}
            ListHeaderComponent={!error ? <Text testID="aitour-inspection-notes-count" style={styles.caption}>{items.length} note · dalla più recente</Text> : null}
            ListEmptyComponent={!error ? <Text testID="aitour-inspection-notes-empty" style={styles.empty}>Nessuna nota registrata nelle ispezioni precedenti di questo cliente.</Text> : null}
            renderItem={({ item }) => <View testID={`aitour-inspection-note-${item.id}`} style={styles.note}>
              <Text testID={`aitour-inspection-note-${item.id}-date`} style={styles.date}>{new Date(item.date).toLocaleString('it-IT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
              <Text testID={`aitour-inspection-note-${item.id}-text`} style={styles.text}>{item.notes}</Text>
              {item.photoCount > 0 && <Text testID={`aitour-inspection-note-${item.id}-photos`} style={styles.caption}>{item.photoCount} foto</Text>}
            </View>} />}
        <TouchableOpacity testID="aitour-inspection-notes-close" accessibilityRole="button" style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>Chiudi</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#00000099', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  dialog: { width: '100%', maxWidth: 440, maxHeight: '90%', backgroundColor: DS.surface, borderRadius: 20, padding: 20 },
  title: { color: DS.ink, fontSize: 20, fontFamily: JAKARTA.bold },
  customer: { color: DS.ink2, fontSize: 14, marginTop: 8, marginBottom: 12 },
  list: { flexGrow: 0, flexShrink: 1 }, loading: { paddingVertical: 30 },
  note: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: DS.border, gap: 6 },
  date: { color: DS.brand, fontSize: 12, fontFamily: JAKARTA.semibold },
  text: { color: DS.ink, fontSize: 15, lineHeight: 22 },
  caption: { color: DS.inkMuted, fontSize: 12 },
  empty: { color: DS.inkMuted, fontSize: 14, lineHeight: 21, paddingVertical: 18 },
  close: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  closeText: { color: DS.brand, fontFamily: JAKARTA.semibold, fontSize: 15 },
});