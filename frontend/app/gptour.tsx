import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { DS } from '../lib/theme';
import { canUseGptour, normalizeGptourAgents } from '../lib/aitour/gptour-auth';
import { useGptour } from '../hooks/useGptour';
import { candidateMatchesTourIntent } from '../lib/aitour/gptour-criteria';
import { IdentitySet } from '../lib/aitour/gptour-identity';
import { GptButton, GptNotice, GptCriteria, ui } from '../components/aitour/gptour/UI';
import { GptConversation } from '../components/aitour/gptour/Conversation';
import { GptFollowUps, GptRescheduleModal } from '../components/aitour/gptour/FollowUps';
import { GptPlan } from '../components/aitour/gptour/Plan';

export default function GptourScreen() {
  const user = useAuthStore((s) => s.user), router = useRouter(), insets = useSafeAreaInsets();
  const sessionLoading = useAuthStore((s) => s.isLoading);
  if (sessionLoading) return <View testID="gptour-session-loading" style={[ui.screen, ui.content]}><ActivityIndicator color={DS.brand} /></View>;
  if (!user || !canUseGptour(user.role)) return <View style={[ui.screen, ui.content, { paddingTop: insets.top + 24 }]}><GptNotice id="gptour-forbidden" text="Il tuo ruolo non è abilitato a GPTour (403)." error /><GptButton id="gptour-forbidden-back" label="Torna indietro" onPress={() => router.back()} /></View>;
  return <GptourAllowed key={user.id} actor={{ id: user.id, role: user.role }} />;
}
function GptourAllowed({ actor }: { actor: { id: string; role: string } }) {
  const [agentId, setAgentId] = useState(actor.id), [agents, setAgents] = useState<{ id: string; full_name: string }[]>([]), [agentMenu, setAgentMenu] = useState(false);
  const [localError, setLocalError] = useState(''), [gpsBusy, setGpsBusy] = useState(false);
  const [agentError, setAgentError] = useState(''), [agentRefresh, setAgentRefresh] = useState(0);
  const router = useRouter(), insets = useSafeAreaInsets(), isAdmin = actor.role === 'admin' || actor.role === 'admincustom';
  const g = useGptour(actor, isAdmin ? agentId : actor.id);
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
      g.setHome({ lat: location.coords.latitude, lng: location.coords.longitude, label: 'Posizione GPS' });
    } catch (e) { setLocalError(e instanceof Error ? e.message : 'GPS non disponibile.'); } finally { setGpsBusy(false); }
  };
  return <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <ScrollView testID="gptour-screen" keyboardShouldPersistTaps="handled" contentContainerStyle={[ui.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}>
      <View style={ui.row}><GptButton id="gptour-back" label="AI Tour" icon="chevron-back" onPress={() => router.back()} /><View style={ui.flex} /><GptButton id="gptour-reset" label="Nuovo giro" disabled={g.busy || g.uncertainSave || g.loading} onPress={() => { void g.reset(); }} /></View>
      <View><Text testID="gptour-title" style={ui.title}>GPTour</Text><Text style={ui.muted}>Parliamo del giro. Alle tappe e ai vincoli pensa il motore.</Text></View>
      {isAdmin && <View style={ui.card}><GptButton id="gptour-agent-picker" label={`Agente: ${agents.find((a) => a.id === agentId)?.full_name || 'Il mio account'}`} disabled={g.busy || g.uncertainSave} onPress={() => setAgentMenu(!agentMenu)} />
        {!!agentError && <><GptNotice id="gptour-agent-error" text={agentError} error /><GptButton id="gptour-agents-retry" label="Ricarica elenco agenti" onPress={() => setAgentRefresh((n) => n + 1)} disabled={g.busy} /></>}
        {agentMenu && agents.map((a) => <GptButton key={a.id} id={`gptour-agent-${a.id}`} label={a.full_name || a.id} onPress={() => { setAgentId(a.id); setAgentMenu(false); }} />)}
      </View>}
      {!!(g.error || localError) && <GptNotice id="gptour-error" text={g.error || localError} error />}
      {g.loading ? <View testID="gptour-pool-loading" style={ui.card}><ActivityIndicator color={DS.brand} /><Text style={ui.body}>Carico portafoglio, territorio e statistiche…</Text></View> : !g.pool ? <GptButton id="gptour-retry-load" label="Riprova caricamento" onPress={g.retryLoad} /> : <>
        <Text testID="gptour-pool-count" style={ui.muted}>{g.pool.candidates.length} candidati autorizzati · {g.pool.complete ? 'fonti caricate' : 'copertura parziale'}</Text>
        {!g.pool.complete && <GptNotice id="gptour-pool-partial" text={`Pool parziale: “tutti” significa tutti gli idonei disponibili, non l’intero CRM. ${g.pool.warnings.join(' ')}`} />}
        <View style={ui.card}><Text style={ui.heading}>Base e orari</Text><Text testID="gptour-base" style={ui.body}>{g.home?.label || 'Seleziona una base: nessuna posizione viene inventata.'}</Text>
          <View style={ui.wrap}>
            {g.settings.home_lat != null && g.settings.home_lng != null && <GptButton id="gptour-home" label="Casa" disabled={g.busy || !!g.days.length} onPress={() => g.setHome({ lat: g.settings.home_lat!, lng: g.settings.home_lng!, label: g.settings.home_address || 'Casa' })} />}
            {g.settings.office_lat != null && g.settings.office_lng != null && <GptButton id="gptour-office" label="Sede" disabled={g.busy || !!g.days.length} onPress={() => g.setHome({ lat: g.settings.office_lat!, lng: g.settings.office_lng!, label: g.settings.office_address || 'Sede' })} />}
            <GptButton id="gptour-gps" label={gpsBusy ? 'Rilevamento…' : 'Usa GPS'} icon="locate-outline" disabled={gpsBusy || g.busy || !!g.days.length} onPress={locate} />
          </View>
          <Text style={ui.muted}>Orario {g.settings.work_start}–{g.settings.work_end}. Puoi chiedere orari diversi nella conversazione.</Text>
          <Text style={ui.muted}>Tempo libero residuo massimo (minuti, distinto dal margine di sicurezza)</Text>
          <TextInput testID="gptour-daily-buffer" accessibilityLabel="Tempo libero massimo in minuti" keyboardType="number-pad" value={String(g.settings.max_daily_buffer_minutes ?? 120)} editable={!g.busy && !g.days.length} onChangeText={(t) => { if (/^\d{0,3}$/.test(t)) g.setSettings({ ...g.settings, max_daily_buffer_minutes: Number(t) }); }} style={ui.input} />
        </View>
        <GptCriteria intent={g.intent} />
        <GptConversation messages={g.messages} candidates={g.pool.candidates} busy={g.busy} disabled={!g.home || !!g.saved.length || g.uncertainSave} onSend={g.send} />
        <GptFollowUps pending={g.pending} busy={g.busy} decide={g.decide} onReschedule={g.setReschedule} />
        {g.warnings.map((w, i) => <GptNotice id={`gptour-warning-${i}`} key={i} text={w} />)}
        {(g.draftAvailable || (g.stale && !!g.days.length)) && <GptNotice id="gptour-stale" text="Piano precedente o bozza: ricostruisci con i dati aggiornati prima di salvare." />}
        {(g.draftAvailable || g.stale) && <GptButton id="gptour-rebuild" label="Ricostruisci piano / riprendi bozza" disabled={g.busy || !g.home} onPress={g.rebuild} />}
        <GptPlan days={g.days} selected={g.activeDay} busy={g.busy} locked={g.stale || !!g.saved.length || g.uncertainSave} proposal={g.proposal} addable={addable} choose={g.chooseDay} edit={g.edit} accept={g.acceptProposal} reject={g.rejectProposal} />
        {(!!g.days.length || g.uncertainSave) && !g.saved.length && <GptButton id="gptour-save" label={g.uncertainSave ? 'Verifica salvataggio' : `Salva tutte le ${g.days.length} giornate`} primary disabled={g.busy || (g.stale && !g.uncertainSave)} onPress={g.save} />}
        {!!g.saved.length && <View style={ui.card}><GptNotice id="gptour-save-success" text={`${g.saved.length} giornate salvate. Aprile in I miei Tour e avviale nel normale Tour Live.`} /><GptButton id="gptour-open-saved" label="Apri I miei Tour" primary onPress={() => router.replace({ pathname: '/ai-tour', params: { gptourAgentId: agentId, tab: 'tours' } })} /></View>}
      </>}
    </ScrollView>
    <GptRescheduleModal event={g.reschedule} busy={g.busy} error={g.error} onClose={() => g.setReschedule(null)} onConfirm={g.confirmReschedule} />
  </KeyboardAvoidingView>;
}