import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import {
  getLeadById,
  updateLead,
  updateLeadStatus,
  getVisits,
  getSellUps,
  getFollowUps,
  createVisit,
  createSellUp,
  completeFollowUp,
} from '../../lib/api/laservideo';
import type {
  LaserVideoLead,
  LaserVideoVisit,
  LaserVideoSellUp,
  LaserVideoFollowUp,
  LaserVideoLeadStatus,
  LaserVideoVisitOutcome,
} from '../../types/laservideo';
import { LEAD_STATUS_CONFIG, KIT_CONFIG, VISIT_OUTCOME_CONFIG } from '../../types/laservideo';

type TabKey = 'info' | 'visite' | 'vendite' | 'followup';

export default function LaserVideoLeadDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuthStore();

  const [lead, setLead] = useState<LaserVideoLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('info');

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({ ragione_sociale: '', telefono: '', email: '', note: '' });

  // Sub data
  const [visits, setVisits] = useState<LaserVideoVisit[]>([]);
  const [sellUps, setSellUps] = useState<LaserVideoSellUp[]>([]);
  const [followUps, setFollowUps] = useState<LaserVideoFollowUp[]>([]);

  // Modals
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showNewVisit, setShowNewVisit] = useState(false);
  const [showNewSellUp, setShowNewSellUp] = useState(false);

  // New Visit form
  const [visitEsito, setVisitEsito] = useState<LaserVideoVisitOutcome>('positivo');
  const [visitNote, setVisitNote] = useState('');

  // New SellUp form
  const [sellUpImporto, setSellUpImporto] = useState('');
  const [sellUpDescrizione, setSellUpDescrizione] = useState('');

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      const [leadData, visitsData, sellUpsData, followUpsData] = await Promise.all([
        getLeadById(id),
        getVisits(id),
        getSellUps(id),
        getFollowUps(id),
      ]);
      setLead(leadData);
      setVisits(visitsData);
      setSellUps(sellUpsData);
      setFollowUps(followUpsData);
      if (leadData) {
        setEditData({
          ragione_sociale: leadData.ragione_sociale || '',
          telefono: leadData.telefono || '',
          email: leadData.email || '',
          note: leadData.note || '',
        });
      }
    } catch (err) {
      console.error('Error loading lead detail:', err);
      Alert.alert('Errore', 'Impossibile caricare i dati del lead');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleSaveEdit = async () => {
    if (!lead) return;
    setSaving(true);
    try {
      await updateLead(lead.id, {
        ragione_sociale: editData.ragione_sociale,
        telefono: editData.telefono || null,
        email: editData.email || null,
        note: editData.note || null,
      } as any);
      setLead({ ...lead, ...editData });
      setEditing(false);
      Alert.alert('Salvato', 'Lead aggiornato con successo');
    } catch (err) {
      console.error('Error saving lead:', err);
      Alert.alert('Errore', 'Impossibile salvare le modifiche');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: LaserVideoLeadStatus) => {
    if (!lead) return;
    try {
      await updateLeadStatus(lead.id, newStatus);
      setLead({ ...lead, stato: newStatus });
      setShowStatusPicker(false);
    } catch (err) {
      console.error('Error updating status:', err);
      Alert.alert('Errore', 'Impossibile aggiornare lo stato');
    }
  };

  const handleCreateVisit = async () => {
    if (!lead || !user) return;
    setSaving(true);
    try {
      const newVisit = await createVisit(
        { lead_id: lead.id, data_visita: new Date().toISOString(), esito: visitEsito, note: visitNote || undefined },
        user.id
      );
      setVisits([{ ...newVisit, agente: { id: user.id, full_name: 'Tu' } }, ...visits]);
      setShowNewVisit(false);
      setVisitNote('');
      setVisitEsito('positivo');
      // Refresh lead to get updated status
      const updatedLead = await getLeadById(lead.id);
      if (updatedLead) setLead(updatedLead);
    } catch (err) {
      console.error('Error creating visit:', err);
      Alert.alert('Errore', 'Impossibile registrare la visita');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSellUp = async () => {
    if (!lead) return;
    setSaving(true);
    try {
      const importo = parseFloat(sellUpImporto.replace(',', '.'));
      const newSellUp = await createSellUp({
        lead_id: lead.id,
        data_vendita: new Date().toISOString(),
        importo: isNaN(importo) ? undefined : importo,
        descrizione: sellUpDescrizione || undefined,
      });
      setSellUps([newSellUp, ...sellUps]);
      setShowNewSellUp(false);
      setSellUpImporto('');
      setSellUpDescrizione('');
      const updatedLead = await getLeadById(lead.id);
      if (updatedLead) setLead(updatedLead);
    } catch (err) {
      console.error('Error creating sellup:', err);
      Alert.alert('Errore', 'Impossibile registrare la vendita');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteFollowUp = async (followUpId: string) => {
    try {
      await completeFollowUp(followUpId);
      setFollowUps(followUps.map((f) => (f.id === followUpId ? { ...f, completato: true, data_completamento: new Date().toISOString() } : f)));
    } catch (err) {
      Alert.alert('Errore', 'Impossibile completare il follow-up');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!lead) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <Ionicons name="warning-outline" size={48} color="#EF4444" />
          <Text style={styles.errorText}>Lead non trovato</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.linkText}>Torna indietro</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const statusConf = LEAD_STATUS_CONFIG[lead.stato];
  const kitConf = lead.tipo_kit ? KIT_CONFIG[lead.tipo_kit] : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{lead.ragione_sociale}</Text>
          <Text style={styles.headerSub}>{lead.matricola}</Text>
        </View>
        {editing ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => setEditing(false)} style={styles.iconBtn}>
              <Ionicons name="close" size={22} color="#EF4444" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSaveEdit} style={styles.iconBtn} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#10B981" /> : <Ionicons name="checkmark" size={22} color="#10B981" />}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditing(true)} style={styles.iconBtn}>
            <Ionicons name="pencil" size={20} color="#3B82F6" />
          </TouchableOpacity>
        )}
      </View>

      {/* Status bar */}
      <TouchableOpacity style={styles.statusBar} onPress={() => setShowStatusPicker(true)} activeOpacity={0.7}>
        <View style={[styles.statusBadge, { backgroundColor: statusConf.bg }]}>
          <Text style={[styles.statusBadgeText, { color: statusConf.color }]}>{statusConf.label}</Text>
        </View>
        {kitConf && (
          <View style={[styles.statusBadge, { backgroundColor: kitConf.bg }]}>
            <Text style={[styles.statusBadgeText, { color: kitConf.color }]}>{kitConf.label}</Text>
          </View>
        )}
        {lead.tabaccheria?.denominazione && (
          <View style={[styles.statusBadge, { backgroundColor: '#ECFDF5' }]}>
            <Ionicons name="link" size={12} color="#059669" />
            <Text style={[styles.statusBadgeText, { color: '#059669', marginLeft: 4 }]}>{lead.tabaccheria.denominazione}</Text>
          </View>
        )}
        <Ionicons name="chevron-down" size={16} color="#9CA3AF" style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>

      {/* Tabs */}
      <View style={styles.tabs}>
        {([
          { key: 'info', label: 'Info', icon: 'information-circle-outline' },
          { key: 'visite', label: 'Visite', icon: 'walk-outline', count: visits.length },
          { key: 'vendite', label: 'Vendite', icon: 'cart-outline', count: sellUps.length },
          { key: 'followup', label: 'Follow-up', icon: 'alarm-outline', count: followUps.filter((f) => !f.completato).length },
        ] as { key: TabKey; label: string; icon: any; count?: number }[]).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons name={tab.icon} size={18} color={activeTab === tab.key ? '#1E40AF' : '#9CA3AF'} />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            {tab.count !== undefined && tab.count > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{tab.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* INFO TAB */}
          {activeTab === 'info' && (
            <View>
              {/* Main info card */}
              <View style={styles.infoCard}>
                <Text style={styles.sectionTitle}>Informazioni Lead</Text>
                <InfoRow label="Ragione Sociale" value={editing ? undefined : lead.ragione_sociale} editing={editing}
                  editValue={editData.ragione_sociale} onEditChange={(v) => setEditData({ ...editData, ragione_sociale: v })} />
                <InfoRow label="Matricola" value={lead.matricola} />
                <InfoRow label="Comune" value={`${lead.comune || '-'}${lead.provincia ? ` (${lead.provincia})` : ''}`} />
                <InfoRow label="Indirizzo" value={lead.indirizzo || '-'} />
                <InfoRow label="CAP" value={lead.cap || '-'} />
              </View>

              {/* Contact card */}
              <View style={styles.infoCard}>
                <Text style={styles.sectionTitle}>Contatti</Text>
                <InfoRow label="Telefono" value={editing ? undefined : lead.telefono || '-'} editing={editing}
                  editValue={editData.telefono} onEditChange={(v) => setEditData({ ...editData, telefono: v })}
                  action={lead.telefono ? () => Linking.openURL(`tel:${lead.telefono}`) : undefined} actionIcon="call-outline" />
                <InfoRow label="Email" value={editing ? undefined : lead.email || '-'} editing={editing}
                  editValue={editData.email} onEditChange={(v) => setEditData({ ...editData, email: v })}
                  action={lead.email ? () => Linking.openURL(`mailto:${lead.email}`) : undefined} actionIcon="mail-outline" />
              </View>

              {/* Fiscal card */}
              <View style={styles.infoCard}>
                <Text style={styles.sectionTitle}>Dati Fiscali</Text>
                <InfoRow label="Codice Fiscale" value={lead.codice_fiscale || '-'} />
                <InfoRow label="Partita IVA" value={lead.partita_iva || '-'} />
                <InfoRow label="Codice SDI" value={lead.codice_sdi || '-'} />
              </View>

              {/* Dates card */}
              <View style={styles.infoCard}>
                <Text style={styles.sectionTitle}>Date</Text>
                <InfoRow label="Installazione" value={formatDate(lead.data_installazione)} />
                <InfoRow label="Appuntamento" value={formatDate(lead.data_appuntamento || null)} />
                <InfoRow label="Ultimo contatto" value={formatDate(lead.data_ultimo_contatto)} />
                <InfoRow label="Conversione" value={formatDate(lead.data_conversione)} />
              </View>

              {/* Notes */}
              <View style={styles.infoCard}>
                <Text style={styles.sectionTitle}>Note</Text>
                {editing ? (
                  <TextInput
                    style={styles.noteInput}
                    value={editData.note}
                    onChangeText={(v) => setEditData({ ...editData, note: v })}
                    multiline
                    placeholder="Aggiungi note..."
                    placeholderTextColor="#9CA3AF"
                  />
                ) : (
                  <Text style={styles.noteText}>{lead.note || 'Nessuna nota'}</Text>
                )}
              </View>
            </View>
          )}

          {/* VISITE TAB */}
          {activeTab === 'visite' && (
            <View>
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowNewVisit(true)}>
                <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                <Text style={styles.addBtnText}>Registra Visita</Text>
              </TouchableOpacity>

              {visits.length === 0 ? (
                <View style={styles.emptySection}>
                  <Ionicons name="walk-outline" size={40} color="#D1D5DB" />
                  <Text style={styles.emptyText}>Nessuna visita registrata</Text>
                </View>
              ) : (
                visits.map((v) => {
                  const esitoConf = v.esito ? VISIT_OUTCOME_CONFIG[v.esito] : null;
                  return (
                    <View key={v.id} style={styles.activityCard}>
                      <View style={styles.activityHeader}>
                        <Text style={styles.activityDate}>{formatDateTime(v.data_visita)}</Text>
                        {esitoConf && (
                          <View style={[styles.smallBadge, { backgroundColor: esitoConf.bg }]}>
                            <Text style={[styles.smallBadgeText, { color: esitoConf.color }]}>{esitoConf.label}</Text>
                          </View>
                        )}
                      </View>
                      {v.agente?.full_name && (
                        <Text style={styles.activityAgent}>Agente: {v.agente.full_name}</Text>
                      )}
                      {v.note && <Text style={styles.activityNote}>{v.note}</Text>}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* VENDITE TAB */}
          {activeTab === 'vendite' && (
            <View>
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowNewSellUp(true)}>
                <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                <Text style={styles.addBtnText}>Registra Vendita</Text>
              </TouchableOpacity>

              {sellUps.length === 0 ? (
                <View style={styles.emptySection}>
                  <Ionicons name="cart-outline" size={40} color="#D1D5DB" />
                  <Text style={styles.emptyText}>Nessuna vendita registrata</Text>
                </View>
              ) : (
                sellUps.map((s) => (
                  <View key={s.id} style={styles.activityCard}>
                    <View style={styles.activityHeader}>
                      <Text style={styles.activityDate}>{formatDateTime(s.data_vendita)}</Text>
                      {s.importo !== null && s.importo !== undefined && (
                        <Text style={styles.sellUpAmount}>{'\u20AC'}{s.importo.toFixed(2)}</Text>
                      )}
                    </View>
                    {s.descrizione && <Text style={styles.activityNote}>{s.descrizione}</Text>}
                    {s.note && <Text style={styles.activityNote}>{s.note}</Text>}
                  </View>
                ))
              )}
            </View>
          )}

          {/* FOLLOWUP TAB */}
          {activeTab === 'followup' && (
            <View>
              {followUps.length === 0 ? (
                <View style={styles.emptySection}>
                  <Ionicons name="alarm-outline" size={40} color="#D1D5DB" />
                  <Text style={styles.emptyText}>Nessun follow-up</Text>
                </View>
              ) : (
                followUps.map((f) => {
                  const isPast = new Date(f.data_scadenza) < new Date() && !f.completato;
                  return (
                    <View key={f.id} style={[styles.activityCard, isPast && styles.overdueBorder]}>
                      <View style={styles.activityHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.activityDate, isPast && { color: '#EF4444' }]}>
                            {formatDate(f.data_scadenza)} {isPast ? '(scaduto)' : ''}
                          </Text>
                          <Text style={styles.followUpType}>{f.tipo}</Text>
                        </View>
                        {!f.completato ? (
                          <TouchableOpacity
                            style={styles.completeBtn}
                            onPress={() => handleCompleteFollowUp(f.id)}
                          >
                            <Ionicons name="checkmark-circle" size={28} color="#10B981" />
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.completedBadge}>
                            <Ionicons name="checkmark" size={14} color="#059669" />
                            <Text style={styles.completedText}>Fatto</Text>
                          </View>
                        )}
                      </View>
                      {f.descrizione && <Text style={styles.activityNote}>{f.descrizione}</Text>}
                    </View>
                  );
                })
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Status Picker Modal */}
      <Modal visible={showStatusPicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowStatusPicker(false)}>
          <Pressable style={styles.pickerModal} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Cambia Stato</Text>
            {(Object.keys(LEAD_STATUS_CONFIG) as LaserVideoLeadStatus[]).map((s) => {
              const conf = LEAD_STATUS_CONFIG[s];
              const isActive = lead.stato === s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.statusOption, isActive && styles.statusOptionActive]}
                  onPress={() => handleStatusChange(s)}
                >
                  <View style={[styles.statusDot, { backgroundColor: conf.color }]} />
                  <Text style={[styles.statusOptionText, isActive && { fontWeight: '700', color: '#1E40AF' }]}>{conf.label}</Text>
                  {isActive && <Ionicons name="checkmark" size={18} color="#1E40AF" />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      {/* New Visit Modal */}
      <Modal visible={showNewVisit} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowNewVisit(false)}>
          <Pressable style={styles.formModal} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Nuova Visita</Text>

            <Text style={styles.formLabel}>Esito</Text>
            <View style={styles.esitoRow}>
              {(Object.keys(VISIT_OUTCOME_CONFIG) as LaserVideoVisitOutcome[]).map((e) => {
                const conf = VISIT_OUTCOME_CONFIG[e];
                const isActive = visitEsito === e;
                return (
                  <TouchableOpacity
                    key={e}
                    style={[styles.esitoChip, isActive && { backgroundColor: conf.bg, borderColor: conf.color, borderWidth: 1 }]}
                    onPress={() => setVisitEsito(e)}
                  >
                    <Text style={[styles.esitoChipText, isActive && { color: conf.color, fontWeight: '700' }]}>{conf.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.formLabel}>Note (opzionale)</Text>
            <TextInput
              style={styles.formInput}
              value={visitNote}
              onChangeText={setVisitNote}
              multiline
              placeholder="Dettagli della visita..."
              placeholderTextColor="#9CA3AF"
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateVisit} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Registra Visita</Text>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* New SellUp Modal */}
      <Modal visible={showNewSellUp} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowNewSellUp(false)}>
          <Pressable style={styles.formModal} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Nuova Vendita</Text>

            <Text style={styles.formLabel}>Importo ({'\u20AC'})</Text>
            <TextInput
              style={styles.formInputSingle}
              value={sellUpImporto}
              onChangeText={setSellUpImporto}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.formLabel}>Descrizione (opzionale)</Text>
            <TextInput
              style={styles.formInput}
              value={sellUpDescrizione}
              onChangeText={setSellUpDescrizione}
              multiline
              placeholder="Dettagli della vendita..."
              placeholderTextColor="#9CA3AF"
            />

            <TouchableOpacity style={styles.submitBtn} onPress={handleCreateSellUp} disabled={saving}>
              {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.submitBtnText}>Registra Vendita</Text>}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// Reusable InfoRow component
function InfoRow({ label, value, editing, editValue, onEditChange, action, actionIcon }: {
  label: string;
  value?: string;
  editing?: boolean;
  editValue?: string;
  onEditChange?: (v: string) => void;
  action?: () => void;
  actionIcon?: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueRow}>
        {editing && onEditChange ? (
          <TextInput
            style={styles.infoEdit}
            value={editValue}
            onChangeText={onEditChange}
            placeholder={label}
            placeholderTextColor="#D1D5DB"
          />
        ) : (
          <Text style={styles.infoValue} numberOfLines={2}>{value || '-'}</Text>
        )}
        {action && actionIcon && !editing && (
          <TouchableOpacity onPress={action} style={styles.actionBtn}>
            <Ionicons name={actionIcon as any} size={18} color="#3B82F6" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { fontSize: 16, color: '#EF4444', marginTop: 12 },
  linkText: { fontSize: 14, color: '#3B82F6', marginTop: 8 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  headerSub: { fontSize: 12, color: '#6B7280', marginTop: 1 },
  iconBtn: { padding: 8 },

  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  statusBadgeText: { fontSize: 12, fontWeight: '600' },

  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#1E40AF' },
  tabText: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  tabTextActive: { color: '#1E40AF', fontWeight: '600' },
  tabBadge: { backgroundColor: '#EF4444', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  tabBadgeText: { fontSize: 9, color: '#FFFFFF', fontWeight: '700' },

  body: { flex: 1 },
  bodyContent: { padding: 16, paddingBottom: 32 },

  // Info card
  infoCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  infoLabel: { width: 110, fontSize: 13, color: '#6B7280', fontWeight: '500' },
  infoValueRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  infoValue: { flex: 1, fontSize: 14, color: '#1F2937' },
  infoEdit: { flex: 1, fontSize: 14, color: '#1F2937', borderBottomWidth: 1, borderBottomColor: '#3B82F6', paddingVertical: 4 },
  actionBtn: { padding: 6 },

  noteInput: { fontSize: 14, color: '#1F2937', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top' },
  noteText: { fontSize: 14, color: '#4B5563', lineHeight: 20 },

  // Activity cards
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  addBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  activityCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, marginBottom: 10 },
  overdueBorder: { borderLeftWidth: 3, borderLeftColor: '#EF4444' },
  activityHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  activityDate: { fontSize: 13, fontWeight: '600', color: '#1F2937' },
  activityAgent: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  activityNote: { fontSize: 13, color: '#4B5563', marginTop: 4, lineHeight: 18 },
  smallBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  smallBadgeText: { fontSize: 11, fontWeight: '600' },
  sellUpAmount: { fontSize: 16, fontWeight: '700', color: '#059669' },

  followUpType: { fontSize: 12, color: '#6B7280', marginTop: 2, textTransform: 'capitalize' },
  completeBtn: { padding: 4 },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  completedText: { fontSize: 11, color: '#059669', fontWeight: '600' },

  emptySection: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, color: '#9CA3AF', marginTop: 8 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalHandle: { width: 36, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 16 },
  pickerModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '70%',
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  statusOptionActive: { backgroundColor: '#EFF6FF' },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  statusOptionText: { flex: 1, fontSize: 15, color: '#4B5563' },

  formModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  formLabel: { fontSize: 13, fontWeight: '600', color: '#4B5563', marginBottom: 8, marginTop: 12 },
  formInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  formInputSingle: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  esitoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  esitoChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
  esitoChipText: { fontSize: 13, color: '#4B5563' },
  submitBtn: {
    backgroundColor: '#1E40AF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  submitBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
