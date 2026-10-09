// Porting del modulo web gptour-purchase-intent.ts @ 2eea9933 (solo percorsi import).
import type { TourIntent } from './gptour-intent';

const WORD_DAYS: Record<string, number> = { dieci: 10, quindici: 15, venti: 20, trenta: 30, quaranta: 40, quarantacinque: 45, sessanta: 60, novanta: 90 };
const PERIOD = '(?:da|negli?\\s+ultimi|nell[’\x27]ultimo)\\s+(?:almeno\\s+)?(\\d{1,4}|dieci|quindici|venti|trenta|quaranta|quarantacinque|sessanta|novanta)\\s*(?:giorn[io]|gg)\\b';
const PURCHASE = new RegExp('(?:non\\s+(?:(?:ha|hanno)\\s+)?(?:compr\\w*|acquist\\w*|ordin\\w*)(?:\\s+pi[uù])?|senza\\s+(?:ordini|acquisti)|fermi)\\s+' + PERIOD, 'i');

export function purchaseMinDays(message: string): number | null {
  const match = message.match(PURCHASE);
  if (!match) return null;
  const n = WORD_DAYS[match[1].toLowerCase()] ?? Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Commercial constraints belong to the conversation, not to the place name/type label. */
export function applyPurchaseIntent(intent: TourIntent, message: string, previous?: TourIntent): TourIntent {
  const days = purchaseMinDays(message);
  const clear = /\b(?:togli|rimuovi|senza)\s+(?:il\s+)?filtro\s+(?:acquisti|ordini)|\b(?:anche|includi)\s+chi\s+ha\s+(?:comprato|ordinato|acquistato)\s+recentemente/i.test(message);
  const developmentOnly = /^(?:solo\s+)?(?:nuovi punti vendita|nuove tabaccherie)\b/i.test(message.trim());
  if (clear || developmentOnly) return { ...intent, orderMinDays: null, requireOrderHistory: false };
  if (days == null && !previous?.requireOrderHistory) return intent;
  return {
    ...intent,
    orderMinDays: days ?? previous!.orderMinDays,
    requireOrderHistory: true,
    requestedEntityTypes: ['client', 'orphan'],
    allowedExpansionTypes: [],
    allTobacconists: false,
    // An order-only request must not inherit an invented visit threshold from the model.
    physicalContactMinDays: /\b(?:non\s+(?:visitat\w*|contattat\w*|ispezionat\w*)|ultima\s+visita|ultimo\s+contatto).{0,25}\b(?:giorni|gg)\b/i.test(message)
      ? intent.physicalContactMinDays : previous?.physicalContactMinDays ?? null,
  };
}
