import type { RequestEnvelope } from '../../lib/aitour/orchestrator/contract';
import type { OrchestratorResponse } from '../../lib/aitour/orchestrator/wire-contract';

type Status = OrchestratorResponse['status'];

const baseCriteria: OrchestratorResponse['criteria'] = {
  groups: { version: 1, existing: true, newPoints: true, ownOnly: false, inactiveDays: 20, needsDays: false },
  area: { comuni: ['MILANO', 'OPERA'], provincia: null, exhaustive: false },
  date: '2026-10-12',
  dateAnchorTurn: 1,
  startTime: '07:00',
  endTime: '16:30',
  wantAll: false,
  nonWorkingConfirmed: false,
  maxDays: 2,
  extraDaysApproved: false,
  requiredKeys: ['cust:111'],
  requiredNames: ['Cliente Storico'],
  excludedNames: ['Tabaccheria Esclusa'],
  excludedKeys: ['tab:999'],
  consents: ['Conferma gestione follow-up in arretrato'],
};

const basePlan = {
  date: '2026-10-12',
  startMin: 420,
  finishMin: 930,
  endMin: 1020,
  departure: { lat: 45.348, lng: 9.164, label: 'Casa' },
  returnTo: { lat: 45.348, lng: 9.164, label: 'Casa' },
  stops: [
    {
      key: 'cust:111',
      name: 'Cliente Storico',
      city: 'MILANO',
      lat: 45.42,
      lng: 9.18,
      role: 'required_by_agent' as const,
      group: 'existing' as const,
      arrivalMin: 470,
      departureMin: 500,
      travelMinFromPrev: 20,
      travelKmFromPrev: 11,
      waitMin: 0,
      visitMin: 30,
      lunchBeforeMin: 0,
      reason: 'cliente con relazione commerciale',
      lastOrderDate: '2026-09-18',
      daysSinceOrder: 24,
      outsideWindow: false,
    },
    {
      key: 'tab:222',
      name: 'Nuovo Punto Centro',
      city: 'MILANO',
      lat: 45.45,
      lng: 9.21,
      role: 'suggested' as const,
      group: 'new' as const,
      arrivalMin: 540,
      departureMin: 570,
      travelMinFromPrev: 12,
      travelKmFromPrev: 6,
      waitMin: 0,
      visitMin: 30,
      lunchBeforeMin: 30,
      reason: 'nuovo punto verificato nel registro',
      lastOrderDate: null,
      daysSinceOrder: null,
      outsideWindow: false,
    },
  ],
  totals: {
    driveMin: 72,
    visitMin: 120,
    waitMin: 0,
    breakMin: 30,
    returnMin: 28,
    totalMin: 250,
    availableMin: 600,
    bufferMin: 350,
    totalKm: 44.8,
  },
  geometry: [
    [45.348, 9.164],
    [45.42, 9.18],
    [45.45, 9.21],
    [45.348, 9.164],
  ] as [number, number][],
  warnings: ['Routing stimato: geometria semplificata nel giorno 2'],
  conflicts: [],
};

