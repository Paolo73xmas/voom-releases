import assert from 'node:assert/strict';
import {
  buildVerificationPayload,
  submitVerificationRequest,
  verificationTimeout,
  type VerificationInput,
} from '../../frontend/lib/api/customer-verification';
import { supabase } from '../../frontend/lib/supabase';

const AGENT_ID = '11111111-1111-4111-8111-111111111111';
const REQ_ID = '22222222-2222-4222-8222-222222222222';
const CUSTOMER_ID = '33333333-3333-4333-8333-333333333333';
const TAB_ID = '44444444-4444-4444-8444-444444444444';

function baseInput(): VerificationInput {
  return {
    subject: {
      customerId: CUSTOMER_ID,
      tabaccheriaId: TAB_ID,
      name: 'Tabacchi Demo',
      gps: { lat: 45.46, lng: 9.19 },
    },
    anomalyType: 'moved',
    notes: 'Segnalazione test',
    agentGps: { lat: 45.47, lng: 9.2 },
  };
}

async function run() {
  const originalFrom = (supabase as any).from;
  const originalGetUser = (supabase as any).auth.getUser;

  try {
    // payload validation: subject must be resolvable by customer/tab/name
    assert.throws(
      () => buildVerificationPayload(REQ_ID, AGENT_ID, { ...baseInput(), subject: { customerId: null, tabaccheriaId: null, name: ' ', gps: null } }),
      /Seleziona il soggetto/
    );

    // notes cap
    assert.throws(
      () => buildVerificationPayload(REQ_ID, AGENT_ID, { ...baseInput(), notes: 'a'.repeat(3001) }),
      /3000/
    );

    // invalid gps (0,0) must be null in payload
    const payload = buildVerificationPayload(REQ_ID, AGENT_ID, {
      ...baseInput(),
      subject: { ...baseInput().subject, gps: { lat: 0, lng: 0 } },
      agentGps: { lat: Number.NaN, lng: 12 },
    });
    assert.equal(payload.customer_gps_lat, null);
    assert.equal(payload.agent_gps_lat, null);
    assert.equal(payload.status, 'pending');
    assert.equal(payload.reported_by_agent_id, AGENT_ID);

    // verificationTimeout must reject hung operation
    await assert.rejects(
      () => verificationTimeout(new Promise<never>(() => {}), 25, 'timeout-test'),
      /timeout-test/
    );

    // auth mismatch must fail before DB insert
    let inserts = 0;
    (supabase as any).auth.getUser = async () => ({ data: { user: { id: '99999999-9999-4999-8999-999999999999' } }, error: null });
    (supabase as any).from = () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      insert: () => {
        inserts += 1;
        return { select: () => ({ single: async () => ({ data: null, error: null }) }) };
      },
    });
    await assert.rejects(() => submitVerificationRequest(REQ_ID, AGENT_ID, baseInput()), /sessione.*cambiata|sessione.*scaduta|sessione/i);
    assert.equal(inserts, 0, 'must not insert when session actor mismatches expectedAgentId');

    // stable-id preflight should avoid duplicate insert
    let stored: { id: string; reported_by_agent_id: string; status: string } | null = null;
    let preflightChecks = 0;
    inserts = 0;
    (supabase as any).auth.getUser = async () => ({ data: { user: { id: AGENT_ID } }, error: null });
    (supabase as any).from = () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => {
              preflightChecks += 1;
              return { data: stored, error: null };
            },
          }),
        }),
      }),
      insert: (row: { id: string; reported_by_agent_id: string; status: string }) => {
        inserts += 1;
        stored = { id: row.id, reported_by_agent_id: row.reported_by_agent_id, status: row.status };
        return {
          select: () => ({ single: async () => ({ data: stored, error: null }) }),
        };
      },
    });

    const first = await submitVerificationRequest(REQ_ID, AGENT_ID, baseInput());
    const second = await submitVerificationRequest(REQ_ID, AGENT_ID, baseInput());
    assert.equal(first.id, REQ_ID);
    assert.equal(second.id, REQ_ID);
    assert.equal(inserts, 1, 'retries with same UUID must not duplicate insert');
    assert.ok(preflightChecks >= 2, 'findOwnReceipt preflight expected before retry insert');

    // uncertain write path: insert fails, select-by-own-id resolves committed receipt
    stored = null;
    let failInsertOnce = true;
    (supabase as any).from = () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: stored, error: null }),
          }),
        }),
      }),
      insert: (row: { id: string; reported_by_agent_id: string; status: string }) => {
        stored = { id: row.id, reported_by_agent_id: row.reported_by_agent_id, status: row.status };
        return {
          select: () => ({
            single: async () => {
              if (failInsertOnce) {
                failInsertOnce = false;
                return { data: null, error: { message: 'network timeout after commit' } };
              }
              return { data: stored, error: null };
            },
          }),
        };
      },
    });
    const uncertain = await submitVerificationRequest(REQ_ID, AGENT_ID, baseInput());
    assert.equal(uncertain.id, REQ_ID);

    console.log('PASS customer_verification_service.unit.ts');
  } finally {
    (supabase as any).from = originalFrom;
    (supabase as any).auth.getUser = originalGetUser;
  }
}

run();
