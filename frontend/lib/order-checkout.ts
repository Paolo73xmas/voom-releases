import type { PaymentMethod, ShippingMethod } from './api/order-collection';

const normalizedName = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

/** Regola confermata: Estero paga con CONTANTI, non Contanti al Corriere.
 * Italia mantiene tutti i pagamenti attivi, incluso Contanti (valido per entrambi).
 */
export function isPaymentAllowed(method: PaymentMethod, isForeign: boolean): boolean {
  return method.is_active === true && (!isForeign || normalizedName(method.name) === 'contanti');
}

/** Le spedizioni seguono solo i dati del gestionale: colonna STATO (is_active) e
 * colonna TIPO (foreign_only). Nessun nome o codice è codificato nella app, così
 * nuovi metodi Italia/Estero creati sul web compaiono subito senza modifiche.
 */
export function isShippingAllowed(method: ShippingMethod, isForeign: boolean): boolean {
  if (!method.is_active) return false;
  return isForeign ? method.foreign_only === true : method.foreign_only !== true;
}

/** Stesse fasce del gestionale web (shipping-methods): minimo sotto soglia,
 * percentuale nella fascia, tetto oltre threshold_max. Nessuna soglia inventata.
 * La base è merce + accisa, prima di IVA e sconti riepilogo, come nel web.
 */
export function getShippingBaseCost(method: ShippingMethod | undefined, orderBase: number): number {
  if (!method) return 0;
  if (method.cost_type !== 'percentage') return method.cost || 0;
  const value = Math.max(0, orderBase);
  const minThreshold = method.threshold_min || 0;
  const maxThreshold = method.threshold_max || 0;
  const percent = (method.cost_percentage || 0) / 100;
  const cost = value <= minThreshold ? (method.min_cost || 0)
    : (maxThreshold > 0 ? Math.min(value, maxThreshold) : value) * percent;
  return Math.round(cost * 100) / 100;
}
