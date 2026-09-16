import type { PaymentMethod, ShippingMethod } from './api/order-collection';

const normalizedName = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();

/** Regola confermata: Estero paga con CONTANTI, non Contanti al Corriere.
 * Cassiopea 3% è invece una spedizione: non va mai usata come payment_method_id.
 * Italia mantiene tutti i pagamenti attivi, incluso Contanti (valido per entrambi).
 */
export function isPaymentAllowed(method: PaymentMethod, isForeign: boolean): boolean {
  return method.is_active === true && (!isForeign || normalizedName(method.name) === 'contanti');
}

/** Le spedizioni seguono esattamente il flag foreign_only del gestionale:
 * Estero → Cassiopea 3% e il ritiro in sede marcato foreign_only.
 * Italia → spedizioni nazionali e il ritiro in sede non foreign_only (nessun doppione).
 */
export function isShippingAllowed(method: ShippingMethod, isForeign: boolean): boolean {
  if (!method.is_active) return false;
  const name = normalizedName(method.name);
  if (isForeign) {
    return method.foreign_only === true && (/^cassiopea\s*3\s*%$/.test(name) || name.includes('ritiro'));
  }
  return method.foreign_only !== true;
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