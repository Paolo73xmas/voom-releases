import { describe, expect, it, vi } from 'vitest';
vi.mock('../lib/supabase', () => ({ supabase: {} }));
import { createOrchestratorTransport, type OrchestratorClient } from '../lib/aitour/gptour-orchestrator-api';
import { buildRequest } from '../lib/aitour/orchestrator/request';
import { OrchestratorError } from '../lib/aitour/orchestrator/errors';
import { fixtureBinding, readySnapshot, REQUEST_BASE } from './fixtures/orchestrator-fixtures';

function clientFactory(): OrchestratorClient {
  const getSession = vi.fn(async () => ({ data: { session: { access_token: 'token-1', user: { id: 'owner-1' } } }, error: null }));
  const invoke = vi.fn(async () => ({ data: readySnapshot(), error: null }));
  return { auth: { getSession }, functions: { invoke } } as unknown as OrchestratorClient;
}

describe('orchestrator transport and request envelope guards', () => {
  it('pins JWT from the current session and strips caller roles without logging tokens', async () => {
    const client = clientFactory(); const log = vi.spyOn(console, 'log');
    await createOrchestratorTransport({ binding: fixtureBinding, client, isolatedTest: true })({ ...REQUEST_BASE, role: 'admin' } as never, 'owner-1', () => true);
    const [name, options] = vi.mocked(client.functions.invoke).mock.calls[0];
    expect(name).toBe('gptour-orchestrator');
    expect(options?.headers).toEqual({ Authorization: 'Bearer token-1' });
    expect(options?.body).not.toHaveProperty('role');
    expect(JSON.stringify(log.mock.calls)).not.toContain('token-1'); log.mockRestore();
  });
  it('timeout includes a blocked getSession and never invokes after a late auth result', async () => {
    const client = clientFactory();
    let resolve!: (v: unknown) => void;
    vi.mocked(client.auth.getSession).mockImplementationOnce(() => new Promise(r => { resolve = r as never; }));
    const send = createOrchestratorTransport({ binding: fixtureBinding, client, isolatedTest: true, timeoutMs: 5 });
    await expect(send(REQUEST_BASE, 'owner-1', () => true)).rejects.toMatchObject({ code: 'NETWORK' });
    resolve({ data: { session: { access_token: 'late-token', user: { id: 'owner-1' } } }, error: null });
    await new Promise(r => setTimeout(r, 0)); expect(client.functions.invoke).not.toHaveBeenCalled();
  });
  it('abort during a non-resolving auth wait rejects promptly without waiting for transport timeout', async () => {
    const client = clientFactory(); vi.mocked(client.auth.getSession).mockImplementationOnce(() => new Promise(() => {}));
    const controller = new AbortController();
    const pending = createOrchestratorTransport({ binding: fixtureBinding, client, isolatedTest: true })(REQUEST_BASE, 'owner-1', () => true, controller.signal);
    controller.abort(); await expect(pending).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(client.functions.invoke).not.toHaveBeenCalled();
  });
  it('account changes after invoke discard the result, not just switches detected before sending', async () => {
    const client = clientFactory();
    vi.mocked(client.auth.getSession).mockResolvedValueOnce({ data: { session: { access_token: 'one', user: { id: 'owner-1' } } }, error: null } as never)
      .mockResolvedValueOnce({ data: { session: { access_token: 'two', user: { id: 'owner-2' } } }, error: null } as never);
    await expect(createOrchestratorTransport({ binding: fixtureBinding, client, isolatedTest: true })(REQUEST_BASE, 'owner-1', () => true))
      .rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
    expect(client.functions.invoke).toHaveBeenCalledTimes(1);
  });
  it('default binding null blocks invoke with HANDOFF_REQUIRED', async () => {
    const client = clientFactory();
    const send = createOrchestratorTransport({ binding: null, client, isolatedTest: true });
    await expect(send(REQUEST_BASE, 'owner-1', () => true)).rejects.toMatchObject({ code: 'HANDOFF_REQUIRED' });
    expect((client.functions.invoke as unknown as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('isolated-fixture binding requires BOTH isolatedTest and injected client', async () => {
    const client = clientFactory();
    await expect(createOrchestratorTransport({ binding: fixtureBinding, isolatedTest: true })(REQUEST_BASE, 'owner-1', () => true))
      .rejects.toMatchObject({ code: 'HANDOFF_REQUIRED' });
    await expect(createOrchestratorTransport({ binding: fixtureBinding, client })(REQUEST_BASE, 'owner-1', () => true))
      .rejects.toMatchObject({ code: 'HANDOFF_REQUIRED' });
    await expect(createOrchestratorTransport({ binding: fixtureBinding, client, isolatedTest: true })(REQUEST_BASE, 'owner-1', () => true))
      .resolves.toMatchObject({ status: 'ready' });
  });

  it('whitelist rejects malformed envelopes and auth-like payload fields', () => {
    expect(() => buildRequest({ ...REQUEST_BASE, message: undefined, action: undefined } as never)).toThrowError(OrchestratorError);
    expect(() => buildRequest({ ...REQUEST_BASE, action: { role: 'admin' }, message: undefined } as never)).toThrowError(OrchestratorError);
    expect(() => buildRequest({ ...REQUEST_BASE, contractVersion: '9.9' as never })).toThrowError(OrchestratorError);
    expect(() => buildRequest({ ...REQUEST_BASE, action: { ok: true }, message: 'x' } as never)).toThrowError(OrchestratorError);
  });

  it('transport maps 401/403/409/503 and does not auto-retry', async () => {
    for (const [status, expected] of [[401, 'AUTH_REQUIRED'], [403, 'FORBIDDEN'], [409, 'CONFLICT'], [503, 'UNAVAILABLE']] as const) {
      const client = clientFactory();
      (client.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: null, error: { context: { status } } });
      const send = createOrchestratorTransport({ binding: fixtureBinding, client, isolatedTest: true });
      await expect(send(REQUEST_BASE, 'owner-1', () => true)).rejects.toMatchObject({ code: expected });
      expect((client.functions.invoke as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    }
  });

  it('timeout, abort, stale identity and malformed decode become safe errors', async () => {
    const timeoutClient = clientFactory();
    (timeoutClient.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockImplementation(async () => new Promise(resolve => setTimeout(() => resolve({ data: null, error: null }), 50)));
    const timeoutSend = createOrchestratorTransport({ binding: fixtureBinding, client: timeoutClient, isolatedTest: true, timeoutMs: 5 });
    await expect(timeoutSend(REQUEST_BASE, 'owner-1', () => true)).rejects.toMatchObject({ code: 'NETWORK' });

    const abortClient = clientFactory();
    const controller = new AbortController();
    controller.abort();
    const abortSend = createOrchestratorTransport({ binding: fixtureBinding, client: abortClient, isolatedTest: true });
    await expect(abortSend(REQUEST_BASE, 'owner-1', () => true, controller.signal)).rejects.toMatchObject({ code: 'CANCELLED' });

    const staleClient = clientFactory();
    const staleSend = createOrchestratorTransport({ binding: fixtureBinding, client: staleClient, isolatedTest: true });
    await expect(staleSend(REQUEST_BASE, 'owner-1', () => false)).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });

    const malformedClient = clientFactory();
    (malformedClient.functions.invoke as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { wrong: true }, error: null });
    const malformedSend = createOrchestratorTransport({ binding: fixtureBinding, client: malformedClient, isolatedTest: true });
    await expect(malformedSend(REQUEST_BASE, 'owner-1', () => true)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('controller payload keeps user text unchanged (no local parsing)', () => {
    for (const text of ['clienti15/20/30', 'misti', 'new', 'oggi', 'domani']) {
      const out = buildRequest({ ...REQUEST_BASE, requestId: `req-${text}`, message: text });
      expect(out.message).toBe(text);
    }
  });
});
