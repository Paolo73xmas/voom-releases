import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import type { GptEvent } from '../../../lib/aitour/gptour-followups';
import { formatDateIt } from '../../../lib/aitour/gptour-followups';
import { todayRome } from '../../../lib/aitour/gptour-dates';
import { DS } from '../../../lib/theme';
import { GptButton, GptIcon, GptNotice, ui } from './UI';

/** Follow-up da decidere: una riga per evento, azioni a icona (mantieni / escludi / sposta). */
export function GptFollowUps({ pending, busy, decide, decideAll, onReschedule }: { pending: GptEvent[]; busy: boolean; decide: (e: GptEvent, a: 'keep' | 'exclude') => void; decideAll: (a: 'keep' | 'exclude') => void; onReschedule: (e: GptEvent) => void }) {
  if (!pending.length) return null;
  const today = todayRome();
  return <View testID="gptour-followups" style={ui.card}>
    <View style={ui.row}><Text style={[ui.heading, ui.flex]}>Follow-up da decidere · {pending.length}</Text></View>
    <Text style={ui.muted}>Escludere un follow-up dal giro non lo cancella dal CRM. Puoi anche rispondere in chat.</Text>
    {pending.map((e) => <View testID={`gptour-followup-${e.id}`} key={e.id} style={[ui.row, { paddingVertical: 4 }]}>
      <View style={ui.flex}><Text style={ui.small} numberOfLines={1}>{e.name}</Text><Text style={[ui.muted, e.date < today && { color: DS.warning }]}>{formatDateIt(e.date)} · {e.time}{e.date < today ? ' · arretrato' : ''}</Text></View>
      <GptIcon id={`gptour-keep-${e.id}`} icon="checkmark" label="Mantieni nel giro" onPress={() => decide(e, 'keep')} disabled={busy} color={DS.success} />
      <GptIcon id={`gptour-exclude-${e.id}`} icon="close" label="Escludi dal giro" onPress={() => decide(e, 'exclude')} disabled={busy} color={DS.error} />
      <GptIcon id={`gptour-reschedule-${e.id}`} icon="calendar-outline" label="Sposta nel CRM" onPress={() => onReschedule(e)} disabled={busy} />
    </View>)}
    {pending.length > 1 && <View style={ui.row}>
      <View style={ui.flex}><GptButton id="gptour-keep-all" label="Mantieni tutti" small icon="checkmark-done-outline" onPress={() => decideAll('keep')} disabled={busy} /></View>
      <View style={ui.flex}><GptButton id="gptour-exclude-all" label="Escludi tutti" small icon="close-circle-outline" onPress={() => decideAll('exclude')} disabled={busy} /></View>
    </View>}
  </View>;
}

export function GptRescheduleModal({ event, busy, error, onClose, onConfirm }: { event: GptEvent | null; busy: boolean; error: string; onClose: () => void; onConfirm: (date: string, time: string) => void }) {
  const [date, setDate] = useState(''), [time, setTime] = useState('');
  useEffect(() => { if (event) { setDate(event.date < todayRome() ? todayRome() : event.date); setTime(event.time); } }, [event]);
  return <Modal testID="gptour-reschedule-modal" visible={!!event} animationType="slide" transparent onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={ui.sheetBackdrop}>
      <Pressable style={ui.flex} onPress={() => { if (!busy) onClose(); }} accessibilityLabel="Chiudi" />
      <View style={ui.sheet}><View style={ui.grabber} />
        <Text style={ui.heading}>Sposta follow-up</Text><Text testID="gptour-reschedule-name" style={ui.small}>{event?.name} · {event ? formatDateIt(event.date) : ''} alle {event?.time}</Text>
        <GptNotice id="gptour-reschedule-warning" text="La nuova data viene scritta realmente nel CRM." />
        <View style={ui.row}>
          <View style={ui.flex}><Text style={ui.muted}>Nuova data (AAAA-MM-GG)</Text><TextInput testID="gptour-reschedule-date" accessibilityLabel="Nuova data" value={date} onChangeText={setDate} editable={!busy} style={ui.input} placeholderTextColor={DS.inkMuted} /></View>
          <View style={{ width: 110 }}><Text style={ui.muted}>Ora (HH:MM)</Text><TextInput testID="gptour-reschedule-time" accessibilityLabel="Nuova ora" value={time} onChangeText={setTime} editable={!busy} style={ui.input} /></View>
        </View>
        {!!error && <GptNotice id="gptour-reschedule-error" text={error} error />}
        <GptButton id="gptour-reschedule-confirm" label="Conferma modifica nel CRM" primary disabled={busy} onPress={() => onConfirm(date, time)} />
        <GptButton id="gptour-reschedule-cancel" label="Annulla" disabled={busy} onPress={onClose} />
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
