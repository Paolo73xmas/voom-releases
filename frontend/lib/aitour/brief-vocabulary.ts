// Fase 3: vocabolario per la dettatura. Progetti attivi, comuni dell'agente e insegne/nominativi
// del portafoglio vengono passati a Whisper come "prompt" per orientare la trascrizione.
// Nessuna correzione automatica del testo: il vocabolario guida solo il riconoscimento.
// Parità web src/lib/aitour/brief-vocabulary.ts
import type { BriefCustomer } from './brief-customers';

const MAX_CHARS = 850; // limite pratico del prompt Whisper (~224 token)
const GENERIC = new Set(['tabaccheria', 'tabacchi', 'tabaccherie', 'rivendita', 'bar', 'edicola', 'snc', 'srl', 'sas', 'srls', 'spa', 'di', 'da', 'del', 'della', 'dei', 'e', 'c', 'cartoleria', 'ricevitoria']);

const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/["\n\r]/g, ' ').trim();

function shortName(name: string): string {
  const parts = clean(name).split(' ').filter((w) => w.length > 1 && !GENERIC.has(w.toLowerCase()));
  return parts.slice(0, 3).join(' ');
}

function frequent(values: string[], limit: number): string[] {
  const counts = new Map<string, { label: string; n: number }>();
  for (const raw of values) {
    const label = clean(raw);
    if (!label) continue;
    const key = label.toLowerCase();
    const prev = counts.get(key);
    if (prev) prev.n += 1;
    else counts.set(key, { label, n: 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).slice(0, limit).map((x) => x.label);
}

function section(title: string, items: string[], budget: number): string {
  if (!items.length || budget <= title.length + 4) return '';
  const kept: string[] = [];
  let used = title.length + 2;
  for (const it of items) {
    if (used + it.length + 2 > budget) break;
    kept.push(it);
    used += it.length + 2;
  }
  return kept.length ? `${title}: ${kept.join(', ')}.` : '';
}

/**
 * Prompt di dettatura: progetti, comuni e nomi realmente presenti nel portafoglio dell'agente.
 * Ordine di priorità: progetti (pochi e decisivi), comuni, insegne/nominativi.
 */
export function buildDictationVocabulary(projects: string[], customers: BriefCustomer[], maxChars = MAX_CHARS): string {
  const head = 'Giro visite di un agente VOOM in Italia.';
  const projectItems = frequent(projects.map(shortName).filter(Boolean), 20);
  const cityItems = frequent(customers.map((c) => c.city || ''), 60);
  const nameItems = frequent(
    customers.flatMap((c) => [shortName(c.name || c.crmName || ''), clean(c.contactName || '')]).filter((x) => x.length > 2),
    120,
  );

  const parts = [head];
  let budget = maxChars - head.length;
  for (const [title, items, share] of [['Progetti', projectItems, 0.3], ['Comuni', cityItems, 0.4], ['Insegne e nominativi', nameItems, 1]] as const) {
    const slice = section(title, items, Math.max(0, Math.floor(budget * share)));
    if (slice) { parts.push(slice); budget -= slice.length + 1; }
  }
  return parts.join(' ').slice(0, maxChars);
}
