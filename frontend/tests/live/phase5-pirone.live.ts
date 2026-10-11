import { afterEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { createOrchestratorTransport, probeOrchestratorAccess, type OrchestratorClient } from '../../lib/aitour/gptour-orchestrator-api';
import { APPROVED_ORCHESTRATOR_BINDING } from '../../lib/aitour/orchestrator/binding';
import { OrchestratorSession } from '../../lib/aitour/orchestrator/session';
import { SessionStore, type KeyStorage } from '../../lib/aitour/orchestrator/storage';
import type { RequestEnvelope } from '../../lib/aitour/orchestrator/contract';
import type { OrchestratorResponse } from '../../lib/aitour/orchestrator/wire-contract';
import { OrchestratorError } from '../../lib/aitour/orchestrator/errors';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(), getAllKeys: vi.fn(async () => []) },
}));
vi.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000999' }));
vi.mock('../../lib/supabase', () => ({ supabase: {} }));

const LIVE_ROOT = '/app/test_reports/phase5_live_first';
const DEFAULT_LEDGER = path.join(LIVE_ROOT, 'edge-ledger.json');
const DEFAULT_MARKER = path.join(LIVE_ROOT, 'run-marker.json');
const DEFAULT_LOCK = path.join(LIVE_ROOT, 'run.lock');
const DEFAULT_PENDING = path.join(LIVE_ROOT, 'pending-request.json');
const REQUIRED_AUTH_VALUE = 'PHASE5_FIRST_LIVE_AUTHORIZED';
const EXPECTED_EMAIL = 'salvatore.pirone@voomweb.it';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AllowedOp = 'auth_password' | 'auth_user' | 'orchestrator';

type Marker = {
  schemaVersion: 1;
  loginAttempted?: boolean;
  authFailed: boolean;
  loginCompleted: boolean;
  stoppedPermanently: boolean;
  preflightCorrectionApplied?: boolean;
};

type LedgerEntry = {
  ts: string;
  operation: AllowedOp;
  requestId: string | null;
  expectedRevision: number | null;
  status: 'reserved' | 'received' | 'failed' | 'timeout';
  durationMs: number | null;
  responseMeta?: Record<string, string>;
  responseSha256?: string;
  requestSha256?: string;
  sessionId?: string | null;
  action?: string | null;
  httpStatus?: number;
};

type Ledger = {
  schemaVersion: 1;
  maxCalls: 25;
  reservedCount: number;
  receivedCount: number;
  entries: LedgerEntry[];
};

type HarnessOptions = {
  ledgerPath?: string;
  markerPath?: string;
  lockPath?: string;
  pendingPath?: string;
  credentialsPath?: string;
  projectRef?: string;
  functionName?: string;
  now?: () => Date;
  noNetwork?: boolean;
};

type Credentials = { email: string; password: string };

class LiveHarnessError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

function sha256Text(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

async function ensureParent(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
}

async function readJsonIfPresent<T>(filePath: string): Promise<T | null> {
  try {
    const txt = await fs.readFile(filePath, 'utf8');
    return JSON.parse(txt) as T;
  } catch (e) {
    if ((e as { code?: string }).code === 'ENOENT') return null;
    throw new LiveHarnessError('LOCAL_AUDIT_UNREADABLE');
  }
}

async function atomicWriteJson(filePath: string, payload: unknown): Promise<void> {
  await ensureParent(filePath);
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(tmp, filePath);
}

function validateLedger(raw: unknown): Ledger {
  const x = raw as Ledger;
  if (!x || x.schemaVersion !== 1 || x.maxCalls !== 25 || !Number.isInteger(x.reservedCount) || !Number.isInteger(x.receivedCount) || !Array.isArray(x.entries)) {
    throw new LiveHarnessError('LEDGER_MALFORMED');
  }
  if (x.reservedCount < 0 || x.receivedCount < 0 || x.reservedCount > 25 || x.receivedCount > x.reservedCount) {
    throw new LiveHarnessError('LEDGER_MALFORMED');
  }
  if (x.entries.length !== x.reservedCount || x.entries.some(e => e.operation !== 'orchestrator')
    || x.entries.filter(e => e.status === 'received').length !== x.receivedCount) throw new LiveHarnessError('LEDGER_MALFORMED');
  return x;
}

function emptyLedger(): Ledger {
  return { schemaVersion: 1, maxCalls: 25, reservedCount: 0, receivedCount: 0, entries: [] };
}

function validatePublicKey(key: string, project: string): void {
  // Current Supabase publishable keys are opaque, not legacy anon JWTs.
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return;
  if (key.startsWith('sb_secret_')) throw new LiveHarnessError('SUPABASE_ANON_INVALID');
  let claims: { role?: string; ref?: string };
  try { claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); }
  catch { throw new LiveHarnessError('SUPABASE_ANON_INVALID'); }
  if (claims.role !== 'anon' || claims.ref !== project) throw new LiveHarnessError('SUPABASE_ANON_INVALID');
}

function zeroNetworkPreflightOnly(marker: Marker, proof: Record<string, unknown>, ledger: Ledger | null): boolean {
  return !marker.loginAttempted && !marker.loginCompleted && !marker.authFailed && !marker.preflightCorrectionApplied
    && marker.stoppedPermanently && proof.errorCode === 'SUPABASE_ANON_INVALID'
    && proof.edgeReserved === 0 && proof.edgeResponses === 0
    && Array.isArray(proof.authAudit) && proof.authAudit.length === 0
    && Array.isArray(proof.steps) && proof.steps.length === 0
    && (!ledger || (validateLedger(ledger).reservedCount === 0 && ledger.receivedCount === 0));
}

