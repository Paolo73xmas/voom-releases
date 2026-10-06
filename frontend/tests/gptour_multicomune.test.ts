// Multi-comune regression coverage for intent sanitization/merge, area checks, engine wantAll completion, and criteria chips.
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_INTENT, mergeIntent, sanitizeIntentPatch, type TourIntent } from '../lib/aitour/gptour-intent';
import { candidateIntentProblems, outsideRequestedComune } from '../lib/aitour/gptour-criteria';
import { prepareGptDays } from '../lib/aitour/gptour-engine';
import type { GptResult } from '../lib/aitour/gptour-api';
import { DEFAULT_SETTINGS, type TourCandidate } from '../lib/aitour/types';
import { criteriaChips } from '../components/aitour/gptour/UI';

vi.mock('../lib/theme', () => ({
  currentThemeMode: 'light',
  DS: {
    surface: '#fff', surface2: '#f5f5f5', brand: '#000', error: '#f00', border: '#ddd', borderStrong: '#bbb',
    brandSoft: '#eee', ink: '#111', inkMuted: '#666', warning: '#fa0',
  },
  JAKARTA: { regular: 'System', medium: 'System', semibold: 'System', bold: 'System' },
}));
vi.mock('../lib/supabase', () => ({ supabase: {} }));
vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
vi.mock('react-native', () => ({
  Animated: { Value: class {}, timing: () => ({ start: () => {} }) },
  Pressable: (props: unknown) => props,
  Text: (props: unknown) => props,
  View: (props: unknown) => props,
  StyleSheet: { create: <T,>(s: T) => s },
}));

const date = '2099-11-15';
const settings = { ...DEFAULT_SETTINGS, work_start: '09:00', work_end: '18:00', lunch_break_minutes: 0 };
const candidate = (key: string, city: string, patch: Partial<TourCandidate> = {}): TourCandidate => ({
  key,
  customerId: key,
  tabaccheriaId: null,
  entityType: 'client',
  name: key,
  lat: 45.4,
  lng: 9.1,
  city,
  province: 'MI',
  address: '',
  lastVisitDate: null,
  lastOrderDate: null,
  daysSinceVisit: null,
  daysSinceOrder: null,
  daysSincePhysicalContact: null,
  orderCount: 0,
  totalRevenue: 0,
  revenue6m: 600,
  avgOrderValue: 0,
  avgReorderDays: null,
  followUpDate: null,
  appointmentAt: null,
  notes: null,
  orphanStatus: null,
  estimatedRevenue: null,
  score: 0,
  priorityClass: 'Media',
  reason: '',
  nextSuggestedVisit: null,
  visitMinutes: 20,
  potentialValue: 0,
  gptourData: { contactKnown: true, orderKnown: true, revenueKnown: true, zoneNames: ['Ovest'] },
  ...patch,
});
const result = (keys: string[]): GptResult => ({
  reply: 'Fixture',
  needsInfo: false,
  multiDay: false,
  lodging: 'home',
  tourDate: date,
  startTime: null,
  endTime: null,
  selection: keys.map((key) => ({ key, reason: null })),
  days: [],
  notes: null,
});

