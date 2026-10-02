import React, { useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, Pressable } from 'react-native';
import type { GptMessage } from '../../../lib/aitour/gptour-api';
import type { TourCandidate } from '../../../lib/aitour/types';
import { useGptourVoice } from '../../../hooks/useGptourVoice';
import { DS } from '../../../lib/theme';
import { GptIcon, GptNotice, ui } from './UI';

const EXAMPLES = ['Tutti i miei orfani, massimo 3 giorni', 'Prospect a Rozzano non visitati da 30 giorni', 'Domani 10 tabaccherie a Pavia, prima i clienti fermi da più tempo'];

/** Thread della conversazione: bolle compatte, suggerimenti all'avvio, stato "sto pensando". */
export function GptThread({ messages, busy, onSuggest }: { messages: GptMessage[]; busy: boolean; onSuggest: (text: string) => void }) {
  return <View testID="gptour-conversation" style={{ gap: 8 }}>
    {!messages.length && <View style={ui.card}>
      <Text style={ui.heading}>Dimmi che giro vuoi</Text>
      <Text style={ui.muted}>Clienti, zona, giorni e vincoli: a tappe e percorsi pensa il motore. Puoi scrivere o dettare.</Text>
      {EXAMPLES.map((text, i) => <Pressable key={text} testID={`gptour-example-${i}`} accessibilityRole="button" onPress={() => onSuggest(text)} style={({ pressed }) => [ui.notice, { opacity: pressed ? .7 : 1 }]}><Text style={[ui.small, ui.flex, { color: DS.brand }]}>«{text}»</Text></Pressable>)}
    </View>}
    {messages.map((m, i) => <View testID={`gptour-message-${i}`} key={i} style={[ui.bubble, m.role === 'user' && ui.ownBubble]}>
      <Text style={[ui.small, m.role === 'user' && { color: DS.surface }]}>{m.content}</Text>
    </View>)}
    {busy && <View testID="gptour-loading" style={[ui.row, { paddingVertical: 4 }]}><ActivityIndicator color={DS.brand} /><Text style={ui.muted}>GPTour sta costruendo il giro…</Text></View>}
  </View>;
}

/** Barra di scrittura fissa in basso: campo + microfono + invio. */
export function GptComposer({ candidates, busy, disabled, draft, onDraftUsed, onSend }: {
  candidates: TourCandidate[]; busy: boolean; disabled: boolean; draft: string; onDraftUsed: () => void; onSend: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  React.useEffect(() => { if (draft) { setText(draft); onDraftUsed(); } }, [draft, onDraftUsed]);
  const voice = useGptourVoice(candidates, (value) => setText((t) => [t, value].filter(Boolean).join(' ')));
  const locked = busy || disabled || voice.transcribing;
  const send = () => { const value = text.trim(); if (!value || locked || voice.recording) return; setText(''); void onSend(value); };
  return <View testID="gptour-composer" style={{ gap: 6 }}>
    {!!voice.error && <GptNotice id="gptour-voice-error" text={voice.error} error />}
    <View style={[ui.row, { alignItems: 'flex-end' }]}>
      <GptIcon id="gptour-voice-button" icon={voice.recording ? 'stop-circle' : 'mic-outline'} label={voice.recording ? 'Ferma registrazione' : 'Detta la richiesta'} onPress={voice.toggle} disabled={locked} color={voice.recording ? DS.error : undefined} />
      <TextInput testID="gptour-message-input" accessibilityLabel="Richiesta GPTour" multiline value={text} onChangeText={setText} editable={!locked && !voice.recording}
        placeholder={voice.recording ? 'Registrazione in corso…' : voice.transcribing ? 'Trascrizione in corso…' : 'Scrivi o detta la richiesta…'} placeholderTextColor={DS.inkMuted}
        style={[ui.input, ui.flex, { maxHeight: 110, paddingTop: 11 }]} />
      <GptIcon id="gptour-send" icon="arrow-up" label="Invia" primary onPress={send} disabled={!text.trim() || locked || voice.recording} />
    </View>
  </View>;
}
