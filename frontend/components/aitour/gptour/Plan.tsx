import React, { useState } from 'react';
import { View, Text, TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { GptDayPlan } from '../../../lib/aitour/gptour-engine';
import type { GptProposal } from '../../../lib/aitour/gptour-opportunities';
import type { TourCandidate, PlannedStop as TourStop } from '../../../lib/aitour/types';
import { ENTITY_COLORS, ENTITY_LABELS, minToTime, fmtDur } from '../../../lib/aitour/types';
import { formatDateIt } from '../../../lib/aitour/gptour-followups';
import { TourMapView } from '../TourMapView';
import { DS } from '../../../lib/theme';
import { GptButton, GptIcon, GptNotice, ui } from './UI';

export type GptEditOp = 'remove' | 'move' | 'next' | 'add';
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function GptPlan({ days, selected, busy, locked, proposal, addable, choose, edit, accept, reject }: {
  days: GptDayPlan[]; selected: number; busy: boolean; locked: boolean; proposal: GptProposal | null; addable: TourCandidate[];
  choose: (n: number) => void; edit: (op: GptEditOp, key: string, toIndex?: number) => void; accept: () => void; reject: () => void;
}) {
  const [map, setMap] = useState(true), [addOpen, setAddOpen] = useState(false), [search, setSearch] = useState('');
  const [actionFor, setActionFor] = useState<TourStop | null>(null), [moving, setMoving] = useState<string | null>(null);
  const day = days[selected]; if (!day) return null;
  const plan = day.plan, disabled = busy || locked, total = days.reduce((n, d) => n + d.plan.stops.length, 0);
  const matches = addable.filter((c) => `${c.name} ${c.city}`.toLowerCase().includes(search.toLowerCase()));
  const movingStop = moving ? plan.stops.find((s) => s.candidate.key === moving) : null;
  const onRow = (s: TourStop, index: number) => {
    if (disabled) return;
    if (moving) { if (moving !== s.candidate.key) edit('move', moving, index); setMoving(null); return; }
    setActionFor(s);
  };
  return <View testID="gptour-plan" style={{ gap: 10 }}>
    {/* Intestazione: titolo + giornate + mappa on/off */}
    <View style={ui.row}>
      <View style={ui.flex}>
        <Text style={ui.heading}>{days.length > 1 ? `Giro su ${days.length} giornate · ${total} tappe` : `Giro proposto · ${formatDateIt(plan.tourDate)}`}</Text>
      </View>
      <GptIcon id="gptour-toggle-map" icon={map ? 'map' : 'map-outline'} label={map ? 'Nascondi mappa' : 'Mostra mappa'} onPress={() => setMap(!map)} />
    </View>
    {days.length > 1 && <View style={ui.wrap}>
      {days.map((d, i) => <Pressable key={i} testID={`gptour-day-${i}`} accessibilityRole="button" disabled={busy} onPress={() => choose(i)} style={[ui.chip, i === selected && { backgroundColor: DS.brand }]}>
        <Text style={[ui.chipText, i === selected && { color: DS.surface }]}>G{i + 1} · {dm(d.plan.tourDate)} · {d.plan.stops.length}</Text>
      </Pressable>)}
    </View>}
    <View style={[ui.card, { padding: 0, overflow: 'hidden' }]}>
      {map && <View testID="gptour-map"><TourMapView height={220} start={plan.start} end={plan.end} geometry={plan.geometry} stops={plan.stops.map((s) => ({ key: s.candidate.key, name: s.candidate.name, lat: s.candidate.lat, lng: s.candidate.lng, color: ENTITY_COLORS[s.candidate.entityType], label: String(s.sequence), mandatory: s.mandatory, entity: ENTITY_LABELS[s.candidate.entityType], line1: `${minToTime(s.arrivalMin)} · ${s.candidate.visitMinutes} min` }))} /></View>}
      <View style={{ padding: 12, gap: 4 }}>
        <Text testID="gptour-plan-metrics" style={ui.small}>{plan.stops.length} tappe · {plan.totalKm.toFixed(0)} km · {minToTime(plan.startMin)} → {minToTime(plan.finishMin)}</Text>
        <Text testID="gptour-plan-times" style={ui.muted}>Guida {fmtDur(plan.driveMin)} · visite {fmtDur(plan.visitMin)} · <Text testID="gptour-plan-buffer">libero {fmtDur(plan.bufferMin)}</Text></Text>
        {days.length > 1 && <Text testID="gptour-lodging" style={ui.muted}>Parte da {day.startsFrom === 'home' ? 'casa' : 'dove ha finito il giorno prima'} · {day.day === day.total ? 'fine giro: rientro a casa' : day.returnHomeAfterDay ? 'notte: rientro a casa' : 'notte: dorme fuori'}{day.nightKmHome != null ? ` (${Math.round(day.nightKmHome)} km stradali alla 1ª tappa G${day.day + 1})` : ''}</Text>}
        {plan.warnings.map((warning, i) => <GptNotice key={i} id={`gptour-plan-warning-${i}`} text={warning} />)}
      </View>
    </View>
    {/* Elenco tappe compatto: tocca la riga per le azioni, la maniglia per spostarla */}
    {movingStop && <View style={[ui.notice, ui.row]}><Ionicons name="swap-vertical" size={18} color={DS.brand} /><Text style={[ui.small, ui.flex, { color: DS.brand }]}>Sposto «{movingStop.candidate.name}»: tocca la tappa nella cui posizione inserirla.</Text><GptButton id="gptour-move-cancel" label="Annulla" small onPress={() => setMoving(null)} /></View>}
    <View style={[ui.card, { padding: 4, gap: 0 }]}>
      {plan.stops.map((s, i) => <View key={s.candidate.key} style={[ui.row, { paddingVertical: 2, paddingRight: 4, borderRadius: 10, backgroundColor: moving === s.candidate.key ? DS.brandSoft : 'transparent' }, i > 0 && { borderTopWidth: 1, borderTopColor: DS.border }]}>
        <Pressable testID={`gptour-stop-${i}`} accessibilityRole="button" accessibilityLabel={`${i + 1}. ${s.candidate.name}`} onPress={() => onRow(s, i)} disabled={disabled}
          style={({ pressed }) => [ui.row, ui.flex, { paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10, backgroundColor: pressed ? DS.surface2 : 'transparent' }]}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: ENTITY_COLORS[s.candidate.entityType], alignItems: 'center', justifyContent: 'center' }}><Text style={[ui.chipText, { color: DS.surface }]}>{i + 1}</Text></View>
          <View style={ui.flex}>
            <Text style={ui.small} numberOfLines={1}>{s.candidate.name}{s.mandatory ? '  🔒' : ''}</Text>
            <Text style={ui.muted} numberOfLines={1}>{s.candidate.city} · {minToTime(s.arrivalMin)}–{minToTime(s.departureMin)} · {ENTITY_LABELS[s.candidate.entityType]}</Text>
          </View>
        </Pressable>
        <GptIcon id={`gptour-handle-${i}`} icon="reorder-three-outline" label={`Sposta ${s.candidate.name}`} onPress={() => setMoving(moving === s.candidate.key ? null : s.candidate.key)} disabled={disabled} color={DS.inkMuted} />
      </View>)}
      <GptButton id="gptour-add-stop" label="Aggiungi tappa dai miei clienti" small icon="add" disabled={disabled} onPress={() => setAddOpen(true)} />
    </View>
    {!!proposal?.warning && <GptNotice id="gptour-proposal-warning" text={proposal.warning} />}
    {!!proposal?.candidates.length && <View testID="gptour-proposal" style={[ui.card, { borderColor: DS.brand }]}>
      <Text style={ui.heading}>Posso completare la giornata</Text>
      <Text testID="gptour-proposal-cost" style={ui.muted}>+{Math.round(proposal.extraMinutes)} min di guida · +{proposal.extraKm.toFixed(0)} km, oltre alle visite.</Text>
      {proposal.candidates.map((c, i) => <Text testID={`gptour-proposal-candidate-${i}`} key={c.key} style={ui.small} numberOfLines={1}>• {c.name} · {c.city}</Text>)}
      <View style={ui.row}>
        <View style={ui.flex}><GptButton id="gptour-accept-proposal" label="Inserisci" small primary disabled={disabled} onPress={accept} /></View>
        <View style={ui.flex}><GptButton id="gptour-reject-proposal" label="No, finisco prima" small disabled={disabled} onPress={reject} /></View>
      </View>
    </View>}
    {/* Foglio azioni tappa */}
    <Modal visible={!!actionFor} transparent animationType="fade" onRequestClose={() => setActionFor(null)} testID="gptour-stop-actions">
      <View style={ui.sheetBackdrop}>
        <Pressable style={ui.flex} onPress={() => setActionFor(null)} accessibilityLabel="Chiudi" />
        <View style={ui.sheet}><View style={ui.grabber} />
          <Text style={ui.heading} numberOfLines={2}>{actionFor?.candidate.name}</Text>
          <Text style={ui.muted}>{actionFor?.candidate.city} · {actionFor ? ENTITY_LABELS[actionFor.candidate.entityType] : ''}{actionFor?.candidate.reason ? ` · ${actionFor.candidate.reason}` : ''}</Text>
          {actionFor?.mandatory && <GptNotice id="gptour-stop-mandatory" text="Tappa obbligatoria (follow-up o richiesta esplicita): non si può rimuovere da qui." />}
          <GptButton id="gptour-action-move" label="Sposta in un'altra posizione" icon="swap-vertical-outline" onPress={() => { setMoving(actionFor!.candidate.key); setActionFor(null); }} />
          {days.length > 1 && <GptButton id="gptour-action-next" label="Sposta nella giornata successiva" icon="arrow-forward-outline" disabled={!!actionFor?.mandatory} onPress={() => { edit('next', actionFor!.candidate.key); setActionFor(null); }} />}
          <GptButton id="gptour-action-remove" label="Rimuovi dal giro" icon="trash-outline" danger disabled={!!actionFor?.mandatory} onPress={() => { edit('remove', actionFor!.candidate.key); setActionFor(null); }} />
          <GptButton id="gptour-action-close" label="Chiudi" onPress={() => setActionFor(null)} />
        </View>
      </View>
    </Modal>
    {/* Aggiungi tappa */}
    <Modal visible={addOpen} animationType="slide" transparent onRequestClose={() => setAddOpen(false)} testID="gptour-add-modal">
      <KeyboardAvoidingView style={ui.sheetBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={ui.flex} onPress={() => setAddOpen(false)} accessibilityLabel="Chiudi" />
        <View style={ui.sheet}><View style={ui.grabber} />
          <View style={ui.row}><Text style={[ui.heading, ui.flex]}>Aggiungi tappa</Text><GptIcon id="gptour-add-close" icon="close" label="Chiudi" onPress={() => setAddOpen(false)} /></View>
          <TextInput testID="gptour-add-search" accessibilityLabel="Cerca candidati idonei" placeholder="Cerca nome o comune…" placeholderTextColor={DS.inkMuted} value={search} onChangeText={setSearch} style={ui.input} autoFocus />
          <Text testID="gptour-add-count" style={ui.muted}>{matches.length} idonei ai criteri{matches.length > 40 ? ' · mostro i primi 40, raffina la ricerca' : ''}</Text>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 360 }}>
            {matches.slice(0, 40).map((c) => <Pressable key={c.key} testID={`gptour-add-${c.key}`} accessibilityRole="button" disabled={disabled} onPress={() => { setAddOpen(false); edit('add', c.key); }} style={({ pressed }) => [{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: DS.border, opacity: pressed ? .6 : 1 }]}>
              <Text style={ui.small} numberOfLines={1}>{c.name}</Text><Text style={ui.muted}>{c.city} · {ENTITY_LABELS[c.entityType]}</Text>
            </Pressable>)}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </View>;
}
