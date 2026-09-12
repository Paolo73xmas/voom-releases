/** Entrata rapida da una tappa AI Tour o da un cliente della Mappa. */
export function customerOrderRoute(customerId: string, customerName: string) {
  return { pathname: '/order-collection-v2' as const, params: { customerId, customerName, startStep: 'products' } };
}