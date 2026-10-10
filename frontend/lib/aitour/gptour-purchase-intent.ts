import type { CommercialGroups, TourIntent } from './gptour-intent';

const WORD_DAYS: Record<string, number> = { dieci: 10, quindici: 15, venti: 20, trenta: 30, quaranta: 40, quarantacinque: 45, sessanta: 60, novanta: 90, un: 1, uno: 1, due: 2, tre: 3 };
const NUMBER = '(\\d{1,4}|dieci|quindici|venti|trenta|quaranta|quarantacinque|sessanta|novanta|un|uno|due|tre)';
const PERIOD = `(?:da|negli?\\s+ultimi|nell[’']ultimo)\\s*(?:almeno\\s+)?${NUMBER}\\s*(giorn[io]|gg|mes[ei])\\b`;
const PURCHASE = new RegExp(`(?:non\\s+(?:(?:ha|hanno)\\s+)?(?:compr\\w*|acquist\\w*|ordin\\w*)(?:\\s+pi[uù])?|senza\\s+(?:ordini|acquisti)|fermi)\\s+${PERIOD}`, 'i');
const LAST = new RegExp(`ultimo\\s+(?:acquisto|ordine)\\s+(?:(?:risalente|di|da)\\s+)?(?:almeno\\s+)?${NUMBER}\\s*(giorn[io]|gg|mes[ei])\\s*(?:fa|prima)?\\b`, 'i');
export function purchaseMinDays(message: string): number | null {
  const m = message.match(PURCHASE) || message.match(LAST);
  if (!m) return null;
  const n = (WORD_DAYS[m[1].toLowerCase()] ?? Number(m[1])) * (/mes/i.test(m[2]) ? 30 : 1);
  return Number.isFinite(n) && n > 0 ? n : null;
}
export const purchaseNeedsDays = (text: string): boolean => purchaseMinDays(text) == null
  && /inattiv\w*\s+(?:negli|sugli|per gli)\s+acquisti|non\s+(?:comprano|acquistano|ordinano)(?:\s+pi[uù])?(?:[.!?]|$)/i.test(text.trim());
export const newPointsMention = (s: string): boolean => /nuov[ioe]\s+(?:client[ei]|punt[io](?:\s+vendita)?|tabaccheri[ae])|(?:tabaccheri[ae]|client[ei]|punt[io](?:\s+vendita)?)\s+nuov[ioe]|(?:giornata|giorno|fare)\s+(?:di\s+)?(?:sviluppo|acquisizione)|(?:tabaccherie|punti vendita)\s+mai\s+visitat[ei]/i.test(s);
const noNew = (s: string) => /(?:lascia perdere|escludi|togli|rimuovi|senza|non includere|non voglio|niente)\s+(?:(?:i|le|anche)\s+)*(?:nuov[ie]|tabaccherie nuove|punti nuovi)/i.test(s);

/** Read ONLY the user's words for grants. A model patch/intentReset is not consent. */
export function applyPurchaseIntent(intent: TourIntent, message: string, previous?: TourIntent): TourIntent {
  const days = purchaseMinDays(message), vague = purchaseNeedsDays(message);
  const withoutNewNouns = message.replace(/nuovi\s+clienti|clienti\s+nuovi/gi, '');
  const clients = /\bclienti\b/i.test(withoutNewNouns);
  const fresh = newPointsMention(message) && !noNew(message);
  const only = /\b(?:solo|soltanto|esclusivamente)\b/i.test(message);
  const clear = /\b(?:togli|rimuovi|senza)\s+(?:il\s+)?filtro\s+(?:acquisti|ordini)|\b(?:anche|includi)\s+chi\s+ha\s+(?:comprato|ordinato|acquistato)\s+recentemente/i.test(message);
  const prev = previous?.commercialGroups;
  const answer = prev?.needsDays ? message.trim().match(new RegExp(`^(?:da\\s+)?(?:almeno\\s+)?${NUMBER}\\s*(giorn[io]|gg|mes[ei])?[.!]?$`, 'i')) : null;
  const answeredDays = answer ? (WORD_DAYS[answer[1].toLowerCase()] ?? Number(answer[1])) * (/mes/i.test(answer[2] || '') ? 30 : 1) : null;
  const purchase = days != null || vague || (answeredDays != null && answeredDays > 0);
  // Keep legacy unclassified requests intact, but never accept LLM-only expansion grants.
  if (!prev && !clients && !fresh && !purchase && !previous?.requireOrderHistory) {
    return { ...intent, allowedExpansionTypes: previous?.allowedExpansionTypes || [] };
  }
  let g: CommercialGroups = prev ? { ...prev } : { version: 1, existing: !!previous?.requireOrderHistory,
    newPoints: false, ownOnly: false, inactiveDays: previous?.requireOrderHistory ? previous.orderMinDays : null, needsDays: false };
  if (only && (clients || purchase || fresh)) { g.existing = clients || purchase; g.newPoints = fresh; }
  else { if (clients || purchase) g.existing = true; if (fresh) g.newPoints = true; }
  if (noNew(message)) g.newPoints = false;
  if (/\bmiei\s+clienti\b|\bmio\s+portafoglio\b/i.test(message)) g.ownOnly = true;
  if (vague) { g.inactiveDays = null; g.needsDays = true; }
  if (days != null || (answeredDays != null && answeredDays > 0)) { g.inactiveDays = days ?? answeredDays; g.needsDays = false; }
  if (clear || !g.existing) { g.inactiveDays = null; g.needsDays = false; }
  const requireHistory = g.existing && g.inactiveDays != null;
  return { ...intent, commercialGroups: g, requireOrderHistory: requireHistory && !g.newPoints, orderMinDays: g.newPoints ? null : g.inactiveDays,
    requestedEntityTypes: [...(g.existing ? ['client', 'prospect', 'orphan'] as const : []), ...(g.newPoints ? ['free', 'never'] as const : [])],
    allowedExpansionTypes: [], allTobacconists: false,
    physicalContactMinDays: /\b(?:non\s+(?:visitat\w*|contattat\w*|ispezionat\w*)|ultima\s+visita|ultimo\s+contatto).{0,25}\b(?:giorni|gg)\b/i.test(message)
      ? intent.physicalContactMinDays : previous?.physicalContactMinDays ?? null };
}