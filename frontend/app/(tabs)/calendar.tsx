import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  Linking,
  Alert,
  Dimensions,
} from 'react-native';
import { Calendar } from 'react-native-big-calendar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../lib/theme';

type CalendarMode = 'month' | 'week' | '3days' | 'day';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  color?: string;
  eventType: 'appointment' | 'visit' | 'follow_up';
  customerId?: string | null;
  customerName?: string;
  customerAddress?: string;
  customerCity?: string;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  status?: string;
  completedAt?: string | null;
  appointmentType?: string;
  createdByAdmin?: boolean;
}

const MODE_LABELS: Record<CalendarMode, string> = {
  month: 'Mese',
  week: 'Settimana',
  '3days': '3 Giorni',
  day: 'Giorno',
};

const EVENT_TYPE_CONFIG = {
  appointment: { label: 'Appuntamento', color: '#F59E0B', icon: 'calendar' as const },
  visit: { label: 'Visita', color: '#3B82F6', icon: 'walk' as const },
  follow_up: { label: 'Follow-up', color: '#10B981', icon: 'refresh' as const },
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function CalendarScreen() {
  const router = useRouter();
  const { user, profile } = useAuthStore();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'admincustom';

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<CalendarMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showModePicker, setShowModePicker] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);

      // Dynamic date range based on view mode (less data fetched for narrower views)
      const rangeStart = new Date(currentDate);
      const rangeEnd = new Date(currentDate);
      switch (mode) {
        case 'day':
          rangeStart.setDate(rangeStart.getDate() - 7);
          rangeEnd.setDate(rangeEnd.getDate() + 7);
          break;
        case '3days':
          rangeStart.setDate(rangeStart.getDate() - 14);
          rangeEnd.setDate(rangeEnd.getDate() + 14);
          break;
        case 'week':
          rangeStart.setDate(rangeStart.getDate() - 21);
          rangeEnd.setDate(rangeEnd.getDate() + 21);
          break;
        case 'month':
        default:
          rangeStart.setMonth(rangeStart.getMonth() - 1);
          rangeEnd.setMonth(rangeEnd.getMonth() + 1);
          break;
      }

      const allEvents: CalendarEvent[] = [];

      // Load appointments
      let aptQuery = supabase
        .from('appointments')
        .select('*')
        .gte('appointment_date', rangeStart.toISOString())
        .lte('appointment_date', rangeEnd.toISOString())
        .order('appointment_date', { ascending: true });

      if (!isAdmin) {
        aptQuery = aptQuery.eq('agent_id', user.id);
      }

      const { data: appointments } = await aptQuery;

      if (appointments && appointments.length > 0) {
        // Fetch customers
        const customerIds = [...new Set(appointments.map((a: any) => a.customer_id).filter(Boolean))];
        let customerMap = new Map();
        if (customerIds.length > 0) {
          const { data: customers } = await supabase
            .from('customers')
            .select('id, business_name, address, city, contact_name, contact_phone')
            .in('id', customerIds);
          customerMap = new Map((customers || []).map((c: any) => [c.id, c]));
        }

        // Fetch creators
        const creatorIds = [...new Set(appointments.map((a: any) => a.created_by_id).filter(Boolean))];
        let creatorMap = new Map();
        if (creatorIds.length > 0) {
          const { data: creators } = await supabase
            .from('profiles')
            .select('id, role')
            .in('id', creatorIds);
          creatorMap = new Map((creators || []).map((c: any) => [c.id, c]));
        }

        for (const apt of appointments) {
          const customer = apt.customer_id ? customerMap.get(apt.customer_id) : null;
          const creator = apt.created_by_id ? creatorMap.get(apt.created_by_id) : null;
          const isCreatedByAdmin = creator?.role === 'admin' || creator?.role === 'supervisor';
          const isForDifferentAgent = apt.created_by_id !== apt.agent_id;
          const isAdminAppointment = isCreatedByAdmin && isForDifferentAgent;

          const customerName = customer?.business_name || apt.quick_customer_name || 'Cliente';
          const isCompleted = !!apt.completed_at;
          const isFollowUp = apt.appointment_type === 'follow_up';

          let color = '#F59E0B'; // Orange default
          let eventType: CalendarEvent['eventType'] = 'appointment';
          if (isCompleted) {
            color = '#9CA3AF'; // Gray
          } else if (isAdminAppointment) {
            color = '#EAB308'; // Yellow
          } else if (isFollowUp) {
            color = '#10B981'; // Green
            eventType = 'follow_up';
          }

          const start = new Date(apt.appointment_date);
          const end = new Date(start.getTime() + (apt.duration_minutes || 60) * 60000);

          allEvents.push({
            id: apt.id,
            title: customerName,
            start,
            end,
            color,
            eventType,
            customerId: apt.customer_id,
            customerName,
            customerAddress: customer?.address || apt.quick_customer_address || '',
            customerCity: customer?.city || apt.quick_customer_city || '',
            contactName: customer?.contact_name || apt.quick_customer_name || '',
            contactPhone: customer?.contact_phone || apt.quick_customer_phone || '',
            notes: apt.notes,
            status: apt.status,
            completedAt: apt.completed_at,
            appointmentType: apt.appointment_type,
            createdByAdmin: isAdminAppointment,
          });
        }
      }

      // Load visits
      let visitQuery = supabase
        .from('visits')
        .select('id, customer_id, visit_date, visit_type, notes')
        .gte('visit_date', rangeStart.toISOString())
        .lte('visit_date', rangeEnd.toISOString())
        .order('visit_date', { ascending: true });

      if (!isAdmin) {
        visitQuery = visitQuery.eq('agent_id', user.id);
      }

      const { data: visits } = await visitQuery;

      if (visits && visits.length > 0) {
        const customerIds = [...new Set(visits.map((v: any) => v.customer_id).filter(Boolean))];
        let customerMap = new Map();
        if (customerIds.length > 0) {
          const { data: customers } = await supabase
            .from('customers')
            .select('id, business_name, address, city, contact_name, contact_phone')
            .in('id', customerIds);
          customerMap = new Map((customers || []).map((c: any) => [c.id, c]));
        }

        for (const visit of visits) {
          const customer = visit.customer_id ? customerMap.get(visit.customer_id) : null;
          const start = new Date(visit.visit_date);
          const end = new Date(start.getTime() + 2 * 3600000);

          allEvents.push({
            id: visit.id,
            title: `Visita - ${customer?.business_name || 'Cliente'}`,
            start,
            end,
            color: '#3B82F6',
            eventType: 'visit',
            customerId: visit.customer_id,
            customerName: customer?.business_name,
            customerAddress: customer?.address || '',
            customerCity: customer?.city || '',
            contactName: customer?.contact_name || '',
            contactPhone: customer?.contact_phone || '',
            notes: visit.notes,
          });
        }
      }

      allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
      setEvents(allEvents);
    } catch (err) {
      console.error('Error loading calendar events:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, isAdmin, currentDate, mode]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleMarkDone = async () => {
    if (!selectedEvent) return;
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', selectedEvent.id);
      if (error) throw error;
      setSelectedEvent(null);
      loadEvents();
    } catch (err) {
      Alert.alert('Errore', 'Impossibile completare l\'appuntamento');
    }
  };

  const handleUndoDone = async () => {
    if (!selectedEvent) return;
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ completed_at: null })
        .eq('id', selectedEvent.id);
      if (error) throw error;
      setSelectedEvent(null);
      loadEvents();
    } catch (err) {
      Alert.alert('Errore', 'Impossibile ripristinare l\'appuntamento');
    }
  };

  const formatDate = (d: Date) =>
    d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  // Transform events for the calendar library
  const calendarEvents = useMemo(() =>
    events.map((e) => ({
      ...e,
      children: null,
    })),
    [events]
  );

  const eventCellStyle = useCallback((event: CalendarEvent) => ({
    backgroundColor: event.color || '#3B82F6',
    borderRadius: 4,
    opacity: event.completedAt ? 0.5 : 1,
  }), []);

  return (
    <View style={styles.container}>
      {/* Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.modeSelector}
          onPress={() => setShowModePicker(true)}
        >
          <Text style={styles.modeSelectorText}>{MODE_LABELS[mode]}</Text>
          <Ionicons name="chevron-down" size={16} color="#7C3AED" />
        </TouchableOpacity>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => {
              const d = new Date(currentDate);
              if (mode === 'month') d.setMonth(d.getMonth() - 1);
              else if (mode === 'week') d.setDate(d.getDate() - 7);
              else if (mode === '3days') d.setDate(d.getDate() - 3);
              else d.setDate(d.getDate() - 1);
              setCurrentDate(d);
            }}
          >
            <Ionicons name="chevron-back" size={20} color="#4B5563" />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setCurrentDate(new Date())}>
            <Text style={styles.todayBtn}>Oggi</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onRefresh}
            disabled={refreshing}
            style={{ marginLeft: 8, padding: 4 }}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#7C3AED" />
            ) : (
              <Ionicons name="refresh" size={18} color="#7C3AED" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => {
              const d = new Date(currentDate);
              if (mode === 'month') d.setMonth(d.getMonth() + 1);
              else if (mode === 'week') d.setDate(d.getDate() + 7);
              else if (mode === '3days') d.setDate(d.getDate() + 3);
              else d.setDate(d.getDate() + 1);
              setCurrentDate(d);
            }}
          >
            <Ionicons name="chevron-forward" size={20} color="#4B5563" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#EAB308' }]} />
          <Text style={styles.legendText}>Admin</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
          <Text style={styles.legendText}>Appt.</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.legendText}>Follow-up</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#3B82F6' }]} />
          <Text style={styles.legendText}>Visita</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#9CA3AF' }]} />
          <Text style={styles.legendText}>Fatto</Text>
        </View>
      </View>

      {/* Calendar */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Caricamento calendario...</Text>
        </View>
      ) : (
        <Calendar
          events={calendarEvents}
          height={Dimensions.get('window').height - 220}
          mode={mode}
          date={currentDate}
          onPressEvent={(event) => setSelectedEvent(event as CalendarEvent)}
          onSwipeEnd={(date) => setCurrentDate(date)}
          eventCellStyle={eventCellStyle as any}
          locale="it"
          weekStartsOn={1}
          swipeEnabled
          showTime
          headerContainerStyle={styles.calendarHeader}
          bodyContainerStyle={styles.calendarBody}
        />
      )}

      {/* Mode Picker */}
      <Modal visible={showModePicker} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowModePicker(false)}>
          <View style={styles.modePickerModal}>
            {(Object.keys(MODE_LABELS) as CalendarMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeOption, mode === m && styles.modeOptionActive]}
                onPress={() => { setMode(m); setShowModePicker(false); }}
              >
                <Text style={[styles.modeOptionText, mode === m && styles.modeOptionTextActive]}>
                  {MODE_LABELS[m]}
                </Text>
                {mode === m && <Ionicons name="checkmark" size={18} color="#7C3AED" />}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Event Detail Modal */}
      <Modal visible={!!selectedEvent} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedEvent(null)}>
          <Pressable style={styles.eventModal} onPress={() => {}}>
            {selectedEvent && (() => {
              const typeConf = EVENT_TYPE_CONFIG[selectedEvent.eventType];
              const isCompleted = !!selectedEvent.completedAt;
              return (
                <>
                  <View style={styles.modalHandle} />

                  {/* Type badge + status */}
                  <View style={styles.eventBadgeRow}>
                    <View style={[styles.eventTypeBadge, { backgroundColor: typeConf.color + '20' }]}>
                      <Ionicons name={typeConf.icon as any} size={14} color={typeConf.color} />
                      <Text style={[styles.eventTypeBadgeText, { color: typeConf.color }]}>{typeConf.label}</Text>
                    </View>
                    {selectedEvent.createdByAdmin && (
                      <View style={[styles.eventTypeBadge, { backgroundColor: '#FEF9C3' }]}>
                        <Ionicons name="star" size={12} color="#CA8A04" />
                        <Text style={[styles.eventTypeBadgeText, { color: '#CA8A04' }]}>Da Admin</Text>
                      </View>
                    )}
                    {isCompleted && (
                      <View style={[styles.eventTypeBadge, { backgroundColor: COLORS.border }]}>
                        <Ionicons name="checkmark-circle" size={12} color="#6B7280" />
                        <Text style={[styles.eventTypeBadgeText, { color: COLORS.textMuted }]}>Completato</Text>
                      </View>
                    )}
                  </View>

                  {/* Title */}
                  <Text style={[styles.eventTitle, isCompleted && styles.eventTitleCompleted]}>
                    {selectedEvent.title}
                  </Text>

                  {/* Date/Time */}
                  <View style={styles.eventInfoRow}>
                    <Ionicons name="time-outline" size={18} color="#6B7280" />
                    <View>
                      <Text style={styles.eventInfoText}>{formatDate(selectedEvent.start)}</Text>
                      <Text style={styles.eventInfoSub}>{formatTime(selectedEvent.start)} - {formatTime(selectedEvent.end)}</Text>
                    </View>
                  </View>

                  {/* Address */}
                  {(selectedEvent.customerAddress || selectedEvent.customerCity) && (
                    <TouchableOpacity
                      style={styles.eventInfoRow}
                      onPress={() => {
                        const addr = encodeURIComponent(`${selectedEvent.customerAddress}, ${selectedEvent.customerCity}`);
                        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${addr}`);
                      }}
                    >
                      <Ionicons name="location-outline" size={18} color="#3B82F6" />
                      <Text style={[styles.eventInfoText, { color: '#3B82F6' }]}>
                        {selectedEvent.customerAddress}{selectedEvent.customerCity ? `, ${selectedEvent.customerCity}` : ''}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Phone */}
                  {selectedEvent.contactPhone && (
                    <TouchableOpacity
                      style={styles.eventInfoRow}
                      onPress={() => Linking.openURL(`tel:${selectedEvent.contactPhone}`)}
                    >
                      <Ionicons name="call-outline" size={18} color="#3B82F6" />
                      <Text style={[styles.eventInfoText, { color: '#3B82F6' }]}>
                        {selectedEvent.contactPhone}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Notes */}
                  {selectedEvent.notes && (
                    <View style={styles.eventInfoRow}>
                      <Ionicons name="document-text-outline" size={18} color="#6B7280" />
                      <Text style={styles.eventInfoText}>{selectedEvent.notes}</Text>
                    </View>
                  )}

                  {/* Actions */}
                  {selectedEvent.eventType !== 'visit' && (
                    <View style={styles.eventActions}>
                      {!isCompleted ? (
                        <TouchableOpacity style={styles.doneBtn} onPress={handleMarkDone}>
                          <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                          <Text style={styles.doneBtnText}>Segna completato</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity style={styles.undoBtn} onPress={handleUndoDone}>
                          <Ionicons name="arrow-undo" size={20} color="#4B5563" />
                          <Text style={styles.undoBtnText}>Ripristina</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.surface },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  modeSelectorText: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  navBtn: { padding: 6 },
  todayBtn: { fontSize: 14, fontWeight: '600', color: '#7C3AED' },

  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: COLORS.textMuted },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, color: COLORS.textMuted },

  calendarHeader: { backgroundColor: '#FAFAFA' },
  calendarBody: { backgroundColor: COLORS.surface },

  // Mode picker
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modePickerModal: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modeOptionActive: {},
  modeOptionText: { fontSize: 16, color: COLORS.textSecondary },
  modeOptionTextActive: { color: '#7C3AED', fontWeight: '700' },

  // Event modal
  eventModal: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '75%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  eventBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  eventTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  eventTypeBadgeText: { fontSize: 12, fontWeight: '600' },
  eventTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  eventTitleCompleted: { textDecorationLine: 'line-through', color: COLORS.textLight },
  eventInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  eventInfoText: { fontSize: 14, color: COLORS.textSecondary, flex: 1 },
  eventInfoSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  eventActions: { marginTop: 20 },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  doneBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.bg,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  undoBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
});
