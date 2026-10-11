import type { ContractBinding, RequestEnvelope, ServerSnapshot } from '../../lib/aitour/orchestrator/contract';
// INTERNAL PRESENTATION FIXTURES ONLY. _fixtureWire and these response fields are NOT API1.0 examples.

export const REQUEST_BASE: RequestEnvelope = {
  contractVersion: '1.0',
  sessionId: 'sess-1',
  requestId: 'req-1',
  message: 'clienti 15/20/30 misti new oggi domani',
};

export function readySnapshot(overrides: Partial<ServerSnapshot> = {}): ServerSnapshot {
  return {
    sessionId: 'sess-1',
    revision: 2,
    status: 'ready',
    messages: [
      { id: 'm1', role: 'user', text: 'Domani clienti misti' },
      { id: 'm2', role: 'assistant', text: 'Piano pronto' },
    ],
    questions: [],
    warnings: ['routing stimato'],
    plan: {
      routing: 'estimated',
      warnings: ['server warning'],
      days: [
        {
          id: 'd1',
          title: 'Giorno 1',
          date: '2099-10-05',
          start: { coordinate: { latitude: 45.4, longitude: 9.1 }, label: 'Casa' },
          end: { coordinate: { latitude: 45.42, longitude: 9.12 }, label: 'Rientro base' },
          stops: [
            {
              id: 's1',
              sequence: '1',
              name: 'Stop uno',
              coordinate: { latitude: 45.401, longitude: 9.101 },
              arrival: '09:00',
              departure: '09:20',
              travel: '00:15',
              visit: '00:20',
              wait: '00:05',
              mandatory: true,
              reason: 'Appuntamento fisso',
              options: [{ id: 'o1', label: 'Escludi', command: { name: 'exclude_stop', input: { stopId: 's1' } } }],
            },
            {
              id: 's2',
              sequence: '2',
              name: 'Stop due',
              coordinate: { latitude: 45.405, longitude: 9.105 },
              arrival: '09:35',
              departure: '09:55',
              travel: '00:10',
              visit: '00:20',
            },
            {
              id: 's3',
              sequence: '3',
              name: 'Stop tre',
              coordinate: { latitude: 45.409, longitude: 9.109 },
              arrival: '10:05',
              departure: '10:25',
              travel: '00:10',
              visit: '00:20',
            },
          ],
          geometry: [
            { latitude: 45.4, longitude: 9.1 },
            { latitude: 45.401, longitude: 9.101 },
            { latitude: 45.405, longitude: 9.105 },
            { latitude: 45.409, longitude: 9.109 },
          ],
          metrics: [
            { id: 'drive', label: 'Guida', value: '01:20' },
            { id: 'visit', label: 'Visite', value: '01:00' },
            { id: 'wait', label: 'Attese', value: '00:05' },
            { id: 'return', label: 'Rientro', value: '00:30' },
            { id: 'break', label: 'Pause', value: '00:30' },
            { id: 'distance', label: 'Distanza complessiva', value: '18,4 km' },
            { id: 'total', label: 'Tempo complessivo', value: '03:25' },
          ],
          breaks: ['Pausa pranzo 12:30'],
          commitments: ['Consegna 11:00'],
          overnight: 'Pernottamento previsto',
          warnings: ['giorno warning'],
        },
      ],
    },
    ...overrides,
  };
}

export function statusSnapshot(status: ServerSnapshot['status']): ServerSnapshot {
  return readySnapshot({ status, plan: status === 'ready' ? readySnapshot().plan : null });
}

export const fixtureBinding: ContractBinding = {
  version: '1.0',
  provenance: 'isolated-fixture',
  recoveryRevision: 'confirmed',
  encodeAction: command => ({ _fixtureWire: command.name, payload: command.input ?? null }),
  decodeResponse: raw => raw as ServerSnapshot,
};
