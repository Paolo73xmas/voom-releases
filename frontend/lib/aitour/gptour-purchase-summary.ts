// Porting del modulo web gptour-purchase-summary.ts @ 2eea9933 (solo percorsi import/tipi).
import { normalizeProvincia } from '../italy-provinces';
import type { TourIntent, TourIntentArea } from './gptour-intent';
import type { GptResult } from './gptour-api';

export function requestedAreaLabel(area: TourIntentArea | null | undefined): string {
  const names = area?.comuni?.length ? area.comuni : area?.comune ? [area.comune] : [];
  if (names.length) return `${names.length === 1 ? 'nel comune' : 'nei comuni'} di ${names.join(', ')}`;
  if (area?.provincia) return `nella provincia di ${normalizeProvincia(area.provincia)?.name || area.provincia}`;
  return 'nel territorio dell’agente';
}

/** The model can propose keys, but cannot rename a verified province as its capital
 * or claim the whole eligible portfolio was selected when only a subset was. */
export function withVerifiedPurchaseReply(result: GptResult, intent: TourIntent, eligibleCount: number): GptResult {
  if (!intent.requireOrderHistory || result.needsInfo) return result;
  const keys = new Set([...result.selection, ...result.days.flatMap(d => d.selection)].map(s => s.key));
  if (!keys.size) return result;
  return { ...result, reply: `Ho proposto ${keys.size} tapp${keys.size === 1 ? 'a' : 'e'} tra ${eligibleCount} clienti e orfani idonei ${requestedAreaLabel(intent.requestedArea)}, con ultimo acquisto risalente ad almeno ${intent.orderMinDays} giorni.${intent.skipFollowUps ? ' Follow-up esclusi.' : ''}` };
}
