import { afterEach, describe, expect, it } from 'vitest';
import { copyFileSync, linkSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GPTOUR_CONTRACT_VERSION, GPTOUR_ENGINE_VERSION } from '../lib/aitour/orchestrator/wire-contract';

type AnyJson = Record<string, any>;

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url) as any);
const nodeRequire = createRequire(import.meta.url);
const VERIFIER_SOURCE = resolve(REPO_ROOT, 'tools/gptour-offline-verifier/gptour-p1-verify.cjs');
const GENERATOR_SOURCE = resolve(REPO_ROOT, 'tools/gptour-offline-verifier/generate.cjs');
const ORCHESTRATOR_DIR = resolve(REPO_ROOT, 'frontend/lib/aitour/orchestrator');
const MODULE_NAMES = ['contract', 'errors', 'coordinates', 'wire-contract', 'wire-actions', 'wire-response', 'presentation', 'request', 'view', 'binding'];
const sandboxes = new Set<string>();
afterEach(() => { for (const dir of sandboxes) rmSync(dir, { recursive: true, force: true }); sandboxes.clear(); });

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function makeGeometry(): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < 2704; i++) {
    const latitude = 40 + (i % 52) * 0.001;
    const longitude = 8 + Math.floor(i / 52) * 0.001;
    points.push([Number(latitude.toFixed(6)), Number(longitude.toFixed(6))]);
  }
  return points;
}

function makeStops(startMin: number): AnyJson[] {
  const travelMin = [4, 5.2, 6, 7, 5, 6.5, 4.5, 6, 7.3, 6.2, 5.1, 7.4, 7];
  const travelKm = [2.4, 3.1, 2.7, 3.8, 2.9, 3.4, 2.2, 3.1, 4, 3.3, 2.5, 4.1, 2.6];
  const lunchBefore = Array.from({ length: 13 }, (_, i) => (i === (startMin === 420 ? 9 : 7) ? 30 : 0));
  const stops: AnyJson[] = [];

  let previous = startMin;
  for (let i = 0; i < 13; i++) {
    const arrivalMin = previous + travelMin[i] + lunchBefore[i];
    const departureMin = arrivalMin + 30;
    stops.push({
      key: `TEST_STOP_${String(i + 1).padStart(2, '0')}`,
      name: `SYNTH_STOP_${i + 1}`,
      city: i % 2 === 0 ? 'SYNTH_CITY_A' : 'SYNTH_CITY_B',
      lat: Number((40.2 + i * 0.01).toFixed(6)),
      lng: Number((8.2 + i * 0.01).toFixed(6)),
      role: i < 3 ? 'required_by_agent' : i % 3 === 0 ? 'appointment' : 'suggested',
      group: i < 8 ? 'existing' : 'new',
      arrivalMin,
      departureMin,
      travelMinFromPrev: travelMin[i],
      travelKmFromPrev: travelKm[i],
      waitMin: 0,
      visitMin: 30,
      lunchBeforeMin: lunchBefore[i],
      reason: i < 8 ? 'existing portfolio coverage' : 'new business expansion',
      lastOrderDate: i % 4 === 0 ? `2026-09-${String(10 + i).padStart(2, '0')}` : null,
      daysSinceOrder: i % 4 === 0 ? 30 + i : null,
      outsideWindow: false,
    });
    previous = departureMin;
  }
  return stops;
}

function makeCriteria(startTime: string): AnyJson {
  return {
    groups: { version: 1, existing: true, newPoints: true, ownOnly: false, inactiveDays: 20, needsDays: false },
    area: { comuni: ['SYNTH_CITY_A', 'SYNTH_CITY_B'], provincia: null, exhaustive: false },
    date: '2026-10-12',
    dateAnchorTurn: 1,
    startTime,
    endTime: '20:00',
    wantAll: false,
    nonWorkingConfirmed: false,
    maxDays: 1,
    extraDaysApproved: false,
    requiredKeys: ['TEST_STOP_01'],
    requiredNames: ['SYNTH_STOP_1'],
    excludedNames: ['SYNTH_EXCLUDED'],
    excludedKeys: ['TEST_EXCLUDED_01'],
    consents: ['SYNTH_CONSENT_OK'],
  };
}

