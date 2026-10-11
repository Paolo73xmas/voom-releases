import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DS } from '../../../lib/theme';
import type { Command, ServerStatus } from '../../../lib/aitour/orchestrator/contract';
import type { SessionState } from '../../../lib/aitour/orchestrator/session';
import { definitivePlan } from '../../../lib/aitour/orchestrator/view';
import { OButton, ServerOptions } from './controls';
import { ServerPlan } from './ServerPlan';
import { styles as s } from './styles';

const STATUS: Record<ServerStatus, string> = {
  needs_clarification: 'Serve una tua risposta', planning: 'Il motore sta pianificando', ready: 'Piano pronto',
  infeasible: 'Giornata non fattibile', blocked: 'Pianificazione bloccata', failed: 'Pianificazione non riuscita',
};
export interface ScreenProps {
  state: SessionState; available: boolean; signedIn: boolean; testPreview?: boolean;
  send: (message: string) => Promise<void>; act: (command: Command) => void; retry: () => void; recover: () => void; legacy: () => void;
}
export function OrchestratorScreen({ state, available, signedIn, testPreview, send, act, retry, recover, legacy }: ScreenProps) {
  const insets = useSafeAreaInsets(); const [text, setText] = useState('');
  const busy = ['hydrating', 'sending'].includes(state.phase);
  const disabled = !available || !signedIn || busy || state.pending;
  const plan = definitivePlan(state.snapshot, busy || state.pending || !!state.error);
  const submit = async () => { if (!text.trim() || disabled) return; const value = text; setText(''); await send(value); };
  return <KeyboardAvoidingView testID="orchestrator-screen" style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View style={[s.header, { paddingTop: insets.top + 12 }]}>
      <View style={s.flex}><Text testID="orchestrator-title" style={s.title}>GPTour Orchestrator</Text>
        <Text testID="orchestrator-source" style={s.subtitle}>MOTORE CENTRALE VOOM · PILOTA</Text></View>
    </View>
    <ScrollView testID="orchestrator-conversation" keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      {testPreview && <Text testID="orchestrator-fixture-notice" style={s.muted}>TEST ISOLATO · Dati simulati, nessuna API reale</Text>}
      {!available && <View testID="orchestrator-handoff-pending" style={s.notice}>
        <Text style={s.heading}>Integrazione in preparazione</Text>
        <Text style={s.text}>Il collegamento operativo è disattivato finché MOBILE_API_HANDOFF.md e il contratto pubblicato non saranno verificati. Nessuna richiesta sarà inviata.</Text>
      </View>}
      {!signedIn && <Text testID="orchestrator-login-required" style={s.text}>Accedi con il tuo account VOOM per utilizzare una sessione autorizzata.</Text>}
      <OButton id="orchestrator-open-legacy" label="Apri GPTour classico (modalità separata)" onPress={legacy} />
      {state.snapshot && <Text testID="orchestrator-server-status" style={s.heading}>{busy || state.pending || state.error ? 'Ultimo stato confermato: ' : ''}{STATUS[state.snapshot.status]}</Text>}
      {state.snapshot?.messages.map(m => <View key={m.id} testID={`orchestrator-message-${m.id}`} style={[s.message, m.role === 'user' && s.userMessage]}>
        <Text style={s.text}>{m.text}</Text></View>)}
      {busy && <View testID="orchestrator-loading" style={s.row}><ActivityIndicator color={DS.brand} /><Text style={s.text}>{state.phase === 'hydrating' ? 'Recupero sessione…' : 'Attendo il motore centrale…'}</Text></View>}
      {!!state.error && <View testID="orchestrator-error" accessibilityRole="alert" style={[s.notice, s.danger]}><Text style={s.text}>{state.error.message}</Text></View>}
      {state.phase === 'resume_pending' && <Text testID="orchestrator-pending-request" style={s.text}>Una richiesta attende conferma. Riprovala senza cambiare identificativo.</Text>}
      {state.pending && !busy && (!state.error || state.error.retryable || state.error.code === 'STORAGE')
        && <OButton id="orchestrator-retry" label="Riprova la stessa richiesta" onPress={retry} disabled={!available || !signedIn} />}
      {available && signedIn && !busy && (!state.pending || ['CONFLICT', 'REQUEST_REJECTED', 'INVALID_RESPONSE'].includes(state.error?.code || ''))
        && <OButton id="orchestrator-recover" label="Recupera stato dal server" onPress={recover} />}
      {state.snapshot?.questions.map(q => <View testID={`orchestrator-question-${q.id}`} key={q.id} style={s.card}>
        <Text style={s.heading}>{q.text}</Text><ServerOptions id={`orchestrator-answer-${q.id}`} options={q.options} disabled={disabled} act={act} />
      </View>)}
      {state.snapshot?.warnings.map((w, index) => <Text testID={`orchestrator-warning-${index}`} key={`w-${index}`} style={s.muted}>{w}</Text>)}
      {plan && <ServerPlan plan={plan} disabled={disabled} act={act} />}
    </ScrollView>
    <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <TextInput testID="orchestrator-message-input" accessibilityLabel="Messaggio al motore centrale" multiline editable={!disabled}
        value={text} onChangeText={setText} placeholder="Descrivi il giro o rispondi al motore…" placeholderTextColor={DS.inkMuted} style={s.input} />
      <OButton id="orchestrator-send" label="Invia al motore centrale" primary disabled={disabled || !text.trim()} onPress={() => { void submit(); }} />
    </View>
  </KeyboardAvoidingView>;
}