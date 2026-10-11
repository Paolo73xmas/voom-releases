import React, { useState } from 'react';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { APPROVED_ORCHESTRATOR_BINDING } from '../lib/aitour/orchestrator/binding';
import { useOrchestratorSession } from '../hooks/useOrchestratorSession';
import { useOrchestratorAccess } from '../hooks/useOrchestratorAccess';
import { OrchestratorScreen } from '../components/aitour/orchestrator/OrchestratorScreen';
import { TargetAgentControl } from '../components/aitour/orchestrator/TargetAgentControl';

/** No pilot entry in the legacy screen, and no live activation without BOTH gates. Server owns allowlist. */
export default function OrchestratorRoute() {
  const user = useAuthStore(s => s.user), router = useRouter();
  const [target, setTarget] = useState<{ owner: string; id?: string } | null>(null);
  const binding = APPROVED_ORCHESTRATOR_BINDING;
  const enabled = Constants.expoConfig?.extra?.gptourOrchestratorPilotEnabled === true && binding?.provenance === 'handoff-verified';
  const access = useOrchestratorAccess(user?.id ?? null, enabled);
  const admin = user?.role === 'admin' || user?.role === 'admincustom';
  const targetId = admin && target?.owner === user?.id ? target?.id : undefined;
  const { session, state } = useOrchestratorSession(user?.id ?? null, binding, access === 'enabled', targetId);
  return <OrchestratorScreen key={`${user?.id ?? 'anonymous'}:${targetId ?? 'self'}`} state={state} available={access === 'enabled'} access={access} signedIn={!!user}
    targetControl={admin && access === 'enabled' ? <TargetAgentControl key={`${user?.id}:${targetId}`} targetId={targetId} disabled={state.phase === 'sending' || state.phase === 'hydrating' || state.pending}
      onSelect={id => { if (user) setTarget({ owner: user.id, id: id === user.id ? undefined : id }); }} /> : undefined}
    send={async text => { await session?.message(text); }} act={command => { void session?.action(command); }}
    newConversation={() => { void session?.newConversation(); }}
    retry={() => { void session?.retry(); }} recover={() => { void session?.recover(); }}
    legacy={() => router.replace('/gptour')} />;
}