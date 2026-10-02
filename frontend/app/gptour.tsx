import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, TextInput, Modal, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { DS } from '../lib/theme';
import { canUseGptour, normalizeGptourAgents } from '../lib/aitour/gptour-auth';
import { useGptour } from '../hooks/useGptour';
import { candidateMatchesTourIntent } from '../lib/aitour/gptour-criteria';
import { IdentitySet } from '../lib/aitour/gptour-identity';
import { GptButton, GptIcon, GptNotice, GptCriteria, ui } from '../components/aitour/gptour/UI';
import { GptThread, GptComposer } from '../components/aitour/gptour/Conversation';
import { GptFollowUps, GptRescheduleModal } from '../components/aitour/gptour/FollowUps';
import { GptPlan } from '../components/aitour/gptour/Plan';

export default function GptourScreen() {
  const user = useAuthStore((s) => s.user), router = useRouter(), insets = useSafeAreaInsets();
  const sessionLoading = useAuthStore((s) => s.isLoading);
  if (sessionLoading) return <View testID="gptour-session-loading" style={[ui.screen, ui.content, { justifyContent: 'center' }]}><ActivityIndicator color={DS.brand} /></View>;
  if (!user || !canUseGptour(user.role)) return <View style={[ui.screen, ui.content, { paddingTop: insets.top + 24 }]}><GptNotice id="gptour-forbidden" text="Il tuo ruolo non è abilitato a GPTour (403)." error /><GptButton id="gptour-forbidden-back" label="Torna indietro" onPress={() => router.back()} /></View>;
  return <GptourAllowed key={user.id} actor={{ id: user.id, role: user.role, name: user.fullName }} />;
}

