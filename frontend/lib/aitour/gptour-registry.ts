// Porting MIRATO del modulo web gptour-registry.ts @ 2eea9933: regole conversazionali deterministiche
// e pool di pianificazione verificato. Volutamente NON portati sul mobile: resolveRegistryAreas
// (RPC ai_tour_registry_availability / ai_tour_catalog_area), titolarità ai_tour_scope_candidates e
// la risoluzione località via Edge ai-tour-locality (geocoding server-side).
import type { TourIntent } from './gptour-intent';
import type { TourCandidate } from './types';
import { cityMatches, filterPoolByIntent } from './gptour-criteria';
import { applyDayConsent } from './gptour-day-consent';
import { explicitRequestArea, normalizeStoreWords } from './gptour-request-area';
import { applyPurchaseIntent, purchaseMinDays } from './gptour-purchase-intent';
export { explicitLocalityNames } from './gptour-request-area';

export function applyConversationRules(intent: TourIntent, message: string, previous?: TourIntent): TourIntent {
  message = normalizeStoreWords(message);
  const t = message.toLowerCase();
  let allowNearby = intent.allowNearby ?? false;
  if (/\b(limitrofi|confinanti|comuni vicini)\b/.test(t)) allowNearby = !/\b(no|senza|non|escludi)\b.*\b(limitrofi|confinanti|comuni vicini)\b/.test(t);
  let skipFollowUps = intent.skipFollowUps ?? false;
  if (/\b(niente|senza|no|escludi)\s+(?:i\s+)?follow[ -]?up/i.test(t)) skipFollowUps = true;
  else if (/\b(includi|anche|considera)\s+(?:i\s+)?follow[ -]?up/i.test(t)) skipFollowUps = false;
  const allTypesOnly = /tutt[ei]\s+(?:le\s+)?tipologie/i.test(message)
    && !/tutti (?:i )?(?:punti|clienti|negozi)|tutte (?:le )?tabaccherie|visitali tutti|ogn[ui]/i.test(message);
  const area = explicitRequestArea(message, previous?.requestedArea);
  const explicitAll = /\btutt[ie]\s+(?:(?:i|le|miei|mie|nuovi|nuove|vecchi|vecchie)\s+)*(?:punti vendita|tabaccherie|clienti|rivendite|negozi)\b|\bvisitali tutti\b|\bogni\s+(?:punto|tabaccheria|cliente|rivendita)\b/i.test(message);
  const plainTobacconists = /\btabaccherie\b/i.test(message) && !/\b(nuove|nuovi|orfane|orfani|prospect|mai|soltanto clienti|solo clienti)\b/i.test(message);
  const purchaseRequest = purchaseMinDays(message) != null || previous?.requireOrderHistory;
  const allCatalog = plainTobacconists && !purchaseRequest && intent.orderMinDays == null;
  const narrowing = /\b(nuovi punti|nuove tabaccherie|orfani|orfane|prospect|solo clienti|soltanto clienti)\b/i.test(message);
  const out: TourIntent = { ...intent, allowNearby, strictGeography: !allowNearby, skipFollowUps,
    wantAll: allTypesOnly ? false : explicitAll ? true : previous?.wantAll ?? intent.wantAll,
    allTobacconists: allCatalog ? true : narrowing || purchaseRequest ? false : previous?.allTobacconists,
    ...(allCatalog ? { requestedEntityTypes: ['client', 'prospect', 'orphan', 'free', 'never'] as TourIntent['requestedEntityTypes'], allowedExpansionTypes: [],
      ownOrphansOnly: false, wantAll: true } : {}),
    ...(area ? { requestedArea: area } : {}),
  };
  return applyDayConsent(applyPurchaseIntent(out, message, previous), message, previous);
}

export function isTypeOnlyRefinement(message: string): boolean {
  return /^(?:solo\s+)?nuovi\s+punti\s+vendita[.!\s]*$/i.test(message.trim());
}

/** Invio al modello limitato al perimetro autorizzato e ai criteri già verificati. */
export function verifiedPlanningPool(pool: TourCandidate[], intent: TourIntent, nearbyComuni: string[] = []): TourCandidate[] {
  const area = intent.allowNearby && intent.requestedArea
    ? { ...intent.requestedArea, comuni: [...(intent.requestedArea.comuni || (intent.requestedArea.comune ? [intent.requestedArea.comune] : [])), ...nearbyComuni] }
    : intent.requestedArea;
  // Permission for neighbouring municipalities never means the entire agent's territory.
  const scoped = { ...intent, strictGeography: !!area, requestedArea: area };
  return filterPoolByIntent(pool, scoped, 'corridor').filter(c => cityMatches(c, area));
}