export function syntheticOfficialResponse(request: RequestEnvelope, status: Status): OrchestratorResponse {
  const ready = status === 'ready';
  const planning = status === 'planning';
  const blocked = status === 'blocked';
  const failed = status === 'failed';
  const revision = request.expectedRevision === undefined ? 1 : Number(request.expectedRevision) + 1;
  const planId = `<plan-${request.sessionId}>`;

  return {
    status,
    contractVersion: '1.0',
    engineVersion: 'gptour-orchestrator/0.2.0',
    sessionId: request.sessionId,
    sessionRevision: revision,
    requestId: request.requestId,
    generatedAt: '2026-10-11T19:17:04.000Z',
    message: blocked
      ? 'La sessione è legata a un altro agente: apri una nuova sessione.'
      : failed
        ? 'Servizio di calcolo percorsi non disponibile, riprova tra poco.'
        : planning
          ? 'Bozza pronta: verifico routing per conferma.'
          : 'Piano pronto e verificato.',
    question: planning
      ? {
          id: 'followups:fu-1,fu-2',
          kind: 'follow_ups',
          text: 'Per lunedì risultano impegni da decidere:\n• «Cliente A» — follow-up ore 11:00\n• «Cliente B» — follow-up ore 16:00',
          options: [
            { id: 'include_all', label: 'Includili tutti' },
            { id: 'exclude_all', label: 'Lasciali fuori dal giro' },
          ],
        }
      : null,
    criteria: baseCriteria,
    pendingDecisions: planning ? ['follow_up:fu-1', 'follow_up:fu-2'] : [],
    plan:
      ready || planning
        ? {
            planId,
            sessionId: request.sessionId,
            sessionRevision: revision,
            engineVersion: 'gptour-orchestrator/0.2.0',
            contractVersion: '1.0',
            generatedAt: '2026-10-11T19:17:04.000Z',
            ...basePlan,
            verification: ready ? 'verified_routing' : 'estimated_routing',
            snapshotRef: '<snapshot-ref-1>',
            selectionReasons: {
              selected: [{ key: 'cust:111', reason: 'cliente con relazione commerciale' }],
              excluded: [{ key: 'tab:999', name: 'Tabaccheria Esclusa', reason: 'fuori dal territorio autorizzato' }],
            },
            warnings: ['follow-up arretrato fuori area: non inserito nel percorso'],
            dependsOnPendingChanges: planning ? ['pending-routing-confirmation'] : [],
            days: [
              {
                day: 1,
                ...basePlan,
                startsFrom: 'home',
                returnHomeAfterDay: false,
                nightKmHome: 61,
                nightDecision: 'threshold',
              },
              {
                day: 2,
                date: '2026-10-13',
                startMin: 450,
                finishMin: 910,
                endMin: 1020,
                departure: { lat: 45.45, lng: 9.21, label: 'Fine giorno precedente' },
                returnTo: { lat: 45.348, lng: 9.164, label: 'Casa' },
                stops: [
                  {
                    key: 'cust:333',
                    name: 'Cliente Follow-up',
                    city: 'OPERA',
                    lat: 45.37,
                    lng: 9.21,
                    role: 'follow_up_confirmed',
                    group: 'existing',
                    arrivalMin: 500,
                    departureMin: 530,
                    travelMinFromPrev: 16,
                    travelKmFromPrev: 8,
                    waitMin: 0,
                    visitMin: 30,
                    lunchBeforeMin: 0,
                    reason: 'follow-up confermato',
                    lastOrderDate: '2026-08-22',
                    daysSinceOrder: 51,
                    outsideWindow: false,
                  },
                ],
                totals: {
                  driveMin: 58,
                  visitMin: 30,
                  waitMin: 0,
                  breakMin: 0,
                  returnMin: 36,
                  totalMin: 124,
                  availableMin: 570,
                  bufferMin: 446,
                  totalKm: 33.2,
                },
                geometry: [
                  [45.45, 9.21],
                  [45.37, 9.21],
                  [45.348, 9.164],
                ],
                startsFrom: 'previous_day_end',
                returnHomeAfterDay: true,
                nightKmHome: null,
                nightDecision: 'last_day',
                warnings: [],
                conflicts: [],
              },
            ],
          }
        : null,
    planId: ready || planning ? planId : null,
    conflicts: blocked ? ['agent_mismatch'] : [],
    dataQuality: {
      candidatesComplete: true,
      poolTruncated: false,
      purchasesVerified: true,
      registryVerified: true,
      routingSource: ready ? 'osrm' : planning ? 'estimate' : 'none',
      notes: [],
    },
    metrics: {
      durationMs: 2300,
      crmQueries: 7,
      aiCalls: 0,
      routingCalls: ready ? 2 : planning ? 1 : 0,
    },
    ...(blocked ? { errorCode: 'agent_mismatch' } : {}),
    ...(failed ? { errorCode: 'routing_unavailable' } : {}),
  };
}