function parseOperation(url: URL, method: string, expectedOrigin: string, functionName: string): AllowedOp {
  if (url.origin !== expectedOrigin || url.protocol !== 'https:') throw new LiveHarnessError('NETWORK_DENIED');
  if (method === 'POST' && url.pathname === '/auth/v1/token' && url.search === '?grant_type=password') return 'auth_password';
  if (method === 'GET' && url.pathname === '/auth/v1/user' && url.search === '') return 'auth_user';
  if (method === 'POST' && url.pathname === `/functions/v1/${functionName}` && url.search === '') return 'orchestrator';
  throw new LiveHarnessError('NETWORK_DENIED');
}

async function reserveLedgerCall(ledgerPath: string, operation: AllowedOp, requestId: string | null, expectedRevision: number | null, now: () => Date, request?: Partial<RequestEnvelope>): Promise<void> {
  if (operation !== 'orchestrator') throw new LiveHarnessError('LEDGER_EDGE_ONLY');
  const raw = await readJsonIfPresent<Ledger>(ledgerPath);
  const ledger = raw ? validateLedger(raw) : emptyLedger();
  if (ledger.reservedCount >= ledger.maxCalls) throw new LiveHarnessError('EDGE_LIMIT_REACHED');
  ledger.reservedCount += 1;
  ledger.entries.push({
    ts: now().toISOString(),
    operation,
    requestId,
    expectedRevision,
    status: 'reserved',
    durationMs: null,
    sessionId: request?.sessionId ?? null,
    action: typeof request?.action === 'object' && request.action && !Array.isArray(request.action) ? String(request.action.type) : null,
    ...(request ? { requestSha256: sha256Text(canonical(request)) } : {}),
  });
  await atomicWriteJson(ledgerPath, ledger);
}

async function finalizeLedgerCall(ledgerPath: string, operation: AllowedOp, requestId: string | null, status: 'received' | 'failed' | 'timeout', durationMs: number, responseMeta: Record<string, string>, responseBody: string | null, httpStatus?: number): Promise<void> {
  const raw = await readJsonIfPresent<Ledger>(ledgerPath);
  const ledger = validateLedger(raw ?? emptyLedger());
  const idx = [...ledger.entries].reverse().findIndex((e) => e.operation === operation && e.requestId === requestId && e.status === 'reserved');
  if (idx < 0) throw new LiveHarnessError('LEDGER_MALFORMED');
  const realIndex = ledger.entries.length - 1 - idx;
  ledger.entries[realIndex] = {
    ...ledger.entries[realIndex],
    status,
    durationMs,
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    ...(responseBody ? { responseSha256: sha256Text(responseBody) } : {}),
    ...(Object.keys(responseMeta).length ? { responseMeta } : {}),
  };
  if (status === 'received') ledger.receivedCount += 1;
  await atomicWriteJson(ledgerPath, ledger);
}

function redactError(): LiveHarnessError {
  return new LiveHarnessError('LIVE_FLOW_ABORTED');
}

