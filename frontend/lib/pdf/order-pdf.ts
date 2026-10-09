/**
 * PDF Ordine — generatore unico per il dettaglio ordine e per il download dalle tappe AI Tour
 * (equivalente mobile di downloadOrderPdf in OrderDetail.tsx della web app).
 * Mobile: expo-print + share sheet; web: dialog di stampa del browser (salvabile come PDF).
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { Order } from '../../types';
import { getOrderStatusLabel } from '../api/orders';
import { orderBreakdown, orderLineBreakdown } from '../order-totals';

const eur = (v: number) => `€ ${Number(v || 0).toFixed(2).replace('.', ',')}`;
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const dateIt = (value: string | null | undefined) => {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export function buildOrderPdfHtml(order: Order): string {
  const totals = orderBreakdown(order);
  const items = order.order_items || [];
  const rows = items.map((item, i) => {
    const line = orderLineBreakdown(item, order.is_foreign);
    const product = item.product;
    return `<tr style="background:${i % 2 === 0 ? '#FFFFFF' : '#FAFAFA'}">
      <td class="td">${esc(product?.sku || '-')}</td>
      <td class="td"><div class="prod-name">${esc(product?.name || 'Prodotto')}</div>${product?.short_description ? `<div class="prod-sku">${esc(product.short_description)}</div>` : ''}</td>
      <td class="td center">${item.quantity}</td>
      <td class="td right">${eur(item.unit_price)}${item.discount_percent > 0 ? `<div class="prod-sku">sconto ${item.discount_percent}%</div>` : ''}</td>
      <td class="td right">${eur(line.excise)}</td>
      <td class="td right">${line.vatRate}% (${eur(line.vat)})</td>
      <td class="td right"><strong>${eur(line.gross)}</strong></td>
    </tr>`;
  }).join('');
  const customer = order.customer;
  const totalQty = items.reduce((n, it) => n + Number(it.quantity || 0), 0);
  return `<!DOCTYPE html>
<html lang="it"><head><meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1C1C1E; font-size: 12px; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #29417A; padding-bottom: 16px; margin-bottom: 20px; }
  .brand { font-size: 22px; font-weight: 800; color: #29417A; letter-spacing: -0.5px; }
  .brand-sub { font-size: 11px; color: #8E8E93; margin-top: 2px; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 22px; color: #1C1C1E; letter-spacing: 1px; }
  .doc-meta { font-size: 11px; color: #8E8E93; margin-top: 4px; }
  .status { display: inline-block; margin-top: 6px; padding: 2px 10px; border-radius: 6px; background: #EEF2FF; color: #29417A; font-size: 10px; font-weight: 700; }
  .grid { display: flex; gap: 16px; margin-bottom: 20px; }
  .box { flex: 1; background: #F8F8F8; border-radius: 10px; padding: 12px 14px; }
  .box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #8E8E93; margin-bottom: 6px; }
  .box .main { font-size: 14px; font-weight: 700; margin-bottom: 3px; }
  .box .line { font-size: 11px; color: #3A3A3C; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { background: #29417A; color: #FFF; font-size: 9px; text-transform: uppercase; letter-spacing: 0.6px; padding: 7px 8px; text-align: left; }
  th.center, td.center { text-align: center; } th.right, td.right { text-align: right; }
  .td { padding: 7px 8px; border-bottom: 1px solid #EEE; vertical-align: top; font-size: 11px; }
  .prod-name { font-weight: 600; } .prod-sku { font-size: 9px; color: #8E8E93; margin-top: 2px; }
  .qty { text-align: right; font-size: 10px; color: #8E8E93; margin-bottom: 16px; }
  .totals { margin-left: auto; width: 280px; }
  .tot-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .grand { border-top: 2px solid #29417A; margin-top: 6px; padding-top: 8px; font-size: 16px; font-weight: 800; color: #29417A; }
  .notes { background: #F8F8F8; border-radius: 10px; padding: 10px 14px; margin-top: 16px; }
  .notes h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #8E8E93; margin-bottom: 4px; }
  .notes p { font-size: 11px; color: #3A3A3C; white-space: pre-wrap; }
  .footer { margin-top: 28px; border-top: 1px solid #EEE; padding-top: 12px; font-size: 9px; color: #8E8E93; line-height: 1.6; }
  .badge-estero { display: inline-block; background: #F3E8FF; color: #6D28D9; border: 1px solid #DDD6FE; border-radius: 6px; font-size: 10px; font-weight: 700; padding: 2px 8px; margin-top: 4px; }
</style></head>
<body>
  <div class="header">
    <div><div class="brand">VOOM Crm</div><div class="brand-sub">Documento generato dall'app mobile</div>${order.is_foreign ? '<div class="badge-estero">ORDINE ESTERO — IVA esente</div>' : ''}</div>
    <div class="doc-title"><h1>ORDINE #${esc(order.order_number)}</h1><div class="doc-meta">Data: ${dateIt(order.order_date)}</div><div class="status">${esc(getOrderStatusLabel(order.status))}</div></div>
  </div>
  <div class="grid">
    <div class="box"><h3>Cliente</h3><div class="main">${esc(customer?.business_name || 'Cliente')}</div>
      ${customer?.address ? `<div class="line">${esc(customer.address)}</div>` : ''}
      ${customer?.city ? `<div class="line">${esc([customer.postal_code, customer.city, customer.province ? `(${customer.province})` : ''].filter(Boolean).join(' '))}</div>` : ''}
      ${customer?.vat_number ? `<div class="line">P.IVA: ${esc(customer.vat_number)}</div>` : ''}
    </div>
    <div class="box"><h3>Consegna</h3>
      <div class="line">${esc(order.shipping_address || customer?.address || '-')}</div>
      ${order.expected_delivery_date ? `<div class="line">Consegna prevista: ${dateIt(order.expected_delivery_date)}</div>` : ''}
      ${order.actual_delivery_date ? `<div class="line">Consegnato il: ${dateIt(order.actual_delivery_date)}</div>` : ''}
    </div>
  </div>
  <table><thead><tr><th style="width:70px">SKU</th><th>Prodotto</th><th class="center" style="width:40px">Q.tà</th><th class="right" style="width:80px">Prezzo unit.</th><th class="right" style="width:70px">Accisa</th><th class="right" style="width:90px">IVA</th><th class="right" style="width:85px">Totale</th></tr></thead>
  <tbody>${rows || '<tr><td class="td" colspan="7">Nessun prodotto</td></tr>'}</tbody></table>
  <div class="qty">Totale quantità: ${totalQty}</div>
  <div class="totals">
    <div class="tot-row"><span>Imponibile prodotti</span><span>${eur(totals.net)}</span></div>
    <div class="tot-row"><span>Accisa</span><span>${eur(totals.excise)}</span></div>
    ${!order.is_foreign ? `<div class="tot-row"><span>IVA</span><span>${eur(totals.vat)}</span></div>` : ''}
    <div class="tot-row"><span>Spedizione${!order.is_foreign ? ' (IVA incl.)' : ''}</span><span>${eur(totals.shipping)}</span></div>
    <div class="tot-row grand"><span>TOTALE</span><span>${eur(totals.gross)}</span></div>
    <div class="tot-row"><span>Importo registrato</span><span>${eur(order.total_amount)}</span></div>
  </div>
  ${order.notes ? `<div class="notes"><h3>Note</h3><p>${esc(order.notes)}</p></div>` : ''}
  <div class="footer">Calcolo informativo con accisa e aliquote del catalogo attuale. Per i valori fiscali definitivi fa fede la fattura.</div>
</body></html>`;
}

/** Genera il PDF dell'ordine e apre lo share sheet (mobile) o il dialog di stampa (web). */
export async function downloadOrderPdf(order: Order): Promise<void> {
  const html = buildOrderPdfHtml(order);
  if (Platform.OS === 'web') { await Print.printAsync({ html }); return; }
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Ordine ${order.order_number}`, UTI: 'com.adobe.pdf' });
  }
}
