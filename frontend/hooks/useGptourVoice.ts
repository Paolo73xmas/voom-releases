import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import type { TourCandidate } from '../lib/aitour/types';
import { cleanupGptourAudio } from '../lib/aitour/gptour-voice-lifecycle';
export function useGptourVoice(pool: TourCandidate[], onText: (text: string) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false), [transcribing, setTranscribing] = useState(false), [error, setError] = useState('');
  const active = useRef(true), transition = useRef(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      pending.current?.abort();
      void cleanupGptourAudio(recorder, Platform.OS === 'web', () => setAudioModeAsync({ allowsRecording: false }));
    };
  }, [recorder]);
  const toggle = async () => {
    if (!active.current || transition.current || transcribing) return;
    const operation = new AbortController(); pending.current = operation;
    const cancelled = () => !active.current || operation.signal.aborted;
    transition.current = true; setError('');
    try {
      if (!recording) {
        const permission = await requestRecordingPermissionsAsync();
        if (cancelled()) return;
        if (!permission.granted) throw new Error('Permesso microfono negato. Puoi scrivere la richiesta o abilitarlo nelle impostazioni.');
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        if (cancelled()) { await setAudioModeAsync({ allowsRecording: false }); return; }
        await recorder.prepareToRecordAsync();
        if (cancelled()) return;
        recorder.record(); setRecording(true);
      } else {
        await recorder.stop();
        if (cancelled()) return;
        setRecording(false); await setAudioModeAsync({ allowsRecording: false });
        if (cancelled()) return;
        const uri = recorder.uri;
        if (!uri) throw new Error('Registrazione non disponibile.');
        setTranscribing(true);
        const fd = new FormData();
        if (Platform.OS === 'web') { const blob = await (await fetch(uri, { signal: operation.signal })).blob(); if (cancelled()) return; fd.append('audio', blob, blob.type.includes('webm') ? 'voce.webm' : 'voce.m4a'); }
        else {
          // React Native FormData accepts the native URI object (not a browser Blob).
          fd.append('audio', { uri, name: 'voce.m4a', type: 'audio/m4a' } as unknown as Blob);
        }
        const vocabulary = [...new Set(pool.flatMap((c) => [c.city, c.projectName, c.name]).filter(Boolean))].join(', ').slice(0, 1800);
        if (vocabulary) fd.append('prompt', vocabulary);
        const backend = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL;
        if (!backend) throw new Error('Servizio di dettatura non configurato.');
        const response = await fetch(`${backend}/api/ai-tour/transcribe`, { method: 'POST', body: fd, signal: operation.signal });
        if (cancelled()) return;
        if (!response.ok) throw new Error('Dettatura non disponibile. Riprova oppure scrivi il messaggio.');
        const data = await response.json();
        if (!cancelled()) { if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('Audio non compreso. Riprova.'); onText(data.text.trim()); }
      }
    } catch (e) { if (!cancelled()) setError(e instanceof Error ? e.message : 'Errore microfono.'); }
    finally { transition.current = false; if (!cancelled()) setTranscribing(false); if (pending.current === operation) pending.current = null; }
  };
  return { recording, transcribing, error, toggle };
}