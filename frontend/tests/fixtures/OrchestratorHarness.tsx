/** TEST ONLY. Mount through a temporary route, never enable the production pilot flag. */
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Text, View } from 'react-native';
import { OrchestratorScreen } from '../../components/aitour/orchestrator/OrchestratorScreen';
import { OrchestratorSession } from '../../lib/aitour/orchestrator/session';
import { SessionStore } from '../../lib/aitour/orchestrator/storage';
import { APPROVED_ORCHESTRATOR_BINDING } from '../../lib/aitour/orchestrator/binding';
import { createOrchestratorTransport, type OrchestratorClient } from '../../lib/aitour/gptour-orchestrator-api';
import type { RequestEnvelope } from '../../lib/aitour/orchestrator/contract';
import { syntheticOfficialResponse } from './orchestrator-official-synthetic';
import turn1 from './official-handoff/gptour_mobile_handoff/examples/02_response_turn1_needs_clarification.json';
import { styles as s } from '../../components/aitour/orchestrator/styles';
function createHarness() {
  const values = new Map<string, string>(), requests: RequestEnvelope[] = [], attempted = new Set<string>();
  const storage = { getItem: async (k: string) => values.get(k) ?? null, setItem: async (k: string, v: string) => { values.set(k, v); }, removeItem: async (k: string) => { values.delete(k); } };
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: 'offline-owner' }, access_token: 'offline-not-valid' } }, error: null }) },
    functions: { invoke: async (_name: string, options: { body: RequestEnvelope }) => {
      const req = options.body; requests.push(req);
      const fail = (status: number, body: unknown) => ({ data: null, error: { context: new Response(JSON.stringify(body), { status }) } });
      if (req.message === 'errore503' && !attempted.has(req.requestId)) { attempted.add(req.requestId); return fail(503, { error: 'Servizio temporaneamente non disponibile' }); }
      if (req.message === 'conflitto') return fail(409, { status: 'failed', errorCode: 'revision_conflict', sessionRevision: 20, message: 'Revisione cambiata' });
      if (req.message === 'inizio') return { data: { ...turn1, sessionId: req.sessionId, requestId: req.requestId, sessionRevision: Number(req.expectedRevision ?? 0) + 1 }, error: null };
      const action = req.action as { type?: string } | undefined;
      const status = action?.type === 'follow_up_decision' || req.message === 'stimato' ? 'planning'
        : req.message === 'impossibile' ? 'infeasible' : req.message === 'bloccato' ? 'blocked' : req.message === 'fallito' ? 'failed' : 'ready';
      const data = syntheticOfficialResponse(req, status);
      data.question = null; data.dataQuality.notes = ['Nota qualità dati dal motore'];
      if (status === 'blocked') return fail(403, data);
      if (status === 'failed') return fail(422, data);
      return { data, error: null };
    } } } as unknown as OrchestratorClient;
  let id = 0;
  const session = new OrchestratorSession({ ownerId: 'offline-owner', currentOwner: () => 'offline-owner', store: new SessionStore(storage),
    binding: APPROVED_ORCHESTRATOR_BINDING, send: createOrchestratorTransport({ binding: APPROVED_ORCHESTRATOR_BINDING, client, isolatedTest: true }), uuid: () => `offline-${++id}` });
  return { session, requests };
}
export default function OrchestratorHarness() {
  const [h] = useState(createHarness);
  const state = useSyncExternalStore(h.session.subscribe, h.session.getSnapshot, h.session.getSnapshot);
  useEffect(() => { void h.session.initialize(); return () => h.session.dispose(); }, [h]);
  return <View style={s.screen}>
    <Text testID="offline-request-count" style={s.muted}>{h.requests.length}</Text>
    <Text testID="offline-request-json" style={s.muted}>{JSON.stringify(h.requests.at(-1) ?? {})}</Text>
    <OrchestratorScreen state={state} available signedIn testPreview send={v => h.session.message(v)} act={c => { void h.session.action(c); }}
      retry={() => { void h.session.retry(); }} recover={() => { void h.session.recover(); }} newConversation={() => { void h.session.newConversation(); }} legacy={() => {}} />
  </View>;
}