function makePlan(sessionId: string, revision: number, planId: string, startMin: number, geometry: [number, number][], stops: AnyJson[]): AnyJson {
  const totals = {
    driveMin: 77.2,
    visitMin: 390,
    waitMin: 0,
    breakMin: 30,
    returnMin: 35.6,
    totalMin: 532.8,
    availableMin: 1200 - startMin,
    bufferMin: 1200 - (startMin + 532.8),
    totalKm: 79.7,
  };
  const finishMin = startMin + totals.totalMin;
  const plan = {
    planId,
    sessionId,
    sessionRevision: revision,
    engineVersion: GPTOUR_ENGINE_VERSION,
    contractVersion: GPTOUR_CONTRACT_VERSION,
    generatedAt: '2026-10-12T10:00:00.000Z',
    snapshotRef: `SNAP_${revision}`,
    verification: 'verified_routing',
    date: '2026-10-12',
    startMin,
    finishMin,
    endMin: 1200,
    departure: { lat: 40.11, lng: 8.11, label: 'SYNTH_HOME' },
    returnTo: { lat: 40.11, lng: 8.11, label: 'SYNTH_HOME' },
    stops,
    totals,
    geometry,
    selectionReasons: {
      selected: stops.map((s) => ({ key: s.key, reason: `selected:${s.key}` })),
      excluded: [{ key: 'TEST_EXCLUDED_01', name: 'SYNTH_EXCLUDED', reason: 'outside synthetic scope' }],
    },
    warnings: ['synthetic-warning-a', 'synthetic-warning-b'],
    dependsOnPendingChanges: [],
  };
  return {
    ...plan,
    days: [{
      day: 1,
      date: plan.date,
      startMin: plan.startMin,
      finishMin: plan.finishMin,
      endMin: plan.endMin,
      departure: plan.departure,
      returnTo: plan.returnTo,
      stops: plan.stops,
      totals: plan.totals,
      geometry: plan.geometry,
      startsFrom: 'home',
      returnHomeAfterDay: true,
      nightKmHome: null,
      nightDecision: 'last_day',
      warnings: [],
      conflicts: [],
    }],
  };
}

function makeValidTurns(): { turns: AnyJson[]; requests: AnyJson[] } {
  const sessionId = 'SYNTH_SESSION_P1';
  const geometry = makeGeometry();
  const stopsTurn2 = makeStops(420);
  const stopsTurn3 = makeStops(480);
  const turn1 = {
    status: 'needs_clarification',
    contractVersion: GPTOUR_CONTRACT_VERSION,
    engineVersion: GPTOUR_ENGINE_VERSION,
    sessionId,
    sessionRevision: 1,
    requestId: 'SYNTH_REQ_1',
    generatedAt: '2026-10-12T09:00:00.000Z',
    message: 'Synthetic clarification required.',
    question: {
      id: 'followups:TEST_FU_01,TEST_FU_02',
      kind: 'follow_ups',
      text: 'Conferma follow-up:\n• Follow-up sintetico 01\n• Follow-up sintetico 02',
      options: [
        { id: 'include_all', label: 'Includi tutti' },
        { id: 'exclude_all', label: 'Escludi tutti' },
      ],
    },
    criteria: makeCriteria('07:00'),
    pendingDecisions: [],
    plan: null,
    planId: null,
    conflicts: [],
    dataQuality: {
      candidatesComplete: true,
      poolTruncated: false,
      purchasesVerified: true,
      registryVerified: true,
      routingSource: 'none',
      notes: [],
    },
    metrics: { durationMs: 100, crmQueries: 0, aiCalls: 0, routingCalls: 0 },
  };

  const plan2 = makePlan(sessionId, 2, 'SYNTH_PLAN_R2', 420, geometry, stopsTurn2);
  const plan3 = makePlan(sessionId, 3, 'SYNTH_PLAN_R3', 480, geometry, stopsTurn3);
  const turn2 = {
    ...stableClone(turn1),
    status: 'ready',
    sessionRevision: 2,
    requestId: 'SYNTH_REQ_2',
    message: 'Synthetic plan ready turn 2.',
    question: null,
    criteria: makeCriteria('07:00'),
    plan: plan2,
    planId: plan2.planId,
    dataQuality: { ...turn1.dataQuality, routingSource: 'osrm' },
    metrics: { durationMs: 2100, crmQueries: 9, aiCalls: 1, routingCalls: 2 },
  };
  const turn3 = {
    ...stableClone(turn2),
    sessionRevision: 3,
    requestId: 'SYNTH_REQ_3',
    message: 'Synthetic plan ready turn 3 shift 08:00.',
    criteria: makeCriteria('08:00'),
    plan: plan3,
    planId: plan3.planId,
  };

  const requests = [
    { contractVersion: '1.0', sessionId, requestId: 'SYNTH_REQ_1', message: 'msg-1' },
    { contractVersion: '1.0', sessionId, requestId: 'SYNTH_REQ_2', expectedRevision: 1, message: 'msg-2' },
    { contractVersion: '1.0', sessionId, requestId: 'SYNTH_REQ_3', expectedRevision: 2, message: 'msg-3' },
  ];
  return { turns: [turn1, turn2, turn3], requests };
}

