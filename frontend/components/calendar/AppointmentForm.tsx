import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
import { format } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import { fetchCustomers } from '../../lib/api/customers';
import { createAppointment } from '../../lib/api/appointments';
import { Customer } from '../../types';
import { COLORS } from '../../lib/theme';

export function AppointmentForm({ initialDate, onClose, onSaved }: { initialDate: Date; onClose: () => void; onSaved: (id: string, date: Date) => void }) {
  const user = useAuthStore(s => s.user);
  const [mode, setMode] = useState<'customer' | 'free'>('customer');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({ title: '', date: format(initialDate, 'yyyy-MM-dd'), time: format(initialDate, 'HH:mm'), duration: '30', notes: '', address: '', city: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const requestId = useRef(randomUUID());
  const load = async () => {
    if (!user) return;
    setLoading(true); setLoadError(false);
    try { setCustomers(await fetchCustomers(user.id, user.role, user.branchId, { force: true })); }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = () => { if (!locked.current) onClose(); };
  const set = (field: keyof typeof form, value: string) => { setForm(old => ({ ...old, [field]: value })); setError(''); };
  const save = async () => {
    if (!user || locked.current) return;
    if (mode === 'customer' && !customer) { setError('Seleziona un cliente oppure scegli Impegno libero.'); return; }
    locked.current = true; setBusy(true); setError('');
    try {
      const id = await createAppointment({ ...form, id: requestId.current, agentId: user.id, customerId: mode === 'customer' ? customer!.id : null, duration: Number(form.duration) });
      onSaved(id, new Date(`${form.date}T${form.time}:00`));
    } catch (e) { setError(e instanceof Error ? e.message : 'Salvataggio non riuscito.'); }
    finally { locked.current = false; setBusy(false); }
  };
  const visibleCustomers = customers.filter(c => `${c.business_name} ${c.city ?? ''} ${c.contact_phone ?? ''}`.toLowerCase().includes(search.toLowerCase().trim())).slice(0, 30);
  const field = (key: keyof typeof form, label: string, placeholder = '', numeric = false) => <View key={key} style={styles.field}>
    <Text testID={`appointment-${key}-label`} style={styles.label}>{label}</Text>
    <TextInput testID={`appointment-${key}`} editable={!busy} style={[styles.input, key === 'notes' && styles.notes]} value={form[key]} onChangeText={v => set(key, v)} placeholder={placeholder} placeholderTextColor={COLORS.textMuted} keyboardType={numeric ? 'number-pad' : 'default'} autoCapitalize="none" multiline={key === 'notes'} />
  </View>;
  return <Modal visible animationType="slide" onRequestClose={close}>
    <SafeAreaView testID="appointment-form" style={styles.page}>
      <View style={styles.header}><Text testID="appointment-form-title" style={styles.title}>Nuovo appuntamento</Text><TouchableOpacity testID="appointment-cancel" onPress={close} disabled={busy} style={styles.textButton}><Text style={styles.link}>Chiudi</Text></TouchableOpacity></View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.row}>{(['customer', 'free'] as const).map(value => <TouchableOpacity key={value} testID={`appointment-mode-${value}`} disabled={busy} accessibilityState={{ selected: mode === value }} onPress={() => { setMode(value); setError(''); }} style={[styles.mode, mode === value && styles.active]}><Text style={mode === value ? styles.white : styles.label}>{value === 'customer' ? 'Cliente / Follow-up' : 'Impegno libero'}</Text></TouchableOpacity>)}</View>
          {mode === 'customer' ? <View style={styles.field}>
            <Text testID="appointment-customer-help" style={styles.hint}>Il cliente apparirà tra i follow-up di AI Tour per il giorno scelto.</Text>
            {customer ? <TouchableOpacity testID="appointment-customer-change" disabled={busy} onPress={() => setCustomer(null)} style={styles.selection}><Text testID="appointment-selected-customer" style={styles.label}>{customer.business_name} · Cambia</Text></TouchableOpacity> : <>
              <TextInput testID="appointment-customer-search" editable={!busy} style={styles.input} value={search} onChangeText={setSearch} placeholder="Cerca cliente o città" placeholderTextColor={COLORS.textMuted} />
              {loading ? <ActivityIndicator testID="appointment-customers-loading" color={COLORS.primary} /> : loadError ? <TouchableOpacity testID="appointment-customers-retry" onPress={load} style={styles.textButton}><Text style={styles.error}>Clienti non caricati. Tocca per riprovare.</Text></TouchableOpacity> : visibleCustomers.map(c => <TouchableOpacity key={c.id} testID={`appointment-customer-${c.id}`} disabled={busy} onPress={() => setCustomer(c)} style={styles.customer}><Text style={styles.label}>{c.business_name}</Text><Text style={styles.hint}>{c.city}</Text></TouchableOpacity>)}
              {!loading && !loadError && visibleCustomers.length === 0 && <Text testID="appointment-customer-empty" style={styles.hint}>Nessun cliente trovato.</Text>}
            </>}
          </View> : <>
            <Text testID="appointment-free-help" style={styles.hint}>Visibile in AI Tour come impegno. Per inserirlo come tappa, indica un luogo e confermalo in AI Tour.</Text>
            {field('title', 'Titolo *', 'Es. Incontro in sede')}
            {field('address', 'Luogo / indirizzo (facoltativo)', 'Via e numero civico')}
            {field('city', 'Città (facoltativa)', 'Città')}
          </>}
          {field('date', 'Data *', 'AAAA-MM-GG')}
          {field('time', 'Ora locale *', 'HH:MM')}
          {field('duration', 'Durata in minuti *', '30', true)}
          {field('notes', 'Note', 'Motivo e dettagli dell’appuntamento')}
          {!!error && <Text testID="appointment-error" accessibilityRole="alert" style={styles.error}>{error}</Text>}
        </ScrollView>
        <TouchableOpacity testID="appointment-save" onPress={save} disabled={busy} style={[styles.save, busy && styles.disabled]}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.white}>Salva appuntamento</Text>}</TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg }, flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 8 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.text, flex: 1 },
  content: { padding: 20, paddingBottom: 32, gap: 20 }, row: { flexDirection: 'row', gap: 8 },
  mode: { flex: 1, padding: 12, minHeight: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surface },
  active: { backgroundColor: COLORS.primary }, white: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  field: { gap: 10 }, label: { color: COLORS.text, fontSize: 15, fontWeight: '500' }, hint: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19 },
  input: { minHeight: 48, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, color: COLORS.text, fontSize: 16 },
  notes: { minHeight: 90, textAlignVertical: 'top' },
  customer: { minHeight: 48, padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  selection: { padding: 16, minHeight: 48, borderRadius: 12, backgroundColor: COLORS.primarySoft },
  textButton: { minHeight: 48, justifyContent: 'center', padding: 8 }, link: { color: COLORS.primary, fontSize: 15 },
  error: { color: COLORS.danger, fontSize: 14, lineHeight: 20 },
  save: { margin: 16, minHeight: 52, backgroundColor: COLORS.primary, borderRadius: 14, justifyContent: 'center', alignItems: 'center' }, disabled: { opacity: 0.5 },
});