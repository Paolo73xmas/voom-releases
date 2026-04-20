/**
 * Sostituzioni — Mobile optimized
 * List + Create (3-step wizard) + Detail modal
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert,
  ActivityIndicator, Modal, ScrollView, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { fetchSubstitutions, createSubstitution, deleteSubstitution, SubstitutionWithDetails } from '../lib/api/substitutions';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending: { label: 'In Attesa', color: '#92400E', bg: '#FEF3C7', icon: 'time-outline' },
  approved: { label: 'Approvata', color: '#065F46', bg: '#D1FAE5', icon: 'checkmark-circle-outline' },
  rejected: { label: 'Rifiutata', color: '#991B1B', bg: '#FEE2E2', icon: 'close-circle-outline' },
  completed: { label: 'Completata', color: '#1E40AF', bg: '#DBEAFE', icon: 'shield-checkmark-outline' },
};

interface Product { id: string; name: string; sku: string | null; short_description?: string; unit_price?: number | null }
interface Customer { id: string; business_name: string; city?: string; province?: string }
interface NewItem { original_product_id: string; replacement_product_id: string; original_quantity: number; replacement_quantity: number; notes: string }

const formatCurrency = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);

export default function SubstitutionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const [substitutions, setSubstitutions] = useState<SubstitutionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Create wizard
  const [showCreate, setShowCreate] = useState(false);
  const [createStep, setCreateStep] = useState(0); // 0=cliente, 1=articoli, 2=motivo+conferma
  const [creating, setCreating] = useState(false);

  // Create form
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [reason, setReason] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [items, setItems] = useState<NewItem[]>([
    { original_product_id: '', replacement_product_id: '', original_quantity: 1, replacement_quantity: 1, notes: '' },
  ]);

  // Product search for items
  const [productSearchKey, setProductSearchKey] = useState('');
  const [productSearchText, setProductSearchText] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);

  // Detail
  const [selectedSub, setSelectedSub] = useState<SubstitutionWithDetails | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await fetchSubstitutions(user.id);
      setSubstitutions(data);
    } catch (e) {
      console.error('[Substitutions] Error:', e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const loadCustomers = async () => {
    if (!user) return;
    const { data } = await supabase.from('customers').select('id, business_name, city, province')
      .eq('agent_id', user.id).order('business_name').limit(500);
    setCustomers(data || []);
  };

  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('id, name, sku, short_description, unit_price')
      .eq('is_active', true).order('name').limit(2000);
    setProducts(data || []);
  };

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const filtered = substitutions.filter(s => {
    if (!searchText.trim() || searchText.length < 3) return true;
    const q = searchText.toLowerCase();
    return (s.customers?.business_name?.toLowerCase().includes(q) || s.substitution_number?.toLowerCase().includes(q));
  });

  // ── Create wizard helpers ──
  const openCreate = () => {
    loadCustomers();
    loadProducts();
    setShowCreate(true);
    setCreateStep(0);
    resetForm();
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setReason('');
    setFormNotes('');
    setItems([{ original_product_id: '', replacement_product_id: '', original_quantity: 1, replacement_quantity: 1, notes: '' }]);
  };

  const getProductName = (id: string) => {
    const p = products.find(pr => pr.id === id);
    return p?.short_description || p?.name || '';
  };
  const getProductPrice = (id: string) => {
    const p = products.find(pr => pr.id === id);
    return p?.unit_price != null ? Number(p.unit_price) : 0;
  };

  const handleSubmitCreate = async () => {
    if (!user || !selectedCustomer || !reason.trim()) {
      Alert.alert('Errore', 'Compila tutti i campi obbligatori'); return;
    }
    const validItems = items.filter(i => i.original_product_id && i.replacement_product_id);
    if (validItems.length === 0) {
      Alert.alert('Errore', 'Aggiungi almeno un articolo da sostituire'); return;
    }
    for (const item of validItems) {
      if (item.original_product_id === item.replacement_product_id) {
        Alert.alert('Errore', 'Il prodotto originale e sostitutivo non possono essere uguali'); return;
      }
    }

    try {
      setCreating(true);
      await createSubstitution({
        customer_id: selectedCustomer.id,
        agent_id: user.id,
        reason: reason.trim(),
        notes: formNotes.trim() || undefined,
        items: validItems,
      });
      Alert.alert('Successo', 'Richiesta di sostituzione creata');
      setShowCreate(false);
      loadData();
    } catch (e) {
      Alert.alert('Errore', 'Impossibile creare la sostituzione');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = (sub: SubstitutionWithDetails) => {
    if (sub.status !== 'pending') { Alert.alert('Errore', 'Solo le sostituzioni in attesa possono essere eliminate'); return; }
    Alert.alert('Elimina', `Vuoi eliminare ${sub.substitution_number}?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: async () => { await deleteSubstitution(sub.id); loadData(); } },
    ]);
  };

  // ── Product picker ──
  const openProductPicker = (key: string) => {
    setProductSearchKey(key);
    setProductSearchText('');
    setShowProductPicker(true);
  };

  const selectProduct = (productId: string) => {
    const parts = productSearchKey.split('-');
    const idx = parseInt(parts[0]);
    const field = parts[1] === 'orig' ? 'original_product_id' : 'replacement_product_id';
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: productId };
    setItems(updated);
    setShowProductPicker(false);
  };

  const filteredPickerProducts = productSearchText.length >= 2
    ? products.filter(p => {
        const q = productSearchText.toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.short_description && p.short_description.toLowerCase().includes(q)) || (p.sku && p.sku.toLowerCase().includes(q));
      }).slice(0, 50)
    : products.slice(0, 50);

  // ═══ RENDER ═══

  const renderSubCard = ({ item: sub }: { item: SubstitutionWithDetails }) => {
    const cfg = STATUS_CONFIG[sub.status] || STATUS_CONFIG.pending;
    const itemCount = sub.substitution_items?.length || 0;
    return (
      <TouchableOpacity style={s.card} onPress={() => setSelectedSub(sub)} activeOpacity={0.7}>
        <View style={s.cardHeader}>
          <Text style={s.cardNumber}>{sub.substitution_number}</Text>
          <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
            <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <Text style={s.cardCustomer} numberOfLines={1}>{sub.customers?.business_name || 'N/D'}</Text>
        <View style={s.cardFooter}>
          <Text style={s.cardDate}>{new Date(sub.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
          <Text style={s.cardItems}>{itemCount} articol{itemCount === 1 ? 'o' : 'i'}</Text>
          {sub.status === 'pending' && (
            <TouchableOpacity onPress={() => handleDelete(sub)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="trash-outline" size={16} color="#DC2626" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Detail Modal ──
  const renderDetail = () => {
    if (!selectedSub) return null;
    const cfg = STATUS_CONFIG[selectedSub.status] || STATUS_CONFIG.pending;
    const detailItems = selectedSub.substitution_items || [];
    const totalRetire = detailItems.reduce((sum, i) => sum + getProductPrice(i.original_product_id) * (i.original_quantity || i.quantity || 1), 0);
    const totalSend = detailItems.reduce((sum, i) => sum + getProductPrice(i.replacement_product_id) * (i.replacement_quantity || i.quantity || 1), 0);

    return (
      <Modal visible={!!selectedSub} animationType="slide" transparent onRequestClose={() => setSelectedSub(null)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={s.modalHandle} />
            <ScrollView style={{ paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#1F2937' }}>{selectedSub.substitution_number}</Text>
                  <View style={[s.statusBadge, { backgroundColor: cfg.bg, marginTop: 4 }]}>
                    <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
                    <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => setSelectedSub(null)} style={{ padding: 8 }}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Totals */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                <View style={[s.totalBox, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#991B1B', textTransform: 'uppercase' }}>Ritiro</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#DC2626' }}>{formatCurrency(totalRetire)}</Text>
                </View>
                <View style={[s.totalBox, { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#065F46', textTransform: 'uppercase' }}>Invio</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#059669' }}>{formatCurrency(totalSend)}</Text>
                </View>
              </View>

              {/* Info */}
              <View style={s.infoCard}>
                <View style={s.infoRow}><Text style={s.infoLabel}>Cliente</Text><Text style={s.infoValue}>{selectedSub.customers?.business_name}</Text></View>
                <View style={s.infoRow}><Text style={s.infoLabel}>Data</Text><Text style={s.infoValue}>{new Date(selectedSub.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text></View>
                {selectedSub.reason && <View style={s.infoRow}><Text style={s.infoLabel}>Motivo</Text><Text style={s.infoValue}>{selectedSub.reason}</Text></View>}
                {selectedSub.notes && <View style={s.infoRow}><Text style={s.infoLabel}>Note</Text><Text style={s.infoValue}>{selectedSub.notes}</Text></View>}
                {selectedSub.admin_notes && <View style={[s.infoRow, { backgroundColor: '#FFF7ED' }]}><Text style={s.infoLabel}>Note Admin</Text><Text style={[s.infoValue, { color: '#EA580C' }]}>{selectedSub.admin_notes}</Text></View>}
              </View>

              {/* Workflow status */}
              <View style={s.infoCard}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Stato Avanzamento</Text>
                <View style={s.workflowRow}>
                  <Ionicons name={selectedSub.is_approved ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={selectedSub.is_approved ? '#059669' : '#D1D5DB'} />
                  <Text style={[s.workflowText, selectedSub.is_approved && s.workflowDone]}>Approvata</Text>
                </View>
                <View style={s.workflowRow}>
                  <Ionicons name={selectedSub.is_sent ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={selectedSub.is_sent ? '#059669' : '#D1D5DB'} />
                  <Text style={[s.workflowText, selectedSub.is_sent && s.workflowDone]}>Merce sostitutiva inviata</Text>
                </View>
                <View style={s.workflowRow}>
                  <Ionicons name={selectedSub.is_returned ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={selectedSub.is_returned ? '#059669' : '#D1D5DB'} />
                  <Text style={[s.workflowText, selectedSub.is_returned && s.workflowDone]}>Merce originale ritirata</Text>
                </View>
                {selectedSub.is_rejected && (
                  <View style={s.workflowRow}>
                    <Ionicons name="close-circle" size={18} color="#DC2626" />
                    <Text style={[s.workflowText, { color: '#DC2626' }]}>Rifiutata</Text>
                  </View>
                )}
              </View>

              {/* Items */}
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151', marginTop: 12, marginBottom: 8 }}>Articoli ({detailItems.length})</Text>
              {detailItems.map((item, idx) => (
                <View key={item.id || idx} style={s.itemCard}>
                  <View style={s.itemRow}>
                    <View style={[s.itemDot, { backgroundColor: '#DC2626' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemLabel}>Da ritirare</Text>
                      <Text style={s.itemProduct}>{item.original_product?.short_description || item.original_product?.name || 'N/D'}</Text>
                      <Text style={s.itemQty}>Qtà: {item.original_quantity || item.quantity || 1} · {formatCurrency(getProductPrice(item.original_product_id))}/pz</Text>
                    </View>
                  </View>
                  <Ionicons name="arrow-down" size={16} color="#9CA3AF" style={{ alignSelf: 'center', marginVertical: 4 }} />
                  <View style={s.itemRow}>
                    <View style={[s.itemDot, { backgroundColor: '#059669' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemLabel}>Da inviare</Text>
                      <Text style={s.itemProduct}>{item.replacement_product?.short_description || item.replacement_product?.name || 'N/D'}</Text>
                      <Text style={s.itemQty}>Qtà: {item.replacement_quantity || item.quantity || 1} · {formatCurrency(getProductPrice(item.replacement_product_id))}/pz</Text>
                    </View>
                  </View>
                  {item.notes && <Text style={s.itemNotes}>{item.notes}</Text>}
                </View>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  // ── Create Wizard Modal ──
  const renderCreateWizard = () => {
    const filteredCustomers = customerSearch.length >= 2
      ? customers.filter(c => c.business_name.toLowerCase().includes(customerSearch.toLowerCase()))
      : customers;

    const canAdvanceStep0 = !!selectedCustomer;
    const canAdvanceStep1 = items.some(i => i.original_product_id && i.replacement_product_id);
    const canSubmit = canAdvanceStep0 && canAdvanceStep1 && reason.trim().length > 0;

    return (
      <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, paddingTop: insets.top, backgroundColor: '#F3F4F6' }}>
          {/* Header */}
          <View style={s.wizHeader}>
            <TouchableOpacity onPress={() => setShowCreate(false)} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={s.wizTitle}>Nuova Sostituzione</Text>
            <Text style={s.wizStep}>Step {createStep + 1}/3</Text>
          </View>

          {/* Step indicators */}
          <View style={s.stepIndicators}>
            {['Cliente', 'Articoli', 'Conferma'].map((label, i) => (
              <View key={i} style={[s.stepDot, createStep >= i && s.stepDotActive]}>
                <Text style={[s.stepDotText, createStep >= i && s.stepDotTextActive]}>{i + 1}</Text>
              </View>
            ))}
          </View>

          {/* Value badges — visible from step 1 */}
          {createStep >= 1 && (() => {
            const totalRetire = items.reduce((sum, it) => sum + getProductPrice(it.original_product_id) * (it.original_quantity || 1), 0);
            const totalSend = items.reduce((sum, it) => sum + getProductPrice(it.replacement_product_id) * (it.replacement_quantity || 1), 0);
            return (
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FEE2E2', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 }}>
                  <Ionicons name="arrow-up-circle" size={16} color="#DC2626" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#991B1B' }}>Ritiro: {formatCurrency(totalRetire)}</Text>
                </View>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#D1FAE5', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10 }}>
                  <Ionicons name="arrow-down-circle" size={16} color="#059669" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#065F46' }}>Invio: {formatCurrency(totalSend)}</Text>
                </View>
              </View>
            );
          })()}

          <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
            {/* Step 0: Cliente */}
            {createStep === 0 && (
              <>
                <Text style={s.formLabel}>Seleziona Cliente</Text>
                <View style={s.searchBar}>
                  <Ionicons name="search" size={16} color="#9CA3AF" />
                  <TextInput style={s.searchInput} placeholder="Cerca cliente..." value={customerSearch} onChangeText={setCustomerSearch} placeholderTextColor="#9CA3AF" />
                </View>
                {selectedCustomer && (
                  <View style={s.selectedPill}>
                    <Text style={s.selectedPillText}>{selectedCustomer.business_name}</Text>
                    <TouchableOpacity onPress={() => setSelectedCustomer(null)}><Ionicons name="close-circle" size={18} color="#1E40AF" /></TouchableOpacity>
                  </View>
                )}
                <FlatList
                  data={filteredCustomers.slice(0, 30)}
                  keyExtractor={c => c.id}
                  renderItem={({ item: c }) => (
                    <TouchableOpacity style={[s.listItem, selectedCustomer?.id === c.id && s.listItemSelected]} onPress={() => setSelectedCustomer(c)}>
                      <Text style={s.listItemTitle}>{c.business_name}</Text>
                      <Text style={s.listItemSub}>{c.city}{c.province ? ` (${c.province})` : ''}</Text>
                    </TouchableOpacity>
                  )}
                  scrollEnabled={false}
                />
              </>
            )}

            {/* Step 1: Articoli */}
            {createStep === 1 && (
              <>
                <Text style={s.formLabel}>Articoli da sostituire</Text>
                {items.map((item, idx) => (
                  <View key={idx} style={s.itemFormCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151' }}>Articolo #{idx + 1}</Text>
                      {items.length > 1 && (
                        <TouchableOpacity onPress={() => setItems(items.filter((_, i) => i !== idx))}><Ionicons name="close-circle" size={20} color="#DC2626" /></TouchableOpacity>
                      )}
                    </View>

                    <Text style={s.miniLabel}>Prodotto da ritirare *</Text>
                    <TouchableOpacity style={s.pickerBtn} onPress={() => openProductPicker(`${idx}-orig`)}>
                      <Text style={item.original_product_id ? s.pickerBtnText : s.pickerBtnPlaceholder} numberOfLines={1}>
                        {item.original_product_id ? getProductName(item.original_product_id) : 'Seleziona prodotto originale...'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                    </TouchableOpacity>

                    <Text style={s.miniLabel}>Prodotto sostitutivo *</Text>
                    <TouchableOpacity style={s.pickerBtn} onPress={() => openProductPicker(`${idx}-repl`)}>
                      <Text style={item.replacement_product_id ? s.pickerBtnText : s.pickerBtnPlaceholder} numberOfLines={1}>
                        {item.replacement_product_id ? getProductName(item.replacement_product_id) : 'Seleziona prodotto sostitutivo...'}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color="#9CA3AF" />
                    </TouchableOpacity>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.miniLabel}>Qtà ritiro</Text>
                        <TextInput style={s.input} keyboardType="numeric" value={String(item.original_quantity)}
                          onChangeText={t => { const v = [...items]; v[idx] = { ...v[idx], original_quantity: parseInt(t) || 1 }; setItems(v); }} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.miniLabel}>Qtà invio</Text>
                        <TextInput style={s.input} keyboardType="numeric" value={String(item.replacement_quantity)}
                          onChangeText={t => { const v = [...items]; v[idx] = { ...v[idx], replacement_quantity: parseInt(t) || 1 }; setItems(v); }} />
                      </View>
                    </View>
                  </View>
                ))}
                <TouchableOpacity style={s.addItemBtn} onPress={() => setItems([...items, { original_product_id: '', replacement_product_id: '', original_quantity: 1, replacement_quantity: 1, notes: '' }])}>
                  <Ionicons name="add-circle-outline" size={18} color="#1E40AF" />
                  <Text style={{ color: '#1E40AF', fontWeight: '600', fontSize: 13 }}>Aggiungi Articolo</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Step 2: Motivo + Conferma */}
            {createStep === 2 && (
              <>
                <Text style={s.formLabel}>Motivo della sostituzione *</Text>
                <TextInput style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]} placeholder="Descrivi il motivo..." value={reason} onChangeText={setReason} multiline placeholderTextColor="#9CA3AF" />

                <Text style={[s.formLabel, { marginTop: 16 }]}>Note aggiuntive</Text>
                <TextInput style={[s.input, { minHeight: 60, textAlignVertical: 'top' }]} placeholder="Opzionale..." value={formNotes} onChangeText={setFormNotes} multiline placeholderTextColor="#9CA3AF" />

                {/* Riepilogo */}
                <View style={[s.infoCard, { marginTop: 16 }]}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 }}>Riepilogo</Text>
                  <Text style={s.infoValue}>Cliente: {selectedCustomer?.business_name}</Text>
                  <Text style={[s.infoValue, { marginTop: 4 }]}>Articoli: {items.filter(i => i.original_product_id && i.replacement_product_id).length}</Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* Bottom navigation */}
          <View style={[s.wizBottom, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {createStep > 0 && (
              <TouchableOpacity style={s.wizBackBtn} onPress={() => setCreateStep(createStep - 1)}>
                <Ionicons name="arrow-back" size={18} color="#374151" />
                <Text style={{ color: '#374151', fontWeight: '600' }}>Indietro</Text>
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }} />
            {createStep < 2 ? (
              <TouchableOpacity
                style={[s.wizNextBtn, !(createStep === 0 ? canAdvanceStep0 : canAdvanceStep1) && { opacity: 0.4 }]}
                onPress={() => { Keyboard.dismiss(); setCreateStep(createStep + 1); }}
                disabled={!(createStep === 0 ? canAdvanceStep0 : canAdvanceStep1)}
              >
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Avanti</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[s.wizSubmitBtn, !canSubmit && { opacity: 0.4 }]} onPress={handleSubmitCreate} disabled={!canSubmit || creating}>
                {creating ? <ActivityIndicator color="#FFF" /> : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#FFF" />
                    <Text style={{ color: '#FFF', fontWeight: '700' }}>Crea Richiesta</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

  // ── Product Picker Modal ──
  const renderProductPicker = () => (
    <Modal visible={showProductPicker} animationType="slide" transparent onRequestClose={() => setShowProductPicker(false)}>
      <View style={s.modalOverlay}>
        <View style={[s.modalContent, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.modalHandle} />
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1F2937', marginBottom: 8 }}>Seleziona Prodotto</Text>
            <View style={s.searchBar}>
              <Ionicons name="search" size={16} color="#9CA3AF" />
              <TextInput style={s.searchInput} placeholder="Cerca prodotto (min 2 car.)..." value={productSearchText} onChangeText={setProductSearchText} placeholderTextColor="#9CA3AF" autoFocus />
            </View>
          </View>
          <FlatList
            data={filteredPickerProducts}
            keyExtractor={p => p.id}
            renderItem={({ item: p }) => (
              <TouchableOpacity style={s.productPickerItem} onPress={() => selectProduct(p.id)}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#1F2937' }} numberOfLines={1}>{p.short_description || p.name}</Text>
                  {p.sku && <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{p.sku}</Text>}
                </View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E40AF' }}>{p.unit_price != null ? formatCurrency(Number(p.unit_price)) : ''}</Text>
              </TouchableOpacity>
            )}
            style={{ maxHeight: 400 }}
          />
          <TouchableOpacity style={{ padding: 16, alignItems: 'center' }} onPress={() => setShowProductPicker(false)}>
            <Text style={{ color: '#6B7280', fontWeight: '600' }}>Annulla</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ═══ MAIN ═══
  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Sostituzioni</Text>
        <TouchableOpacity onPress={openCreate} style={s.headerAddBtn}>
          <Ionicons name="add" size={20} color="#1E40AF" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
        <View style={s.searchBar}>
          <Ionicons name="search" size={16} color="#9CA3AF" />
          <TextInput style={s.searchInput} placeholder="Cerca sostituzione (min 3 car.)..." value={searchText} onChangeText={setSearchText} placeholderTextColor="#9CA3AF" />
          {searchText.length > 0 && <TouchableOpacity onPress={() => setSearchText('')}><Ionicons name="close-circle" size={16} color="#9CA3AF" /></TouchableOpacity>}
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#1E40AF" /></View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderSubCard}
          keyExtractor={s => s.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Ionicons name="swap-horizontal-outline" size={48} color="#D1D5DB" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7280', marginTop: 12 }}>Nessuna sostituzione</Text>
              <TouchableOpacity style={[s.wizNextBtn, { marginTop: 16 }]} onPress={openCreate}>
                <Ionicons name="add" size={18} color="#FFF" />
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Crea la prima</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {renderDetail()}
      {renderCreateWizard()}
      {renderProductPicker()}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1E40AF', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  headerAddBtn: { backgroundColor: '#FFF', borderRadius: 8, padding: 6 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  searchInput: { flex: 1, fontSize: 13, color: '#1F2937' },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardNumber: { fontSize: 14, fontWeight: '800', color: '#1F2937' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardCustomer: { fontSize: 13, fontWeight: '600', color: '#374151' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  cardDate: { fontSize: 11, color: '#9CA3AF' },
  cardItems: { fontSize: 11, color: '#6B7280', flex: 1 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  modalHandle: { width: 36, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginVertical: 10 },
  totalBox: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1 },
  infoCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel: { fontSize: 12, color: '#6B7280', flex: 0.4 },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#1F2937', flex: 0.6, textAlign: 'right' },
  workflowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  workflowText: { fontSize: 13, color: '#9CA3AF' },
  workflowDone: { color: '#059669', fontWeight: '600' },
  itemCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  itemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  itemLabel: { fontSize: 10, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' },
  itemProduct: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  itemQty: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  itemNotes: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', marginTop: 6 },

  // Wizard
  wizHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1E40AF', paddingHorizontal: 16, paddingVertical: 12 },
  wizTitle: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  wizStep: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  stepIndicators: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: '#1E40AF' },
  stepDotText: { fontSize: 12, fontWeight: '700', color: '#9CA3AF' },
  stepDotTextActive: { color: '#FFF' },
  formLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8 },
  miniLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1F2937' },
  selectedPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10, borderWidth: 1, borderColor: '#BFDBFE' },
  selectedPillText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1E40AF' },
  listItem: { backgroundColor: '#FFF', borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: '#E5E7EB' },
  listItemSelected: { borderColor: '#1E40AF', backgroundColor: '#EFF6FF' },
  listItemTitle: { fontSize: 14, fontWeight: '600', color: '#1F2937' },
  listItemSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  itemFormCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 12, paddingVertical: 12 },
  pickerBtnText: { fontSize: 13, fontWeight: '600', color: '#1F2937', flex: 1 },
  pickerBtnPlaceholder: { fontSize: 13, color: '#9CA3AF', flex: 1 },
  addItemBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF' },
  productPickerItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  wizBottom: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  wizBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 12 },
  wizNextBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1E40AF', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
  wizSubmitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#059669', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12 },
});
