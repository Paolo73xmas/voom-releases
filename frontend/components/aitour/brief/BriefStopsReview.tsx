import React from 'react';
import { View, Text, TextInput } from 'react-native';
import type { BriefStopRef, TourBriefV4 } from '../../../lib/aitour/brief-v4';
import { matchBriefCustomers, type BriefCustomer } from '../../../lib/aitour/brief-customers';
import { areaConsentKey, outsideAreaReason } from '../../../lib/aitour/brief-area';
import { BriefButton, reviewStyles as s } from './controls';

interface Props { id: string; value: BriefStopRef; customers: BriefCustomer[]; brief: TourBriefV4; optional?: boolean; onChange: (r: BriefStopRef) => void; onRemove: () => void }
function StopReview({ id, value: r, customers, brief, optional, onChange, onRemove }: Props) {
  const chosen = customers.find((c) => c.id === r.selectedCustomerId);
  const matches = matchBriefCustomers(r, customers);
  const outside = chosen && outsideAreaReason(chosen, brief.areas, brief.journey);
  const consent = chosen ? areaConsentKey(chosen, brief.areas, brief.journey) : undefined;
  return <View testID={id} style={s.card}>
    <TextInput testID={`${id}-reference`} style={s.input} value={r.rawReference} accessibilityLabel="Cliente richiesto" onChangeText={(rawReference) => onChange({ ...r, rawReference, selectedCustomerId: undefined, areaConsent: undefined, areaDecision: undefined })} />
    {chosen ? <Text testID={`${id}-customer`} style={s.text}>{chosen.name}{chosen.crmName ? ` · ${chosen.crmName}` : ''}{'\n'}{chosen.address} · {chosen.city} ({chosen.province})</Text> : <>
      <Text testID={`${id}-unresolved`} style={s.hint}>{matches.options.length ? 'Scegli il cliente corretto:' : 'Cliente non trovato: precisa il nome, referente o codice rivendita.'}</Text>
      {matches.options.map((c, i) => <BriefButton key={c.id} id={`${id}-choice-${i}`} label={`${c.name}${c.crmName ? ` · ${c.crmName}` : ''}\n${c.city} (${c.province}) · ${c.address}`} onPress={() => onChange({ ...r, selectedCustomerId: c.id, areaDecision: undefined, areaConsent: undefined })} />)}
    </>}
    {!optional && <View style={s.row}>{[1, 2, 3].map((p) => <BriefButton key={p} id={`${id}-priority-${p}`} label={`P${p} · ${['Alta', 'Normale', 'Bassa'][p - 1]}`} selected={(r.priority ?? 2) === p} onPress={() => onChange({ ...r, priority: p })} />)}</View>}
    {r.appointment && <Text testID={`${id}-appointment`} style={s.text}>Appuntamento: {r.appointment.time || `${r.appointment.from}–${r.appointment.to}`}</Text>}
    {outside && <><Text testID={`${id}-outside`} style={s.error}>{outside}. Includere questa eccezione?</Text><View style={s.row}>
      <BriefButton id={`${id}-include`} label="Includi fuori zona" selected={r.areaDecision === 'include' && r.areaConsent === consent} onPress={() => onChange({ ...r, areaDecision: 'include', areaConsent: consent })} />
      <BriefButton id={`${id}-exclude`} label="Escludi dal giro" selected={r.areaDecision === 'exclude'} onPress={() => onChange({ ...r, areaDecision: 'exclude', areaConsent: consent })} />
    </View></>}
    {r.areaDecision === 'exclude' && <BriefButton id={`${id}-restore`} label="Ripristina questa tappa" onPress={() => onChange({ ...r, areaDecision: undefined, areaConsent: undefined })} />}
    <BriefButton id={`${id}-remove`} label="Rimuovi richiesta" onPress={onRemove} />
  </View>;
}
export function BriefStopsReview({ brief, customers, onChange }: { brief: TourBriefV4; customers: BriefCustomer[]; onChange: (b: TourBriefV4) => void }) {
  return <View testID="brief-stops-review">{(['mandatoryStops', 'preferredStops'] as const).map((field) => <View key={field}>
    {!!brief[field].length && <Text testID={`brief-${field}-title`} style={s.title}>{field === 'mandatoryStops' ? 'Clienti obbligatori' : 'Clienti desiderati'}</Text>}
    {brief[field].map((r, i) => <StopReview key={i} id={`brief-${field}-${i}`} value={r} brief={brief} customers={customers} optional={field === 'preferredStops'} onChange={(value) => onChange({ ...brief, [field]: brief[field].map((item, j) => j === i ? value : item) })} onRemove={() => onChange({ ...brief, [field]: brief[field].filter((_, j) => i !== j) })} />)}
  </View>)}</View>;
}