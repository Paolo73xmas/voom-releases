import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DS, JAKARTA } from '../../lib/theme';
import { AI_PURPLE, AI_PURPLE_SOFT, AI_PURPLE_TEXT } from './shared';
import { ANOMALY_LABELS, type AnomalyType, type VerificationSubject } from '../../lib/api/customer-verification';
import { useVerificationRequest } from '../../hooks/useVerificationRequest';

const OPTIONS: { type: AnomalyType; icon: keyof typeof Ionicons.glyphMap; description: string }[] = [
  { type: 'geolocation', icon: 'location-outline', description: 'La posizione sulla mappa non corrisponde alla realtà' },
  { type: 'closed', icon: 'storefront-outline', description: 'L’attività non esiste più o ha chiuso definitivamente' },
  { type: 'moved', icon: 'navigate-outline', description: 'L’attività si è trasferita in un’altra sede' },
  { type: 'other', icon: 'help-circle-outline', description: 'Un’altra anomalia da descrivere nelle note' },
];
interface Props { subject: VerificationSubject; agentId: string; contextKey: string; onClose: () => void; onSuccess: (withoutGps: boolean) => void }
export function VerificationRequestModal({ subject, agentId, contextKey, onClose, onSuccess }: Props) {
  const insets = useSafeAreaInsets();
  const form = useVerificationRequest(agentId, contextKey, subject, onSuccess);
  const busy = form.phase !== 'idle';
  const frozen = busy || form.pending || !form.ready;
  return <Modal testID="verification-modal" visible transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView style={s.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16), marginTop: insets.top + 16 }]}>
        <View style={s.header}>
          <View style={s.flex}><Text testID="verification-title" style={s.title}>{form.confirm ? 'Conferma segnalazione' : 'Segnala un’anomalia'}</Text>
            <Text testID="verification-subject" style={s.subject}>{form.reportedSubject.name || 'Punto vendita'}</Text></View>
          <TouchableOpacity testID="verification-close" accessibilityLabel="Chiudi segnalazione" disabled={busy} onPress={onClose} style={s.iconButton}><Ionicons name="close" size={24} color={DS.ink} /></TouchableOpacity>
        </View>
        <ScrollView testID="verification-content" keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
          {!form.reportedSubject.customerId && <Text testID="verification-without-customer" style={s.notice}>Punto vendita senza scheda cliente. La segnalazione riguarda il soggetto del registro; non verrà creata una nuova anagrafica.</Text>}
          {form.pending && <Text testID="verification-pending" style={s.notice}>Invio da verificare: i dati sono conservati. Riprova con lo stesso identificativo, senza duplicare la segnalazione.</Text>}
          {form.confirm ? <View testID="verification-summary" style={s.summary}>
            <Text testID="verification-summary-type" style={s.label}>{ANOMALY_LABELS[form.anomalyType]}</Text>
            {!!form.notes.trim() && <Text testID="verification-summary-notes" style={s.body}>{form.notes.trim()}</Text>}
            <Text testID="verification-staff-review" style={s.body}>Lo staff verificherà la segnalazione. Questa azione non chiude la visita e non disabilita il cliente.</Text>
          </View> : <>
            <Text testID="verification-anomaly-label" style={s.label}>Che cosa hai riscontrato?</Text>
            {OPTIONS.map((option) => <TouchableOpacity key={option.type} testID={`verification-type-${option.type}`} accessibilityRole="radio" accessibilityState={{ checked: form.anomalyType === option.type, disabled: frozen }} disabled={frozen} activeOpacity={0.75} onPress={() => form.setAnomalyType(option.type)} style={[s.option, form.anomalyType === option.type && s.optionSelected]}>
              <Ionicons name={option.icon} size={23} color={AI_PURPLE_TEXT} /><View style={s.flex}>
                <Text testID={`verification-type-${option.type}-label`} style={s.label}>{ANOMALY_LABELS[option.type]}</Text>
                <Text testID={`verification-type-${option.type}-description`} style={s.hint}>{option.description}</Text>
              </View><Ionicons name={form.anomalyType === option.type ? 'radio-button-on' : 'radio-button-off'} size={20} color={AI_PURPLE_TEXT} />
            </TouchableOpacity>)}
            <Text testID="verification-notes-label" style={s.label}>Note aggiuntive (facoltative)</Text>
            <TextInput testID="verification-notes" accessibilityLabel="Note aggiuntive" style={s.input} multiline maxLength={3000} editable={!frozen} value={form.notes} onChangeText={form.setNotes} placeholder="Descrivi il problema riscontrato…" placeholderTextColor={DS.inkMuted} textAlignVertical="top" />
          </>}
          <View style={s.gpsNote}><Ionicons name="locate-outline" size={18} color={AI_PURPLE_TEXT} /><Text testID="verification-gps-notice" style={[s.hint, s.flex]}>Acquisiremo la tua posizione al momento dell’invio. Se il GPS non è disponibile o non autorizzi l’accesso, puoi inviare comunque senza coordinate.</Text></View>
          {!!form.error && <Text testID="verification-error" accessibilityRole="alert" style={s.error}>{form.error}</Text>}
          {busy && <View style={s.gpsNote}><ActivityIndicator testID="verification-loading" color={AI_PURPLE_TEXT} /><Text testID="verification-progress" style={s.body}>{form.phase === 'gps' ? 'Acquisizione posizione…' : form.phase === 'loading' ? 'Controllo dati salvati…' : 'Invio e verifica della segnalazione…'}</Text></View>}
        </ScrollView>
        <View style={s.footer}>
          <TouchableOpacity testID="verification-cancel" disabled={busy} onPress={form.confirm && !form.pending ? () => form.setConfirm(false) : onClose} style={[s.button, s.secondary, busy && s.disabled]}><Text testID="verification-cancel-label" style={s.secondaryText}>{form.confirm && !form.pending ? 'Modifica' : 'Chiudi'}</Text></TouchableOpacity>
          <TouchableOpacity testID={form.confirm ? 'verification-confirm' : 'verification-review'} disabled={busy || !agentId || !form.ready} onPress={form.confirm ? form.send : () => form.setConfirm(true)} activeOpacity={0.75} style={[s.button, s.primary, (busy || !agentId || !form.ready) && s.disabled]}>
            <Text testID="verification-submit-label" style={s.primaryText}>{form.confirm ? form.pending ? 'Verifica e riprova' : 'Conferma invio' : 'Rivedi segnalazione'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { maxHeight: '94%', backgroundColor: DS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 20, borderBottomWidth: 1, borderColor: DS.border },
  title: { fontFamily: JAKARTA.bold, fontSize: 22, color: DS.ink },
  subject: { fontFamily: JAKARTA.medium, fontSize: 16, color: DS.ink2, marginTop: 8 },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 20, gap: 14 }, flex: { flex: 1, minWidth: 0 },
  option: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: DS.border, borderRadius: 12, minHeight: 68 },
  optionSelected: { backgroundColor: AI_PURPLE_SOFT, borderColor: AI_PURPLE_TEXT },
  label: { fontFamily: JAKARTA.semibold, fontSize: 15, color: DS.ink },
  hint: { fontFamily: JAKARTA.regular, fontSize: 13, color: DS.inkMuted, lineHeight: 19, marginTop: 3 },
  body: { fontFamily: JAKARTA.regular, fontSize: 14, color: DS.ink2, lineHeight: 21 },
  notice: { padding: 12, backgroundColor: DS.surface2, color: DS.ink2, fontSize: 13, lineHeight: 20, borderRadius: 10 },
  summary: { padding: 16, gap: 12, backgroundColor: AI_PURPLE_SOFT, borderRadius: 12 },
  input: { minHeight: 95, padding: 14, borderWidth: 1, borderColor: DS.border, borderRadius: 12, backgroundColor: DS.surface2, fontFamily: JAKARTA.regular, color: DS.ink, fontSize: 15 },
  gpsNote: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  error: { color: DS.ink, backgroundColor: DS.surface2, borderLeftWidth: 3, borderColor: AI_PURPLE_TEXT, padding: 12, lineHeight: 21 },
  footer: { flexDirection: 'row', paddingHorizontal: 20, paddingTop: 14, gap: 10, borderTopWidth: 1, borderColor: DS.border },
  button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 14, borderRadius: 12 },
  primary: { flex: 1, backgroundColor: AI_PURPLE }, secondary: { backgroundColor: DS.surface2 },
  primaryText: { fontFamily: JAKARTA.semibold, color: '#FFFFFF', fontSize: 14 }, secondaryText: { fontFamily: JAKARTA.medium, color: DS.ink2, fontSize: 14 }, disabled: { opacity: 0.5 },
});