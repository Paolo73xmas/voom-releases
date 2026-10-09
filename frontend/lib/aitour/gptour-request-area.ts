// Porting del modulo web gptour-request-area.ts @ 2eea9933 (solo percorsi import).
import { normalizeProvincia } from '../italy-provinces';
import { normalizeComune } from './comuni-adjacency';
import type { TourIntentArea } from './gptour-intent';

// Geographic wording ends before commercial conditions, dates and instructions.
// In particular, "provincia che non comprano..." is NEVER a locality.
const END_AREA = /\s+(?:che|non\s+(?:compr\w*|acquist\w*|ordin\w*|visitat\w*)|senza\s+(?:ordini|acquisti)|con\s+fatturato|fermi\s+da|domani|dopodomani|oggi)\b|[,;]?\s*(?:niente|senza|no)\s+follow[ -]?up|\s+e\s+(?:comuni\s+)?(?:limitrofi|confinanti)|\s+dalle?\s+\d|[.!?;\n]/i;
const clean = (s: string) => s.split(END_AREA)[0].trim().replace(/^['"“”]|['"“”]$/g, '');
const isLocalityName = (s: string) => s.length >= 2 && s.length <= 80
  && !/\b(?:voglio|visita|clienti|tabaccherie|punti vendita|provincia|ore|partenza|rientro|limitrofi|confinanti|vicini|territorio)\b/i.test(s);

// Only known spelling variants of the business noun: never autocorrect place names.
// The original chat text remains untouched.
export function normalizeStoreWords(message: string): string {
  return message.replace(/\b(?:tyabaccheri|tabbaccheri|tabbacheri)([ae])\b/gi, (_word, ending: string) => `tabaccheri${ending.toLowerCase()}`);
}

function localityText(message: string): string | null {
  const matches = [
    message.match(/\b(?:comun[ei]|localit[aà]|frazion[ei])\s+(?:di\s+)?(.+)/i),
    message.match(/\b(?:nuovi punti vendita|sviluppo)\s+a\s+(.+)/i),
    message.match(/\b(?:tabaccherie|clienti|orfani|prospect)\s+(?:di|a)\s+(.+)/i),
  ].filter((m): m is RegExpMatchArray => !!m);
  const first = matches.sort((a, b) => (a.index || 0) - (b.index || 0))[0];
  return first ? clean(first[1]) : null;
}

/** null: no unambiguous literal area, so keep the interpreter/current context. */
export function explicitRequestArea(message: string, previous?: TourIntentArea | null): TourIntentArea | null {
  message = normalizeStoreWords(message);
  const text = localityText(message);
  const namedProvince = message.match(/\bprovincia\s+di\s+(.+)/i);
  const provinceTail = text?.match(/^(.+?)\s+e\s+(?:(?:la|sua|tutta\s+la)\s+)?provincia\b/i);
  // "Castelfranco Veneto in provincia di Treviso" disambiguates a municipality;
  // it does not request every municipality of TV.
  const qualifiedTown = text?.match(/^(.+?)(?:\s+in\s+|\s*,\s*(?:in\s+)?)provincia\s+di\s+(.+)$/i);
  if (qualifiedTown) {
    const names = qualifiedTown[1].split(/\s*,\s*|\s+e\s+/i).map(s => s.trim()).filter(Boolean);
    // "Treviso e le tabaccherie in provincia di Treviso" repeats the subject:
    // the second noun is not a town and the request includes the whole province.
    if (names.length && names.every(isLocalityName)) {
      return { comuni: names, comune: names[0], provincia: normalizeProvincia(qualifiedTown[2])?.sigla || qualifiedTown[2], zona: null };
    }
  }
  if (namedProvince || provinceTail) {
    const raw = clean(namedProvince?.[1] || provinceTail![1]);
    const province = normalizeProvincia(raw);
    // An explicit unknown province stays a province (fail-closed), not a fake town.
    return { comuni: [], comune: null, provincia: province?.sigla || raw, zona: null };
  }
  if (!text) {
    // A short geographic clarification replaces a malformed old area, not the criteria.
    const bare = clean(message);
    const province = normalizeProvincia(bare);
    if (previous && province && bare === message.trim()) {
      return previous.provincia && !previous.comuni?.length && !previous.comune
        ? { comuni: [], comune: null, provincia: province.sigla, zona: null }
        : { comuni: [bare], comune: bare, provincia: null, zona: null };
    }
    return null;
  }
  const names = text.split(/\s*,\s*|\s+e\s+/i).map(s => s.trim()).filter(Boolean);
  if (!names.length || !names.every(isLocalityName)) return null;
  const combined = /\b(?:aggiungi|anche)\b/i.test(message)
    ? [...(previous?.comuni || (previous?.comune ? [previous.comune] : [])), ...names] : names;
  const unique = [...new Map(combined.map(n => [normalizeComune(n), n])).values()];
  return { comuni: unique, comune: unique[0], provincia: null, zona: null };
}

export function explicitLocalityNames(message: string): string[] {
  return explicitRequestArea(message)?.comuni || [];
}
