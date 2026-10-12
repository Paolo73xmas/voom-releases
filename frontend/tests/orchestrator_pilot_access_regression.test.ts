import { describe, expect, it, vi } from 'vitest';
import { probeOrchestratorAccess, type OrchestratorClient } from '../lib/aitour/gptour-orchestrator-api';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

function makeClient(status: number): OrchestratorClient {
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'token', user: { id: 'owner-1' } } }, error: null })),
    },
    functions: {
      invoke: vi.fn(async () => {
        if (status === 200) return { data: { ok: true }, error: null };
        return { data: null, error: { context: new Response('{}', { status }) } };
      }),
    },
  } as unknown as OrchestratorClient;
}

describe('orchestrator pilot access and config regressions', () => {
  it.each([
    [400, 'enabled'],
    [403, 'not_allowed'],
    [503, 'disabled'],
    [500, 'unavailable'],
  ] as const)('probeOrchestratorAccess maps HTTP %s to %s', async (status, expected) => {
    const access = await probeOrchestratorAccess(
      {
        binding: {
          version: '1.0',
          provenance: 'handoff-verified',
          historyMode: 'local-transcript',
          recoveryRevision: 'confirmed',
          encodeAction: () => ({ type: 'noop' }),
          decodeResponse: () => ({
            sessionId: 's',
            revision: 1,
            status: 'ready',
            warnings: [],
            criteria: [],
            pendingDecisions: [],
            questions: [],
            messages: [],
            plan: null,
            planId: null,
          }),
        },
        client: makeClient(status),
        isolatedTest: true,
      },
      'owner-1',
      () => true,
    );

    expect(access).toBe(expected);
  });

  it('pilot config is strict boolean true and verified provenance only', async () => {
    vi.resetModules();
    vi.doMock('expo-constants', () => ({
      default: { expoConfig: { extra: { gptourOrchestratorPilotEnabled: true } } },
    }));
    vi.doMock('../lib/aitour/orchestrator/binding', () => ({
      APPROVED_ORCHESTRATOR_BINDING: { provenance: 'handoff-verified' },
    }));
    const mod = await import('../lib/aitour/orchestrator/pilot-config');
    expect(mod.orchestratorPilotEnabled()).toBe(true);
  });

  it('pilot config rejects non-boolean and unverified provenance', async () => {
    vi.resetModules();
    vi.doMock('expo-constants', () => ({
      default: { expoConfig: { extra: { gptourOrchestratorPilotEnabled: 'true' } } },
    }));
    vi.doMock('../lib/aitour/orchestrator/binding', () => ({
      APPROVED_ORCHESTRATOR_BINDING: { provenance: 'handoff-verified' },
    }));
    const strict = await import('../lib/aitour/orchestrator/pilot-config');
    expect(strict.orchestratorPilotEnabled()).toBe(false);

    vi.resetModules();
    vi.doMock('expo-constants', () => ({
      default: { expoConfig: { extra: { gptourOrchestratorPilotEnabled: true } } },
    }));
    vi.doMock('../lib/aitour/orchestrator/binding', () => ({
      APPROVED_ORCHESTRATOR_BINDING: { provenance: 'fixture' },
    }));
    const provenance = await import('../lib/aitour/orchestrator/pilot-config');
    expect(provenance.orchestratorPilotEnabled()).toBe(false);
  });
});