function GptourAllowed({ actor }: { actor: { id: string; role: string; name: string } }) {
  const [agentId, setAgentId] = useState(actor.id), [agents, setAgents] = useState<{ id: string; full_name: string }[]>([]);
  const [localError, setLocalError] = useState(''), [gpsBusy, setGpsBusy] = useState(false), [settingsOpen, setSettingsOpen] = useState(false), [draft, setDraft] = useState('');
  const [agentError, setAgentError] = useState(''), [agentRefresh, setAgentRefresh] = useState(0), [agentSearch, setAgentSearch] = useState('');
  const router = useRouter(), insets = useSafeAreaInsets(), isAdmin = actor.role === 'admin' || actor.role === 'admincustom';
  const agentName = isAdmin ? agents.find((a) => a.id === agentId)?.full_name || actor.name : actor.name;
  const g = useGptour(actor, isAdmin ? agentId : actor.id, agentName);
  // La chat cresce verso il basso: dopo ogni risposta o ricostruzione si va in fondo (come il web).
  const scrollRef = useRef<ScrollView>(null), [follow, setFollow] = useState(false);
  useEffect(() => { if (!g.busy && follow) { setFollow(false); scrollRef.current?.scrollToEnd({ animated: true }); } }, [g.busy, follow]);
  useEffect(() => { if (g.messages.length) scrollRef.current?.scrollToEnd({ animated: true }); }, [g.messages.length]);
  const track = <T,>(fn: T): T => { setFollow(true); return fn; };
  useEffect(() => { if (!isAdmin) return; let active = true;
    supabase.from('profiles').select('id,full_name').in('role', ['agent', 'agentcustom']).order('full_name').then(({ data, error }) => {
      if (!active) return;
      try { if (error) throw new Error('Elenco agenti non disponibile.'); setAgents(normalizeGptourAgents(data)); setAgentError(''); }
      catch (e) { setAgents([]); setAgentError(e instanceof Error ? e.message : 'Elenco agenti non disponibile.'); }
    }); return () => { active = false; };
  }, [isAdmin, agentRefresh]);
  const addable = useMemo(() => { const present = IdentitySet.from(g.days.flatMap((d) => d.plan.stops.map((s) => s.candidate)));
    return g.pool?.candidates.filter((c) => !present.has(c) && candidateMatchesTourIntent(c, g.intent)) || [];
  }, [g.pool, g.days, g.intent]);
  const locate = async () => { setGpsBusy(true); setLocalError('');
    try { const p = await Location.requestForegroundPermissionsAsync(); if (!p.granted) throw new Error('Permesso GPS negato. Scegli Casa o Sede.');
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      pickHome({ lat: location.coords.latitude, lng: location.coords.longitude, label: 'Posizione GPS' });
    } catch (e) { setLocalError(e instanceof Error ? e.message : 'GPS non disponibile.'); } finally { setGpsBusy(false); }
  };
  const draftUsed = useCallback(() => setDraft(''), []);
  const composerDisabled = !!g.saved.length || g.uncertainSave || g.loading || !g.pool;
  const baseLocked = g.busy || !!g.days.length;
  const pickHome = (point: { lat: number; lng: number; label: string }) => { g.setHome(point); setLocalError(''); setSettingsOpen(false); };
  const baseButtons = <View style={ui.wrap}>
    {g.settings.home_lat != null && g.settings.home_lng != null && <GptButton id="gptour-home" label="Casa" small icon="home-outline" disabled={baseLocked} onPress={() => pickHome({ lat: g.settings.home_lat!, lng: g.settings.home_lng!, label: g.settings.home_address || 'Casa' })} />}
    {g.settings.office_lat != null && g.settings.office_lng != null && <GptButton id="gptour-office" label="Sede" small icon="business-outline" disabled={baseLocked} onPress={() => pickHome({ lat: g.settings.office_lat!, lng: g.settings.office_lng!, label: g.settings.office_address || 'Sede' })} />}
    <GptButton id="gptour-gps" label={gpsBusy ? 'Rilevamento…' : 'Usa GPS'} small icon="locate-outline" disabled={gpsBusy || baseLocked} onPress={locate} />
  </View>;
  const sendOrAskBase = (text: string) => {
    if (g.home) return track(g.send)(text);
    // Senza base non si costruisce nulla: il testo resta nel campo e si apre la scelta della base.
    setDraft(text); setLocalError('Scegli la base di partenza (Casa, Sede o GPS) per costruire il giro.'); setSettingsOpen(true);
    return Promise.resolve();
  };
  return <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    {/* Intestazione compatta */}
    <View style={[ui.row, { paddingTop: insets.top + 6, paddingHorizontal: 8, paddingBottom: 6, backgroundColor: DS.surface, borderBottomWidth: 1, borderBottomColor: DS.border }]}>
      <GptIcon id="gptour-back" icon="chevron-back" label="Torna ad AI Tour" onPress={() => router.back()} />
      <View style={ui.flex}>
        <Text testID="gptour-title" style={ui.title}>GPTour</Text>
        <Text testID="gptour-pool-count" style={ui.muted} numberOfLines={1}>{g.loading ? 'Carico portafoglio e territorio…' : g.pool ? `${isAdmin ? agentName + ' · ' : ''}${g.pool.candidates.length} clienti${g.pool.complete ? '' : ' · copertura parziale'} · ${g.home?.label || 'base da scegliere'}` : 'Portafoglio non caricato'}</Text>
      </View>
      <GptIcon id="gptour-settings" icon="options-outline" label="Base, orari e agente" onPress={() => setSettingsOpen(true)} disabled={g.loading} />
      <GptIcon id="gptour-reset" icon="refresh-outline" label="Nuovo giro" onPress={() => { void g.reset(); }} disabled={g.busy || g.uncertainSave || g.loading} />
    </View>
    <ScrollView ref={scrollRef} testID="gptour-screen" keyboardShouldPersistTaps="handled" contentContainerStyle={[ui.content, { paddingTop: 12, paddingBottom: 16 }]}>
      {!!(g.error || localError) && <GptNotice id="gptour-error" text={g.error || localError} error />}
      {g.loading ? <View testID="gptour-pool-loading" style={[ui.card, ui.row]}><ActivityIndicator color={DS.brand} /><Text style={ui.small}>Carico portafoglio, territorio e statistiche…</Text></View>
        : !g.pool ? <GptButton id="gptour-retry-load" label="Riprova caricamento" onPress={g.retryLoad} /> : <>
        {!g.pool.complete && <GptNotice id="gptour-pool-partial" text={`Pool parziale: “tutti” significa tutti gli idonei disponibili, non l’intero CRM. ${g.pool.warnings.join(' ')}`} />}
        {!g.home && <GptNotice id="gptour-base-missing" text="Scegli la base di partenza (Casa, Sede o GPS) dalle impostazioni in alto a destra prima di chiedere il giro." />}
        <GptCriteria intent={g.intent} />
        <GptThread messages={g.messages} busy={g.busy} onSuggest={setDraft} />
        <GptFollowUps pending={g.pending} busy={g.busy} decide={(e, a) => track(g.decide)(e, a)} decideAll={(a) => track(g.decideAll)(a)} onReschedule={g.setReschedule} />
        {(g.draftAvailable || (g.stale && !!g.days.length)) && <GptNotice id="gptour-stale" text="Piano precedente o bozza: ricostruisci con i dati aggiornati prima di salvare." />}
        {(g.draftAvailable || (g.stale && !!g.days.length)) && !g.pending.length && <GptButton id="gptour-rebuild" label="Ricostruisci piano / riprendi bozza" small icon="construct-outline" disabled={g.busy || !g.home} onPress={() => track(g.rebuild)()} />}
        <GptPlan days={g.days} selected={g.activeDay} busy={g.busy} locked={g.stale || !!g.saved.length || g.uncertainSave} proposal={g.proposal} addable={addable} choose={g.chooseDay} edit={g.edit} accept={() => track(g.acceptProposal)()} reject={g.rejectProposal} />
        {!!g.saved.length && <View style={ui.card}><GptNotice id="gptour-save-success" text={`${g.saved.length === 1 ? 'Giro salvato' : `${g.saved.length} giornate salvate`} in I miei Tour: avvialo dal normale Tour Live.`} /><GptButton id="gptour-open-saved" label="Apri I miei Tour" primary onPress={() => router.navigate({ pathname: '/ai-tour', params: { gptourAgentId: agentId, tab: 'tours' } })} /></View>}
      </>}
    </ScrollView>
    {/* Barra fissa in basso: salvataggio + scrittura */}
    <View style={{ paddingHorizontal: 10, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 10), gap: 8, backgroundColor: DS.surface, borderTopWidth: 1, borderTopColor: DS.border }}>
      {(!!g.days.length || g.uncertainSave) && !g.saved.length && <GptButton id="gptour-save" label={g.uncertainSave ? 'Verifica salvataggio' : g.days.length > 1 ? `Salva ${g.days.length} giornate` : 'Salva giro'} icon="save-outline" primary disabled={g.busy || (g.stale && !g.uncertainSave)} onPress={() => track(g.save)()} />}
      {!g.home && !!g.pool && !g.loading && !settingsOpen && <View style={ui.row}><Ionicons name="navigate-circle-outline" size={18} color={DS.warning} /><Text style={[ui.muted, ui.flex]}>Base di partenza mancante:</Text>{baseButtons}</View>}
      <GptComposer candidates={g.pool?.candidates || []} busy={g.busy} disabled={composerDisabled} draft={draft} onDraftUsed={draftUsed} onSend={sendOrAskBase} />
    </View>
    {/* Foglio impostazioni: base, orari, buffer, agente (admin) */}
    <Modal visible={settingsOpen} transparent animationType="slide" onRequestClose={() => setSettingsOpen(false)} testID="gptour-settings-sheet">
      <KeyboardAvoidingView style={ui.sheetBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={ui.flex} onPress={() => setSettingsOpen(false)} accessibilityLabel="Chiudi" />
        <View style={ui.sheet}><View style={ui.grabber} />
          <View style={ui.row}><Text style={[ui.heading, ui.flex]}>Base e orari</Text><GptIcon id="gptour-settings-close" icon="close" label="Chiudi" onPress={() => setSettingsOpen(false)} /></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12 }}>
            {!!localError && <GptNotice id="gptour-sheet-error" text={localError} error />}
            <Text testID="gptour-base" style={ui.small}>Partenza: {g.home?.label || 'nessuna base scelta (nessuna posizione viene inventata)'}</Text>
            {baseButtons}
            {!!g.days.length && <Text style={ui.muted}>Base e buffer si cambiano prima di costruire il giro: con “Nuovo giro” tornano modificabili.</Text>}
            <Text style={ui.muted}>Orario di lavoro {g.settings.work_start}–{g.settings.work_end}, pausa {g.settings.lunch_break_minutes} min. Puoi chiedere orari diversi in chat.</Text>
            <View style={ui.row}>
              <View style={ui.flex}><Text style={ui.small}>Tempo libero massimo a fine giornata</Text><Text style={ui.muted}>Oltre questo valore GPTour propone integrazioni</Text></View>
              <TextInput testID="gptour-daily-buffer" accessibilityLabel="Tempo libero massimo in minuti" keyboardType="number-pad" value={String(g.settings.max_daily_buffer_minutes ?? 120)} editable={!baseLocked} onChangeText={(t) => { if (/^\d{0,3}$/.test(t)) g.setSettings({ ...g.settings, max_daily_buffer_minutes: Number(t) }); }} style={[ui.input, { width: 84, textAlign: 'center' }]} />
              <Text style={ui.muted}>min</Text>
            </View>
            {isAdmin && <View style={{ gap: 6 }}>
              <View style={ui.divider} />
              <Text style={ui.small}>Agente: {agentName}</Text>
              {!!agentError && <><GptNotice id="gptour-agent-error" text={agentError} error /><GptButton id="gptour-agents-retry" label="Ricarica elenco agenti" small onPress={() => setAgentRefresh((n) => n + 1)} disabled={g.busy} /></>}
              <TextInput testID="gptour-agent-search" accessibilityLabel="Cerca agente" placeholder={`Cerca tra ${agents.length} agenti…`} placeholderTextColor={DS.inkMuted} value={agentSearch} onChangeText={setAgentSearch} editable={!g.busy && !g.uncertainSave} style={ui.input} />
              <View style={ui.wrap}>
                {[{ id: actor.id, full_name: 'Il mio account' }, ...agents.filter((a) => !agentSearch.trim() ? false : (a.full_name || '').toLowerCase().includes(agentSearch.trim().toLowerCase())).slice(0, 12)]
                  .map((a) => <Pressable key={a.id} testID={`gptour-agent-${a.id}`} accessibilityRole="button" disabled={g.busy || g.uncertainSave} onPress={() => { setAgentId(a.id); setAgentSearch(''); }} style={[ui.chip, a.id === agentId && { backgroundColor: DS.brand }]}><Text style={[ui.chipText, a.id === agentId && { color: DS.surface }]}>{a.full_name || a.id}</Text></Pressable>)}
              </View>
              {!agentSearch.trim() && agentId !== actor.id && <Text style={ui.muted}>Scrivi un nome per cambiare agente.</Text>}
            </View>}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    <GptRescheduleModal event={g.reschedule} busy={g.busy} error={g.error} onClose={() => g.setReschedule(null)} onConfirm={(d, t) => track(g.confirmReschedule)(d, t)} />
  </KeyboardAvoidingView>;
}
