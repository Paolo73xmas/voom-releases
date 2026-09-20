import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

import { validateBriefSchema, repairInstructions, schemaErrorSummary } from '../lib/aitour/brief-schema';
import { buildDictationVocabulary } from '../lib/aitour/brief-vocabulary';
import { briefCorrections } from '../lib/aitour/brief-memory';
import { normalizeBriefV4, type TourBriefV4 } from '../lib/aitour/brief-v4';
import type { BriefCustomer } from '../lib/aitour/brief-customers';

// Porting del test web tests/aitour/brief_schema_memory.unit.ts
const validRaw = (): Record<string, unknown> => ({
  version: '4.0',
  dayType: 'clienti',
  requestedDate: { type: 'tomorrow', value: '2026-06-16' },
  areas: [{ kind: 'province', value: 'PV', mode: 'include' }],
  journey: null,
  selection: { operator: 'AND', conditions: [{ type: 'project_membership', names: ['FED', 'DoctorVape'], match: 'any' }, { type: 'last_order_days', operator: '>=', value: 30 }] },
  includeAutomatic: true,
  mandatoryStops: [{ rawReference: 'tabacchi rossi di voghera', cityHint: 'Voghera', priority: 1, appointment: { type: 'exact', time: '15:30', from: null, to: null } }],
  preferredStops: [],
  exclusions: [{ type: 'prospects' }],
  preferences: [{ type: 'prefer_oldest_last_order' }],
  projectRules: [{ type: 'minimum_count', project: 'FED', value: 6, priority: 1 }],
  fillers: [{ selection: { operator: 'AND', conditions: [{ type: 'prospects' }] }, when: 'time_available', target: { mode: 'maximum', value: 3 } }],
  visitTarget: { mode: 'exact', value: 10, min: null, max: null, scope: 'total_including_mandatory' },
  route: { startPlace: { kind: 'home', rawReference: 'Casa', cityHint: null }, endPlace: null, compact: 'prefer', startTime: '09:00', endTime: null, finishBy: '18:00', returnHome: true, returnToStart: false, splitAllowed: null, maxDays: null },
  interpretation: { confidence: 0.92, needsConfirmation: false, unresolvedEntities: [], warnings: [] },
  summary: 'Domani 10 visite FED/DoctorVape in provincia di Pavia.',
});
const paths = (raw: unknown) => validateBriefSchema(raw).map((e) => e.path);

describe('validateBriefSchema', () => {
  it('brief completo e corretto: nessun errore', () => {
    expect(validateBriefSchema(validRaw())).toEqual([]);
    expect(validateBriefSchema(null)).toHaveLength(1);
    expect(validateBriefSchema('{}')).toHaveLength(1);
  });

  it('campi e condizioni fuori contratto', () => {
    expect(paths({ ...validRaw(), stops: [] })).toContain('stops');
    expect(paths({ ...validRaw(), selection: { operator: 'AND', conditions: [{ type: 'clients_vip' }] } })).toContain('selection.conditions[0].type');
    const bo = paths({ ...validRaw(), selection: { operator: 'XOR', conditions: [{ type: 'last_order_days', operator: '~', value: 'trenta' }] } });
    expect(bo).toContain('selection.operator');
    expect(bo).toContain('selection.conditions[0].operator');
    expect(bo).toContain('selection.conditions[0].value');
    expect(paths({ ...validRaw(), exclusions: [{ type: 'prospects', names: ['FED'] }] })).toContain('exclusions[0].names');
  });

  it('tappe, percorso e quote non validi', () => {
    const bs = paths({ ...validRaw(), mandatoryStops: [{ cityHint: 'Pavia', priority: 7, appointment: { type: 'exact', time: 'tre e mezza' } }] });
    expect(bs).toContain('mandatoryStops[0].rawReference');
    expect(bs).toContain('mandatoryStops[0].priority');
    expect(bs).toContain('mandatoryStops[0].appointment.time');
    const bj = paths({ ...validRaw(), journey: { stages: [{ name: 'Milano', direction: 'SUDOVEST' }, { direction: 'S' }] } });
    expect(bj).toContain('journey.stages[0].direction');
    expect(bj).toContain('journey.stages[1].name');
    const br = paths({ ...validRaw(), projectRules: [{ type: 'quota', project: 'FED', value: 6 }, { type: 'minimum_count', project: '', value: null }] });
    expect(br).toContain('projectRules[0].type');
    expect(br).toContain('projectRules[1].project');
    expect(br).toContain('projectRules[1].value');
  });

  it('target, orari, data e interpretazione non validi', () => {
    const bt = paths({ ...validRaw(), visitTarget: { mode: 'exact', value: null, min: null, max: null, scope: 'strano' } });
    expect(bt).toContain('visitTarget.value');
    expect(bt).toContain('visitTarget.scope');
    const brt = paths({ ...validRaw(), route: { startPlace: { kind: 'garage', rawReference: '' }, endPlace: null, compact: 'molto', startTime: '9', returnHome: 'si', splitAllowed: 'forse', maxDays: 0 } });
    expect(brt).toContain('route.startPlace.kind');
    expect(brt).toContain('route.compact');
    expect(brt).toContain('route.startTime');
    expect(brt).toContain('route.returnHome');
    expect(paths({ ...validRaw(), requestedDate: { type: 'tomorrow', value: null } })).toContain('requestedDate.value');
    const bi = paths({ ...validRaw(), interpretation: { confidence: 5, warnings: 'nessuno', unresolvedEntities: [] } });
    expect(bi).toContain('interpretation.confidence');
    expect(bi).toContain('interpretation.warnings');
  });

  it('istruzioni di riparazione e avviso in italiano', () => {
    const errs = validateBriefSchema({ ...validRaw(), route: { startPlace: { kind: 'garage', rawReference: '' }, compact: 'molto', startTime: '9', returnHome: 'si' } });
    const instructions = repairInstructions(errs);
    expect(instructions.length).toBeGreaterThan(0);
    expect(instructions.length).toBeLessThanOrEqual(12);
    expect(instructions.every((x) => x.includes(':'))).toBe(true);
    expect(repairInstructions([{ path: 'route.compact', message: 'x' }, { path: 'route.compact', message: 'x' }])).toHaveLength(1);
    expect(schemaErrorSummary(errs)).toContain('partenza, arrivo e orari');
  });
});

