import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { APPROVED_ORCHESTRATOR_BINDING, decodeOfficialResponse } from '../lib/aitour/orchestrator/binding';
import { buildRequest } from '../lib/aitour/orchestrator/request';
import { OrchestratorError } from '../lib/aitour/orchestrator/errors';
import { createOrchestratorTransport, probeOrchestratorAccess, type OrchestratorClient } from '../lib/aitour/gptour-orchestrator-api';
import type { RequestEnvelope } from '../lib/aitour/orchestrator/contract';
import { syntheticOfficialResponse } from './fixtures/orchestrator-official-synthetic';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

const FIXTURE_DIR = './fixtures/official-handoff/gptour_mobile_handoff/examples/';
const fixture = <T>(name: string): T => JSON.parse(readFileSync(fileURLToPath(new URL(`${FIXTURE_DIR}${name}`, import.meta.url) as any), 'utf8')) as T;
const responseError = (status: number, body: unknown) => ({ data: null, error: { context: new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }) } });

function requestFrom(file: string): RequestEnvelope {
  return buildRequest(fixture<RequestEnvelope>(file));
}

function clientWithInvoke(invoke: ReturnType<typeof vi.fn>): OrchestratorClient {
  const getSession = vi.fn(async () => ({ data: { session: { access_token: 'token', user: { id: 'owner-1' } } }, error: null }));
  return { auth: { getSession }, functions: { invoke } } as unknown as OrchestratorClient;
}

