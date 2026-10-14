// Schema di output dell'LLM (compatibile con structured output "strict") + validazione rigorosa lato server.
import { CATEGORIES, CONSENT_KINDS, type LlmOutput, type Operation } from './contract.ts';

const OPS = ['set', 'clear', 'add_segment', 'replace_segments', 'remove_segment', 'add_locality', 'remove_locality', 'replace_area',
  'require_stop', 'exclude_stop', 'follow_up', 'propose_reschedule', 'grant_consent', 'decline_consent', 'reset_all'] as const;
const FIELDS = ['dates', 'start_time', 'end_time', 'revenue_min', 'revenue_max', 'project', 'coverage', 'max_days', 'overflow_policy',
  'lodging_mode', 'lodging_max_km', 'follow_ups_mode', 'allow_nearby', 'segments', 'purchase_filter', 'visit_filter', 'revenue', 'area',
  'lodging', 'stops', 'follow_ups'] as const;
const REASONS = ['ambiguous', 'missing_info', 'unrelated'] as const;
export const MAX_OPERATIONS = 20;
const MAX_STR = 200;

const nullable = (t: Record<string, unknown>) => ({ anyOf: [t, { type: 'null' }] });
const OP_PROPS: Record<string, unknown> = {
  op: { type: 'string', enum: OPS },
  field: nullable({ type: 'string', enum: FIELDS }),
  text: nullable({ type: 'string' }), number: nullable({ type: 'number' }), flag: nullable({ type: 'boolean' }),
  dates: nullable({ type: 'array', items: { type: 'string' } }),
  categories: nullable({ type: 'array', items: { type: 'string', enum: CATEGORIES } }),
  allCategories: nullable({ type: 'boolean' }), minDaysSinceOrder: nullable({ type: 'number' }), minDaysSinceVisit: nullable({ type: 'number' }), ownOnly: nullable({ type: 'boolean' }),
  locality: nullable({ type: 'string' }), provincia: nullable({ type: 'string' }),
  refId: nullable({ type: 'string' }), mention: nullable({ type: 'string' }),
  decision: nullable({ type: 'string', enum: ['include', 'exclude'] }), proposedDate: nullable({ type: 'string' }),
  consent: nullable({ type: 'string', enum: CONSENT_KINDS }),
  evidence: { type: 'string' },
};
export const OP_KEYS = Object.keys(OP_PROPS);

export const LLM_OUTPUT_SCHEMA = {
  name: 'gptour_semantic_operations',
  strict: true,
  schema: {
    type: 'object', additionalProperties: false, required: ['operations', 'clarification'],
    properties: {
      operations: { type: 'array', items: { type: 'object', additionalProperties: false, required: OP_KEYS, properties: OP_PROPS } },
      clarification: nullable({ type: 'object', additionalProperties: false, required: ['reason', 'question'], properties: { reason: { type: 'string', enum: REASONS }, question: { type: 'string' } } }),
    },
  },
} as const;

type Check = { ok: true; value: LlmOutput } | { ok: false; error: string };
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => v === null || (typeof v === 'string' && v.length <= MAX_STR);
const num = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v));
const bool = (v: unknown) => v === null || typeof v === 'boolean';
const inEnum = (list: readonly string[]) => (v: unknown) => v === null || (typeof v === 'string' && list.includes(v));
const strArr = (allowed?: readonly string[]) => (v: unknown) => v === null || (Array.isArray(v) && v.length <= 20 && v.every((x) => typeof x === 'string' && x.length <= MAX_STR && (!allowed || allowed.includes(x))));

const VALIDATORS: Record<string, (v: unknown) => boolean> = {
  op: (v) => typeof v === 'string' && (OPS as readonly string[]).includes(v), field: inEnum(FIELDS),
  text: str, number: num, flag: bool, dates: strArr(), categories: strArr(CATEGORIES), allCategories: bool,
  minDaysSinceOrder: num, minDaysSinceVisit: num, ownOnly: bool, locality: str, provincia: str, refId: str, mention: str,
  decision: inEnum(['include', 'exclude']), proposedDate: str, consent: inEnum(CONSENT_KINDS),
  evidence: (v) => typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_STR,
};

/** Chiavi sconosciute, tipi o enum errati ⇒ output intero rifiutato. Chiavi nullable assenti ⇒ null. */
export function validateLlmOutput(raw: unknown): Check {
  if (!isObj(raw)) return { ok: false, error: 'radice non oggetto' };
  for (const k of Object.keys(raw)) if (k !== 'operations' && k !== 'clarification') return { ok: false, error: `chiave non ammessa: ${k}` };
  if (!Array.isArray(raw.operations)) return { ok: false, error: 'operations mancante' };
  if (raw.operations.length > MAX_OPERATIONS) return { ok: false, error: 'troppe operazioni' };
  const operations: Operation[] = [];
  for (const [i, o] of raw.operations.entries()) {
    if (!isObj(o)) return { ok: false, error: `operazione ${i} non oggetto` };
    for (const k of Object.keys(o)) if (!VALIDATORS[k]) return { ok: false, error: `operazione ${i}: chiave non ammessa ${k}` };
    const full: Record<string, unknown> = {};
    for (const k of OP_KEYS) {
      const v = k in o ? o[k] : null;
      if (!VALIDATORS[k](v)) return { ok: false, error: `operazione ${i}: valore non valido per ${k}` };
      full[k] = v;
    }
    operations.push(full as unknown as Operation);
  }
  let clarification: LlmOutput['clarification'] = null;
  if (raw.clarification !== null && raw.clarification !== undefined) {
    const c = raw.clarification;
    if (!isObj(c) || Object.keys(c).some((k) => k !== 'reason' && k !== 'question') || !inEnum(REASONS)(c.reason) || c.reason === null
      || typeof c.question !== 'string' || !c.question.trim() || c.question.length > 400) return { ok: false, error: 'clarification non valida' };
    clarification = { reason: c.reason as 'ambiguous', question: c.question.trim() };
  }
  return { ok: true, value: { operations, clarification } };
}

/** Estrae il JSON dalla risposta testuale (tollera solo un eventuale blocco ```json). */
export function parseLlmText(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(t);
}
