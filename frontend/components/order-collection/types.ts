import { Product } from '../../lib/api/order-collection';

export interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
}

export interface CashBackBalance {
  available_balance: number;
}

export interface RottamazioneConfig {
  lots: number[];
  multiplier: number;
  iva_rate: number;
}

export const DEFAULT_ROTTAMAZIONE_LOTS = [0, 100, 200, 300, 400, 500];
export const DEFAULT_ROTTAMAZIONE_MULTIPLIER = 2.5;
export const DEFAULT_ROTTAMAZIONE_IVA_RATE = 1.22;

export const STEPS = ['Cliente', 'Prodotti', 'Pagamento', 'Spedizione', 'Riepilogo'];
