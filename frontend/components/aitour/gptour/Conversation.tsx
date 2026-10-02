import React, { useState } from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import type { GptMessage } from '../../../lib/aitour/gptour-api';
import type { TourCandidate } from '../../../lib/aitour/types';
import { useGptourVoice } from '../../../hooks/useGptourVoice';
import { DS } from '../../../lib/theme';
import { GptButton, GptNotice, ui } from './UI';
export function GptConversation({ messages, candidates, busy, disabled, pendingCount, onSend }: {
  messages: GptMessage[]; candidates: TourCandidate[]; busy: boolean; disabled: boolean; pendingCount: number; onSend: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const send = () => { const value = text.trim(); if (!value) return; setText(''); void onSend(value); };
  const voice = useGptourVoice(candidates, (value) => setText((t) => [t, value].filter(Boolean).join(' ')));
  return <View testID="gptour-conversation" style={ui.card}>
    <Text style={ui.heading}>Il tuo prossimo giro</Text><Text style={ui.muted}>Descrivi clienti, zona e giorni. GPTour conserva i criteri mentre perfezioni il piano.</Text>
    {!messages.length && <GptButton id="gptour-example" label="Tutti i miei orfani, massimo 3 giorni" onPress={() => setText('Fammi tutti i miei clienti diventati orfani, in massimo 3 giorni.')} disabled={disabled || busy} />}
    {messages.map((m, i) => <View testID={`gptour-message-${i}`} key={i} style={[ui.bubble, m.role === 'user' && ui.ownBubble]}><Text style={ui.muted}>{m.role === 'user' ? 'Tu' : 'GPTour'}</Text><Text style={ui.body}>{m.content}</Text></View>)}
    {!busy && pendingCount > 0 && <GptNotice id="gptour-pending-hint" text={`Prima di costruire il giro decidi ${pendingCount === 1 ? 'il follow-up' : `i ${pendingCount} follow-up`} in agenda: li trovi qui sotto.`} />}
    <TextInput testID="gptour-message-input" accessibilityLabel="Richiesta GPTour" multiline value={text} onChangeText={setText} editable={!busy && !disabled && !voice.recording && !voice.transcribing} placeholder="Ad esempio: prospect a Rozzano non visitati da 30 giorni…" placeholderTextColor={DS.inkMuted} style={[ui.input, { minHeight: 104, textAlignVertical: 'top' }]} />
    {!!voice.error && <GptNotice id="gptour-voice-error" text={voice.error} error />}
    {voice.recording && <Text testID="gptour-recording" style={ui.body}>Registrazione in corso… tocca Ferma.</Text>}
    <View style={ui.row}><GptButton id="gptour-voice-button" label={voice.recording ? 'Ferma' : voice.transcribing ? 'Trascrizione…' : 'Detta'} icon={voice.recording ? 'stop-circle-outline' : 'mic-outline'} onPress={voice.toggle} disabled={busy || disabled || voice.transcribing} />
      <View style={ui.flex}><GptButton id="gptour-send" label="Invia richiesta" icon="arrow-up-outline" primary disabled={!text.trim() || busy || disabled || voice.recording || voice.transcribing} onPress={send} /></View>
    </View>
    {(busy || voice.transcribing) && <View testID="gptour-loading" style={ui.row}><ActivityIndicator color={DS.brand} /><Text style={ui.muted}>{voice.transcribing ? 'Sto trascrivendo la voce…' : 'Sto verificando criteri, agenda e percorso…'}</Text></View>}
  </View>;
}