/**
 * PDF Preventivo — genera e condivide un PDF con il riepilogo dell'ordine
 * (Step 5 Raccolta Ordine). Su mobile usa expo-print + expo-sharing (share sheet),
 * su web apre il dialog di stampa del browser (salvabile come PDF).
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export interface QuoteItem {
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  originalUnitPrice?: number; // presente se il prezzo è scontato (spalmato)
  lineTotal: number; // totale riga IVA+accisa incluse (come da calcolo ordine)
}

export interface QuoteData {
  customer: {
    businessName: string;
    address: string;
    vatNumber: string;
    fiscalCode: string;
  };
  agentName: string;
  agentEmail: string;
  isForeignOrder: boolean;
  items: QuoteItem[];
  totals: {
    imponibile: number;
    accisa: number;
    iva: number;
    shipping: number;
    grandTotal: number;
    totalProducts: number;
  };
  discounts: {
    rottamazione: { gross: number; net: number; description: string } | null;
    cashBack: number | null;
    scontoBenvenuto: boolean;
  };
  paymentLabel: string | null;
  shippingLabel: string | null;
  notes: string | null;
}

const eur = (v: number) => `€ ${v.toFixed(2).replace('.', ',')}`;
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function buildQuoteHtml(d: QuoteData): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  const quoteNumber = `PREV-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const itemRows = d.items
    .map(
      (it, i) => `
      <tr style="background:${i % 2 === 0 ? '#FFFFFF' : '#FAFAFA'}">
        <td class="td">
          <div class="prod-name">${esc(it.name)}</div>
          ${it.sku ? `<div class="prod-sku">SKU: ${esc(it.sku)}</div>` : ''}
        </td>
        <td class="td center">${it.quantity}</td>
        <td class="td right">
          ${
            it.originalUnitPrice !== undefined && it.originalUnitPrice !== it.unitPrice
              ? `<span class="strike">${eur(it.originalUnitPrice)}</span> <strong>${eur(it.unitPrice)}</strong>`
              : eur(it.unitPrice)
          }
        </td>
        <td class="td right"><strong>${eur(it.lineTotal)}</strong></td>
      </tr>`
    )
    .join('');

  const discountBadges: string[] = [];
  if (d.discounts.rottamazione) {
    discountBadges.push(
      `<div class="discount-row"><span>♻️ Rottamazione (lordo IVA incl.)${d.discounts.rottamazione.description ? ` — ${esc(d.discounts.rottamazione.description)}` : ''}</span><span class="discount-val">-${eur(d.discounts.rottamazione.net)} (netto spalmato)</span></div>`
    );
  }
  if (d.discounts.cashBack) {
    discountBadges.push(
      `<div class="discount-row"><span>🎁 CashBack utilizzato (spalmato sui prodotti idonei)</span><span class="discount-val">-${eur(d.discounts.cashBack)}</span></div>`
    );
  }
  if (d.discounts.scontoBenvenuto) {
    discountBadges.push(
      `<div class="discount-row"><span>⭐ Sconto Benvenuto 25% (primo ordine, prodotti idonei)</span><span class="discount-val">applicato</span></div>`
    );
  }

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1C1C1E; font-size: 12px; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #C2410C; padding-bottom: 16px; margin-bottom: 20px; }
  .brand { font-size: 22px; font-weight: 800; color: #C2410C; letter-spacing: -0.5px; }
  .brand-sub { font-size: 11px; color: #8E8E93; margin-top: 2px; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 24px; color: #1C1C1E; letter-spacing: 1px; }
  .doc-meta { font-size: 11px; color: #8E8E93; margin-top: 4px; }
  .grid { display: flex; gap: 16px; margin-bottom: 20px; }
  .box { flex: 1; background: #F8F8F8; border-radius: 10px; padding: 12px 14px; }
  .box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #8E8E93; margin-bottom: 6px; }
  .box .main { font-size: 14px; font-weight: 700; margin-bottom: 3px; }
  .box .line { font-size: 11px; color: #3A3A3C; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #C2410C; color: #FFF; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; padding: 8px 10px; text-align: left; }
  th.center, td.center { text-align: center; }
  th.right, td.right { text-align: right; }
  .td { padding: 8px 10px; border-bottom: 1px solid #EEE; vertical-align: top; }
  .prod-name { font-weight: 600; }
  .prod-sku { font-size: 9px; color: #8E8E93; margin-top: 2px; }
  .strike { text-decoration: line-through; color: #8E8E93; font-size: 10px; }
  .totals { margin-left: auto; width: 280px; }
  .tot-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .tot-row .lbl { color: #3A3A3C; }
  .grand { border-top: 2px solid #C2410C; margin-top: 6px; padding-top: 8px; font-size: 16px; font-weight: 800; color: #C2410C; }
  .discounts { background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 10px; padding: 10px 14px; margin-bottom: 16px; }
  .discounts h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9A3412; margin-bottom: 6px; }
  .discount-row { display: flex; justify-content: space-between; font-size: 11px; color: #9A3412; padding: 2px 0; }
  .discount-val { font-weight: 700; }
  .notes { background: #F8F8F8; border-radius: 10px; padding: 10px 14px; margin-bottom: 16px; }
  .notes h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #8E8E93; margin-bottom: 4px; }
  .notes p { font-size: 11px; color: #3A3A3C; white-space: pre-wrap; }
  .footer { margin-top: 28px; border-top: 1px solid #EEE; padding-top: 12px; font-size: 9px; color: #8E8E93; line-height: 1.6; }
  .badge-estero { display: inline-block; background: #FFF7ED; color: #C2410C; border: 1px solid #FED7AA; border-radius: 6px; font-size: 10px; font-weight: 700; padding: 2px 8px; margin-top: 4px; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">VOOM Crm</div>
      <div class="brand-sub">Preventivo generato dall'app mobile</div>
      ${d.isForeignOrder ? '<div class="badge-estero">ORDINE ESTERO — IVA esente</div>' : ''}
    </div>
    <div class="doc-title">
      <h1>PREVENTIVO</h1>
      <div class="doc-meta">N. ${quoteNumber}</div>
      <div class="doc-meta">Data: ${dateStr}</div>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <h3>Cliente</h3>
      <div class="main">${esc(d.customer.businessName)}</div>
      ${d.customer.address ? `<div class="line">${esc(d.customer.address)}</div>` : ''}
      ${d.customer.vatNumber ? `<div class="line">P.IVA: ${esc(d.customer.vatNumber)}</div>` : ''}
      ${d.customer.fiscalCode ? `<div class="line">C.F.: ${esc(d.customer.fiscalCode)}</div>` : ''}
    </div>
    <div class="box">
      <h3>Agente</h3>
      <div class="main">${esc(d.agentName)}</div>
      ${d.agentEmail ? `<div class="line">${esc(d.agentEmail)}</div>` : ''}
      ${d.paymentLabel ? `<div class="line">Pagamento: ${esc(d.paymentLabel)}</div>` : ''}
      ${d.shippingLabel ? `<div class="line">Spedizione: ${esc(d.shippingLabel)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Prodotto</th>
        <th class="center" style="width:50px">Q.tà</th>
        <th class="right" style="width:110px">Prezzo unit.</th>
        <th class="right" style="width:110px">Totale riga*</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  ${discountBadges.length > 0 ? `<div class="discounts"><h3>Sconti applicati (già inclusi nei prezzi unitari)</h3>${discountBadges.join('')}</div>` : ''}

  <div class="totals">
    <div class="tot-row"><span class="lbl">Imponibile (${d.totals.totalProducts} pz)</span><span>${eur(d.totals.imponibile)}</span></div>
    <div class="tot-row"><span class="lbl">Accisa</span><span>${eur(d.totals.accisa)}</span></div>
    ${!d.isForeignOrder ? `<div class="tot-row"><span class="lbl">IVA</span><span>${eur(d.totals.iva)}</span></div>` : ''}
    <div class="tot-row"><span class="lbl">Spedizione${!d.isForeignOrder ? ' (IVA incl.)' : ''}</span><span>${eur(d.totals.shipping)}</span></div>
    <div class="tot-row grand"><span>TOTALE</span><span>${eur(d.totals.grandTotal)}</span></div>
  </div>

  ${d.notes ? `<div class="notes"><h3>Note</h3><p>${esc(d.notes)}</p></div>` : ''}

  <div class="footer">
    * Totale riga comprensivo di accisa${!d.isForeignOrder ? ' e IVA' : ''} ove applicabili.<br/>
    Il presente preventivo non costituisce documento fiscale né conferma d'ordine. Prezzi e disponibilità soggetti a variazione fino alla conferma dell'ordine. Validità: 7 giorni dalla data di emissione.
  </div>
</body>
</html>`;
}

/**
 * Genera il PDF e apre lo share sheet nativo (mobile) o il dialog di stampa (web).
 */
export async function generateAndShareQuotePdf(data: QuoteData): Promise<void> {
  const html = buildQuoteHtml(data);

  if (Platform.OS === 'web') {
    // Su web: apre il dialog di stampa del browser (l'utente può salvare come PDF)
    await Print.printAsync({ html });
    return;
  }

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Condividi Preventivo PDF',
      UTI: 'com.adobe.pdf',
    });
  }
}
