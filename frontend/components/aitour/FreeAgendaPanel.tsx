import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { FreeAppointment } from '../../lib/aitour/followups';
import type { GeoPoint } from '../../lib/aitour/types';
import { geocodePlaceChoices } from '../../lib/aitour/osrm';
import { COLORS } from '../../lib/theme';

export function FreeAgendaPanel({ appointments, places, onPlace }: { appointments: FreeAppointment[]; places: Record<string, GeoPoint>; onPlace: (id: string, place: GeoPoint | null) => void }) {
  const [searching, setSearching] = useState<string | null>(null);
  const [options, setOptions] = useState<Record<string, GeoPoint[]>>({});
  const [error, setError] = useState<Record<string, string>>({});
  const search = async (appointment: FreeAppointment) => {
    setSearching(appointment.id); setError(old => ({ ...old, [appointment.id]: '' }));
    try {
      const result = await geocodePlaceChoices([appointment.address, appointment.city].filter(Boolean).join(', '));
      setOptions(old => ({ ...old, [appointment.id]: result }));
      if (!result.length) setError(old => ({ ...old, [appointment.id]: 'Luogo non trovato. Specifica un indirizzo più preciso nel calendario.' }));
    } catch { setError(old => ({ ...old, [appointment.id]: 'Ricerca luogo non riuscita. Riprova.' })); }
    finally { setSearching(null); }
  };
  if (!appointments.length) return null;
  return <View testID="aitour-free-agenda" style={styles.panel}>
    <Text testID="aitour-free-agenda-title" style={styles.title}>Impegni liberi in agenda</Text>
    <Text style={styles.hint}>Conferma un luogo per inserire l’impegno come tappa obbligatoria. Senza luogo resta un promemoria: verifica che gli orari del giro non si sovrappongano.</Text>
    {appointments.map(a => <View key={a.id} testID={`aitour-free-appointment-${a.id}`} style={styles.item}>
      <Text testID={`aitour-free-title-${a.id}`} style={styles.label}>{a.time} · {a.title} · {a.duration} min</Text>
      {!!a.notes && <Text testID={`aitour-free-notes-${a.id}`} style={styles.hint}>{a.notes}</Text>}
      {!!(a.address || a.city) && <Text testID={`aitour-free-address-${a.id}`} style={styles.hint}>{[a.address, a.city].filter(Boolean).join(', ')}</Text>}
      {places[a.id] ? <>
        <Text testID={`aitour-free-confirmed-${a.id}`} style={styles.hint}>Tappa obbligatoria: {places[a.id].label}</Text>
        <TouchableOpacity testID={`aitour-free-remove-${a.id}`} style={styles.button} onPress={() => onPlace(a.id, null)}><Text style={styles.link}>Mantieni solo come promemoria</Text></TouchableOpacity>
      </> : (a.address || a.city) ? <>
        <TouchableOpacity testID={`aitour-free-find-${a.id}`} disabled={!!searching} style={styles.button} onPress={() => search(a)}>{searching === a.id ? <ActivityIndicator color={COLORS.primary} /> : <Text style={styles.link}>Cerca e conferma luogo per il giro</Text>}</TouchableOpacity>
        {(options[a.id] ?? []).map((place, index) => <TouchableOpacity key={index} testID={`aitour-free-place-${a.id}-${index}`} style={styles.button} onPress={() => { onPlace(a.id, place); setOptions(old => ({ ...old, [a.id]: [] })); }}><Text style={styles.link}>{place.label}</Text></TouchableOpacity>)}
      </> : <Text testID={`aitour-free-no-location-${a.id}`} style={styles.hint}>Senza luogo · solo promemoria, non tappa</Text>}
      {!!error[a.id] && <Text testID={`aitour-free-error-${a.id}`} style={styles.error}>{error[a.id]}</Text>}
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  panel: { padding: 16, borderRadius: 16, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, gap: 12, marginBottom: 16 },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '700' }, label: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  hint: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19 },
  item: { gap: 8, paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  button: { minHeight: 44, justifyContent: 'center', paddingVertical: 10 }, link: { color: COLORS.primary, fontSize: 14 },
  error: { color: COLORS.danger, fontSize: 13 },
});