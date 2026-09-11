import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { buildVerificationPayload, submitVerificationRequest, type AnomalyType, type VerificationInput, type VerificationSubject } from '../lib/api/customer-verification';
import { getVerificationPosition } from '../lib/aitour/verification-location';

interface Draft { id: string; input: VerificationInput }
export function useVerificationRequest(agentId: string, contextKey: string, subject: VerificationSubject, onSuccess: (withoutGps: boolean) => void) {
  const key = `aitour_verification_pending:${agentId}:${contextKey}`;
  const [anomalyType, setAnomalyType] = useState<AnomalyType>('geolocation');
  const [notes, setNotes] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [phase, setPhase] = useState<'loading' | 'idle' | 'gps' | 'sending'>('loading');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const draft = useRef<Draft | null>(null), sending = useRef(false), active = useRef(true);
  useEffect(() => {
    active.current = true;
    AsyncStorage.getItem(key).then((raw) => {
      if (!active.current) return;
      if (raw) {
        const saved = JSON.parse(raw) as Draft;
        buildVerificationPayload(saved.id, agentId, saved.input);
        draft.current = saved; setAnomalyType(saved.input.anomalyType); setNotes(saved.input.notes); setPending(true); setConfirm(true);
      }
      setReady(true);
    }).catch(() => { if (active.current) setError('Non è stato possibile leggere i dati salvati. Chiudi e riapri la segnalazione prima di inviare.'); })
      .finally(() => { if (active.current) setPhase('idle'); });
    return () => { active.current = false; };
  }, [key, agentId]);
  const send = async () => {
    if (sending.current || phase !== 'idle' || !agentId || !ready) return;
    sending.current = true; setError('');
    try {
      if (!draft.current) {
        setPhase('gps');
        const agentGps = await getVerificationPosition();
        if (!active.current) return;
        draft.current = { id: randomUUID(), input: { subject, anomalyType, notes, agentGps } };
      }
      // Prima conserva localmente l'identità, poi esegue qualunque scrittura remota.
      setPending(true);
      await AsyncStorage.setItem(key, JSON.stringify(draft.current));
      if (!active.current) return;
      setPending(true); setPhase('sending');
      await submitVerificationRequest(draft.current.id, agentId, draft.current.input);
      await AsyncStorage.removeItem(key);
      if (active.current) onSuccess(!draft.current.input.agentGps);
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Segnalazione non confermata. I dati sono conservati: riprova.'); }
    finally { sending.current = false; if (active.current) setPhase('idle'); }
  };
  return { anomalyType, setAnomalyType, notes, setNotes, confirm, setConfirm, phase, error, pending, ready, send, reportedSubject: draft.current?.input.subject || subject };
}