describe('buildDictationVocabulary', () => {
  const cust = (over: Partial<BriefCustomer>, i = 0): BriefCustomer => ({
    id: over.id ?? `c${i}`, name: over.name ?? '', crmName: over.crmName ?? '', contactName: over.contactName ?? '',
    resaleCode: '', city: over.city ?? 'Pavia', province: 'PV', address: '', lat: 45.18, lng: 9.15,
  });
  const portfolio = [
    cust({ name: 'TABACCHERIA BERETTA', contactName: 'Roberto Beretta', city: 'Voghera' }, 1),
    cust({ name: 'IL TABACCAIO DI M 2 DI VLADOVIC RELJA TULIO', city: 'Voghera' }, 2),
    cust({ name: 'BAR FUMAGALLI SNC', contactName: 'Luigi Fumagalli', city: 'Pavia' }, 3),
    cust({ name: 'Rivendita Nuvolento', city: 'Nuvolento' }, 4),
  ];

  it('contiene progetti, comuni e insegne dell agente, senza parole generiche', () => {
    const vocab = buildDictationVocabulary(['FED', 'DoctorVape'], portfolio);
    expect(vocab).toContain('FED');
    expect(vocab).toContain('DoctorVape');
    expect(vocab).toContain('Voghera');
    expect(vocab).toContain('Pavia');
    expect(/beretta/i.test(vocab)).toBe(true);
    expect(/\bTABACCHERIA\b/.test(vocab)).toBe(false);
    expect(vocab.length).toBeLessThanOrEqual(850);
  });

  it('portafoglio ampio: troncato entro il limite Whisper, progetti mantenuti', () => {
    const big = buildDictationVocabulary(['FED'], Array.from({ length: 500 }, (_, i) => cust({ name: `Insegna Numero ${i}`, city: `Comune${i}` }, i)));
    expect(big.length).toBeLessThanOrEqual(850);
    expect(big).toContain('FED');
    expect(buildDictationVocabulary([], []).includes('Progetti')).toBe(false);
  });
});

describe('briefCorrections: memoria delle correzioni', () => {
  const interpreted = normalizeBriefV4(validRaw());

  it('nessuna modifica: nessuna correzione', () => {
    expect(briefCorrections(interpreted, interpreted)).toEqual([]);
  });

  it('registra i campi corretti dall agente', () => {
    const corrected: TourBriefV4 = {
      ...interpreted,
      selection: { ...interpreted.selection, conditions: [interpreted.selection.conditions[0]] },
      areas: [...interpreted.areas, { kind: 'city', value: 'Voghera', mode: 'include' }],
      visitTarget: { ...interpreted.visitTarget, value: 8 },
      mandatoryStops: interpreted.mandatoryStops.map((s) => ({ ...s, selectedCustomerId: 'abc-123' })),
      projectRules: [],
      dayType: 'mista',
      route: { ...interpreted.route, compact: 'required' },
    };
    const corr = briefCorrections(interpreted, corrected);
    const fields = corr.map((c) => c.field);
    for (const f of ['selection', 'areas', 'visitTarget', 'mandatoryStops', 'projectRules', 'dayType', 'route.compact']) {
      expect(fields).toContain(f);
    }
    const areaCorr = corr.find((c) => c.field === 'areas');
    expect(areaCorr?.added).toEqual(['city:Voghera']);
    expect(areaCorr?.removed).toEqual([]);
    const selCorr = corr.find((c) => c.field === 'selection');
    expect(selCorr?.removed).toHaveLength(1);
    expect(selCorr?.added).toHaveLength(0);
  });
});