async function readPironeCredentials(credentialsPath: string): Promise<Credentials> {
  const data = await fs.readFile(credentialsPath, 'utf8');
  const lines = data.split(/\r?\n/);
  const lower = lines.map((l) => l.toLowerCase());
  const idx = lower.findIndex((l) => l.includes(EXPECTED_EMAIL));
  if (idx < 0) throw new LiveHarnessError('CREDENTIALS_NOT_FOUND');
  const email = EXPECTED_EMAIL;
  let password = '';
  for (let i = idx; i < Math.min(lines.length, idx + 6); i += 1) {
    const m = lines[i].match(/^\s*[-#]*\s*password\s*:\s*(.+)\s*$/i);
    if (m?.[1]) {
      password = m[1].trim();
      if (password.startsWith('`') && password.endsWith('`')) password = password.slice(1, -1);
      break;
    }
  }
  if (!password) throw new LiveHarnessError('CREDENTIALS_NOT_FOUND');
  return { email, password };
}

function makeMemoryStorage(): KeyStorage {
  const db = new Map<string, string>();
  return {
    async getItem(key: string) { return db.get(key) ?? null; },
    async setItem(key: string, value: string) { db.set(key, value); },
    async removeItem(key: string) { db.delete(key); },
    async getAllKeys() { return [...db.keys()]; },
  };
}

export class Phase5FirstLiveHarness {
  readonly wireReplies: { request: Partial<RequestEnvelope>; httpStatus: number; raw: OrchestratorResponse }[] = [];
  readonly authAudit: { operation: AllowedOp; httpStatus: number }[] = [];
  private authVerified = false;
  private readonly ledgerPath: string;
  private readonly markerPath: string;
  private readonly lockPath: string;
  private readonly pendingPath: string;
  private readonly credentialsPath: string;
  private readonly projectRef: string;
  private readonly functionName: string;
  private readonly now: () => Date;
  private readonly noNetwork: boolean;
  private lockFd: fs.FileHandle | null = null;
  private fetchQueue: Promise<unknown> = Promise.resolve();
  private nativeFetch: typeof fetch;

  constructor(options: HarnessOptions = {}) {
    this.ledgerPath = options.ledgerPath ?? DEFAULT_LEDGER;
    this.markerPath = options.markerPath ?? DEFAULT_MARKER;
    this.lockPath = options.lockPath ?? DEFAULT_LOCK;
    this.pendingPath = options.pendingPath ?? DEFAULT_PENDING;
    this.credentialsPath = options.credentialsPath ?? '/app/memory/test_credentials.md';
    this.projectRef = options.projectRef ?? 'gorwxfzzyzxmxnizmebw';
    this.functionName = options.functionName ?? 'gptour-orchestrator';
    this.now = options.now ?? (() => new Date());
    this.noNetwork = options.noNetwork ?? true;
    if (!globalThis.fetch) throw new LiveHarnessError('FETCH_UNAVAILABLE');
    this.nativeFetch = globalThis.fetch.bind(globalThis);
  }

  async acquireRunLock(): Promise<void> {
    const marker = await this.readMarker();
    if (marker.stoppedPermanently && (marker.loginAttempted || marker.loginCompleted || marker.authFailed)) {
      throw new LiveHarnessError('RUN_PERMANENTLY_STOPPED'); // Preserve completed result/ledger; no rerun or output overwrite.
    }
    await ensureParent(this.lockPath);
    this.lockFd = await fs.open(this.lockPath, 'wx', 0o600).catch(() => { throw new LiveHarnessError('RUN_LOCKED'); });
  }

  async releaseRunLock(): Promise<void> {
    if (!this.lockFd) return;
    try { await this.lockFd.close(); } finally { this.lockFd = null; }
    await fs.unlink(this.lockPath).catch(() => {});
  }

  async preflight(): Promise<{ ok: true; noNetwork: boolean }> {
    if (process.env.GPTOUR_FIRST_LIVE_AUTHORIZED !== REQUIRED_AUTH_VALUE) {
      throw new LiveHarnessError('LIVE_NOT_AUTHORIZED');
    }
    const marker = await this.readMarker();
    if (marker.stoppedPermanently || marker.authFailed) throw new LiveHarnessError('RUN_PERMANENTLY_STOPPED');
    await readPironeCredentials(this.credentialsPath);
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) throw new LiveHarnessError('SUPABASE_ENV_MISSING');
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== `${this.projectRef}.supabase.co` || parsed.pathname !== '/'
      || parsed.search || parsed.hash || parsed.username || parsed.password) throw new LiveHarnessError('SUPABASE_ENV_INVALID');
    validatePublicKey(anon, this.projectRef);
    const ledger = await readJsonIfPresent<Ledger>(this.ledgerPath);
    if (ledger) validateLedger(ledger);
    return { ok: true, noNetwork: this.noNetwork };
  }

  private async readMarker(): Promise<Marker> {
    const marker = await readJsonIfPresent<Marker>(this.markerPath);
    if (!marker) return { schemaVersion: 1, authFailed: false, loginCompleted: false, stoppedPermanently: false };
    if (marker.schemaVersion !== 1 || !['authFailed', 'loginCompleted', 'stoppedPermanently'].every(k => typeof marker[k as keyof Marker] === 'boolean')) throw new LiveHarnessError('MARKER_INVALID');
    return marker;
  }

  private async writeMarker(marker: Marker): Promise<void> {
    await atomicWriteJson(this.markerPath, marker);
  }

  installGlobalFetchGuard(): void {
    const expectedOrigin = `https://${this.projectRef}.supabase.co`;
    const functionName = this.functionName;
    const ledgerPath = this.ledgerPath;
    const now = this.now;
    const noNetwork = this.noNetwork;
    const nativeFetch = this.nativeFetch;
    let authPostCount = 0;
    let authGetCount = 0;

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const run = async () => {
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        const url = typeof input === 'string' ? new URL(input) : input instanceof URL ? input : new URL(input.url);
        const op = parseOperation(url, method, expectedOrigin, functionName);
        if (noNetwork) throw new LiveHarnessError('NO_NETWORK_MODE');
        if (op === 'orchestrator' && !this.authVerified) throw new LiveHarnessError('AUTH_NOT_VERIFIED');
        if (op === 'auth_password') {
          authPostCount += 1;
          if (authPostCount > 1) throw new LiveHarnessError('SECOND_LOGIN_BLOCKED');
        }
        if (op === 'auth_user') {
          authGetCount += 1;
          if (authGetCount > 1) throw new LiveHarnessError('SECOND_GETUSER_BLOCKED');
        }

        let requestId: string | null = null;
        let expectedRevision: number | null = null;
        let request: Partial<RequestEnvelope> = {};
        if (op === 'orchestrator' && init?.body && typeof init.body === 'string') {
          try {
            const body = JSON.parse(init.body) as Partial<RequestEnvelope>;
            request = body;
            requestId = typeof body.requestId === 'string' ? body.requestId : null;
            expectedRevision = typeof body.expectedRevision === 'number' ? body.expectedRevision : null;
          } catch {
            throw new LiveHarnessError('OUTBOUND_JSON_INVALID');
          }
        }

        if (op === 'orchestrator') await reserveLedgerCall(ledgerPath, op, requestId, expectedRevision, now, request);

        const started = Date.now();
        try {
          const res = await nativeFetch(input, { ...init, redirect: 'error' });
          if (res.redirected) throw new LiveHarnessError('REDIRECT_DENIED');
          if (op !== 'orchestrator') { this.authAudit.push({ operation: op, httpStatus: res.status }); return res; }
          const allowHeaders = ['x-sb-edge-region', 'sb-request-id', 'x-supabase-api-version', 'x-supabase-version'];
          const meta: Record<string, string> = {};
          for (const h of allowHeaders) {
            const value = res.headers.get(h);
            if (value) meta[h] = value;
          }
          const clone = res.clone();
          const text = await clone.text();
          await finalizeLedgerCall(ledgerPath, op, requestId, 'received', Date.now() - started, meta, text, res.status);
          try { this.wireReplies.push({ request, httpStatus: res.status, raw: JSON.parse(text) }); } catch { /* decoder rejects non-JSON */ }
          return res;
        } catch {
          if (op === 'orchestrator') await finalizeLedgerCall(ledgerPath, op, requestId, 'timeout', Date.now() - started, {}, null);
          throw redactError();
        }
      };
      this.fetchQueue = this.fetchQueue.then(run, run);
      return this.fetchQueue as Promise<Response>;
    }) as typeof fetch;
  }

  restoreGlobalFetch(): void {
    globalThis.fetch = this.nativeFetch;
  }

  buildClient(): SupabaseClient {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) throw new LiveHarnessError('SUPABASE_ENV_MISSING');
    return createClient(url, anon, {
      global: { fetch: globalThis.fetch },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  async authenticateOnce(client: SupabaseClient): Promise<{ userId: string }> {
    const marker = await this.readMarker();
    if (marker.loginCompleted || marker.loginAttempted) throw new LiveHarnessError('SECOND_LOGIN_BLOCKED');
    if (marker.authFailed || marker.stoppedPermanently) throw new LiveHarnessError('RUN_PERMANENTLY_STOPPED');
    const creds = await readPironeCredentials(this.credentialsPath);
    await this.writeMarker({ ...marker, loginAttempted: true, stoppedPermanently: true });
    const { data, error } = await client.auth.signInWithPassword({ email: creds.email, password: creds.password });
    if (error || !data.session?.access_token || !data.user?.id || data.user.email?.toLowerCase() !== EXPECTED_EMAIL) {
      await this.writeMarker({ schemaVersion: 1, authFailed: true, loginCompleted: false, stoppedPermanently: true });
      throw new LiveHarnessError('AUTH_FAILED');
    }
    if (!UUID_RE.test(data.user.id)) {
      await this.writeMarker({ schemaVersion: 1, authFailed: true, loginCompleted: false, stoppedPermanently: true });
      throw new LiveHarnessError('AUTH_FAILED');
    }

    const got = await client.auth.getUser();
    if (got.error || !got.data.user || got.data.user.id !== data.user.id || got.data.user.email?.toLowerCase() !== EXPECTED_EMAIL) {
      await this.writeMarker({ schemaVersion: 1, authFailed: true, loginCompleted: false, stoppedPermanently: true });
      throw new LiveHarnessError('AUTH_FAILED');
    }

    this.authVerified = true;
    await this.writeMarker({ schemaVersion: 1, loginAttempted: true, authFailed: false, loginCompleted: true, stoppedPermanently: false });
    return { userId: data.user.id };
  }

  async dryRunNoNetwork(): Promise<{ preflight: 'ok'; networkCalls: number; sessionInit: 'ok'; transportInit: 'ok' }> {
    await this.preflight();
    this.installGlobalFetchGuard();
    const client = this.buildClient();
    const transport = createOrchestratorTransport({
      binding: APPROVED_ORCHESTRATOR_BINDING,
      client: client as unknown as OrchestratorClient,
      isolatedTest: true,
      timeoutMs: 30_000,
    });
    const store = new SessionStore(makeMemoryStorage());
    const session = new OrchestratorSession({
      ownerId: '00000000-0000-4000-8000-000000000001',
      currentOwner: () => '00000000-0000-4000-8000-000000000001',
      binding: APPROVED_ORCHESTRATOR_BINDING,
      send: transport,
      store,
      uuid: randomUUID,
    });
    await session.initialize();
    session.dispose();
    this.restoreGlobalFetch();
    return { preflight: 'ok', networkCalls: 0, sessionInit: 'ok', transportInit: 'ok' };
  }

  async prepareForFutureLiveRun(): Promise<{ command: string }> {
    await this.preflight();
    return {
      command:
        'GPTOUR_FIRST_LIVE_AUTHORIZED=PHASE5_FIRST_LIVE_AUTHORIZED GPTOUR_FIRST_LIVE_MODE=execute yarn vitest run --config tests/live/vitest.live.config.ts --reporter=default',
    };
  }

  async probeAccess(client: SupabaseClient, ownerId: string): Promise<'enabled' | 'not_allowed' | 'disabled' | 'unavailable'> {
    const transportOptions = {
      binding: APPROVED_ORCHESTRATOR_BINDING,
      client: client as unknown as OrchestratorClient,
      isolatedTest: true,
      timeoutMs: 30_000,
    };
    return probeOrchestratorAccess(transportOptions, ownerId, () => true);
  }

  async persistPendingRequestSafe(request: RequestEnvelope): Promise<void> {
    const payload = {
      schemaVersion: 1,
      requestId: request.requestId,
      expectedRevision: request.expectedRevision ?? null,
      requestSha256: sha256Text(JSON.stringify(request)),
      savedAt: this.now().toISOString(),
    };
    await atomicWriteJson(this.pendingPath, payload);
    await fs.chmod(this.pendingPath, 0o600).catch(() => {});
  }

  async permanentlyStop(): Promise<void> {
    const marker = await this.readMarker();
    await this.writeMarker({ ...marker, stoppedPermanently: true });
  }

  /** One documented harness-only correction, never permission to retry a failed/started login. */
  async correctZeroNetworkPreflight(): Promise<void> {
    if (process.env.GPTOUR_CORRECT_PUBLISHABLE_PREFLIGHT !== 'PROVEN_ZERO_NETWORK') return;
    const marker = await this.readMarker();
    const proof = await readJsonIfPresent<Record<string, unknown>>(path.join(LIVE_ROOT, 'live-result.json'));
    const ledger = await readJsonIfPresent<Ledger>(this.ledgerPath);
    if (!proof || !zeroNetworkPreflightOnly(marker, proof, ledger)) throw new LiveHarnessError('PREFLIGHT_CORRECTION_DENIED');
    const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
    if (!key.startsWith('sb_publishable_')) throw new LiveHarnessError('PREFLIGHT_CORRECTION_DENIED');
    validatePublicKey(key, this.projectRef);
    await atomicWriteJson(path.join(LIVE_ROOT, 'preflight-incident-original.json'), { result: proof, marker,
      correction: 'Harness supports existing publishable key; no env/account/key change; no auth or Edge call had started', ledgerUnchanged: true });
    await this.writeMarker({ ...marker, stoppedPermanently: false, preflightCorrectionApplied: true });
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

const executeMode = process.env.GPTOUR_FIRST_LIVE_MODE === 'execute';
afterEach(() => { vi.unstubAllEnvs(); });
describe.skipIf(executeMode)('phase5 live harness dry-run only', () => {
  it('fails closed for malformed ledger', async () => {
    const dir = `/tmp/phase5-live-${Date.now()}-a`;
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const ledgerPath = path.join(dir, 'edge-ledger.json');
    await fs.writeFile(ledgerPath, '{"schemaVersion":99}', { mode: 0o600 });
    await expect(reserveLedgerCall(ledgerPath, 'orchestrator', 'r', 0, () => new Date())).rejects.toBeInstanceOf(LiveHarnessError);
  });

  it('blocks non-allowlisted endpoint with no network leak', async () => {
    const dir = `/tmp/phase5-live-${Date.now()}-b`;
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const harness = new Phase5FirstLiveHarness({
      ledgerPath: path.join(dir, 'edge-ledger.json'),
      markerPath: path.join(dir, 'marker.json'),
      lockPath: path.join(dir, 'run.lock'),
      pendingPath: path.join(dir, 'pending.json'),
      noNetwork: true,
    });
    harness.installGlobalFetchGuard();
    await expect(globalThis.fetch('https://gorwxfzzyzxmxnizmebw.supabase.co/rest/v1/customers')).rejects.toBeInstanceOf(LiveHarnessError);
    harness.restoreGlobalFetch();
  });

  it('enforces second-login prevention marker', async () => {
    const dir = `/tmp/phase5-live-${Date.now()}-c`;
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    const markerPath = path.join(dir, 'marker.json');
    await atomicWriteJson(markerPath, { schemaVersion: 1, authFailed: false, loginCompleted: true, stoppedPermanently: false });
    const harness = new Phase5FirstLiveHarness({
      ledgerPath: path.join(dir, 'edge-ledger.json'),
      markerPath,
      lockPath: path.join(dir, 'run.lock'),
      pendingPath: path.join(dir, 'pending.json'),
      noNetwork: true,
    });
    const fakeClient = {
      auth: {
        signInWithPassword: vi.fn(async () => ({ data: { user: { id: '00000000-0000-4000-8000-000000000001', email: EXPECTED_EMAIL } }, error: null })),
        getUser: vi.fn(async () => ({ data: { user: { id: '00000000-0000-4000-8000-000000000001', email: EXPECTED_EMAIL } }, error: null })),
      },
    } as unknown as SupabaseClient;
    await expect(harness.authenticateOnce(fakeClient)).rejects.toBeInstanceOf(LiveHarnessError);
  });

  it('dry run initializes transport/session with zero network by default', async () => {
    const dir = `/tmp/phase5-live-${Date.now()}-d`;
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    vi.stubEnv('GPTOUR_FIRST_LIVE_AUTHORIZED', REQUIRED_AUTH_VALUE);
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://gorwxfzzyzxmxnizmebw.supabase.co');
    vi.stubEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role: 'anon', ref: 'gorwxfzzyzxmxnizmebw' })).toString('base64url')}.test`);
    const credsPath = path.join(dir, 'creds.md');
    await fs.writeFile(credsPath, `email: ${EXPECTED_EMAIL}\npassword: x`, { mode: 0o600 });
    const harness = new Phase5FirstLiveHarness({
      ledgerPath: path.join(dir, 'edge-ledger.json'),
      markerPath: path.join(dir, 'marker.json'),
      lockPath: path.join(dir, 'run.lock'),
      pendingPath: path.join(dir, 'pending.json'),
      credentialsPath: credsPath,
      noNetwork: true,
    });
    const out = await harness.dryRunNoNetwork();
    expect(out.networkCalls).toBe(0);
    expect(out.transportInit).toBe('ok');
    expect(out.sessionInit).toBe('ok');
  });
  it('invalid JSON fails closed instead of resetting counter', async () => {
    const dir = await fs.mkdtemp('/tmp/phase5-ledger-invalid-'); const ledger = path.join(dir, 'ledger.json');
    await fs.writeFile(ledger, '{corrupt');
    await expect(reserveLedgerCall(ledger, 'orchestrator', 'r', 0, () => new Date())).rejects.toMatchObject({ code: 'LOCAL_AUDIT_UNREADABLE' });
  });
  it('reserves exactly25 Edge slots and never charges auth as Edge', async () => {
    const dir = await fs.mkdtemp('/tmp/phase5-ledger-limit-'); const ledger = path.join(dir, 'ledger.json');
    for (let i = 0; i < 25; i++) await reserveLedgerCall(ledger, 'orchestrator', `r${i}`, i, () => new Date());
    await expect(reserveLedgerCall(ledger, 'orchestrator', 'extra', 25, () => new Date())).rejects.toMatchObject({ code: 'EDGE_LIMIT_REACHED' });
    await expect(reserveLedgerCall(ledger, 'auth_user', null, null, () => new Date())).rejects.toMatchObject({ code: 'LEDGER_EDGE_ONLY' });
    expect((await readJsonIfPresent<Ledger>(ledger))?.reservedCount).toBe(25);
  });
  it('accepts opaque publishable keys and rejects elevated keys without network', () => {
    expect(() => validatePublicKey('sb_publishable_test_opaque', 'gorwxfzzyzxmxnizmebw')).not.toThrow();
    expect(() => validatePublicKey('sb_secret_test', 'gorwxfzzyzxmxnizmebw')).toThrow();
    const elevated = `eyJ.${Buffer.from(JSON.stringify({ role: 'service_role', ref: 'gorwxfzzyzxmxnizmebw' })).toString('base64url')}.test`;
    expect(() => validatePublicKey(elevated, 'gorwxfzzyzxmxnizmebw')).toThrow();
  });
  it('only corrects zero-network preflight and never allows auth retry or Edge budget reset', () => {
    const marker: Marker = { schemaVersion: 1, authFailed: false, loginCompleted: false, stoppedPermanently: true };
    const proof = { errorCode: 'SUPABASE_ANON_INVALID', edgeReserved: 0, edgeResponses: 0, authAudit: [], steps: [] };
    expect(zeroNetworkPreflightOnly(marker, proof, null)).toBe(true);
    expect(zeroNetworkPreflightOnly({ ...marker, loginAttempted: true }, proof, null)).toBe(false);
    expect(zeroNetworkPreflightOnly({ ...marker, authFailed: true }, proof, null)).toBe(false);
    expect(zeroNetworkPreflightOnly({ ...marker, preflightCorrectionApplied: true }, proof, null)).toBe(false);
    expect(zeroNetworkPreflightOnly(marker, { ...proof, authAudit: [{ operation: 'auth_password', httpStatus: 400 }] }, null)).toBe(false);
    expect(zeroNetworkPreflightOnly(marker, { ...proof, edgeReserved: 1 }, null)).toBe(false);
  });
  it('refuses a completed run before creating a lock or overwriting evidence', async () => {
    const dir = await fs.mkdtemp('/tmp/phase5-completed-');
    const markerPath = path.join(dir, 'marker.json'), lockPath = path.join(dir, 'run.lock');
    await atomicWriteJson(markerPath, { schemaVersion: 1, loginAttempted: true, loginCompleted: true, authFailed: false, stoppedPermanently: true });
    const h = new Phase5FirstLiveHarness({ markerPath, lockPath, ledgerPath: path.join(dir, 'ledger.json'), noNetwork: true });
    await expect(h.acquireRunLock()).rejects.toMatchObject({ code: 'RUN_PERMANENTLY_STOPPED' });
    expect(await readJsonIfPresent(lockPath)).toBeNull();
  });
});

function requireCheck(value: unknown, code: string): asserts value {
  if (!value) throw new LiveHarnessError(code);
}

/** Only server output needed for this test report. No auth response, headers, contact list or excluded pool. */
function responseSummary(raw: OrchestratorResponse) {
  const p = raw.plan;
  return {
    status: raw.status, contractVersion: raw.contractVersion, engineVersion: raw.engineVersion,
    sessionId: raw.sessionId, requestId: raw.requestId, sessionRevision: raw.sessionRevision,
    generatedAt: raw.generatedAt, planId: raw.planId, errorCode: raw.errorCode,
    criteria: raw.criteria, question: raw.question, pendingDecisions: raw.pendingDecisions,
    dataQuality: raw.dataQuality, metrics: raw.metrics, conflicts: raw.conflicts,
    plan: p ? {
      planId: p.planId, sessionRevision: p.sessionRevision, date: p.date,
      startMin: p.startMin, finishMin: p.finishMin, endMin: p.endMin, totals: p.totals,
      verification: p.verification, warnings: p.warnings, dependsOnPendingChanges: p.dependsOnPendingChanges,
      planSha256: sha256Text(canonical(p)), geometrySha256: sha256Text(canonical(p.geometry)),
      geometryPoints: p.geometry?.length, snapshotRef: p.snapshotRef,
      stops: p.stops?.map(s => ({ key: s.key, name: s.name, city: s.city, lat: s.lat, lng: s.lng,
        role: s.role, group: s.group, arrivalMin: s.arrivalMin, departureMin: s.departureMin,
        travelMinFromPrev: s.travelMinFromPrev, travelKmFromPrev: s.travelKmFromPrev,
        visitMin: s.visitMin, waitMin: s.waitMin, lunchBeforeMin: s.lunchBeforeMin,
        lastOrderDate: s.lastOrderDate, daysSinceOrder: s.daysSinceOrder, outsideWindow: s.outsideWindow, reason: s.reason })),
      excludedCount: p.selectionReasons?.excluded?.length,
      days: p.days?.map(d => ({ day: d.day, date: d.date, stops: d.stops.length, totals: d.totals,
        startMin: d.startMin, finishMin: d.finishMin, endMin: d.endMin, warnings: d.warnings, conflicts: d.conflicts,
        geometryPoints: d.geometry.length, returnHomeAfterDay: d.returnHomeAfterDay, startsFrom: d.startsFrom })),
    } : null,
  };
}

it.skipIf(!executeMode)('authorized first live Pirone run — one login,25 Edge global cap', async () => {
  const h = new Phase5FirstLiveHarness({ noNetwork: false });
  let session: OrchestratorSession | undefined;
  const steps: Record<string, unknown>[] = [];
  const report: Record<string, unknown> = {
    startedAt: new Date().toISOString(), scenario: 'Milano domani, misto, includere follow-up; secondo turno ore08',
    method: 'Node with actual mobile transport/binding/session; genuine Supabase authenticated client',
    nativeAndroid: 'NOT_EXECUTED', nativeIPhone: 'NOT_EXECUTED', expoUi: 'NOT_EXECUTED',
    deploymentV6: 'REFERENCE_ONLY_NOT_INDEPENDENTLY_CONFIRMED', pilotFlagChanged: false,
    technicalRows: 'NOT_DIRECTLY_QUERIED: observe session/request/plan IDs only',
    businessWrites: 'No direct requests; existing Edge contract restricts mutations to technical tables. Server-side audit not independently available.',
    steps,
  };
  let failedCode: string | null = null;
  await h.acquireRunLock();
  try {
    await h.correctZeroNetworkPreflight();
    await h.preflight();
    if (!await readJsonIfPresent<Ledger>(DEFAULT_LEDGER)) await atomicWriteJson(DEFAULT_LEDGER, emptyLedger());
    h.installGlobalFetchGuard();
    const client = h.buildClient();
    const { userId } = await h.authenticateOnce(client);
    report.authenticated = true; report.verifiedUserId = userId;
    const access = await h.probeAccess(client, userId);
    steps.push({ step: 'probe', result: access });
    requireCheck(access === 'enabled', 'PILOT_NOT_ENABLED_STOP');
    const transport = createOrchestratorTransport({ binding: APPROVED_ORCHESTRATOR_BINDING, client, timeoutMs: 30_000 });
    const store = new SessionStore(makeMemoryStorage());
    const makeSession = () => new OrchestratorSession({ ownerId: userId, currentOwner: () => userId,
      binding: APPROVED_ORCHESTRATOR_BINDING, store, send: transport, uuid: randomUUID });
    session = makeSession();
    await session.initialize();
    requireCheck(!session.getSnapshot().error, 'LOCAL_SESSION_INIT_FAILED');
    const take = (step: string) => {
      const state = session!.getSnapshot();
      const latest = h.wireReplies.at(-1)!;
      if (state.error) {
        steps.push({ step, httpStatus: latest?.httpStatus, clientError: state.error.code,
          responseStatus: latest?.raw?.status, engineVersion: latest?.raw?.engineVersion,
          contractVersion: latest?.raw?.contractVersion, revision: latest?.raw?.sessionRevision,
          responseFields: Object.keys(latest?.raw ?? {}), criteriaFields: Object.keys(latest?.raw?.criteria ?? {}) });
        throw new LiveHarnessError(`CLIENT_${state.error.code}`);
      }
      steps.push({ step, httpStatus: latest?.httpStatus, clientError: null,
        response: latest?.raw?.sessionId ? responseSummary(latest.raw) : null });
      requireCheck(state.snapshot, 'CLIENT_SNAPSHOT_MISSING');
      return latest;
    };
    const answerApprovedFollowups = async () => {
      for (let i = 0; i < 8; i++) {
        const state = session!.getSnapshot();
        if (state.snapshot?.status !== 'needs_clarification') return;
        const question = state.snapshot.questions[0];
        requireCheck(question?.kind === 'follow_ups', 'CLARIFICATION_REQUIRES_USER_CHOICE');
        const include = question.options.find(o => o.id === 'include_all');
        requireCheck(include, 'FOLLOWUP_OPTION_NOT_AVAILABLE');
        const ledger = validateLedger(await readJsonIfPresent(DEFAULT_LEDGER));
        requireCheck(ledger.reservedCount < 20, 'STOP_RESERVE_RECOVERY_BUDGET');
        await session!.action(include.command); take(`include_followups_${i + 1}`);
      }
      requireCheck(session!.getSnapshot().snapshot?.status !== 'needs_clarification', 'CLARIFICATION_LOOP_STOP');
    };
    await session.message('Organizzami un giro per domani a Milano, visitando clienti esistenti e nuove tabaccherie mai visitate.');
    take('initial_commercial_request');
    await answerApprovedFollowups();
    const first = h.wireReplies.at(-1)!;
    requireCheck(first.raw.plan && ['ready', 'planning'].includes(first.raw.status), 'NO_PLAN_AVAILABLE_STOP');
    const firstPlan = first.raw.plan;
    report.primaryItinerary = responseSummary(first.raw);
    const view = session.getSnapshot().snapshot?.plan;
    requireCheck(view?.days[0].stops.map(s => s.name).join('\n') === firstPlan.stops.map(s => s.name).join('\n'), 'DISPLAY_ORDER_MISMATCH');
    if (firstPlan.geometry.length) requireCheck(canonical(view.days[0].geometry.map(p => [p.latitude, p.longitude])) === canonical(firstPlan.geometry), 'DISPLAY_GEOMETRY_MISMATCH');
    const expectedRoute = firstPlan.verification === 'verified_routing' ? 'osrm' : 'estimate';
    requireCheck(first.raw.dataQuality.routingSource === expectedRoute, 'ROUTING_METADATA_MISMATCH');
    report.serverAuthority = { stopOrderExact: true, geometryExactWhenPresent: true, localRoutingCalls: 0, crmDirectCalls: 0,
      routing: firstPlan.verification, source: first.raw.dataQuality.routingSource };

    const beforeRevision = first.raw.sessionRevision;
    await session.message('Parto alle 8'); take('second_turn_start_time'); await answerApprovedFollowups();
    const second = h.wireReplies.at(-1)!;
    requireCheck(second.raw.sessionId === first.raw.sessionId && second.raw.sessionRevision > beforeRevision, 'SECOND_TURN_REVISION_MISMATCH');
    requireCheck(second.raw.plan && ['ready', 'planning'].includes(second.raw.status), 'SECOND_TURN_NO_PLAN');
    requireCheck(second.raw.criteria.startTime === '08:00', 'SECOND_TURN_TIME_NOT_APPLIED');
    requireCheck(canonical(second.raw.criteria.groups) === canonical(first.raw.criteria.groups)
      && canonical(second.raw.criteria.area) === canonical(first.raw.criteria.area)
      && second.raw.criteria.date === first.raw.criteria.date, 'SECOND_TURN_CRITERIA_CHANGED');
    report.secondItinerary = responseSummary(second.raw);

    const repeated = second.request as RequestEnvelope;
    await transport(repeated, userId, () => true);
    const replay = h.wireReplies.at(-1)!;
    requireCheck(canonical(replay.raw) === canonical(second.raw), 'IDEMPOTENCY_RESPONSE_MISMATCH');
    steps.push({ step: 'idempotency_exact_same_body', result: 'PASS', requestId: repeated.requestId, revision: replay.raw.sessionRevision });

    session.dispose(); session = makeSession(); await session.initialize(); take('recover_recreated_controller');
    const recovered = h.wireReplies.at(-1)!;
    requireCheck((recovered.request.action as { type?: string; planId?: string })?.type === 'get_plan', 'RECOVERY_DID_NOT_USE_GET_PLAN');
    requireCheck(recovered.raw.planId === second.raw.planId && canonical(recovered.raw.plan) === canonical(second.raw.plan), 'RECOVERY_PLAN_CHANGED');
    report.recovery = { result: 'PASS', method: 'recreated controller with retained isolated storage; not native process restart',
      planId: recovered.raw.planId, planSha256: sha256Text(canonical(recovered.raw.plan)) };

    const conflictReq: RequestEnvelope = { contractVersion: '1.0', sessionId: recovered.raw.sessionId, requestId: randomUUID(),
      expectedRevision: Math.max(0, recovered.raw.sessionRevision - 1), action: APPROVED_ORCHESTRATOR_BINDING.encodeAction({ name: 'set_start_time', input: { time: '08:00' } }) };
    let conflict: OrchestratorError | null = null;
    try { await transport(conflictReq, userId, () => true); }
    catch (e) { if (e instanceof OrchestratorError) conflict = e; else throw e; }
    requireCheck(conflict?.code === 'CONFLICT' && conflict.details?.revision === recovered.raw.sessionRevision, 'EXPECTED_409_NOT_OBSERVED');
    steps.push({ step: 'controlled_stale_revision', result: 'PASS', expectedRevision: conflictReq.expectedRevision, serverRevision: conflict.details.revision, automaticRetry: false });
    report.result = 'PASS';
  } catch (e) {
    failedCode = e instanceof LiveHarnessError ? e.code : e instanceof OrchestratorError ? `CLIENT_${e.code}` : 'UNEXPECTED_ERROR_REDACTED';
    report.result = 'STOPPED'; report.errorCode = failedCode;
  } finally {
    session?.dispose();
    h.restoreGlobalFetch();
    report.authAudit = h.authAudit;
    report.finishedAt = new Date().toISOString();
    const ledger = await readJsonIfPresent<Ledger>(DEFAULT_LEDGER);
    report.edgeReserved = ledger?.reservedCount ?? 0; report.edgeResponses = ledger?.receivedCount ?? 0;
    report.observedSessionIds = [...new Set(h.wireReplies.map(r => r.raw.sessionId).filter(Boolean))];
    report.observedPlanIds = [...new Set(h.wireReplies.map(r => r.raw.planId).filter(Boolean))];
    report.observedRequestIds = [...new Set(h.wireReplies.map(r => r.request.requestId).filter(Boolean))];
    await atomicWriteJson(path.join(LIVE_ROOT, 'live-result.json'), report);
    await h.permanentlyStop(); await h.releaseRunLock();
  }
  if (failedCode) throw new LiveHarnessError(failedCode);
}, 300_000);
