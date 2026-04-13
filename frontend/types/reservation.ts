/**
 * Stock Reservation System — TypeScript Types
 * Manages stock reservations (prenotazioni) for draft orders.
 */

export interface ReservationItem {
  product_id: string;
  quantity: number;
}

export interface AvailabilityWarning {
  product_id: string;
  requested: number;
  available: number;
}

export interface ReservationResult {
  status: 'ok' | 'error';
  warnings: AvailabilityWarning[];
}

export interface ReleaseResult {
  status: 'ok' | 'error';
  global_released: number;
  branch_released: number;
}

export interface AvailableStockInfo {
  product_id: string;
  stock_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
}

export type AvailableStockMap = Map<string, AvailableStockInfo>;
