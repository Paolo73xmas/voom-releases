import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import type { BriefPlace } from '../../../lib/aitour/brief-v4';
import { matchBriefCustomers, validCustomerPoint, type BriefCustomer } from '../../../lib/aitour/brief-customers';
import { bindSavedPlace } from '../../../lib/aitour/brief-saved-places';
import { geocodePlaceChoices } from '../../../lib/aitour/osrm';
import type { AiTourSettings, GeoPoint } from '../../../lib/aitour/types';
import { BriefButton, reviewStyles as s } from './controls';

interface Props { id: string; label: string; value?: BriefPlace | null; onChange: (p: BriefPlace | null) => void; customers: BriefCustomer[]; settings: AiTourSettings; allowSaved?: boolean }
export function BriefPlacePicker({ id, label, value, onChange, customers, settings, allowSaved = true }: Props) {
  const [choices, setChoices] = useState<GeoPoint[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const request = useRef(0);
  useEffect(() => { request.current++; setChoices([]); setBusy(false); setError(''); }, [value?.rawReference, value?.kind]);
  useEffect(() => () => { request.current++; }, []);
  const search = async () => {
    if (!value?.rawReference.trim()) return;
    const token = ++request.current;
    setBusy(true); setError('');
    try {
      const points = value.kind === 'customer' ? matchBriefCustomers(value, customers).options.filter(validCustomerPoint).map((c) => ({ lat: c.lat, lng: c.lng, label: `${c.name}, ${c.address}, ${c.city} (${c.province})` })) : await geocodePlaceChoices(value.rawReference, value.cityHint || undefined);
      if (request.current !== token) return;
      setChoices(points); if (!points.length) setError('Nessun risultato: precisa nome, indirizzo o comune e riprova');
    } catch (e) { if (request.current === token) setError(e instanceof Error ? e.message : 'Ricerca non riuscita'); }
    finally { if (request.current === token) setBusy(false); }
  };
  const kind = (k: BriefPlace['kind']) => { onChange(bindSavedPlace({ kind: k, rawReference: k === 'home' ? 'Casa' : k === 'office' ? 'Sede' : '' }, settings)!); };
  return <View testID={id} style={s.card}>
    <Text testID={`${id}-title`} style={s.title}>{label}</Text>
    {allowSaved && <View style={s.row}>{(['home', 'office', 'address', 'customer'] as const).map((k) => <BriefButton key={k} id={`${id}-kind-${k}`} label={{ home: 'Casa', office: 'Sede', address: 'Indirizzo', customer: 'Cliente' }[k]} selected={value?.kind === k} onPress={() => kind(k)} />)}
      <BriefButton id={`${id}-default`} label="Usa il form" selected={!value} onPress={() => onChange(null)} />
    </View>}
    {!value && <Text testID={`${id}-form-hint`} style={s.hint}>Nessun luogo richiesto: si usa il punto del form.</Text>}
    {value && (value.kind === 'home' || value.kind === 'office') && <Text testID={`${id}-saved-address`} style={value.point ? s.text : s.error}>{value.point?.label || `Configura ${value.kind === 'home' ? 'Casa' : 'Sede'} con indirizzo e coordinate nelle impostazioni AI Tour.`}</Text>}
    {value && (value.kind === 'address' || value.kind === 'customer') && <>
      <TextInput testID={`${id}-query`} accessibilityLabel={label} style={s.input} value={value.rawReference} onChangeText={(rawReference) => onChange({ ...value, rawReference, point: undefined, source: undefined })} placeholder="Nome, indirizzo e comune" />
      <BriefButton id={`${id}-search`} label={busy ? 'Cerco…' : 'Cerca e conferma il luogo'} disabled={busy || !value.rawReference.trim()} onPress={search} />
    </>}
    {busy && <ActivityIndicator testID={`${id}-loading`} />}
    {!!error && <Text testID={`${id}-error`} style={s.error}>{error}</Text>}
    {choices.map((p, i) => <BriefButton key={`${p.lat}:${p.lng}`} id={`${id}-choice-${i}`} label={p.label} selected={p.lat === value?.point?.lat && p.lng === value?.point?.lng} onPress={() => { onChange({ ...value!, point: p }); setChoices([]); }} />)}
    {value?.point && <Text testID={`${id}-confirmed`} style={s.hint}>Confermato: {value.point.label}</Text>}
  </View>;
}