import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase';
import { saveToursBatch } from './tours';
import { assertMandatoryFeasible } from './brief-feasibility';
import { resolveGptourAgent } from './gptour-auth';
import type { TourPlan } from './types';

export type SaveJournal = { status: 'pending' | 'uncertain' | 'saved'; ids: string[]; dayCount: number; dates: string[] };
const locks = new Set<string>();
const keyOf = (actor: string, group: string) => `gptour:save:v1:${actor}:${group}`;
function decodeJournal(raw: string): SaveJournal {
  try {
    const r = JSON.parse(raw);
    if (!r || !['pending', 'uncertain', 'saved'].includes(r.status) || !Array.isArray(r.ids) || !Array.isArray(r.dates) || !Number.isInteger(r.dayCount)) throw new Error('Invalid');
    return r;
  } catch { throw new Error('Esito da verificare: registro locale illeggibile. Non verrà effettuato un secondo invio.'); }
}
export interface SaveDependencies {
  storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;
  session: () => Promise<string>;
  batch: (agent: string, plans: TourPlan[], name: string) => Promise<string[]>;
  lookup: (agent: string, group: string) => Promise<{ id: string; tour_date: string }[]>;
}
const dependencies: SaveDependencies = {
  storage: AsyncStorage,
  session: async () => { const a = await supabase.auth.getSession(); return a.data.session?.user.id || ''; },
  batch: saveToursBatch,
  lookup: async (agent, group) => {
    const { data, error } = await supabase.from('ai_tours').select('id,tour_date').eq('agent_id', agent).contains('area_filter', { gptourContext: { groupId: group } }).order('tour_date');
    if (error) throw new Error('Impossibile verificare l’esito del salvataggio. Non verrà ripetuto alla cieca.');
    return data || [];
  },
};
export async function reconcileGptourSave(agentId: string, actorId: string, role: string, groupId: string, deps = dependencies): Promise<string[]> {
  if (await deps.session() !== actorId) throw new Error('Sessione cambiata.');
  resolveGptourAgent(role, actorId, agentId);
  const key = keyOf(actorId, groupId), raw = await deps.storage.getItem(key);
  if (!raw) throw new Error('Registro locale di salvataggio non disponibile. Controlla I miei Tour.');
  const record = decodeJournal(raw);
  if (record.status === 'saved') return record.ids;
  const rows = await deps.lookup(agentId, groupId);
  if (rows.length !== record.dayCount || [...rows.map((r) => r.tour_date)].sort().join() !== [...record.dates].sort().join())
    throw new Error('Esito ancora da verificare: nessun nuovo invio effettuato. Controlla I miei Tour prima di ricreare il giro.');
  const ids = rows.map((r) => r.id);
  await deps.storage.setItem(key, JSON.stringify({ ...record, status: 'saved', ids })); return ids;
}
export async function saveGptourBatch(agentId: string, actorId: string, role: string, plans: TourPlan[], groupId: string, deps = dependencies): Promise<string[]> {
  if (await deps.session() !== actorId) throw new Error('Sessione cambiata. Nessun salvataggio effettuato.');
  resolveGptourAgent(role, actorId, agentId);
  plans.forEach(assertMandatoryFeasible);
  if (!plans.length || plans.some((p) => p.areaFilter?.gptourContext?.groupId !== groupId)) throw new Error('Contesto di salvataggio incompleto.');
  const key = keyOf(actorId, groupId);
  if (locks.has(key)) throw new Error('Salvataggio già in corso.');
  locks.add(key);
  try {
    const stored = await deps.storage.getItem(key);
    const previous = stored ? decodeJournal(stored) : null;
    if (previous?.status === 'saved') return previous.ids;
    if (previous) {
      const rows = await deps.lookup(agentId, groupId);
      if (rows.length === previous.dayCount && [...rows.map((r) => r.tour_date)].sort().join() === [...previous.dates].sort().join()) {
        const ids = rows.map((r) => r.id);
        await deps.storage.setItem(key, JSON.stringify({ ...previous, status: 'saved', ids })); return ids;
      }
      throw new Error('Esito da verificare: nessun secondo invio è stato effettuato. Riprova la verifica più tardi o controlla I miei Tour.');
    }
    const journal: SaveJournal = { status: 'pending', ids: [], dayCount: plans.length, dates: plans.map((p) => p.tourDate) };
    // Durable BEFORE sending: a failed storage write never starts the RPC.
    await deps.storage.setItem(key, JSON.stringify(journal));
    try {
      const ids = await deps.batch(agentId, plans, `GPTour · ${plans[0].tourDate}`);
      if (ids.length !== plans.length || new Set(ids).size !== ids.length) throw new Error('Risposta batch incompleta');
      await deps.storage.setItem(key, JSON.stringify({ ...journal, status: 'saved', ids })); return ids;
    } catch {
      // The durable pending record already exists. Preserve the uncertainty even if storage
      // also fails AFTER the server has committed; never let a disk error imply no write happened.
      try { await deps.storage.setItem(key, JSON.stringify({ ...journal, status: 'uncertain' })); } catch { /* pending is the recovery marker */ }
      throw new Error('Esito del batch da verificare. Per evitare duplicati non verrà reinviato: usa Verifica salvataggio.');
    }
  } finally { locks.delete(key); }
}