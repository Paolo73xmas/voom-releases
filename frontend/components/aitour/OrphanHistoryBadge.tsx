// Badge tipo-entità del tour (parità web OrphanHistoryBadge): per gli Orfani è
// toccabile e apre il modale con gli ordini degli ultimi 12 mesi (valore e
// categorie acquistate) o l'ultima visita / 'Mai visitato'.
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DS, JAKARTA } from '../../lib/theme';
import { AI_PURPLE, AI_PURPLE_TEXT } from './shared';
import { supabase } from '../../lib/supabase';
import type { TourCandidate } from '../../lib/aitour/types';
import { ENTITY_LABELS, ENTITY_TEXT_COLORS, fmtEur } from '../../lib/aitour/types';

interface HistoryOrder {
  order_date: string;
  order_number: string | null;
  total_amount: number;
  categories: string;
}

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('it-IT') : null);

export function CandidateEntityBadge({ candidate }: { candidate: TourCandidate }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [lastVisit, setLastVisit] = useState<string | null>(null);

  const historyId = candidate.customerId || candidate.historyCustomerId || null;
  const clickable = candidate.entityType === 'orphan' && !!historyId;
  const color = ENTITY_TEXT_COLORS[candidate.entityType];

  useEffect(() => {
    if (!open || !historyId) return;
    setLoading(true);
    supabase
      .rpc('ai_tour_customer_order_history', { p_customer_id: historyId })
      .then(({ data, error }) => {
        if (error) {
          console.warn('[OrphanBadge] storico ordini:', error.message);
          setOrders([]);
          setLastVisit(candidate.lastVisitDate);
        } else {
          setOrders((data?.orders || []) as HistoryOrder[]);
          setLastVisit((data?.last_visit_date as string | null) || candidate.lastVisitDate);
        }
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, historyId]);

  const badge = (
    <View style={[styles.badge, { borderColor: color }, clickable && styles.badgeClickable]}>
      <Text style={[styles.badgeText, { color }]}>{ENTITY_LABELS[candidate.entityType]}</Text>
      {clickable && <Ionicons name="time-outline" size={11} color={color} />}
    </View>
  );

  if (!clickable) return badge;

  const totalYear = orders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}>
        {badge}
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Ionicons name="cart" size={17} color={AI_PURPLE_TEXT} />
              <Text style={styles.title} numberOfLines={1}>{candidate.name}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color={DS.inkMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>Ordini degli ultimi 12 mesi del cliente orfano</Text>

            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={AI_PURPLE_TEXT} />
              </View>
            ) : orders.length > 0 ? (
              <>
                <View style={styles.summaryRow}>
                  <View style={styles.pillFilled}>
                    <Text style={styles.pillFilledText}>{orders.length} ordini</Text>
                  </View>
                  <View style={styles.pillOutline}>
                    <Text style={styles.pillOutlineText}>Totale 12 mesi: {fmtEur(totalYear)}</Text>
                  </View>
                  {lastVisit ? (
                    <View style={styles.lastVisitRow}>
                      <Ionicons name="calendar-outline" size={12} color={DS.inkMuted} />
                      <Text style={styles.lastVisitText}>Ultima visita: {fmtDate(lastVisit)}</Text>
                    </View>
                  ) : null}
                </View>
                <ScrollView style={styles.list} bounces={false}>
                  {orders.map((o, i) => (
                    <View key={i} style={[styles.orderRow, i > 0 && styles.orderRowBorder]}>
                      <View style={styles.orderTop}>
                        <Text style={styles.orderDate}>{fmtDate(o.order_date)}</Text>
                        <Text style={styles.orderNumber} numberOfLines={1}>{o.order_number || '—'}</Text>
                        <Text style={styles.orderValue}>{fmtEur(Number(o.total_amount) || 0)}</Text>
                      </View>
                      {o.categories ? (
                        <Text style={styles.orderCategories} numberOfLines={2}>{o.categories}</Text>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>
              </>
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Nessun ordine negli ultimi 12 mesi.</Text>
                <View style={styles.lastVisitRow}>
                  <Ionicons name="calendar-outline" size={14} color={DS.inkMuted} />
                  <Text style={styles.emptyVisit}>
                    {lastVisit ? (
                      <>Ultima visita: <Text style={styles.emptyVisitBold}>{fmtDate(lastVisit)}</Text></>
                    ) : (
                      'Mai visitato.'
                    )}
                  </Text>
                </View>
                {candidate.totalRevenue > 0 && (
                  <Text style={styles.emptyRevenue}>Fatturato storico complessivo: {fmtEur(candidate.totalRevenue)}</Text>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.closeBtn} onPress={() => setOpen(false)} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  badgeClickable: { backgroundColor: DS.brandSoft },
  badgeText: { fontFamily: JAKARTA.semibold, fontSize: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: DS.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    paddingBottom: 28,
    maxHeight: '80%',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: JAKARTA.bold, fontSize: 15, color: DS.ink, flex: 1 },
  subtitle: { fontFamily: JAKARTA.medium, fontSize: 11, color: DS.inkMuted, marginTop: 3, marginBottom: 10 },
  loadingBox: { paddingVertical: 32, alignItems: 'center' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginBottom: 9 },
  pillFilled: { backgroundColor: AI_PURPLE, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },
  pillFilledText: { fontFamily: JAKARTA.semibold, fontSize: 10, color: '#FFF' },
  pillOutline: { borderWidth: 1, borderColor: DS.border, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },
  pillOutlineText: { fontFamily: JAKARTA.semibold, fontSize: 10, color: DS.ink2 },
  lastVisitRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lastVisitText: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted },
  list: { borderWidth: 1, borderColor: DS.border, borderRadius: 10, maxHeight: 360 },
  orderRow: { paddingVertical: 8, paddingHorizontal: 11 },
  orderRowBorder: { borderTopWidth: 1, borderTopColor: DS.border },
  orderTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  orderDate: { fontFamily: JAKARTA.semibold, fontSize: 12, color: DS.ink, width: 74 },
  orderNumber: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted, flex: 1 },
  orderValue: { fontFamily: JAKARTA.bold, fontSize: 12, color: DS.ink },
  orderCategories: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.ink2, marginTop: 2 },
  emptyBox: { paddingVertical: 10, gap: 6 },
  emptyTitle: { fontFamily: JAKARTA.semibold, fontSize: 13, color: DS.ink },
  emptyVisit: { fontFamily: JAKARTA.regular, fontSize: 12, color: DS.inkMuted },
  emptyVisitBold: { fontFamily: JAKARTA.bold, color: DS.ink },
  emptyRevenue: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted },
  closeBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeBtnText: { fontFamily: JAKARTA.semibold, fontSize: 13, color: DS.ink2 },
});