describe('gptour multi-comune sanitize/merge', () => {
  it('sanitize: keeps comuni list only, trims/dedups and ignores invalid/non-array values', () => {
    const p = sanitizeIntentPatch({
      requestedArea: { comuni: [' Magenta ', 'Sedriano', 'Magenta', '', 7, null] as unknown[] },
    });
    expect(p.requestedArea).toEqual({ comuni: ['Magenta', 'Sedriano'], comune: 'Magenta' });
  });

  it('sanitize: legacy comune only is converted to comuni[0]', () => {
    const p = sanitizeIntentPatch({ requestedArea: { comune: '  Magenta  ' } });
    expect(p.requestedArea).toEqual({ comune: 'Magenta', comuni: ['Magenta'] });
  });

  it('sanitize: rejects non-array comuni without discarding a valid legacy comune', () => {
    expect(sanitizeIntentPatch({ requestedArea: { comuni: 'Magenta, Sedriano' } }).requestedArea).toEqual({});
    expect(sanitizeIntentPatch({ requestedArea: { comuni: { city: 'Sedriano' }, comune: 'Magenta' } }).requestedArea)
      .toEqual({ comune: 'Magenta', comuni: ['Magenta'] });
  });

  it('sanitize: combines list + legacy, preserving list order and appending missing legacy', () => {
    const p = sanitizeIntentPatch({ requestedArea: { comuni: ['Sedriano', 'Bareggio'], comune: 'Magenta' } });
    expect(p.requestedArea).toEqual({ comune: 'Sedriano', comuni: ['Sedriano', 'Bareggio', 'Magenta'] });
  });

  it('sanitize: requestedArea null is preserved explicitly', () => {
    expect(sanitizeIntentPatch({ requestedArea: null }).requestedArea).toBeNull();
  });

  it('merge: accumulates comuni across turns, keeps first comune, dedups repeats', () => {
    const first = mergeIntent(DEFAULT_INTENT, { requestedArea: { comune: 'Magenta', comuni: ['Magenta'] } });
    const second = mergeIntent(first, { requestedArea: { comuni: ['Sedriano', 'Bareggio'] } });
    const third = mergeIntent(second, { requestedArea: { comuni: ['Bareggio', 'Magenta'] } });
    expect(second.requestedArea).toEqual({ comune: 'Magenta', comuni: ['Magenta', 'Sedriano', 'Bareggio'] });
    expect(third.requestedArea).toEqual({ comune: 'Magenta', comuni: ['Magenta', 'Sedriano', 'Bareggio'] });
  });

  it('merge: does not mutate previous or patch arrays', () => {
    const prevComuni = ['Magenta'];
    const patchComuni = ['Sedriano', 'Bareggio'];
    const first = mergeIntent(DEFAULT_INTENT, { requestedArea: { comuni: prevComuni } });
    const second = mergeIntent(first, { requestedArea: { comuni: patchComuni } });
    expect(prevComuni).toEqual(['Magenta']);
    expect(patchComuni).toEqual(['Sedriano', 'Bareggio']);
    expect(first.requestedArea?.comuni).toEqual(['Magenta']);
    expect(second.requestedArea?.comuni).toEqual(['Magenta', 'Sedriano', 'Bareggio']);
  });

  it('merge: previous legacy comune falls back into multi-comune union', () => {
    const first = mergeIntent(DEFAULT_INTENT, { requestedArea: { comune: 'Magenta' } });
    const second = mergeIntent(first, { requestedArea: { comuni: ['Sedriano'] } });
    expect(second.requestedArea).toEqual({ comune: 'Magenta', comuni: ['Magenta', 'Sedriano'] });
  });

  it('merge: patching only zona/provincia does not lose comuni; missing area keeps previous', () => {
    const first = mergeIntent(DEFAULT_INTENT, { requestedArea: { comuni: ['Magenta', 'Sedriano'] } });
    const second = mergeIntent(first, { requestedArea: { zona: 'Ovest', provincia: 'MI' } });
    const third = mergeIntent(second, { project: 'TEST' });
    expect(second.requestedArea).toEqual({ comuni: ['Magenta', 'Sedriano'], comune: 'Magenta', zona: 'Ovest', provincia: 'MI' });
    expect(third.requestedArea).toEqual(second.requestedArea);
  });

  it('merge: explicit null clears area, and next turn starts fresh', () => {
    const first = mergeIntent(DEFAULT_INTENT, { requestedArea: { comuni: ['Magenta', 'Sedriano'] } });
    const cleared = mergeIntent(first, { requestedArea: null });
    const next = mergeIntent(cleared, { requestedArea: { comuni: ['Bareggio'] } });
    expect(cleared.requestedArea).toBeNull();
    expect(next.requestedArea).toEqual({ comuni: ['Bareggio'], comune: 'Bareggio' });
  });
});

describe('gptour multi-comune area filtering helpers', () => {
  const intent = (requestedArea: TourIntent['requestedArea']): TourIntent => ({ ...DEFAULT_INTENT, requestedArea });
  const magenta = candidate('mag-1', 'Magenta');
  const sedriano = candidate('sed-1', 'Sedriano');
  const bareggio = candidate('bar-1', 'Bareggio');
  const milano = candidate('mil-1', 'Milano');

  it('outsideRequestedComune works across 3 requested cities + outsiders', () => {
    const i = intent({ comuni: ['Magenta', 'Sedriano', 'Bareggio'] });
    expect(outsideRequestedComune(magenta, i)).toBe(false);
    expect(outsideRequestedComune(sedriano, i)).toBe(false);
    expect(outsideRequestedComune(bareggio, i)).toBe(false);
    expect(outsideRequestedComune(milano, i)).toBe(true);
  });

  it('outsideRequestedComune uses normalized compare (case/whitespace/accents)', () => {
    const i = intent({ comuni: ['sedriano'] });
    expect(outsideRequestedComune(candidate('sed-acc', '  SÉDRIANO  '), i)).toBe(false);
  });

  it('outsideRequestedComune: list takes precedence over legacy single comune', () => {
    const i = intent({ comune: 'Milano', comuni: ['Magenta'] });
    expect(outsideRequestedComune(candidate('m', 'Milano'), i)).toBe(true);
    expect(outsideRequestedComune(candidate('g', 'Magenta'), i)).toBe(false);
  });

  it('outsideRequestedComune: empty list falls back to legacy comune; empty/no area => false', () => {
    expect(outsideRequestedComune(candidate('g', 'Magenta'), intent({ comune: 'Magenta', comuni: [] }))).toBe(false);
    expect(outsideRequestedComune(candidate('m', 'Milano'), intent(null))).toBe(false);
    expect(outsideRequestedComune(candidate('m', 'Milano'), intent({ comuni: [] }))).toBe(false);
  });

  it('candidateIntentProblems ordinary guidance unchanged: comune non-strict, provincia strict', () => {
    expect(candidateIntentProblems(magenta, { ...DEFAULT_INTENT, requestedArea: { comune: 'Sedriano' } })).toEqual([]);
    expect(candidateIntentProblems(magenta, { ...DEFAULT_INTENT, requestedArea: { provincia: 'TO' } })).toEqual(['provincia diversa o non verificata']);
  });
});

