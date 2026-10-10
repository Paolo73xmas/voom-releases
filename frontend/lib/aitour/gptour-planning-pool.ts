// Glue mobile per il flusso web GPTourForm @ 2eea9933 (874ba31/30b163a): il pool di pianificazione
// è ristretto al perimetro deterministico della conversazione (provincia/comuni, confinanti consentiti,
// filtro acquisti riletto dalla tabella ordini). Senza perimetro il portafoglio resta quello caricato.
import type { TourCandidate } from './types';
import type { TourIntent } from './gptour-intent';
import { requestedComuniNorm } from './gptour-criteria';
import { verifiedPlanningPool } from './gptour-registry';
import { refreshPurchaseHistory } from './gptour-purchases';
import { verifiedPurchaseDays } from './gptour-commercial';
import { developmentBorders } from './gptour-development';
import { requestedAreaLabel } from './gptour-purchase-summary';

export interface PlanningScope { signature: string; pool: TourCandidate[] | null; nearby: string[] }
export interface PlanningScopeDeps {
  borders: (intent: TourIntent) => Promise<Set<string>>;
  refresh: (pool: TourCandidate[]) => Promise<TourCandidate[]>;
}
const defaultDeps: PlanningScopeDeps = { borders: developmentBorders, refresh: refreshPurchaseHistory };

/** Il perimetro è deterministico solo quando la conversazione ha fissato area o filtro acquisti. */
export function isScopedIntent(i: TourIntent): boolean {
  return !!i.commercialGroups || !!i.requireOrderHistory || !!i.requestedArea?.provincia || requestedComuniNorm(i.requestedArea).size > 0;
}
export function scopeSignature(i: TourIntent): string {
  return JSON.stringify([i.requireOrderHistory ?? false, i.orderMinDays, i.requestedArea ?? null, i.allowNearby ?? false,
    i.requestedEntityTypes, i.allowedExpansionTypes, i.physicalContactMinDays, i.minRevenue, i.maxRevenue, i.project,
    i.ownOrphansOnly, i.allTobacconists ?? false, i.commercialGroups ?? null]);
}
export async function resolvePlanningScope(candidates: TourCandidate[], intent: TourIntent, deps: PlanningScopeDeps = defaultDeps): Promise<PlanningScope> {
  const signature = scopeSignature(intent);
  const nearby = intent.allowNearby ? [...await deps.borders(intent)] : [];
  if (!isScopedIntent(intent)) return { signature, pool: null, nearby };
  let base = candidates;
  // Gli acquisti vengono riletti SOLO per i candidati dell'area: la data RPC iniziale non decide il filtro.
  if (verifiedPurchaseDays(intent) != null) {
    const unrestrictedPurchase: TourIntent = { ...intent, orderMinDays: null, requireOrderHistory: false,
      ...(intent.commercialGroups ? { commercialGroups: { ...intent.commercialGroups, inactiveDays: null, needsDays: false } } : {}) };
    const eligible = verifiedPlanningPool(candidates, unrestrictedPurchase, nearby);
    // New points keep their own verified non-visit evidence; no purchase requirement is imposed on them.
    const existing = eligible.filter(c => c.gptourData?.commercial?.relationship !== 'none');
    base = [...await deps.refresh(existing), ...eligible.filter(c => c.gptourData?.commercial?.relationship === 'none')];
  }
  return { signature, pool: verifiedPlanningPool(base, intent, nearby), nearby };
}

/** Secondo passaggio AI sul pool verificato: provincia o filtro acquisti (web 30b163a). */
export function needsVerifiedPass(i: TourIntent): boolean {
  return !!i.commercialGroups || !!i.requireOrderHistory || !!i.requestedArea?.provincia;
}
export function verifiedAgentInfo(i: TourIntent, poolSize: number): Record<string, unknown> {
  return {
    nClienti: poolSize,
    gruppiCommercialiVerificati: i.commercialGroups || null,
    vincoliVerificati: { soloTipi: i.requestedEntityTypes, soloAreaRichiesta: !!i.strictGeography, nienteFollowUp: !!i.skipFollowUps,
      tutteLeTabaccherie: !!i.allTobacconists, soloUnaGiornata: !!i.singleDayRequested && !i.extraDaysApproved },
    istruzioneRegistro: i.commercialGroups?.newPoints && i.commercialGroups.existing
      ? `Pool verificato: clienti con relazione commerciale${verifiedPurchaseDays(i) != null ? ` e ordini validi da almeno ${verifiedPurchaseDays(i)} giorni` : ', anche senza ordini'} PIÙ nuovi punti mai visitati. La soglia acquisti vale SOLO per i clienti, MAI per i nuovi punti. Non cambiare gruppi, data, area o orari. Usa solo le key fornite.`
      : i.requireOrderHistory
      ? `Criteri verificati: clienti/orfani con ultimo ordine da almeno ${i.orderMinDays} giorni, NON ultima visita; storico ordini reale aggiornato. Sono esclusi nuovi punti e chi non ha mai acquistato. Area verificata: ${JSON.stringify(i.requestedArea)}. Una provincia comprende tutti i suoi comuni ammessi, non solo il capoluogo. Usa solo i candidati forniti. Rispetta wantAll=${i.wantAll}: non aggiungere giornate o sviluppo per esaurire l’elenco se non richiesto.`
      : i.commercialGroups
        ? 'Pool verificato per i gruppi commerciali richiesti. I nuovi punti hanno evidenza esplicita non_visitato nel registro disponibile, non una deduzione da storico vuoto. Non cambiare gruppi, date, territori o orari; non dichiarare il registro completo se il caricamento è parziale.'
        : 'I candidati forniti appartengono al registro caricato nell’area autorizzata. Non dedurre assenza di visite o relazioni da una categoria tecnica. Non proporre altri comuni senza consenso. Tutte le tipologie indica categorie, NON tutte le righe: wantAll=false non richiede copertura esaustiva, seleziona un sottoinsieme compatibile senza proporre più giorni o pernottamenti solo per esaurire il registro. Rispetta il wantAll verificato nell’intent corrente.',
  };
}
export function emptyScopeMessage(i: TourIntent): string {
  if (i.commercialGroups) return 'Non risultano candidati verificati per i gruppi commerciali richiesti nell’area e nel territorio autorizzati. Non aggiungo categorie o altre zone; i dati mancanti non dimostrano assenza di visite o acquisti.';
  if (i.requireOrderHistory) return `Nell’area richiesta e nel territorio dell’agente non risultano clienti o orfani ammessi con un ultimo acquisto risalente ad almeno ${i.orderMinDays} giorni. Ho verificato gli ordini, non le visite; i punti che non hanno mai acquistato non sono inclusi. Non estendo la ricerca ad altre zone.`;
  return `Non risultano punti pianificabili ${requestedAreaLabel(i.requestedArea)} con i criteri richiesti, nel portafoglio e nel registro caricati. Verifica il nome del comune o della provincia (frazioni e località non vengono risolte automaticamente): non estendo la ricerca ad altre zone.`;
}
