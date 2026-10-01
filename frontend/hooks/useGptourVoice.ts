import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import type { TourCandidate } from '../lib/aitour/types';
export function useGptourVoice(pool: TourCandidate[], onText: (text: string) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false), [transcribing, setTranscribing] = useState(false), [error, setError] = useState('');
  const active = useRef(true), transition = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; if (recorder.isRecording) void recorder.stop().catch(() => undefined); void setAudioModeAsync({ allowsRecording: false }).catch(() => undefined); }; }, [recorder]);
  const toggle = async () => {
    if (transition.current || transcribing) return;
    transition.current = true; setError('');
    try {
      if (!recording) {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) throw new Error('Permesso microfono negato. Puoi scrivere la richiesta o abilitarlo nelle impostazioni.');
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync(); recorder.record(); setRecording(true);
      } else {
        await recorder.stop(); setRecording(false); await setAudioModeAsync({ allowsRecording: false });
        if (!recorder.uri) throw new Error('Registrazione non disponibile.');
        setTranscribing(true);
        const fd = new FormData();
        if (Platform.OS === 'web') { const blob = await (await fetch(recorder.uri)).blob(); fd.append('audio', blob, blob.type.includes('webm') ? 'voce.webm' : 'voce.m4a'); }
        else {
          // React Native FormData accepts the native URI object (not a browser Blob).
          fd.append('audio', { uri: recorder.uri, name: 'voce.m4a', type: 'audio/m4a' } as unknown as Blob);
        }
        const vocabulary = [...new Set(pool.flatMap((c) => [c.city, c.projectName, c.name]).filter(Boolean))].join(', ').slice(0, 1800);
        if (vocabulary) fd.append('prompt', vocabulary);
        const backend = Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL;
        if (!backend) throw new Error('Servizio di dettatura non configurato.');
        const response = await fetch(`${backend}/api/ai-tour/transcribe`, { method: 'POST', body: fd });
        if (!response.ok) throw new Error('Dettatura non disponibile. Riprova oppure scrivi il messaggio.');
        const data = await response.json();
        if (active.current) { if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('Audio non compreso. Riprova.'); onText(data.text.trim()); }
      }
    } catch (e) { if (active.current) setError(e instanceof Error ? e.message : 'Errore microfono.'); }
    finally { transition.current = false; if (active.current) setTranscribing(false); }
  };
  return { recording, transcribing, error, toggle };
}