describe('gptour multi-comune wantAll integration with real prepareGptDays', () => {
  const pool = [
    candidate('mag-1', 'Magenta', { name: 'Magenta Uno' }),
    candidate('mag-2', 'Magenta', { name: 'Magenta Due' }),
    candidate('sed-1', 'Sedriano', { name: 'Sedriano Uno' }),
    candidate('sed-2', 'Sedriano', { name: 'Sedriano Due' }),
    candidate('bar-1', 'Bareggio', { name: 'Bareggio Uno' }),
    candidate('mil-1', 'Milano', { name: 'Milano Uno' }),
    candidate('rho-1', 'Rho', { name: 'Rho Uno' }),
  ];

  it('turn1 only Magenta intent completes exactly Magenta keys', () => {
    const i = mergeIntent(DEFAULT_INTENT, { requestedEntityTypes: ['client'], wantAll: true, requestedArea: { comune: 'Magenta', comuni: ['Magenta'] } });
    const out = prepareGptDays(result(['mag-1']), pool, i, settings, date);
    expect(out.days[0].selection.map((s) => s.key)).toEqual(['mag-1', 'mag-2']);
  });

  it('turn2 merged comuni (Magenta+Sedriano+Bareggio) completes exactly those 5 keys', () => {
    const first = mergeIntent(DEFAULT_INTENT, { requestedEntityTypes: ['client'], wantAll: true, requestedArea: { comune: 'Magenta', comuni: ['Magenta'] } });
    const merged = mergeIntent(first, { requestedArea: { comuni: ['Sedriano', 'Bareggio'] } });
    const out = prepareGptDays(result(['sed-1']), pool, merged, settings, date);
    expect(out.days[0].selection.map((s) => s.key)).toEqual(['sed-1', 'mag-1', 'mag-2', 'sed-2', 'bar-1']);
  });

  it('explicit out-of-area AI pick still kept with warning (existing semantics)', () => {
    const i = mergeIntent(DEFAULT_INTENT, {
      requestedEntityTypes: ['client'],
      wantAll: true,
      requestedArea: { comuni: ['Magenta', 'Sedriano', 'Bareggio'], comune: 'Magenta' },
    });
    const out = prepareGptDays(result(['mil-1']), pool, i, settings, date);
    expect(out.days[0].selection.map((s) => s.key)).toEqual(['mil-1', 'mag-1', 'mag-2', 'sed-1', 'sed-2', 'bar-1']);
    expect(out.warnings).toContain('Milano Uno: fuori dal comune richiesto (Milano), mantenuto come scelto');
  });

  it('requestedArea null reset allows all eligible keys including outsiders', () => {
    const first = mergeIntent(DEFAULT_INTENT, { requestedEntityTypes: ['client'], wantAll: true, requestedArea: { comuni: ['Magenta'] } });
    const merged = mergeIntent(first, { requestedArea: { comuni: ['Sedriano', 'Bareggio'] } });
    const reset = mergeIntent(merged, { requestedArea: null });
    const out = prepareGptDays(result(['mag-1']), pool, reset, settings, date);
    expect(out.days[0].selection.map((s) => s.key)).toEqual(['mag-1', 'mag-2', 'sed-1', 'sed-2', 'bar-1', 'mil-1', 'rho-1']);
  });
});

describe('gptour multi-comune criteria chips', () => {
  it('renders all three comuni once in order', () => {
    const chips = criteriaChips({ ...DEFAULT_INTENT, requestedArea: { comuni: ['Magenta', 'Sedriano', 'Bareggio'], comune: 'Magenta' } });
    expect(chips).toEqual(['Magenta', 'Sedriano', 'Bareggio']);
  });

  it('falls back to legacy comune when comuni list missing/empty', () => {
    const chips = criteriaChips({ ...DEFAULT_INTENT, requestedArea: { comune: 'Magenta' } });
    expect(chips).toEqual(['Magenta']);
    const chipsEmpty = criteriaChips({ ...DEFAULT_INTENT, requestedArea: { comune: 'Magenta', comuni: [] } });
    expect(chipsEmpty).toEqual(['Magenta']);
  });

  it('keeps provincia/zona semantics and removes area chips on null', () => {
    const withArea = criteriaChips({ ...DEFAULT_INTENT, requestedArea: { comuni: ['Magenta', 'Sedriano', 'Bareggio'], provincia: 'MI', zona: 'Ovest' } });
    expect(withArea).toEqual(['Magenta', 'Sedriano', 'Bareggio', 'MI', 'Ovest']);
    const noArea = criteriaChips({ ...DEFAULT_INTENT, requestedArea: null });
    expect(noArea).toEqual([]);
  });
});
