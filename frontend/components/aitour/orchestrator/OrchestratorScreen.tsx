import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DS } from '../../../lib/theme';
import type { Command, ServerStatus } from '../../../lib/aitour/orchestrator/contract';
import type { SessionState } from '../../../lib/aitour/orchestrator/session';
import { visibleServerPlan } from '../../../lib/aitour/orchestrator/view';
import { OButton } from './controls';
import { ServerQuestion } from './ServerQuestion';
import { ServerPlan } from './ServerPlan';
import { styles as s } from './styles';

const STATUS: Record<ServerStatus, string> = {
  needs_clarification: 'Serve una tua risposta', planning: 'Bozza con tempi stimati', ready: 'Piano pronto',
  infeasible: 'Giornata non fattibile', blocked: 'Pianificazione bloccata', failed: 'Pianificazione non riuscita',
};
export interface ScreenProps {
  state: SessionState; available: boolean; signedIn: boolean; testPreview?: boolean;
  send: (message: string) => Promise<void>; act: (command: Command) => void; retry: () => void; recover: () => void; legacy: () => void;
  newConversation?: () => void; access?: string; targetControl?: React.ReactNode;
}
export function OrchestratorScreen({ state, available, signedIn, testPreview, send, act, retry, recover, legacy, newConversation, access, targetControl }: ScreenProps) {
  const insets = useSafeAreaInsets(); const [text, setText] = useState('');
  const busy = ['hydrating', 'sending'].includes(state.phase);
  const disabled = !available || !signedIn || busy || state.pending;
  const plan = visibleServerPlan(state.snapshot, busy || state.pending || !!state.error || !!state.restored);
  const submit = async () => { if (!text.trim() || disabled) return; const value = text; setText(''); await send(value); };
  return <KeyboardAvoidingView testID="orchestrator-screen" style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={[s.header, { paddingTop: insets.top + 12 }]}>
      <View style={s.flex}><Text testID="orchestrator-title" style={s.title}>GPTour Orchestrator</Text>
        <Text testID="orchestrator-source" style={s.subtitle}>MOTORE CENTRALE VOOM · PILOTA</Text></View>
    </View>
    <ScrollView testID="orchestrator-conversation" keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      {testPreview && <Text testID="orchestrator-fixture-notice" style={s.muted}>TEST ISOLATO · Dati simulati, nessuna API reale</Text>}
      {!available && <View testID="orchestrator-handoff-pending" style={s.notice}>
        <Text testID="orchestrator-access-title" style={s.heading}>{access === 'checking' ? 'Verifica accesso al pilota…' : 'Collegamento operativo non attivo'}</Text>
        <Text testID="orchestrator-access-message" style={s.text}>{!access || access === 'off'
          ? 'Contratto API 1.0 integrato. Il collaudo live deve ancora essere autorizzato: nessuna richiesta Orchestrator sarà inviata.'
          : access === 'not_allowed' ? 'Il server non ha autorizzato questo account al pilota.'
          : access === 'checking' ? 'Attendo la verifica del server, senza creare una conversazione.' : 'Pilota non disponibile. Puoi scegliere esplicitamente GPTour classico.'}</Text>
      </View>}
      {!signedIn && <Text testID="orchestrator-login-required" style={s.text}>Accedi con il tuo account VOOM per utilizzare una sessione autorizzata.</Text>}
      <OButton id="orchestrator-open-legacy" label="Apri GPTour classico (modalità separata)" onPress={legacy} />
      {targetControl}
      {available && signedIn && newConversation && <OButton id="orchestrator-new-conversation" label={state.pending ? 'Abbandona attesa e apri nuova conversazione' : 'Nuova conversazione'} onPress={newConversation} disabled={busy} />}
      {state.pending && <Text testID="orchestrator-abandon-notice" style={s.muted}>Una nuova conversazione non annulla l’eventuale elaborazione già avviata sul server.</Text>}
      {state.restored && <Text testID="orchestrator-restored-notice" style={s.muted}>Transcript locale ripristinato: non ricostruisce un piano. Stato e piano devono essere confermati dal server.</Text>}
      {state.snapshot && <Text testID="orchestrator-server-status" style={s.heading}>{busy || state.pending || state.error ? 'Ultimo stato confermato: ' : ''}{STATUS[state.snapshot.status]}</Text>}
      {state.snapshot && <Text testID="orchestrator-server-revision" style={s.muted}>Revisione {state.snapshot.revision}{state.snapshot.engineVersion ? ` · ${state.snapshot.engineVersion}` : ''}</Text>}
      {state.snapshot?.criteria?.map((label, i) => <Text key={i} testID={`orchestrator-criteria-${i}`} style={s.text}>{label}</Text>)}
      {state.snapshot?.pendingDecisions?.map((label, i) => <Text key={i} testID={`orchestrator-pending-decision-${i}`} style={s.muted}>Decisione pendente: {label}</Text>)}
      {state.snapshot?.messages.map(m => <View key={m.id} testID={`orchestrator-message-${m.id}`} style={[s.message, m.role === 'user' && s.userMessage]}>
        <Text style={s.text}>{m.text}</Text></View>)}
      {busy && <View testID="orchestrator-loading" style={s.row}><ActivityIndicator color={DS.brand} /><Text style={s.text}>{state.phase === 'hydrating' ? 'Recupero sessione…' : 'Attendo il motore centrale…'}</Text></View>}
      {!!state.error && <View testID="orchestrator-error" accessibilityRole="alert" style={[s.notice, s.danger]}><Text style={s.text}>{state.error.message}</Text></View>}
      {state.error?.details?.revision !== undefined && <Text testID="orchestrator-conflict-revision" style={s.text}>Revisione server: {state.error.details.revision}. Reinvia esplicitamente il messaggio o la decisione.</Text>}
      {state.phase === 'resume_pending' && <Text testID="orchestrator-pending-request" style={s.text}>Una richiesta attende conferma. Riprovala senza cambiare identificativo.</Text>}
      {(state.pending || state.canRetryResponse) && !busy && (!state.error || state.error.retryable || state.error.code === 'STORAGE')
        && <OButton id="orchestrator-retry" label="Riprova la stessa richiesta" onPress={retry} disabled={!available || !signedIn} />}
      {available && signedIn && !busy && state.canRecover && !state.pending
        && <OButton id="orchestrator-recover" label="Recupera piano dal server" onPress={recover} />}
      {state.snapshot?.questions.map(q => <ServerQuestion key={q.id} question={q} disabled={disabled || !!state.error} act={act} />)}
      {state.snapshot?.warnings.map((w, index) => <Text testID={`orchestrator-warning-${index}`} key={`w-${index}`} style={s.muted}>{w}</Text>)}
      {plan && <ServerPlan key={`${plan.planId}:${state.snapshot?.revision}`} plan={plan} disabled={disabled} act={act} confirmable={state.snapshot?.status === 'ready' && plan.routing === 'verified'} />}
    </ScrollView>
    <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <TextInput testID="orchestrator-message-input" accessibilityLabel="Messaggio al motore centrale" multiline maxLength={2000} editable={!disabled}
        value={text} onChangeText={setText} placeholder="Descrivi il giro o rispondi al motore…" placeholderTextColor={DS.inkMuted} style={s.input} />
      <OButton id="orchestrator-send" label="Invia al motore centrale" primary disabled={disabled || !text.trim()} onPress={() => { void submit(); }} />
    </View>
  </KeyboardAvoidingView>;
}