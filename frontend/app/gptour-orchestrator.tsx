import React from 'react';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { APPROVED_ORCHESTRATOR_BINDING } from '../lib/aitour/orchestrator/contract';
import { useOrchestratorSession } from '../hooks/useOrchestratorSession';
import { OrchestratorScreen } from '../components/aitour/orchestrator/OrchestratorScreen';

/** No pilot entry in the legacy screen, and no live activation without BOTH gates. Server owns allowlist. */
export default function OrchestratorRoute() {
  const user = useAuthStore(s => s.user), router = useRouter();
  const binding = APPROVED_ORCHESTRATOR_BINDING;
  const enabled = Constants.expoConfig?.extra?.gptourOrchestratorPilotEnabled === true && binding?.provenance === 'handoff-verified';
  const { session, state } = useOrchestratorSession(user?.id ?? null, binding, enabled);
  return <OrchestratorScreen key={user?.id ?? 'anonymous'} state={state} available={enabled} signedIn={!!user}
    send={async text => { await session?.message(text); }} act={command => { void session?.action(command); }}
    retry={() => { void session?.retry(); }} recover={() => { void session?.recover(); }}
    legacy={() => router.replace('/gptour')} />;
}