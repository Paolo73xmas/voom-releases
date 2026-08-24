// Modale "Cambia Ordine Tappe" (parità web ReorderStopsDialog): riordino manuale con
// frecce su/giù delle tappe rimanenti; alla conferma percorso e orari vengono
// ricalcolati mantenendo esattamente l'ordine scelto.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DS, JAKARTA } from '../../lib/theme';
import { AI_PURPLE } from './shared';

export interface ReorderItem {
  id: string;
  name: string;
  arrival: string | null;
  mandatory: boolean;
  addedByAdmin?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  items: ReorderItem[];
  saving: boolean;
  onConfirm: (orderedIds: string[]) => void;
}

export function ReorderStopsModal({ visible, onClose, items, saving, onConfirm }: Props) {
  const [order, setOrder] = useState<ReorderItem[]>(items);
  useEffect(() => {
    if (visible) setOrder(items);
  }, [visible, items]);

  const move = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  const changed = order.some((s, i) => s.id !== items[i]?.id);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.titleRow}>
            <Ionicons name="swap-vertical" size={16} color={AI_PURPLE} />
            <Text style={styles.title}>Cambia Ordine Tappe</Text>
          </View>
          <Text style={styles.hint}>
            Sposta le tappe con le frecce: alla conferma percorso e orari vengono ricalcolati mantenendo esattamente questo ordine.
          </Text>
          <ScrollView style={{ maxHeight: 400 }}>
            {order.map((s, i) => (
              <View key={s.id} style={[styles.row, s.addedByAdmin && styles.rowAdmin]}>
                <View style={styles.seq}>
                  <Text style={styles.seqText}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>{s.name}</Text>
                  <View style={styles.metaRow}>
                    {s.arrival ? <Text style={styles.arrival}>prev. {s.arrival.slice(0, 5)}</Text> : null}
                    {s.mandatory && (
                      <View style={[styles.badge, { backgroundColor: '#DC2626' }]}>
                        <Text style={styles.badgeText}>obblig.</Text>
                      </View>
                    )}
                    {s.addedByAdmin && (
                      <View style={[styles.badge, { backgroundColor: '#EA580C' }]}>
                        <Text style={styles.badgeText}>admin</Text>
                      </View>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.arrowBtn, (i === 0 || saving) && { opacity: 0.35 }]}
                  disabled={i === 0 || saving}
                  onPress={() => move(i, -1)}
                  activeOpacity={0.7}
                  testID={`reorder-up-${i}`}
                  accessibilityRole="button"
                >
                  <Ionicons name="chevron-up" size={17} color={DS.ink2} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.arrowBtn, (i === order.length - 1 || saving) && { opacity: 0.35 }]}
                  disabled={i === order.length - 1 || saving}
                  onPress={() => move(i, 1)}
                  activeOpacity={0.7}
                  testID={`reorder-down-${i}`}
                  accessibilityRole="button"
                >
                  <Ionicons name="chevron-down" size={17} color={DS.ink2} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Annulla</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, (!changed || saving) && { opacity: 0.5 }]}
              onPress={() => onConfirm(order.map((s) => s.id))}
              disabled={!changed || saving}
              activeOpacity={0.7}
            >
              {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.confirmText}>Conferma nuovo ordine</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: DS.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingBottom: 28, maxHeight: '90%' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontFamily: JAKARTA.bold, fontSize: 16, color: DS.ink },
  hint: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted, marginTop: 4, marginBottom: 10, lineHeight: 15 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: DS.border, borderRadius: 9,
    paddingVertical: 7, paddingHorizontal: 8, marginBottom: 6,
  },
  rowAdmin: { borderColor: '#FDBA74', backgroundColor: 'rgba(234,88,12,0.08)' },
  seq: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center' },
  seqText: { fontFamily: JAKARTA.bold, fontSize: 10, color: '#FFF' },
  name: { fontFamily: JAKARTA.medium, fontSize: 12.5, color: DS.ink },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  arrival: { fontFamily: JAKARTA.regular, fontSize: 9.5, color: DS.inkMuted },
  badge: { borderRadius: 4, paddingVertical: 1, paddingHorizontal: 5 },
  badgeText: { fontFamily: JAKARTA.semibold, fontSize: 8, color: '#FFF' },
  arrowBtn: {
    width: 34, height: 34, borderRadius: 8,
    borderWidth: 1, borderColor: DS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  footer: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: DS.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  cancelText: { fontFamily: JAKARTA.semibold, fontSize: 13, color: DS.ink2 },
  confirmBtn: { flex: 2, backgroundColor: '#7C3AED', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  confirmText: { fontFamily: JAKARTA.bold, fontSize: 13, color: '#FFF' },
});
