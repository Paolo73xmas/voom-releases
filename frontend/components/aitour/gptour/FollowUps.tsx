import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import type { GptEvent } from '../../../lib/aitour/gptour-followups';
import { todayRome } from '../../../lib/aitour/gptour-dates';
import { DS } from '../../../lib/theme';
import { GptButton, GptNotice, ui } from './UI';
export function GptFollowUps({ pending, busy, decide, decideAll, onReschedule }: { pending: GptEvent[]; busy: boolean; decide: (e: GptEvent, a: 'keep' | 'exclude') => void; decideAll: (a: 'keep' | 'exclude') => void; onReschedule: (e: GptEvent) => void }) {
  if (!pending.length) return null;
  return <View testID="gptour-followups" style={ui.card}><Text style={ui.heading}>Follow-up da decidere</Text><Text style={ui.muted}>Ogni riga è un evento CRM. Escluderlo dal giro non lo cancella.</Text>
    {pending.length > 1 && <View style={ui.wrap}>
      <GptButton id="gptour-keep-all" label="Mantieni tutti" onPress={() => decideAll('keep')} disabled={busy} />
      <GptButton id="gptour-exclude-all" label="Escludi tutti dal giro" onPress={() => decideAll('exclude')} disabled={busy} />
    </View>}
    {pending.map((e) => <View testID={`gptour-followup-${e.id}`} key={e.id} style={ui.bubble}><Text style={ui.body}>{e.name}</Text><Text style={ui.muted}>{e.date} · {e.time}{e.date < todayRome() ? ' · arretrato' : ''}</Text><View style={ui.wrap}>
      <GptButton id={`gptour-keep-${e.id}`} label="Mantieni" onPress={() => decide(e, 'keep')} disabled={busy} />
      <GptButton id={`gptour-exclude-${e.id}`} label="Escludi dal giro" onPress={() => decide(e, 'exclude')} disabled={busy} />
      <GptButton id={`gptour-reschedule-${e.id}`} label="Sposta nel CRM" onPress={() => onReschedule(e)} disabled={busy} />
    </View></View>)}
  </View>;
}
export function GptRescheduleModal({ event, busy, error, onClose, onConfirm }: { event: GptEvent | null; busy: boolean; error: string; onClose: () => void; onConfirm: (date: string, time: string) => void }) {
  const [date, setDate] = useState(''), [time, setTime] = useState('');
  useEffect(() => { if (event) { setDate(event.date < todayRome() ? todayRome() : event.date); setTime(event.time); } }, [event]);
  return <Modal testID="gptour-reschedule-modal" visible={!!event} animationType="slide" transparent onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={ui.modalBackdrop}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}><View style={ui.card}>
      <Text style={ui.heading}>Sposta follow-up</Text><Text testID="gptour-reschedule-name" style={ui.body}>{event?.name} · {event?.date} alle {event?.time}</Text>
      <GptNotice id="gptour-reschedule-warning" text="Spostando questo follow-up verrà modificata realmente la data nel CRM." />
      <Text style={ui.muted}>Nuova data (AAAA-MM-GG)</Text><TextInput testID="gptour-reschedule-date" accessibilityLabel="Nuova data" value={date} onChangeText={setDate} editable={!busy} style={ui.input} placeholderTextColor={DS.inkMuted} />
      <Text style={ui.muted}>Ora (HH:MM)</Text><TextInput testID="gptour-reschedule-time" accessibilityLabel="Nuova ora" value={time} onChangeText={setTime} editable={!busy} style={ui.input} />
      {!!error && <GptNotice id="gptour-reschedule-error" text={error} error />}
      <GptButton id="gptour-reschedule-confirm" label="Conferma modifica nel CRM" primary disabled={busy} onPress={() => onConfirm(date, time)} />
      <GptButton id="gptour-reschedule-cancel" label="Annulla" disabled={busy} onPress={onClose} />
    </View></ScrollView></KeyboardAvoidingView>
  </Modal>;
}