describe('Official Orchestrator API1.0 binding/transport contract tests', () => {
  it('validates all 8 structured actions; get_plan requires planId', () => {
    const encode = APPROVED_ORCHESTRATOR_BINDING.encodeAction;
    expect(encode({ name: 'answer', input: { questionId: 'q1', optionId: 'o1' } })).toEqual({ type: 'answer', questionId: 'q1', optionId: 'o1' });
    expect(encode({ name: 'set_date', input: { date: '2026-10-12' } })).toEqual({ type: 'set_date', date: '2026-10-12' });
    expect(encode({ name: 'set_start_time', input: { time: '07:30' } })).toEqual({ type: 'set_start_time', time: '07:30' });
    expect(encode({ name: 'follow_up_decision', input: { followUpId: 'fu-1', decision: 'exclude' } })).toEqual({ type: 'follow_up_decision', followUpId: 'fu-1', decision: 'exclude' });
    expect(encode({ name: 'require_stop', input: { key: 'cust:1' } })).toEqual({ type: 'require_stop', key: 'cust:1' });
    expect(encode({ name: 'exclude_stop', input: { key: 'tab:1' } })).toEqual({ type: 'exclude_stop', key: 'tab:1' });
    expect(encode({ name: 'get_plan', input: { planId: 'plan-1' } })).toEqual({ type: 'get_plan', planId: 'plan-1' });
    expect(encode({ name: 'reset' })).toEqual({ type: 'reset' });
    expect(() => encode({ name: 'get_plan', input: {} })).toThrowError(OrchestratorError);
  });

  it('validates request envelope and decodes official 02; rejects official 04 excerpt', () => {
    const req = requestFrom('01_request_turn1.json');
    expect(() => APPROVED_ORCHESTRATOR_BINDING.validateRequest?.(req)).not.toThrow();
    expect(() => APPROVED_ORCHESTRATOR_BINDING.validateRequest?.({ ...req, expectedRevision: -1 })).toThrowError(OrchestratorError);

    const turn1 = fixture<unknown>('02_response_turn1_needs_clarification.json');
    const snapshot = decodeOfficialResponse(turn1, req);
    expect(snapshot.status).toBe('needs_clarification');
    expect(snapshot.plan).toBeNull();
    expect(snapshot.questions[0].id).toContain('followups:');
    expect(snapshot.questions[0].followUps?.map(f => f.id)).toEqual(['<uuid-evento-1>', '<uuid-evento-2>']);
    expect(snapshot.criteria).toContain('Clienti esistenti');
    expect(snapshot.criteria).toContain('Nuovi punti mai visitati');
    expect(snapshot.criteria).toContain('MILANO');

    const turn2Req = requestFrom('03_request_turn2_answer.json');
    const excerpt = fixture<unknown>('04_response_turn2_ready_excerpt.json');
    expect(() => decodeOfficialResponse(excerpt, turn2Req)).toThrowError(OrchestratorError);
  });

  it('handles reduced403 + full403/full422 built from 02 and maps 400/401/409/500/503', async () => {
    const errors = fixture<Record<string, { http: number; body: unknown }>>('05_errors.json');
    const req = requestFrom('01_request_turn1.json');

    const reduced403 = decodeOfficialResponse(errors['403_pilot_not_enabled_gateway_body_ridotto'].body, req);
    expect(reduced403.status).toBe('blocked');
    expect(reduced403.errorCode).toBe('pilot_not_enabled');
    expect(reduced403.sessionId).toBe(req.sessionId);
    expect(reduced403.revisionConfirmed).toBe(false);

    const baseTurn1 = fixture<Record<string, unknown>>('02_response_turn1_needs_clarification.json');
    const full403 = { ...baseTurn1, status: 'blocked', plan: null, planId: null, question: null, message: 'La sessione è legata a un altro agente: apri una nuova sessione.', errorCode: 'agent_mismatch' };
    const full422 = { ...baseTurn1, status: 'failed', plan: null, planId: null, question: null, message: 'Servizio di calcolo percorsi non disponibile.', errorCode: 'routing_unavailable' };

    for (const [status, body, expected] of [
      [403, full403, 'blocked'],
      [422, full422, 'failed'],
    ] as const) {
      const invoke = vi.fn(async () => responseError(status, body));
      const send = createOrchestratorTransport({ binding: APPROVED_ORCHESTRATOR_BINDING, client: clientWithInvoke(invoke), isolatedTest: true });
      await expect(send(req, 'owner-1', () => true)).resolves.toMatchObject({ status: expected });
    }

    for (const [status, body, expected] of [
      [400, errors['400_identita_nel_payload'].body, 'REQUEST_REJECTED'],
      [401, errors['401'].body, 'AUTH_REQUIRED'],
      [500, errors['500'].body, 'UNAVAILABLE'],
      [503, errors['503'].body, 'UNAVAILABLE'],
    ] as const) {
      const send = createOrchestratorTransport({ binding: APPROVED_ORCHESTRATOR_BINDING, client: clientWithInvoke(vi.fn(async () => responseError(status, body))), isolatedTest: true });
      await expect(send(req, 'owner-1', () => true)).rejects.toMatchObject({ code: expected });
    }

    for (const revision of [0, 2]) {
      const body = { ...(errors['409_revision_conflict'].body as Record<string, unknown>), sessionRevision: revision };
      const send = createOrchestratorTransport({ binding: APPROVED_ORCHESTRATOR_BINDING, client: clientWithInvoke(vi.fn(async () => responseError(409, body))), isolatedTest: true });
      await expect(send(req, 'owner-1', () => true)).rejects.toMatchObject({ code: 'CONFLICT', details: { revision } });
    }
  });

  it('probe uses exact body and maps 400 enabled, 403 denied, 503 disabled', async () => {
    const errors = fixture<Record<string, { http: number; body: unknown }>>('05_errors.json');
    for (const [bodyKey, expected] of [
      ['400_sonda_utente_abilitato', 'enabled'],
      ['403_blocked_contratto_completo', 'not_allowed'],
      ['503', 'disabled'],
    ] as const) {
      const invoke = vi.fn(async () => responseError(errors[bodyKey]!.http, errors[bodyKey]!.body));
      const access = await probeOrchestratorAccess(
        { binding: APPROVED_ORCHESTRATOR_BINDING, client: clientWithInvoke(invoke), isolatedTest: true },
        'owner-1',
        () => true,
      );
      expect(access).toBe(expected);
      expect(invoke).toHaveBeenCalled();
      const sentBody = (invoke as any).mock.calls[0]?.[1]?.body;
      expect(sentBody).toEqual({ contractVersion: '1.0' });
    }
  });

  it('rejects malformed contractVersion/requestId/sessionId/revision/criteria/coords/planId payloads', async () => {
    const req = requestFrom('01_request_turn1.json');
    const valid = syntheticOfficialResponse(req, 'ready');
    const malformedCases: [string, unknown][] = [
      ['contractVersion', { ...valid, contractVersion: '9.9' }],
      ['requestId', { ...valid, requestId: 'different' }],
      ['sessionId', { ...valid, sessionId: 'other-session' }],
      ['revision', { ...valid, sessionRevision: -1 }],
      ['criteria', { ...valid, criteria: { ...valid.criteria, groups: { ...valid.criteria.groups!, version: 2 } } }],
      ['coords', { ...valid, plan: { ...valid.plan!, geometry: [[91, 9.1]] } }],
      ['planId', { ...valid, planId: 'x', plan: { ...valid.plan!, planId: 'y' } }],
    ];

    for (const [, raw] of malformedCases) {
      const send = createOrchestratorTransport({ binding: APPROVED_ORCHESTRATOR_BINDING, client: clientWithInvoke(vi.fn(async () => ({ data: raw, error: null }))), isolatedTest: true });
      await expect(send(req, 'owner-1', () => true)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
  });
});
