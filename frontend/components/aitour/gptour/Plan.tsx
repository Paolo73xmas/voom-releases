import React, { useState } from 'react';
import { View, Text, TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import type { GptDayPlan } from '../../../lib/aitour/gptour-engine';
import type { GptProposal } from '../../../lib/aitour/gptour-opportunities';
import type { TourCandidate } from '../../../lib/aitour/types';
import { ENTITY_COLORS, ENTITY_LABELS, minToTime, fmtDur } from '../../../lib/aitour/types';
import { TourMapView } from '../TourMapView';
import { DS } from '../../../lib/theme';
import { GptButton, GptNotice, ui } from './UI';
export function GptPlan({ days, selected, busy, locked, proposal, addable, choose, edit, accept, reject }: {
  days: GptDayPlan[]; selected: number; busy: boolean; locked: boolean; proposal: GptProposal | null; addable: TourCandidate[];
  choose: (n: number) => void; edit: (op: 'remove' | 'up' | 'down' | 'next' | 'add', key: string) => void; accept: () => void; reject: () => void;
}) {
  const [map, setMap] = useState(false), [addOpen, setAddOpen] = useState(false), [search, setSearch] = useState('');
  const day = days[selected]; if (!day) return null;
  const plan = day.plan, disabled = busy || locked;
  const matches = addable.filter((c) => `${c.name} ${c.city}`.toLowerCase().includes(search.toLowerCase()));
  return <View testID="gptour-plan" style={ui.card}>
    <Text style={ui.heading}>Il piano del giro</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {days.map((d, i) => <GptButton id={`gptour-day-${i}`} key={i} label={`G${i + 1} · ${d.plan.tourDate}`} primary={i === selected} disabled={busy} onPress={() => choose(i)} />)}
    </ScrollView>
    <Text testID="gptour-plan-metrics" style={ui.heading}>{plan.stops.length} tappe · {plan.totalKm.toFixed(1)} km</Text>
    <Text testID="gptour-plan-times" style={ui.body}>{minToTime(plan.startMin)} → {minToTime(plan.finishMin)} · guida {fmtDur(plan.driveMin)} · visite {fmtDur(plan.visitMin)}</Text>
    <Text testID="gptour-plan-buffer" style={ui.muted}>Tempo libero residuo: {fmtDur(plan.bufferMin)}</Text>
    <Text testID="gptour-lodging" style={ui.body}>Partenza: {day.startsFrom === 'home' ? 'base' : 'pernottamento precedente'} · {day.returnHomeAfterDay ? 'rientro a casa' : 'pernottamento fuori'}{day.nightKmHome != null ? ` · ${day.nightKmHome.toFixed(1)} km stradali alla prima tappa successiva` : ''}</Text>
    {(day.nightDecision === 'routing_unknown' || day.nightDecision === 'unstable') && <GptNotice id="gptour-night-warning" text={`${day.nightDecision}: scelta prudenziale, non una distanza stimata spacciata per stradale.`} />}
    {plan.warnings.map((warning, i) => <GptNotice key={i} id={`gptour-plan-warning-${i}`} text={warning} />)}
    <GptButton id="gptour-toggle-map" label={map ? 'Nascondi mappa' : 'Mostra mappa'} icon="map-outline" onPress={() => setMap(!map)} />
    {map && <View testID="gptour-map"><TourMapView height={330} start={plan.start} end={plan.end} geometry={plan.geometry} stops={plan.stops.map((s) => ({ key: s.candidate.key, name: s.candidate.name, lat: s.candidate.lat, lng: s.candidate.lng, color: ENTITY_COLORS[s.candidate.entityType], label: String(s.sequence), mandatory: s.mandatory, entity: ENTITY_LABELS[s.candidate.entityType], line1: `${minToTime(s.arrivalMin)} · ${s.candidate.visitMinutes} min` }))} /></View>}
    {plan.stops.map((s, i) => <View key={s.candidate.key} testID={`gptour-stop-${i}`} style={ui.bubble}>
      <Text style={ui.body}>{i + 1}. {s.candidate.name}{s.mandatory ? ' · obbligatoria' : ''}</Text>
      <Text style={ui.muted}>{s.candidate.city} · {ENTITY_LABELS[s.candidate.entityType]} · {minToTime(s.arrivalMin)}–{minToTime(s.departureMin)}</Text>
      <View style={ui.wrap}>
        <GptButton id={`gptour-up-${i}`} label="Su" icon="arrow-up" disabled={disabled || i === 0} onPress={() => edit('up', s.candidate.key)} />
        <GptButton id={`gptour-down-${i}`} label="Giù" icon="arrow-down" disabled={disabled || i === plan.stops.length - 1} onPress={() => edit('down', s.candidate.key)} />
        {days.length > 1 && <GptButton id={`gptour-move-day-${i}`} label="Altra giornata" disabled={disabled || s.mandatory} onPress={() => edit('next', s.candidate.key)} />}
        <GptButton id={`gptour-remove-${i}`} label="Rimuovi" disabled={disabled || s.mandatory} onPress={() => edit('remove', s.candidate.key)} />
      </View>
    </View>)}
    <GptButton id="gptour-add-stop" label="Aggiungi tappa idonea" icon="add-outline" disabled={disabled} onPress={() => setAddOpen(true)} />
    {!!proposal?.warning && <GptNotice id="gptour-proposal-warning" text={proposal.warning} />}
    {!!proposal?.candidates.length && <View testID="gptour-proposal" style={ui.bubble}><Text style={ui.heading}>Possiamo completare la giornata</Text>
      <Text testID="gptour-proposal-cost" style={ui.body}>+{Math.round(proposal.extraMinutes)} min di guida · +{proposal.extraKm.toFixed(1)} km complessivi, oltre alle visite.</Text>
      {proposal.candidates.map((c, i) => <Text testID={`gptour-proposal-candidate-${i}`} key={c.key} style={ui.body}>{c.name} · {c.city}</Text>)}
      <GptButton id="gptour-accept-proposal" label="Accetta integrazioni" primary disabled={disabled} onPress={accept} />
      <GptButton id="gptour-reject-proposal" label="No, finisco prima" disabled={disabled} onPress={reject} />
    </View>}
    <Modal visible={addOpen} animationType="slide" onRequestClose={() => setAddOpen(false)} testID="gptour-add-modal">
      <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[ui.content, { paddingTop: 60 }]}>
        <Text style={ui.title}>Aggiungi tappa</Text><GptButton id="gptour-add-close" label="Chiudi" onPress={() => setAddOpen(false)} />
        <TextInput testID="gptour-add-search" accessibilityLabel="Cerca candidati idonei" placeholder="Cerca nome o comune" placeholderTextColor={DS.inkMuted} value={search} onChangeText={setSearch} style={ui.input} />
        <Text testID="gptour-add-count" style={ui.muted}>{matches.length} idonei · visualizzati i primi 50. Raffina la ricerca.</Text>
        {matches.slice(0, 50).map((c) => <GptButton key={c.key} id={`gptour-add-${c.key}`} label={`${c.name} · ${c.city}`} disabled={disabled} onPress={() => { setAddOpen(false); edit('add', c.key); }} />)}
      </ScrollView></KeyboardAvoidingView>
    </Modal>
  </View>;
}