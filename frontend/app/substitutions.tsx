/**
 * Sostituzioni — Mobile (aligned with web app v2)
 * Wizard: 1. Cliente → 2. Prodotti Ritiro → 3. Prodotti Invio → 4. Motivo+Conferma
 * Supports separate retrieve/send lists, nullable product_ids, status filter
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert,
  ActivityIndicator, Modal, ScrollView, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { fetchCustomers } from '../lib/api/customers';
import { fetchSubstitutions, createSubstitution, deleteSubstitution, SubstitutionWithDetails } from '../lib/api/substitutions';

const STATUS_OPTS = [
  { value: 'all', label: 'Tutti' },
  { value: 'pending', label: 'In Attesa' },
  { value: 'approved', label: 'Approvata' },
  { value: 'rejected', label: 'Rifiutata' },
  { value: 'completed', label: 'Completata' },
];
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: 'In Attesa', color: '#92400E', bg: '#FEF3C7', icon: 'time-outline' },
  approved: { label: 'Approvata', color: '#065F46', bg: '#D1FAE5', icon: 'checkmark-circle-outline' },
  rejected: { label: 'Rifiutata', color: '#991B1B', bg: '#FEE2E2', icon: 'close-circle-outline' },
  completed: { label: 'Completata', color: '#1E40AF', bg: '#DBEAFE', icon: 'shield-checkmark-outline' },
};

interface Product { id: string; name: string; sku: string | null; short_description?: string; unit_price?: number | null; stock_quantity?: number | null }
interface Customer { id: string; business_name: string; city?: string; province?: string }
interface ProductCard { id: string; product_id: string | null; quantity: number }

const formatCurrency = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
let cardCounter = 0;
const nextCardId = () => { cardCounter++; return `card-${cardCounter}`; };

export default function SubstitutionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [substitutions, setSubstitutions] = useState<SubstitutionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Create wizard
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [creating, setCreating] = useState(false);

  // Form
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [reason, setReason] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [retrieveCards, setRetrieveCards] = useState<ProductCard[]>([{ id: nextCardId(), product_id: null, quantity: 1 }]);
  const [sendCards, setSendCards] = useState<ProductCard[]>([{ id: nextCardId(), product_id: null, quantity: 1 }]);

  // Product picker
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ type: 'retrieve' | 'send'; idx: number }>({ type: 'retrieve', idx: 0 });
  const [pickerSearch, setPickerSearch] = useState('');

  // Detail
  const [selectedSub, setSelectedSub] = useState<SubstitutionWithDetails | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await fetchSubstitutions(
        user.id,
        statusFilter !== 'all' ? statusFilter : undefined,
        { userRole: user.role, branchId: user.branchId }
      );
      setSubstitutions(data);
    } catch (e) { console.error('[Substitutions] Error:', e); }
    finally { setLoading(false); }
  }, [user, statusFilter]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const loadCustomers = async () => {
    if (!user) return;
    // Use shared fetchCustomers helper for branch-aware filtering (admin/supervisor/branch_admin support)
    try {
      const data = await fetchCustomers(user.id, user.role, user.branchId);
      setCustomers(
        data.slice(0, 500).map((c: any) => ({
          id: c.id,
          business_name: c.business_name,
          city: c.city,
          province: c.province,
        }))
      );
    } catch (e) {
      console.error('[Substitutions] loadCustomers:', e);
      setCustomers([]);
    }
  };
  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('id, name, sku, short_description, unit_price, stock_quantity').eq('is_active', true).order('name').limit(2000);
    setProducts(data || []);
  };

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };
  const getProductName = (id: string | null) => { if (!id) return ''; const p = products.find(pr => pr.id === id); return p?.short_description || p?.name || ''; };
  const getProductPrice = (id: string | null) => { if (!id) return 0; const p = products.find(pr => pr.id === id); return p?.unit_price != null ? Number(p.unit_price) : 0; };

  const filtered = substitutions.filter(s => {
    if (!searchText.trim() || searchText.length < 3) return true;
    const q = searchText.toLowerCase();
    return (s.customers?.business_name?.toLowerCase().includes(q) || s.substitution_number?.toLowerCase().includes(q));
  });

  // Totals
  const totalRetrieve = retrieveCards.reduce((sum, c) => sum + (c.product_id ? getProductPrice(c.product_id) * c.quantity : 0), 0);
  const totalSend = sendCards.reduce((sum, c) => sum + (c.product_id ? getProductPrice(c.product_id) * c.quantity : 0), 0);
  // Conteggio totale pezzi (somma quantità di tutte le card con prodotto selezionato)
  const totalRetrievePieces = retrieveCards.reduce((sum, c) => sum + (c.product_id ? c.quantity : 0), 0);
  const totalSendPieces = sendCards.reduce((sum, c) => sum + (c.product_id ? c.quantity : 0), 0);

  // Create helpers
  const openCreate = () => { loadCustomers(); loadProducts(); setShowCreate(true); setCreateStep(0); resetForm(); };
  const resetForm = () => {
    setSelectedCustomer(null); setCustomerSearch(''); setReason(''); setFormNotes('');
    setRetrieveCards([{ id: nextCardId(), product_id: null, quantity: 1 }]);
    setSendCards([{ id: nextCardId(), product_id: null, quantity: 1 }]);
  };

  const handleSubmitCreate = async () => {
    if (!user || !selectedCustomer || !reason.trim()) { Alert.alert('Errore', 'Compila tutti i campi obbligatori'); return; }
    const retValid = retrieveCards.filter(c => c.product_id);
    const sendValid = sendCards.filter(c => c.product_id);
    if (retValid.length === 0 && sendValid.length === 0) { Alert.alert('Errore', 'Aggiungi almeno un prodotto da ritirare o da inviare'); return; }

    const items = [];
    const maxLen = Math.max(retValid.length, sendValid.length);
    for (let i = 0; i < maxLen; i++) {
      const ret = retValid[i]; const snd = sendValid[i];
      items.push({
        original_product_id: ret?.product_id || null,
        replacement_product_id: snd?.product_id || null,
        quantity: Math.max(ret?.quantity || 0, snd?.quantity || 0) || 1,
        original_quantity: ret ? ret.quantity : null,
        replacement_quantity: snd ? snd.quantity : null,
      });
    }

    try {
      setCreating(true);
      await createSubstitution({ customer_id: selectedCustomer.id, agent_id: user.id, reason: reason.trim(), notes: formNotes.trim() || undefined, items });
      Alert.alert('Successo', 'Richiesta di sostituzione creata');
      setShowCreate(false); loadData();
    } catch (e) { Alert.alert('Errore', 'Impossibile creare la sostituzione'); }
    finally { setCreating(false); }
  };

  const handleDelete = (sub: SubstitutionWithDetails) => {
    if (sub.status !== 'pending') return;
    Alert.alert('Elimina', `Vuoi eliminare ${sub.substitution_number}?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => { await deleteSubstitution(sub.id); loadData(); } },
    ]);
  };

  const openPicker = (type: 'retrieve' | 'send', idx: number) => { setPickerTarget({ type, idx }); setPickerSearch(''); setShowProductPicker(true); };
  const selectProduct = (productId: string) => {
    const { type, idx } = pickerTarget;
    if (type === 'retrieve') { const u = [...retrieveCards]; u[idx] = { ...u[idx], product_id: productId }; setRetrieveCards(u); }
    else { const u = [...sendCards]; u[idx] = { ...u[idx], product_id: productId }; setSendCards(u); }
    setShowProductPicker(false);
  };
  const filteredPicker = pickerSearch.length >= 2
    ? products.filter(p => { const q = pickerSearch.toLowerCase(); return p.name.toLowerCase().includes(q) || (p.short_description && p.short_description.toLowerCase().includes(q)) || (p.sku && p.sku.toLowerCase().includes(q)); }).slice(0, 50)
    : products.slice(0, 50);

  // ═══ RENDERS ═══

  const renderSubCard = ({ item: sub }: { item: SubstitutionWithDetails }) => {
    const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.pending;
    const hasOrig = sub.substitution_items?.some(i => i.original_product_id);
    const hasRepl = sub.substitution_items?.some(i => i.replacement_product_id);
    return (
      <TouchableOpacity style={st.card} onPress={() => setSelectedSub(sub)} activeOpacity={0.7}>
        <View style={st.cardHeader}>
          <Text style={st.cardNumber}>{sub.substitution_number}</Text>
          <View style={[st.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
            <Text style={[st.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <Text style={st.cardCustomer} numberOfLines={1}>{sub.customers?.business_name || 'N/D'}</Text>
        <View style={st.cardFooter}>
          <Text style={st.cardDate}>{new Date(sub.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {hasOrig && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}><Ionicons name="arrow-up-circle" size={12} color="#DC2626" /><Text style={{ fontSize: 10, color: '#DC2626', fontWeight: '600' }}>Ritiro</Text></View>}
            {hasRepl && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}><Ionicons name="arrow-down-circle" size={12} color="#059669" /><Text style={{ fontSize: 10, color: '#059669', fontWeight: '600' }}>Invio</Text></View>}
          </View>
          {sub.status === 'pending' && (
            <TouchableOpacity onPress={() => handleDelete(sub)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}><Ionicons name="trash-outline" size={16} color="#DC2626" /></TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Detail Modal ──
  const renderDetail = () => {
    if (!selectedSub) return null;
    const cfg = STATUS_CONFIG[selectedSub.status] || STATUS_CONFIG.pending;
    const items = selectedSub.substitution_items || [];
    const origItems = items.filter(i => i.original_product_id);
    const replItems = items.filter(i => i.replacement_product_id);
    const totalRet = origItems.reduce((s, i) => s + getProductPrice(i.original_product_id) * ((i.original_quantity ?? i.quantity) || 1), 0);
    const totalSnd = replItems.reduce((s, i) => s + getProductPrice(i.replacement_product_id) * ((i.replacement_quantity ?? i.quantity) || 1), 0);

    return (
      <Modal visible={!!selectedSub} animationType="slide" transparent onRequestClose={() => setSelectedSub(null)}>
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={st.modalHandle} />
            <ScrollView style={{ paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View><Text style={{ fontSize: 18, fontWeight: '800', color: '#1F2937' }}>{selectedSub.substitution_number}</Text>
                  <View style={[st.statusBadge, { backgroundColor: cfg.bg, marginTop: 4 }]}><Ionicons name={cfg.icon as any} size={12} color={cfg.color} /><Text style={[st.statusText, { color: cfg.color }]}>{cfg.label}</Text></View>
                </View>
                <TouchableOpacity onPress={() => setSelectedSub(null)} style={{ padding: 8 }}><Ionicons name="close" size={24} color="#6B7280" /></TouchableOpacity>
              </View>

              {/* Totals */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <View style={[st.totalBox, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}><Text style={{ fontSize: 10, fontWeight: '700', color: '#991B1B', textTransform: 'uppercase' }}>Ritiro</Text><Text style={{ fontSize: 18, fontWeight: '800', color: '#DC2626' }}>{formatCurrency(totalRet)}</Text></View>
                <View style={[st.totalBox, { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' }]}><Text style={{ fontSize: 10, fontWeight: '700', color: '#065F46', textTransform: 'uppercase' }}>Invio</Text><Text style={{ fontSize: 18, fontWeight: '800', color: '#059669' }}>{formatCurrency(totalSnd)}</Text></View>
              </View>

              <View style={st.infoCard}>
                <View style={st.infoRow}><Text style={st.infoLabel}>Cliente</Text><Text style={st.infoValue}>{selectedSub.customers?.business_name}</Text></View>
                <View style={st.infoRow}><Text style={st.infoLabel}>Data</Text><Text style={st.infoValue}>{new Date(selectedSub.created_at).toLocaleDateString('it-IT')}</Text></View>
                {selectedSub.reason && <View style={st.infoRow}><Text style={st.infoLabel}>Motivo</Text><Text style={st.infoValue}>{selectedSub.reason}</Text></View>}
                {selectedSub.notes && <View style={st.infoRow}><Text style={st.infoLabel}>Note</Text><Text style={st.infoValue}>{selectedSub.notes}</Text></View>}
                {selectedSub.admin_notes && <View style={[st.infoRow, { backgroundColor: '#FFF7ED' }]}><Text style={st.infoLabel}>Note Admin</Text><Text style={[st.infoValue, { color: '#EA580C' }]}>{selectedSub.admin_notes}</Text></View>}
              </View>

              {/* Workflow */}
              <View style={st.infoCard}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Stato Avanzamento</Text>
                <View style={st.wfRow}><Ionicons name={selectedSub.is_approved ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={selectedSub.is_approved ? '#059669' : '#D1D5DB'} /><Text style={[st.wfText, selectedSub.is_approved && st.wfDone]}>Approvata</Text></View>
                {replItems.length > 0 && <View style={st.wfRow}><Ionicons name={selectedSub.is_sent ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={selectedSub.is_sent ? '#059669' : '#D1D5DB'} /><Text style={[st.wfText, selectedSub.is_sent && st.wfDone]}>Merce sostitutiva inviata</Text></View>}
                {origItems.length > 0 && <View style={st.wfRow}><Ionicons name={selectedSub.is_returned ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={selectedSub.is_returned ? '#059669' : '#D1D5DB'} /><Text style={[st.wfText, selectedSub.is_returned && st.wfDone]}>Merce originale ritirata</Text></View>}
                {selectedSub.is_rejected && <View style={st.wfRow}><Ionicons name="close-circle" size={18} color="#DC2626" /><Text style={[st.wfText, { color: '#DC2626' }]}>Rifiutata</Text></View>}
              </View>

              {/* Retrieve items */}
              {origItems.length > 0 && (<>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#DC2626', marginTop: 8, marginBottom: 6 }}>Prodotti da Ritirare ({origItems.length})</Text>
                {origItems.map((it, i) => (
                  <View key={it.id || i} style={[st.itemCard, { borderLeftWidth: 3, borderLeftColor: '#DC2626' }]}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1F2937' }}>{it.original_product?.short_description || it.original_product?.name || 'N/D'}</Text>
                    <Text style={{ fontSize: 11, color: '#6B7280' }}>Qtà: {it.original_quantity ?? it.quantity} · {formatCurrency(getProductPrice(it.original_product_id))}/pz</Text>
                  </View>
                ))}
              </>)}

              {/* Send items */}
              {replItems.length > 0 && (<>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#059669', marginTop: 8, marginBottom: 6 }}>Prodotti da Inviare ({replItems.length})</Text>
                {replItems.map((it, i) => (
                  <View key={it.id || i} style={[st.itemCard, { borderLeftWidth: 3, borderLeftColor: '#059669' }]}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1F2937' }}>{it.replacement_product?.short_description || it.replacement_product?.name || 'N/D'}</Text>
                    <Text style={{ fontSize: 11, color: '#6B7280' }}>Qtà: {it.replacement_quantity ?? it.quantity} · {formatCurrency(getProductPrice(it.replacement_product_id))}/pz</Text>
                  </View>
                ))}
              </>)}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ── Product card renderer (used in steps 1 & 2 of wizard) ──
  const renderProductCards = (cards: ProductCard[], setCards: (c: ProductCard[]) => void, type: 'retrieve' | 'send') => {
    const color = type === 'retrieve' ? '#DC2626' : '#059669';
    return (<>
      {cards.map((card, idx) => (
        <View key={card.id} style={[st.itemFormCard, { borderLeftWidth: 3, borderLeftColor: color }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color }}>{type === 'retrieve' ? 'Ritiro' : 'Invio'} #{idx + 1}</Text>
            {cards.length > 1 && <TouchableOpacity onPress={() => setCards(cards.filter((_, i) => i !== idx))}><Ionicons name="close-circle" size={18} color="#DC2626" /></TouchableOpacity>}
          </View>
          <TouchableOpacity style={st.pickerBtn} onPress={() => openPicker(type, idx)}>
            <Text style={card.product_id ? { fontSize: 13, fontWeight: '600', color: '#1F2937', flex: 1 } : { fontSize: 13, color: '#9CA3AF', flex: 1 }} numberOfLines={1}>
              {card.product_id ? getProductName(card.product_id) : 'Seleziona prodotto...'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <Text style={{ fontSize: 12, color: '#6B7280' }}>Qtà:</Text>
            <TouchableOpacity style={st.qtyBtn} onPress={() => { const u = [...cards]; u[idx] = { ...u[idx], quantity: Math.max(1, card.quantity - 1) }; setCards(u); }}><Ionicons name="remove" size={16} color="#374151" /></TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1F2937', minWidth: 24, textAlign: 'center' }}>{card.quantity}</Text>
            <TouchableOpacity style={st.qtyBtn} onPress={() => { const u = [...cards]; u[idx] = { ...u[idx], quantity: card.quantity + 1 }; setCards(u); }}><Ionicons name="add" size={16} color="#374151" /></TouchableOpacity>
            {card.product_id && <Text style={{ fontSize: 12, color: '#6B7280', marginLeft: 'auto' }}>{formatCurrency(getProductPrice(card.product_id) * card.quantity)}</Text>}
          </View>
        </View>
      ))}
      <TouchableOpacity style={[st.addItemBtn, { borderColor: color + '50' }]} onPress={() => setCards([...cards, { id: nextCardId(), product_id: null, quantity: 1 }])}>
        <Ionicons name="add-circle-outline" size={16} color={color} />
        <Text style={{ color, fontWeight: '600', fontSize: 12 }}>Aggiungi prodotto</Text>
      </TouchableOpacity>
    </>);
  };

  // ── Create Wizard ──
  const STEPS = ['Cliente', 'Ritiro', 'Invio', 'Conferma'];
  const canNext = [!!selectedCustomer, true, true, reason.trim().length > 0];

  const renderCreateWizard = () => (
    <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, paddingTop: insets.top, backgroundColor: '#F3F4F6' }}>
        <View style={st.wizHeader}>
          <TouchableOpacity onPress={() => setShowCreate(false)} style={{ padding: 4 }}><Ionicons name="close" size={24} color="#FFF" /></TouchableOpacity>
          <Text style={st.wizTitle}>Nuova Sostituzione</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' }}>Step {createStep + 1}/4</Text>
        </View>
        <View style={st.stepIndicators}>
          {STEPS.map((label, i) => (<View key={i} style={[st.stepDot, createStep >= i && st.stepDotActive]}><Text style={[st.stepDotText, createStep >= i && st.stepDotTextActive]}>{i + 1}</Text></View>))}
        </View>

        {/* Value badges from step 1+ */}
        {createStep >= 1 && (
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
            <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#FEE2E2', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="arrow-up-circle" size={14} color="#DC2626" />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#991B1B' }}>Ritiro</Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#991B1B', marginTop: 2 }}>
                {totalRetrievePieces} {totalRetrievePieces === 1 ? 'pz' : 'pz'} · {formatCurrency(totalRetrieve)}
              </Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center', backgroundColor: '#D1FAE5', borderRadius: 10, paddingVertical: 6, paddingHorizontal: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="arrow-down-circle" size={14} color="#059669" />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#065F46' }}>Invio</Text>
              </View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#065F46', marginTop: 2 }}>
                {totalSendPieces} {totalSendPieces === 1 ? 'pz' : 'pz'} · {formatCurrency(totalSend)}
              </Text>
            </View>
          </View>
        )}

        <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
          {createStep === 0 && (<>
            <Text style={st.formLabel}>Seleziona Cliente</Text>
            <View style={st.searchBar}><Ionicons name="search" size={16} color="#9CA3AF" /><TextInput style={st.searchInput} placeholder="Cerca cliente..." value={customerSearch} onChangeText={setCustomerSearch} placeholderTextColor="#9CA3AF" /></View>
            {selectedCustomer && <View style={st.selectedPill}><Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: '#1E40AF' }}>{selectedCustomer.business_name}</Text><TouchableOpacity onPress={() => setSelectedCustomer(null)}><Ionicons name="close-circle" size={18} color="#1E40AF" /></TouchableOpacity></View>}
            <FlatList data={(customerSearch.length >= 2 ? customers.filter(c => c.business_name.toLowerCase().includes(customerSearch.toLowerCase())) : customers).slice(0, 30)} keyExtractor={c => c.id} scrollEnabled={false}
              renderItem={({ item: c }) => (<TouchableOpacity style={[st.listItem, selectedCustomer?.id === c.id && st.listItemSelected]} onPress={() => setSelectedCustomer(c)}><Text style={{ fontSize: 14, fontWeight: '600', color: '#1F2937' }}>{c.business_name}</Text><Text style={{ fontSize: 11, color: '#9CA3AF' }}>{c.city}{c.province ? ` (${c.province})` : ''}</Text></TouchableOpacity>)} />
          </>)}
          {createStep === 1 && (<>
            <Text style={st.formLabel}>Prodotti da Ritirare</Text>
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>Prodotti che verranno ritirati dal cliente (opzionale)</Text>
            {renderProductCards(retrieveCards, setRetrieveCards, 'retrieve')}
          </>)}
          {createStep === 2 && (<>
            <Text style={st.formLabel}>Prodotti da Inviare</Text>
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>Prodotti sostitutivi che verranno inviati al cliente (opzionale)</Text>
            {renderProductCards(sendCards, setSendCards, 'send')}
          </>)}
          {createStep === 3 && (<>
            <Text style={st.formLabel}>Motivo della sostituzione *</Text>
            <TextInput style={[st.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="Descrivi il motivo..." value={reason} onChangeText={setReason} multiline placeholderTextColor="#9CA3AF" />
            <Text style={[st.formLabel, { marginTop: 16 }]}>Note aggiuntive</Text>
            <TextInput style={[st.input, { minHeight: 60, textAlignVertical: 'top' }]} placeholder="Opzionale..." value={formNotes} onChangeText={setFormNotes} multiline placeholderTextColor="#9CA3AF" />
            <View style={[st.infoCard, { marginTop: 16 }]}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 }}>Riepilogo</Text>
              <Text style={{ fontSize: 13, color: '#1F2937' }}>Cliente: {selectedCustomer?.business_name}</Text>
              <Text style={{ fontSize: 13, color: '#DC2626', marginTop: 4 }}>Prodotti Ritiro: {retrieveCards.filter(c => c.product_id).length} · {formatCurrency(totalRetrieve)}</Text>
              <Text style={{ fontSize: 13, color: '#059669', marginTop: 2 }}>Prodotti Invio: {sendCards.filter(c => c.product_id).length} · {formatCurrency(totalSend)}</Text>
            </View>
          </>)}
        </ScrollView>

        <View style={[st.wizBottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {createStep > 0 && <TouchableOpacity style={st.wizBackBtn} onPress={() => setCreateStep(createStep - 1)}><Ionicons name="arrow-back" size={18} color="#374151" /><Text style={{ color: '#374151', fontWeight: '600' }}>Indietro</Text></TouchableOpacity>}
          <View style={{ flex: 1 }} />
          {createStep < 3 ? (
            <TouchableOpacity style={[st.wizNextBtn, !canNext[createStep] && { opacity: 0.4 }]} onPress={() => { Keyboard.dismiss(); setCreateStep(createStep + 1); }} disabled={!canNext[createStep]}>
              <Text style={{ color: '#FFF', fontWeight: '700' }}>Avanti</Text><Ionicons name="arrow-forward" size={18} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[st.wizSubmitBtn, !canNext[3] && { opacity: 0.4 }]} onPress={handleSubmitCreate} disabled={!canNext[3] || creating}>
              {creating ? <ActivityIndicator color="#FFF" /> : <><Ionicons name="checkmark-circle" size={18} color="#FFF" /><Text style={{ color: '#FFF', fontWeight: '700' }}>Crea Richiesta</Text></>}
            </TouchableOpacity>
          )}
        </View>

        {/* Product Picker nested INSIDE wizard modal (RN limitation: two sibling modals don't stack reliably) */}
        {renderProductPicker()}
      </KeyboardAvoidingView>
    </Modal>
  );

  // ── Product Picker ──
  const renderProductPicker = () => (
    <Modal visible={showProductPicker} animationType="slide" transparent onRequestClose={() => setShowProductPicker(false)}>
      <View style={st.modalOverlay}><View style={[st.modalContent, { paddingBottom: insets.bottom + 16 }]}>
        <View style={st.modalHandle} />
        <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 8 }}>Seleziona Prodotto</Text>
          <View style={st.searchBar}><Ionicons name="search" size={16} color="#9CA3AF" /><TextInput style={st.searchInput} placeholder="Cerca prodotto (min 2 car.)..." value={pickerSearch} onChangeText={setPickerSearch} placeholderTextColor="#9CA3AF" autoFocus /></View>
        </View>
        <FlatList data={filteredPicker} keyExtractor={p => p.id} style={{ maxHeight: 400 }}
          renderItem={({ item: p }) => (
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }} onPress={() => selectProduct(p.id)}>
              <View style={{ flex: 1 }}><Text style={{ fontSize: 13, fontWeight: '600', color: '#1F2937' }} numberOfLines={1}>{p.short_description || p.name}</Text>{p.sku && <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{p.sku}</Text>}</View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E40AF' }}>{p.unit_price != null ? formatCurrency(Number(p.unit_price)) : ''}</Text>
            </TouchableOpacity>
          )} />
        <TouchableOpacity style={{ padding: 16, alignItems: 'center' }} onPress={() => setShowProductPicker(false)}><Text style={{ color: '#6B7280', fontWeight: '600' }}>Annulla</Text></TouchableOpacity>
      </View></View>
    </Modal>
  );

  // ═══ MAIN ═══
  return (
    <View style={[st.container, { paddingTop: insets.top }]}>
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}><Ionicons name="arrow-back" size={24} color="#FFF" /></TouchableOpacity>
        <Text style={st.headerTitle}>Sostituzioni</Text>
        <TouchableOpacity onPress={openCreate} style={{ backgroundColor: '#FFF', borderRadius: 8, padding: 6 }}><Ionicons name="add" size={20} color="#1E40AF" /></TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <View style={st.searchBar}><Ionicons name="search" size={16} color="#9CA3AF" /><TextInput style={st.searchInput} placeholder="Cerca (min 3 car.)..." value={searchText} onChangeText={setSearchText} placeholderTextColor="#9CA3AF" />{searchText.length > 0 && <TouchableOpacity onPress={() => setSearchText('')}><Ionicons name="close-circle" size={16} color="#9CA3AF" /></TouchableOpacity>}</View>
        {/* Status filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          {STATUS_OPTS.map(opt => (
            <TouchableOpacity key={opt.value} onPress={() => setStatusFilter(opt.value)}
              style={[st.filterChip, statusFilter === opt.value && st.filterChipActive]}>
              <Text style={[st.filterChipText, statusFilter === opt.value && st.filterChipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#1E40AF" /></View> : (
        <FlashList data={filtered} renderItem={renderSubCard} keyExtractor={s => s.id} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} refreshing={refreshing} onRefresh={onRefresh}
          ListEmptyComponent={<View style={{ alignItems: 'center', marginTop: 60 }}><Ionicons name="swap-horizontal-outline" size={48} color="#D1D5DB" /><Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280', marginTop: 12 }}>Nessuna sostituzione</Text></View>} />
      )}

      {renderDetail()}
      {renderCreateWizard()}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1E40AF', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, fontSize: 13, color: '#1F2937' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#FFF', marginRight: 6, borderWidth: 1, borderColor: '#E5E7EB' },
  filterChipActive: { backgroundColor: '#1E40AF', borderColor: '#1E40AF' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  filterChipTextActive: { color: '#FFF' },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardNumber: { fontSize: 14, fontWeight: '800', color: '#1F2937' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardCustomer: { fontSize: 13, fontWeight: '600', color: '#374151' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  cardDate: { fontSize: 11, color: '#9CA3AF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHandle: { width: 36, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginVertical: 10 },
  totalBox: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1 },
  infoCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel: { fontSize: 12, color: '#6B7280', flex: 0.4 },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#1F2937', flex: 0.6, textAlign: 'right' },
  wfRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  wfText: { fontSize: 13, color: '#9CA3AF' },
  wfDone: { color: '#059669', fontWeight: '600' },
  itemCard: { backgroundColor: '#FFF', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#E5E7EB' },
  itemFormCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 12 },
  qtyBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', marginTop: 6 },
  wizHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1E40AF', paddingHorizontal: 16, paddingVertical: 12 },
  wizTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  stepIndicators: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: '#1E40AF' },
  stepDotText: { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
  stepDotTextActive: { color: '#FFF' },
  formLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  input: { backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1F2937' },
  selectedPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, borderWidth: 1, borderColor: '#BFDBFE' },
  listItem: { backgroundColor: '#FFF', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#E5E7EB' },
  listItemSelected: { borderColor: '#1E40AF', backgroundColor: '#EFF6FF' },
  wizBottom: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  wizBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 12 },
  wizNextBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1E40AF', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  wizSubmitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#059669', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
});
