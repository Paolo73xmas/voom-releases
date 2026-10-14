// Small strict JSON validators, no dependency downloads or network.
import type { ValidationIssue } from './contract.ts';
export type Check = (v: unknown, path: string, issues: ValidationIssue[]) => void;
export const fail = (issues: ValidationIssue[], path: string, rule: string): void => { issues.push({ path, rule }); };
export const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' &&
  !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
export const text = (max: number, nonempty = true): Check => (v, p, e) => {
  if (typeof v !== 'string' || v.length > max || (nonempty && !v.trim())) fail(e, p, 'string');
};
export const number: Check = (v, p, e) => { if (typeof v !== 'number' || !Number.isFinite(v)) fail(e, p, 'finite_number'); };
export const integer: Check = (v, p, e) => { if (!Number.isSafeInteger(v) || (v as number) < 0) fail(e, p, 'nonnegative_safe_integer'); };
export const range = (min: number, max: number): Check => (v, p, e) => {
  number(v, p, e); if (typeof v === 'number' && (v < min || v > max)) fail(e, p, 'range');
};
export const values = (...allowed: readonly unknown[]): Check => (v, p, e) => { if (!allowed.includes(v)) fail(e, p, 'enum'); };
export const uuid: Check = (v, p, e) => {
  if (typeof v !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v)) fail(e, p, 'canonical_uuid');
};
export const date: Check = (v, p, e) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) fail(e, p, 'calendar_date');
};
export const list = (check: Check, min = 0, max = 100): Check => (v, p, e) => {
  if (!Array.isArray(v) || v.length < min || v.length > max) { fail(e, p, 'array_length'); return; }
  for (let i = 0; i < v.length; i++) check(v[i], `${p}[${i}]`, e);
};
export const object = (required: Record<string, Check>, optional: Record<string, Check> = {}): Check => (v, p, e) => {
  if (!record(v)) { fail(e, p, 'object'); return; }
  for (const key of Object.keys(v)) if (!Object.hasOwn(required, key) && !Object.hasOwn(optional, key)) fail(e, `${p}.${key}`, 'unknown_key');
  for (const [key, check] of Object.entries(required)) check(v[key], `${p}.${key}`, e);
  for (const [key, check] of Object.entries(optional)) if (Object.hasOwn(v, key)) check(v[key], `${p}.${key}`, e);
};
export function isTimestamp(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)) return false;
  const issues: ValidationIssue[] = []; date(v.slice(0, 10), '$', issues);
  return !issues.length && Number.isFinite(Date.parse(v)) && Number(v.slice(11, 13)) < 24 && Number(v.slice(14, 16)) < 60 && Number(v.slice(17, 19)) < 60;
}