import { validateTransportResponse } from '../../../supabase/functions/_shared/gptour-semantic-transport/index.ts';
import { AT, EXPIRES, errorFixture, SID, RID } from './golden-cases.ts';

let checks = 0;
let failed = 0;
function check(ok: unknown, label: string) {
  checks++;
  if (!ok) {
    failed++;
    console.error(`FAIL ${label}`);
  } else {
    console.log(`PASS ${label}`);
  }
}

// Edge case 1: pending receipt without processing expiry should stay recoverable=true.
const pendingReceipt = {
  operation: 'get_request',
  contractVersion: 'semantic-1.1',
  sessionId: SID,
  requestId: RID,
  receipt: {
    status: 'pending',
    processingExpired: false,
    recoverable: false,
    processingDeadline: '2026-10-15T22:04:00Z',
    responseExpiresAt: EXPIRES,
    retryAfterMs: 1000,
    originalHttpStatus: null,
    response: null,
  },
};

const pendingValidation = validateTransportResponse(pendingReceipt);
check(!pendingValidation.ok, 'pending receipt must not be non-recoverable without processingExpired');

// Edge case 2: not_accepted turn should not carry acceptedAt/responseExpiresAt.
const notAcceptedWithCommitMetadata = {
  ...errorFixture('invalid_request'),
  acceptedAt: AT,
  responseExpiresAt: EXPIRES,
};

const metadataValidation = validateTransportResponse(notAcceptedWithCommitMetadata);
check(!metadataValidation.ok, 'not_accepted response must not include commit metadata');

// acceptedAt means acceptance, NOT commit. Pending recovery may legitimately expose both timestamps.
check(validateTransportResponse({...errorFixture('llm_retryable'),acceptedAt:AT,responseExpiresAt:EXPIRES}).ok,
  'accepted but recoverable request may expose its acceptance window');
check(!validateTransportResponse({...errorFixture('llm_retryable'),acceptedAt:AT,responseExpiresAt:null}).ok,
  'partial acceptance metadata rejected');
check(!validateTransportResponse({...errorFixture('llm_retryable'),acceptedAt:EXPIRES,responseExpiresAt:AT}).ok,
  'reversed response window rejected');
check(!validateTransportResponse({...errorFixture('llm_retryable'),outcome:'committed',acceptedAt:AT,responseExpiresAt:EXPIRES}).ok,
  'retryable error cannot masquerade as terminal');
check(!validateTransportResponse({...errorFixture('llm_budget_exhausted'),retryableSameRequest:true}).ok,
  'terminal exhausted budget cannot invite another same-request invocation');
check(!validateTransportResponse({...pendingReceipt,receipt:{...pendingReceipt.receipt,status:'done',recoverable:false,
  originalHttpStatus:200,response:errorFixture('llm_budget_exhausted')}}).ok,
  'receipt must retain actual terminal HTTP503 not HTTP200');
check(validateTransportResponse({...pendingReceipt,receipt:{...pendingReceipt.receipt,recoverable:true}}).ok,
  'non-expired pending receipt recoverable');
check(validateTransportResponse({...pendingReceipt,receipt:{...pendingReceipt.receipt,processingExpired:true,recoverable:false}}).ok,
  'expired processing remains pending until future finalization, without invented commit');

console.log(`U2_EDGE_NEGATIVE DONE checks=${checks} fail=${failed}`);
if (failed) {
  throw new Error(`edge negatives failed=${failed}`);
}
