// SF — semantic-1.0.1: decline_consent (rifiuto TESTUALE di una proposta di consenso). LLM scriptato: il riconoscimento testuale reale NON è provato qui.
import { SEMANTIC_CONTRACT_VERSION, type SemanticState } from '../../supabase/functions/_shared/gptour-semantic/contract.ts';
import { interpretTurn, proposeExpansion } from '../../supabase/functions/_shared/gptour-semantic/interpreter.ts';
import { validateLlmOutput } from '../../supabase/functions/_shared/gptour-semantic/schema.ts';
import { buildSystemPrompt } from '../../supabase/functions/_shared/gptour-semantic/prompt.ts';
import { CATALOG, clock, fresh, opsLlm, say } from './fixtures.ts';
let checks = 0, failed = 0;
const check = (ok: unknown, label: string, detail: unknown = '') => { checks++; if (!ok) { failed++; console.error(`FAIL ${label} :: ${JSON.stringify(detail)?.slice(0, 300)}`); } else console.log(`PASS ${label}`); };
check(SEMANTIC_CONTRACT_VERSION === 'semantic-1.0.1', 'versione U1 semantic-1.0.1 (estensione additiva)');
check(validateLlmOutput({ operations: [{ op: 'decline_consent', consent: 'non_working_day', evidence: 'no grazie' }], clarification: null }).ok, 'schema: decline_consent ammessa');
check(!validateLlmOutput({ operations: [{ op: 'decline_consent', consent: 'non_working_day', evidence: '' }], clarification: null }).ok, 'schema: decline_consent senza citazione respinta');
check(buildSystemPrompt({ today: '2026-10-15', localTime: '08:30', criteria: fresh().criteria, pending: null, catalog: CATALOG, history: [] }).includes('- decline_consent:'), 'prompt: regola decline_consent presente');
// Stato con data domenica e proposta di consenso pendente (come generata dal cancello)
async function pendingConsent(): Promise<SemanticState> {
  const s0 = fresh('d1');
  const t = await say(s0, 'Giro domenica 18 ottobre a Rozzano', opsLlm([{ op: 'set', field: 'dates', dates: ['2026-10-18'], evidence: 'domenica 18 ottobre' }, { op: 'replace_area', locality: 'Rozzano', evidence: 'a Rozzano' }]));
  if (t.result.status !== 'updated') throw new Error('setup: ' + t.result.message);
  return proposeExpansion(t.state, { kind: 'non_working_day', days: null, dates: ['2026-10-18'] }, 'domenica 18/10 non è un tuo giorno lavorativo: vuoi includerlo nel giro?');
}
const consentsOf = (s: SemanticState) => s.criteria.consents.length;
{ const s = await pendingConsent(); const q = s.pendingQuestion!;
  const t = await say(s, 'No grazie', opsLlm([{ op: 'decline_consent', consent: 'non_working_day', evidence: 'No grazie' }]));
  check(t.result.status === 'updated' && t.state.pendingQuestion === null && consentsOf(t.state) === 0 && t.result.applied[0]?.op === 'decline_consent' && t.state.revision === s.revision + 1 && JSON.stringify(t.state.criteria.dates) === '["2026-10-18"]', `«No grazie» → rifiuto applicato, domanda ${q.id} chiusa, nessun consenso, data invariata, +1`, t.result);
  const t2 = await say(s, 'no', opsLlm([{ op: 'decline_consent', consent: 'non_working_day', evidence: 'no' }]));
  check(t2.state.pendingQuestion === null && t2.result.applied[0]?.op === 'decline_consent' && consentsOf(t2.state) === 0, '«no» secco con citazione letterale → rifiuto applicato');
  const t3 = await say(s, 'No grazie', opsLlm([], { reason: 'unrelated', question: 'Non ho capito: vuoi includere domenica?' }));
  check(t3.result.status === 'needs_clarification' && t3.state.pendingQuestion?.kind === 'unclear' && t3.state.pendingQuestion?.previous?.id === q.id && consentsOf(t3.state) === 0, 'fallback: LLM senza operazione → chiarimento sopra la domanda consent, nessun rifiuto dedotto');
  const t4 = await say(s, 'Aggiungi anche Milano', opsLlm([{ op: 'add_locality', locality: 'Milano', evidence: 'Milano' }]));
  check(t4.result.status === 'updated' && t4.state.pendingQuestion?.id === q.id && consentsOf(t4.state) === 0 && t4.state.criteria.area?.localities.length === 2, 'messaggio non pertinente → domanda consent resta aperta, nessun rifiuto');
  const t5 = await say(s, 'No, niente Rozzano', opsLlm([{ op: 'remove_locality', locality: 'Rozzano', evidence: 'niente Rozzano' }]));
  check(t5.result.status === 'updated' && t5.state.pendingQuestion?.id === q.id && consentsOf(t5.state) === 0 && t5.result.applied[0]?.op === 'remove_locality', 'negazione riferita ad altro criterio → operazione pertinente, consent ancora pendente');
  const t6 = await say(s, 'No grazie', opsLlm([{ op: 'decline_consent', consent: 'extra_days', evidence: 'No grazie' }]));
  check(t6.result.status === 'updated' && t6.state.pendingQuestion?.id === q.id && t6.result.rejected.length === 1 && t6.result.applied.length === 0 && consentsOf(t6.state) === 0, 'tipo diverso da quello chiesto → respinto, domanda aperta, nulla registrato', t6.result.rejected);
  const t7 = await say(s, 'sì no', opsLlm([{ op: 'grant_consent', consent: 'non_working_day', evidence: 'sì' }, { op: 'decline_consent', consent: 'non_working_day', evidence: 'no' }]));
  check(t7.result.status === 'updated' && t7.state.pendingQuestion?.id === q.id && t7.result.rejected.length === 2 && consentsOf(t7.state) === 0, 'grant + decline stesso tipo → entrambi respinti, domanda aperta, né consenso né rifiuto', t7.result.rejected);
  const t8 = await say(s, 'No grazie', opsLlm([{ op: 'decline_consent', consent: 'non_working_day', evidence: 'rifiuto' }]));
  check(t8.result.status === 'updated' && t8.state.pendingQuestion?.id === q.id && t8.result.rejected[0]?.reason.includes('citazione') && consentsOf(t8.state) === 0, 'citazione assente → respinto, domanda aperta', t8.result.rejected);
  const t9 = await say(s, 'No grazie, facciamo lunedì 19', opsLlm([{ op: 'decline_consent', consent: 'non_working_day', evidence: 'No grazie' }, { op: 'set', field: 'dates', dates: ['2026-10-19'], evidence: 'lunedì 19' }]));
  check(t9.result.status === 'updated' && t9.state.pendingQuestion === null && JSON.stringify(t9.state.criteria.dates) === '["2026-10-19"]' && consentsOf(t9.state) === 0, 'rifiuto + nuova data nello stesso messaggio → entrambi applicati, domanda chiusa'); }
{ const s = fresh('d2'); const t = await say(s, 'No grazie', opsLlm([{ op: 'decline_consent', consent: 'non_working_day', evidence: 'No grazie' }]));
  check(t.result.status === 'updated' && t.result.rejected.length === 1 && t.result.applied.length === 0 && t.state.pendingQuestion === null && t.state.revision === 1, 'decline senza domanda consent pendente → respinto, nessuna domanda creata'); }
{ const s = await pendingConsent();
  const r1 = await interpretTurn({ contractVersion: SEMANTIC_CONTRACT_VERSION, sessionId: s.sessionId, requestId: 'same', expectedRevision: s.revision, message: 'No grazie' }, s, CATALOG, { llm: opsLlm([{ op: 'decline_consent', consent: 'non_working_day', evidence: 'No grazie' }]), clock });
  const r2 = await interpretTurn({ contractVersion: SEMANTIC_CONTRACT_VERSION, sessionId: s.sessionId, requestId: 'same', expectedRevision: s.revision, message: 'No grazie' }, s, CATALOG, { llm: opsLlm([{ op: 'decline_consent', consent: 'non_working_day', evidence: 'No grazie' }]), clock });
  const strip = (x: unknown) => JSON.stringify(x, (k, v) => (k === 'ms' ? 0 : v));
  check(strip(r1.state) === strip(r2.state) && strip(r1.result) === strip(r2.result), 'determinismo: stesso stato + stesso output LLM ⇒ stesso esito'); }
console.log(`SF_decline_consent ${failed ? 'FAILED' : 'DONE'} checks=${checks} fail=${failed}`);
if (failed) Deno.exit(1);
