import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator } from 'react-native';
import { DIRECTIONS, journeyKey, journeyLabel, type BriefJourney, type JourneyStage } from '../../../lib/aitour/brief-journey';
import { prepareJourney } from '../../../lib/aitour/brief-journey-service';
import type { BriefCustomer } from '../../../lib/aitour/brief-customers';
import type { LocalityChoice } from '../../../lib/aitour/journey-localities';
import { TourMapView } from '../TourMapView';
import { AI_PURPLE } from '../shared';
import { BriefButton, reviewStyles as s } from './controls';

export function BriefJourneyReview({ value: j, onChange, customers }: { value: BriefJourney; onChange: (j: BriefJourney) => void; customers: BriefCustomer[] }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [choices, setChoices] = useState<Record<number, LocalityChoice[]>>({}), [issues, setIssues] = useState<Record<number, string>>({});
  const epoch = useRef(0);
  useEffect(() => () => { epoch.current++; }, []);
  const update = (index: number, patch: Partial<JourneyStage>) => {
    epoch.current++; setBusy(false); setChoices({}); setIssues({}); setError('');
    onChange({ ...j, stages: j.stages.map((v, i) => i === index ? { ...v, ...patch } : v), preview: undefined, confirmedKey: undefined, inputError: undefined });
  };
  const prepare = async () => {
    const version = ++epoch.current;
    setBusy(true); setError(''); setChoices({}); setIssues({});
    onChange({ ...j, preview: undefined, confirmedKey: undefined });
    try {
      const result = await prepareJourney(j, customers);
      if (epoch.current !== version) return;
      onChange(result.journey); setChoices(result.alternatives); setIssues(result.issues);
    } catch (e) { if (epoch.current === version) setError(e instanceof Error ? e.message : 'Mappa non disponibile'); }
    finally { if (epoch.current === version) setBusy(false); }
  };
  const preview = j.preview?.inputKey === journeyKey(j) ? j.preview : undefined;
  const confirmed = !!preview && j.confirmedKey === journeyKey(j);
  return <View testID="brief-journey-review" style={s.card}>
    <Text testID="brief-journey-title" style={s.title}>Zone e corridoi, in quest’ordine</Text>
    <Text testID="brief-journey-hint" style={s.hint}>Controlla località, direzioni e ampiezza. Nessun nome dettato viene corretto senza la tua conferma.</Text>
    {j.stages.map((stage, i) => <View key={i} style={s.card} testID={`brief-stage-${i}`}>
      <Text testID={`brief-stage-${i}-title`} style={s.text}>{i + 1}. {journeyLabel(stage)}</Text>
      <TextInput testID={`brief-stage-${i}-name`} accessibilityLabel={`Località ${i + 1}`} style={s.input} value={stage.name} onChangeText={(name) => update(i, { name, point: undefined })} />
      <View style={s.row}><BriefButton id={`brief-stage-${i}-direction-any`} label="Intera zona" selected={!stage.direction} onPress={() => update(i, { direction: null })} />
        {(Object.keys(DIRECTIONS) as (keyof typeof DIRECTIONS)[]).map((d) => <BriefButton key={d} id={`brief-stage-${i}-direction-${d}`} label={DIRECTIONS[d]} selected={stage.direction === d} onPress={() => update(i, { direction: d })} />)}
      </View>
      <Text testID={`brief-stage-${i}-radius-label`} style={s.hint}>Raggio zona (1–40 km)</Text>
      <TextInput testID={`brief-stage-${i}-radius`} style={s.input} keyboardType="numeric" value={String(stage.radiusKm)} onChangeText={(t) => update(i, { radiusKm: Math.max(1, Math.min(40, Number(t) || 1)) })} />
      {!!issues[i] && <Text testID={`brief-stage-${i}-error`} style={s.error}>{issues[i]}</Text>}
      {choices[i] && <Text testID={`brief-stage-${i}-choose`} style={s.hint}>{choices[i].length ? 'Quale località intendevi?' : 'Nessuna località verificata: correggi il nome o riprova la ricerca.'}</Text>}
      {(choices[i] || []).map((p, k) => <BriefButton key={`${p.lat}:${p.lng}`} id={`brief-stage-${i}-choice-${k}`} label={`${p.isCorrection ? `Conferma correzione “${stage.name}” → ` : ''}${p.label}`} onPress={() => update(i, { name: p.localityName, point: { lat: p.lat, lng: p.lng, label: p.label }, dictatedName: stage.dictatedName || stage.name })} />)}
      {stage.point && <Text testID={`brief-stage-${i}-resolved`} style={s.hint}>{stage.dictatedName && stage.dictatedName !== stage.name ? `Correzione confermata: ${stage.dictatedName} → ` : ''}{stage.point.label}</Text>}
      <View style={s.row}><BriefButton id={`brief-stage-${i}-up`} label="Sposta prima" disabled={i === 0 || busy} onPress={() => { const stages = [...j.stages]; [stages[i - 1], stages[i]] = [stages[i], stages[i - 1]]; onChange({ ...j, stages, preview: undefined, confirmedKey: undefined }); }} />
        <BriefButton id={`brief-stage-${i}-remove`} label="Rimuovi zona" disabled={j.stages.length <= 1 || busy} onPress={() => onChange({ ...j, stages: j.stages.filter((_, k) => k !== i), preview: undefined, confirmedKey: undefined })} /></View>
    </View>)}
    <BriefButton id="brief-journey-add-stage" label="Aggiungi zona" disabled={j.stages.length >= 8 || busy} onPress={() => onChange({ ...j, stages: [...j.stages, { name: '', direction: null, radiusKm: 8 }], preview: undefined, confirmedKey: undefined })} />
    <Text testID="brief-journey-width-label" style={s.hint}>Ampiezza laterale del corridoio (0,5–15 km)</Text>
    <TextInput testID="brief-journey-width" style={s.input} keyboardType="decimal-pad" value={String(j.corridorKm)} onChangeText={(t) => { epoch.current++; setBusy(false); onChange({ ...j, corridorKm: Math.max(0.5, Math.min(15, Number(t.replace(',', '.')) || 0.5)), preview: undefined, confirmedKey: undefined }); }} />
    <BriefButton id="brief-journey-prepare" label={busy ? 'Verifico località e strade…' : 'Verifica zone e mostra la mappa'} disabled={busy} onPress={prepare} />
    {busy && <ActivityIndicator testID="brief-journey-loading" />}
    {!!error && <Text testID="brief-journey-error" style={s.error}>{error}</Text>}
    {preview && <View testID="brief-journey-preview">
      <TourMapView height={280} start={j.stages[0].point!} end={j.stages[j.stages.length - 1].point} geometry={preview.roads.flat().map(([lng, lat]) => [lat, lng])} regions={preview.regions} onReadyChange={setMapReady}
        stops={j.stages.map((v, i) => ({ key: `stage-${i}`, lat: v.point!.lat, lng: v.point!.lng, name: journeyLabel(v), color: AI_PURPLE, label: String(i + 1), mandatory: false, entity: 'Zona', line1: `Zona ${i + 1} · ${v.radiusKm} km` }))} />
      <Text testID="brief-journey-map-description" style={s.hint}>{j.stages.map(journeyLabel).join(' → ')} · {Math.round(preview.roadKm)} km tra zone. Le aree colorate indicano dove cercare visite, non il giro finale.</Text>
      {!mapReady && <ActivityIndicator testID="brief-journey-map-loading" />}
      <BriefButton id="brief-journey-confirm" label={!mapReady ? 'Caricamento della mappa…' : confirmed ? 'Zone e ordine confermati' : 'Confermo queste zone e questo ordine'} disabled={!mapReady} selected={confirmed} onPress={() => onChange({ ...j, confirmedKey: journeyKey(j) })} />
    </View>}
  </View>;
}