function makeSandbox() {
  const root = mkdtempSync(join(tmpdir(), 'gptour-verifier-'));
  sandboxes.add(root);
  const input = join(root, 'input');
  const work = join(root, 'work');
  mkdirSync(input, { recursive: true });
  mkdirSync(work, { recursive: true });
  const script = join(work, 'gptour-p1-verify.cjs');
  copyFileSync(VERIFIER_SOURCE, script);
  return { root, input, work, script };
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function runNode(script: string, args: string[], cwd: string) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
  const stdout = result.stdout ?? '';
  let json: AnyJson | null = null;
  try {
    json = stdout.trim() ? JSON.parse(stdout) as AnyJson : null;
  } catch {
    json = null;
  }
  return { ...result, stdout, json };
}

function expectSafeOutput(text: string, forbidden: string[]): void {
  for (const marker of forbidden) {
    expect(text).not.toContain(marker);
  }
  expect(text).not.toMatch(/stack|\bat\s+[^\n]+\(/i);
}

describe('gptour offline verifier standalone CLI', () => {
  it('node generate --check passes and provenance fingerprint matches real TS modules', () => {
    const check = spawnSync(process.execPath, [GENERATOR_SOURCE, '--check'], { cwd: REPO_ROOT, encoding: 'utf8' });
    expect(check.status).toBe(0);
    expect(check.stdout).toContain('Portable source matches current pure Mobile functions.');

    const verifierModule = nodeRequire(VERIFIER_SOURCE) as { provenance: { fingerprint: string; files: { module: string; sha256: string }[] } };
    const files = MODULE_NAMES.map((name) => {
      const source = readFileSync(resolve(ORCHESTRATOR_DIR, `${name}.ts`), 'utf8');
      return { module: `${name}.ts`, sha256: sha256(source) };
    });
    const fingerprint = sha256(files.map((f) => `${f.module.replace('.ts', '')}:${f.sha256}`).join('\n'));
    expect(verifierModule.provenance.files).toEqual(files);
    expect(verifierModule.provenance.fingerprint).toBe(fingerprint);

    const source = readFileSync(VERIFIER_SOURCE, 'utf8');
    expect(source).toContain('mobile.validateWireResponse');
    expect(source).toContain('mobile.decodeOfficialResponse');
    expect(source).toContain('mobile.assertSnapshot');
    expect(source).not.toContain('/app/');
    expect(source).not.toContain('supabase');
  });

  it('passes positive synthetic modes: raw/containers/envelopes/files/selectors; report 0600; no extra writes', () => {
    const { turns, requests } = makeValidTurns();
    const box = makeSandbox();
    const rawArray = join(box.input, 'raw-array.json');
    const turnsObj = join(box.input, 'turns.json');
    const responsesObj = join(box.input, 'responses.json');
    const customObj = join(box.input, 'custom-container.json');

    writeJson(rawArray, turns);
    writeJson(turnsObj, { turns });
    writeJson(responsesObj, { responses: turns });
    writeJson(customObj, {
      'a/b': { '~c': { response: turns[0] } },
      plain: { one: { response: turns[1] } },
      nested: [{ item: { response: turns[2] } }],
    });

    const filesRaw = turns.map((turn, index) => {
      const p = join(box.input, `raw-turn-${index + 1}.json`);
      writeJson(p, turn);
      return p;
    });
    const filesEnvelope = turns.map((turn, index) => {
      const p = join(box.input, `envelope-turn-${index + 1}.json`);
      writeJson(p, { request: requests[index], response: turn });
      return p;
    });

    const beforeFiles = readdirSync(box.work).sort();

    const runs = [
      { name: 'raw-array', run: runNode(box.script, ['--input', rawArray], box.work) },
      { name: 'turns-object', run: runNode(box.script, ['--input', turnsObj], box.work) },
      { name: 'responses-object', run: runNode(box.script, ['--input', responsesObj], box.work) },
      { name: 'three-raw-files', run: runNode(box.script, ['--turn1', filesRaw[0], '--turn2', filesRaw[1], '--turn3', filesRaw[2]], box.work) },
      { name: 'three-envelope-files', run: runNode(box.script, ['--turn1', filesEnvelope[0], '--turn2', filesEnvelope[1], '--turn3', filesEnvelope[2]], box.work) },
      { name: 'custom-container-select', run: runNode(box.script, ['--input', customObj, '--select', '/a~1b/~0c/response', '--select', '/plain/one/response', '--select', '/nested/0/item/response'], box.work) },
    ];

    for (const { name, run } of runs) {
      expect(run.status, `${name}\nstdout:${run.stdout}\nstderr:${run.stderr ?? ''}`).toBe(0);
      expect(run.json, name).toBeTruthy();
      expect(run.json?.result, name).toBe('PASS');
      expect(run.json?.exitCode, name).toBe(0);
      expect(run.json?.inputFilesUnchanged, name).toBe(true);
      expect(run.json?.summary?.failed, name).toBe(0);
      expect(run.json?.observations.map((o: AnyJson) => o.pauses)).toEqual([[10], [8]]);
      const serialized = JSON.stringify(run.json);
      expect(serialized).not.toContain('SYNTH_STOP_1');
      expect(serialized).not.toContain('40.11');
      expect(serialized).not.toContain('SYNTH_REQ_1');
    }

    const report = join(box.work, 'report-pass.json');
    const withReport = runNode(box.script, ['--input', rawArray, '--report', report], box.work);
    expect(withReport.status).toBe(0);
    expect(withReport.json?.result).toBe('PASS');
    const mode = statSync(report).mode & 0o777;
    expect(mode).toBe(0o600);

    const afterFiles = readdirSync(box.work).sort();
    expect(afterFiles.filter((f) => !beforeFiles.includes(f))).toEqual(['report-pass.json']);
  });

  it.each([
    ['contract version', (x: AnyJson) => { x[1].contractVersion = '9.9'; }],
    ['engine version', (x: AnyJson) => { x[1].engineVersion = 'bad-engine'; }],
    ['malformed shape', (x: AnyJson) => { x[1].plan.stops[0] = { bad: true }; }],
    ['wrong identity from provided request', (x: AnyJson, req: AnyJson[]) => { req[1].requestId = 'MISMATCH_REQ'; }],
    ['wrong provided request version', (_x: AnyJson, req: AnyJson[]) => { req[1].contractVersion = '9.9'; }],
    ['provided request missing operation', (_x: AnyJson, req: AnyJson[]) => { delete req[1].message; }],
    ['unexpected original request field', (_x: AnyJson, req: AnyJson[]) => { req[1].is_admin = true; }],
    ['provided request both message and action', (x: AnyJson, req: AnyJson[]) => { req[1].action = { type: 'answer', questionId: x[0].question.id, optionId: 'include_all' }; }],
    ['empty identity', (x: AnyJson, req: AnyJson[]) => { x[1].requestId = ''; req[1].requestId = ''; }],
    ['stale duplicate revision', (x: AnyJson) => { x[2].sessionRevision = 2; x[2].plan.sessionRevision = 2; }],
    ['duplicate requestId', (x: AnyJson) => { x[2].requestId = x[1].requestId; }],
    ['session mix', (x: AnyJson) => { x[2].sessionId = 'OTHER_SESSION'; x[2].plan.sessionId = 'OTHER_SESSION'; }],
    ['12 stops only', (x: AnyJson) => { x[1].plan.stops = x[1].plan.stops.slice(0, 12); x[1].plan.days[0].stops = x[1].plan.stops; }],
    ['duplicate key', (x: AnyJson) => { x[1].plan.stops[1].key = x[1].plan.stops[0].key; }],
    ['missing geometry', (x: AnyJson) => { x[1].plan.geometry = []; x[1].plan.days[0].geometry = []; }],
    ['2703 geometry points', (x: AnyJson) => { x[1].plan.geometry = x[1].plan.geometry.slice(0, 2703); x[1].plan.days[0].geometry = x[1].plan.geometry; }],
    ['out of range geometry', (x: AnyJson) => { x[1].plan.geometry[0] = [91, 181]; x[1].plan.days[0].geometry = x[1].plan.geometry; }],
    ['79.8 km', (x: AnyJson) => { x[1].plan.totals.totalKm = 79.8; x[1].plan.days[0].totals = x[1].plan.totals; }],
    ['chronology mismatch', (x: AnyJson) => { x[1].plan.stops[5].departureMin += 7; x[1].plan.days[0].stops = x[1].plan.stops; }],
    ['bad break total', (x: AnyJson) => { x[1].plan.totals.breakMin = 0; x[1].plan.days[0].totals = x[1].plan.totals; }],
    ['missing followup', (x: AnyJson) => { x[0].question = null; }],
    ['duplicate followup ids', (x: AnyJson) => { x[0].question.id = 'followups:DUP,DUP'; }],
    ['followup bullet mismatch', (x: AnyJson) => { x[0].question.text = 'Solo una riga\n• una'; }],
    ['followup options missing include_all', (x: AnyJson) => { x[0].question.options = [{ id: 'exclude_all', label: 'X' }]; }],
    ['warning missing', (x: AnyJson) => { x[1].plan.warnings = ['only-one']; }],
    ['single-day extra warning silently dropped', (x: AnyJson) => { x[1].plan.days[0].warnings = ['SYNTH_EXTRA_DAY_WARNING']; }],
    ['wrong plan start minute', (x: AnyJson) => { x[2].plan.startMin = 481; x[2].plan.days[0].startMin = 481; }],
    ['wrong third start criteria', (x: AnyJson) => { x[2].criteria.startTime = '07:00'; }],
    ['changed commercial criteria', (x: AnyJson) => { x[2].criteria.requiredKeys = ['DIFFERENT']; }],
    ['changed stop order', (x: AnyJson) => { x[2].plan.stops = [...x[2].plan.stops].reverse(); x[2].plan.days[0].stops = x[2].plan.stops; }],
    ['changed geometry between turns', (x: AnyJson) => { x[2].plan.geometry = [...x[2].plan.geometry].reverse(); x[2].plan.days[0].geometry = x[2].plan.geometry; }],
    ['new plan missing (same id)', (x: AnyJson) => { x[2].planId = x[1].planId; x[2].plan.planId = x[1].plan.planId; }],
    ['estimated not verified', (x: AnyJson) => { x[1].plan.verification = 'estimated_routing'; }],
  ])('returns exit1 FAIL on semantic mutation: %s', (_, mutate) => {
    const { turns, requests } = makeValidTurns();
    const box = makeSandbox();
    const payload = turns.map((turn, index) => ({ request: stableClone(requests[index]), response: stableClone(turn) }));
    mutate(payload.map(p => p.response), payload.map(p => p.request));
    const file = join(box.input, 'mutated.json');
    writeJson(file, payload);

    const digestBefore = sha256(readFileSync(file));
    const run = runNode(box.script, ['--input', file], box.work);
    const digestAfter = sha256(readFileSync(file));

    expect(run.status).toBe(1);
    expect(run.json?.result).toBe('FAIL');
    expect(run.json?.exitCode).toBe(1);
    expect(run.json?.summary?.failed).toBeGreaterThan(0);
    expect(run.json?.inputFilesUnchanged).toBe(true);
    expect(digestAfter).toBe(digestBefore);
  });

  it.each([
    ['html renamed json', (box: ReturnType<typeof makeSandbox>) => {
      const file = join(box.input, 'fake.zip.json');
      writeFileSync(file, '<html><body>PRIVACYTEST_HTML</body></html>');
      return { args: ['--input', file], markers: ['PRIVACYTEST_HTML'] };
    }],
    ['missing file', (box: ReturnType<typeof makeSandbox>) => ({ args: ['--input', join(box.input, 'missing.json')], markers: ['PRIVACYTEST_MISSING'] })],
    ['invalid json', (box: ReturnType<typeof makeSandbox>) => {
      const file = join(box.input, 'invalid.json');
      writeFileSync(file, '{"x":');
      return { args: ['--input', file], markers: ['PRIVACYTEST_JSON'] };
    }],
    ['invalid flags', (box: ReturnType<typeof makeSandbox>) => ({ args: ['--bad', 'x'], markers: ['PRIVACYTEST_FLAGS'] })],
    ['duplicate flags', (box: ReturnType<typeof makeSandbox>) => {
      const file = join(box.input, 'ok.json');
      writeJson(file, makeValidTurns().turns);
      return { args: ['--input', file, '--input', file], markers: ['PRIVACYTEST_DUP'] };
    }],
    ['mixed input mode', (box: ReturnType<typeof makeSandbox>) => {
      const file = join(box.input, 'ok.json');
      writeJson(file, makeValidTurns().turns);
      return { args: ['--input', file, '--turn1', file, '--turn2', file, '--turn3', file], markers: ['PRIVACYTEST_MIXED'] };
    }],
    ['not exactly 3', (box: ReturnType<typeof makeSandbox>) => {
      const file = join(box.input, 'two.json');
      writeJson(file, makeValidTurns().turns.slice(0, 2));
      return { args: ['--input', file], markers: ['PRIVACYTEST_TWO'] };
    }],
    ['invalid pointer', (box: ReturnType<typeof makeSandbox>) => {
      const file = join(box.input, 'container.json');
      writeJson(file, { turns: makeValidTurns().turns });
      return { args: ['--input', file, '--select', 'bad', '--select', '/turns/1', '--select', '/turns/2'], markers: ['PRIVACYTEST_POINTER'] };
    }],
    ['url input refused', () => ({ args: ['--input', 'https://example.com/fake.json'], markers: ['PRIVACYTEST_URL'] })],
    ['non-regular file', (box: ReturnType<typeof makeSandbox>) => ({ args: ['--input', box.input], markers: ['PRIVACYTEST_TYPE'] })],
    ['oversized file', (box: ReturnType<typeof makeSandbox>) => {
      const file = join(box.input, 'oversized.json');
      writeFileSync(file, Buffer.alloc((32 * 1024 * 1024) + 1, 32));
      return { args: ['--input', file], markers: ['PRIVACYTEST_OVERSIZE'] };
    }],
  ])('returns exit2 fail-closed and sanitized output: %s', (_, build) => {
    const box = makeSandbox();
    const runSpec = build(box);
    const run = runNode(box.script, runSpec.args, box.work);
    expect(run.status).toBe(2);
    expect(run.json).toBeTruthy();
    expect(run.json?.result).toBe('ERROR');
    expect(run.json?.exitCode).toBe(2);
    expectSafeOutput(run.stdout, runSpec.markers);
    expectSafeOutput(run.stderr ?? '', runSpec.markers);
  });

  it('returns exit2 on output overwrite/existing report/symlink report target', () => {
    const box = makeSandbox();
    const input = join(box.input, 'valid.json');
    writeJson(input, makeValidTurns().turns);

    const same = runNode(box.script, ['--input', input, '--report', input], box.work);
    expect(same.status).toBe(2);
    expect(same.json?.result).toBe('ERROR');

    const existing = join(box.work, 'existing-report.json');
    writeFileSync(existing, '{}\n');
    const runExisting = runNode(box.script, ['--input', input, '--report', existing], box.work);
    expect(runExisting.status).toBe(2);
    expect(runExisting.json?.result).toBe('ERROR');

    const symlinkReport = join(box.work, 'symlink-report.json');
    symlinkSync(input, symlinkReport);
    const runSymlink = runNode(box.script, ['--input', input, '--report', symlinkReport], box.work);
    expect(runSymlink.status).toBe(2);
    expect(runSymlink.json?.result).toBe('ERROR');

    const hardlinkReport = join(box.work, 'hardlink-report.json');
    linkSync(input, hardlinkReport);
    const runHardlink = runNode(box.script, ['--input', input, '--report', hardlinkReport], box.work);
    expect(runHardlink.status).toBe(2);
    expect(runHardlink.json?.result).toBe('ERROR');
  });

  it('executes copied standalone only from empty cwd without node_modules and still passes', () => {
    const { turns } = makeValidTurns();
    const box = makeSandbox();
    const input = join(box.input, 'valid.json');
    writeJson(input, turns);

    expect(readdirSync(box.work).map((name) => basename(name)).sort()).toEqual(['gptour-p1-verify.cjs']);
    const run = runNode(box.script, ['--input', input], box.work);
    expect(run.status).toBe(0);
    expect(run.json?.result).toBe('PASS');
  });
  it('keeps input strings, names, IDs, warnings and local paths out of both PASS and FAIL reports', () => {
    const { turns } = makeValidTurns();
    const marker = 'PRIVACYTEST_DO_NOT_PRINT_MARKER';
    turns[0].message = marker;
    turns[0].question.text = `Domanda ${marker}\n• ${marker} uno\n• ${marker} due`;
    for (const response of turns.slice(1)) {
      response.plan.stops[0].name = marker;
      response.plan.warnings = [`${marker} A`, `${marker} B`];
      response.plan.snapshotRef = marker;
      response.dataQuality.notes = [marker];
    }
    const box = makeSandbox(), input = join(box.input, `${marker}.json`), output = join(box.work, 'aggregate.json');
    writeJson(input, turns);
    const pass = runNode(box.script, ['--input', input, '--report', output], box.work);
    expect(pass.status).toBe(0);
    for (const text of [pass.stdout, pass.stderr ?? '', readFileSync(output, 'utf8')]) expectSafeOutput(text, [marker, box.root, input, '40.11', 'SYNTH_SESSION_P1']);
    turns[1].plan.geometry[0] = [999, 999]; writeJson(input, turns);
    const fail = runNode(box.script, ['--input', input], box.work);
    expect(fail.status).toBe(1);
    for (const text of [fail.stdout, fail.stderr ?? '']) expectSafeOutput(text, [marker, box.root, input, '999', 'SYNTH_SESSION_P1']);
    const missing = runNode(box.script, ['--input', join(box.input, `missing-${marker}.json`)], box.work);
    expect(missing.status).toBe(2);
    expectSafeOutput(missing.stdout + missing.stderr, [marker, box.root]);
  });
  it('executes code copied from the complete textual handoff without any Mobile workspace dependencies', () => {
    const handoff = readFileSync(resolve(REPO_ROOT, 'tools/gptour-offline-verifier/TRANSFER_TO_AI_WEB.md'), 'utf8');
    const marker = '## Codice completo da salvare come `gptour-p1-verify.cjs`\n\n```javascript\n';
    const section = handoff.split(marker)[1];
    expect(section.endsWith('```\n')).toBe(true);
    const code = section.slice(0, -4);
    expect(sha256(code)).toBe(sha256(readFileSync(VERIFIER_SOURCE)));
    expect(handoff).toContain(sha256(code));
    const box = makeSandbox(), file = join(box.input, 'synthetic-three-turns.json');
    writeFileSync(box.script, code); writeJson(file, makeValidTurns().turns);
    const result = runNode(box.script, ['--input', file], box.work);
    expect(result.status).toBe(0);
    expect(result.json?.limits.nativeAndroid).toBe('NOT_EXECUTED');
    expect(result.json?.limits.nativeIPhone).toBe('NOT_EXECUTED');
    expect(result.json?.limits.browserRendering).toBe('NOT_EXECUTED');
  });
});
