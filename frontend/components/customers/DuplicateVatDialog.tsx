// Avviso anti-duplicati P.IVA (parità web): la P.IVA inserita esiste già su
// un'altra anagrafica — apri la scheda esistente oppure forza la creazione
// se si tratta di un altro punto vendita dello stesso titolare.
import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DS, JAKARTA } from '../../lib/theme';
import type { ExistingVatCustomer } from '../../lib/api/vat-guard';

interface Props {
  existing: ExistingVatCustomer | null;
  onCancel: () => void;
  onOpenExisting: () => void;
  onForce: () => void;
}

export function DuplicateVatDialog({ existing, onCancel, onOpenExisting, onForce }: Props) {
  if (!existing) return null;
  const where = [existing.address, existing.city].filter(Boolean).join(', ');
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Ionicons name="warning" size={22} color="#F59E0B" />
            <Text style={styles.title}>P.IVA già registrata</Text>
          </View>
          <Text style={styles.desc}>
            Esiste già una scheda cliente con questa Partita IVA:{' '}
            <Text style={styles.descBold}>{existing.business_name}</Text>
            {where ? ` (${where})` : ''}. Per evitare duplicati, apri la scheda esistente oppure
            conferma che si tratta di un altro punto vendita dello stesso titolare.
          </Text>
          <TouchableOpacity style={styles.forceBtn} onPress={onForce} activeOpacity={0.8}>
            <Text style={styles.forceText}>È un altro punto vendita, crea comunque</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.openBtn} onPress={onOpenExisting} activeOpacity={0.8}>
            <Text style={styles.openText}>Apri scheda esistente</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Annulla</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: DS.surface, borderRadius: 16, padding: 20, gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: JAKARTA.bold, fontSize: 17, color: DS.ink },
  desc: { fontFamily: JAKARTA.regular, fontSize: 14, color: DS.ink2, lineHeight: 20 },
  descBold: { fontFamily: JAKARTA.bold, color: DS.ink },
  forceBtn: { backgroundColor: '#D97706', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 4, minHeight: 44, justifyContent: 'center' },
  forceText: { fontFamily: JAKARTA.bold, fontSize: 14, color: '#FFF' },
  openBtn: { borderWidth: 1, borderColor: DS.border, borderRadius: 12, paddingVertical: 13, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  openText: { fontFamily: JAKARTA.semibold, fontSize: 14, color: DS.ink },
  cancelBtn: { paddingVertical: 10, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  cancelText: { fontFamily: JAKARTA.medium, fontSize: 14, color: DS.inkMuted },
});
