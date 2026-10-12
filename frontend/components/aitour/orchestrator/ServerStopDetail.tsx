import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Command, StopView } from '../../../lib/aitour/orchestrator/contract';
import { GptButton, GptIcon, GptNotice, ui } from '../gptour/UI';
import { ServerOptions } from './controls';
import { planStyles as p } from './plan-styles';
import { stopKind } from './stop-presentation';

export function ServerStopDetail({ stop, disabled, close, act }: { stop: StopView | null; disabled: boolean; close: () => void; act: (c: Command) => void }) {
  const insets = useSafeAreaInsets();
  return <Modal testID="orchestrator-stop-detail-modal" visible={!!stop} transparent animationType="fade" onRequestClose={close}>
    <View style={[ui.sheetBackdrop, { paddingTop: insets.top }]}>
      <Pressable testID="orchestrator-stop-detail-dismiss" accessibilityRole="button" accessibilityLabel="Chiudi dettaglio tappa" style={p.backdrop} onPress={close} />
      {stop && <View testID="orchestrator-stop-detail" style={[ui.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
        <View style={ui.grabber} />
        <View style={ui.row}><Text testID="orchestrator-stop-detail-heading" style={[ui.heading, ui.flex]}>Tappa {stop.sequence}</Text>
          <GptIcon id="orchestrator-stop-detail-close" label="Chiudi dettaglio" icon="close" onPress={close} /></View>
        <ScrollView testID="orchestrator-stop-detail-scroll" contentContainerStyle={p.sheetContent} keyboardShouldPersistTaps="handled">
          <Text testID="orchestrator-stop-detail-name" style={[ui.heading, p.fullName]}>{stop.name}</Text>
          <Text testID="orchestrator-stop-detail-location" style={ui.small}>{stop.city || 'Località non fornita'} · {stopKind(stop)}</Text>
          {stop.mandatory && <GptNotice id="orchestrator-stop-detail-mandatory" text="Tappa obbligatoria secondo il piano del server." />}
          {[
            ['time', 'Arrivo → partenza', `${stop.arrival} → ${stop.departure}`], ['travel', 'Trasferimento', stop.travel],
            ['visit', 'Visita', stop.visit], ['wait', 'Attesa', stop.wait], ['lunch', 'Pausa prima della visita', stop.lunch],
            ['last-order', 'Ultimo ordine', stop.lastOrder], ['role', 'Ruolo nel piano', stop.role], ['reason', 'Motivazione', stop.reason],
          ].filter(([, , value]) => !!value).map(([id, label, value]) => <View key={id} style={p.detail}>
            <Text testID={`orchestrator-stop-detail-${id}-label`} style={ui.muted}>{label}</Text>
            <Text testID={`orchestrator-stop-detail-${id}`} style={ui.body}>{value}</Text>
          </View>)}
          {stop.outsideWindow && <GptNotice id="orchestrator-stop-detail-outside-window" text="Fuori dalla finestra oraria: segnalato dal motore." />}
          {!!stop.options?.length && <View style={p.root}>
            <Text testID="orchestrator-stop-detail-server-actions" style={ui.muted}>Le modifiche vengono richieste al server, non applicate localmente.</Text>
            <ServerOptions id={`orchestrator-stop-action-${stop.id}`} options={stop.options} disabled={disabled} act={command => { close(); act(command); }} />
          </View>}
          <GptButton id="orchestrator-stop-detail-done" label="Chiudi" onPress={close} />
        </ScrollView>
      </View>}
    </View>
  </Modal>;
}