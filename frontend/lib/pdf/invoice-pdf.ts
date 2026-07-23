/**
 * PDF Fattura (copia di cortesia) — genera e condivide il PDF di una fattura
 * elettronica per il sollecito pagamento. Su mobile usa expo-print + expo-sharing
 * (share sheet: l'agente la inoltra via WhatsApp/altro), su web apre il dialog di stampa.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

interface InvoiceLine {
  sku?: string;
  descrizione: string;
  quantita: number;
  prezzo_unitario: number;
  prezzo_totale: number;
  aliquota_iva: number;
  accisa?: number;
}

export interface InvoicePdfExtra {
  paymentMethodName?: string | null;
  scadDates?: Date[] | null;
  paid: number;
  residuo: number;
  agentName?: string | null;
}

const eur = (v: number) => `€ ${(v || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = (s: string | null | undefined) =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  const dd = typeof d === 'string' ? new Date(d) : d;
  return Number.isNaN(dd.getTime()) ? '—' : dd.toLocaleDateString('it-IT');
};

export function buildInvoiceHtml(inv: any, extra: InvoicePdfExtra): string {
  const lines: InvoiceLine[] = Array.isArray(inv.dettaglio_linee) ? inv.dettaglio_linee : [];

  const lineRows = lines
    .map(
      (l, i) => `
      <tr style="background:${i % 2 === 0 ? '#FFFFFF' : '#FAFAFA'}">
        <td class="td">
          <div class="prod-name">${esc(l.descrizione)}</div>
          ${l.sku ? `<div class="prod-sku">SKU: ${esc(l.sku)}</div>` : ''}
        </td>
        <td class="td center">${l.quantita ?? ''}</td>
        <td class="td right">${eur(l.prezzo_unitario)}</td>
        <td class="td center">${l.aliquota_iva != null ? `${l.aliquota_iva}%` : '—'}</td>
        <td class="td right"><strong>${eur(l.prezzo_totale)}</strong></td>
      </tr>`
    )
    .join('');

  const cedenteAddr = [inv.cedente_indirizzo, [inv.cedente_cap, inv.cedente_citta, inv.cedente_provincia ? `(${inv.cedente_provincia})` : ''].filter(Boolean).join(' ')]
    .filter(Boolean).join(' — ');
  const cessAddr = [inv.cessionario_indirizzo, [inv.cessionario_cap, inv.cessionario_citta, inv.cessionario_provincia ? `(${inv.cessionario_provincia})` : ''].filter(Boolean).join(' ')]
    .filter(Boolean).join(' — ');

  const scadStr = extra.scadDates && extra.scadDates.length > 0
    ? extra.scadDates.map(fmtDate).join(' + ')
    : '—';

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1C1C1E; font-size: 12px; padding: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #C2410C; padding-bottom: 16px; margin-bottom: 20px; }
  .brand { font-size: 20px; font-weight: 800; color: #C2410C; letter-spacing: -0.5px; }
  .brand-sub { font-size: 11px; color: #3A3A3C; margin-top: 4px; line-height: 1.5; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 22px; color: #1C1C1E; letter-spacing: 1px; }
  .doc-meta { font-size: 11px; color: #8E8E93; margin-top: 4px; }
  .courtesy { display: inline-block; background: #FFF7ED; color: #C2410C; border: 1px solid #FED7AA; border-radius: 6px; font-size: 9px; font-weight: 700; padding: 2px 8px; margin-top: 6px; letter-spacing: 0.5px; }
  .grid { display: flex; gap: 16px; margin-bottom: 20px; }
  .box { flex: 1; background: #F8F8F8; border-radius: 10px; padding: 12px 14px; }
  .box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #8E8E93; margin-bottom: 6px; }
  .box .main { font-size: 13px; font-weight: 700; margin-bottom: 3px; }
  .box .line { font-size: 11px; color: #3A3A3C; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #C2410C; color: #FFF; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; padding: 8px 10px; text-align: left; }
  th.center, td.center { text-align: center; }
  th.right, td.right { text-align: right; }
  .td { padding: 8px 10px; border-bottom: 1px solid #EEE; vertical-align: top; }
  .prod-name { font-weight: 600; }
  .prod-sku { font-size: 9px; color: #8E8E93; margin-top: 2px; }
  .bottom { display: flex; gap: 16px; align-items: flex-start; }
  .paybox { flex: 1; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 10px; padding: 12px 14px; }
  .paybox h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #991B1B; margin-bottom: 8px; }
  .pay-row { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; color: #3A3A3C; }
  .pay-row.resid { font-size: 14px; font-weight: 800; color: #991B1B; border-top: 1px solid #FECACA; margin-top: 6px; padding-top: 6px; }
  .totals { width: 280px; }
  .tot-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
  .tot-row .lbl { color: #3A3A3C; }
  .grand { border-top: 2px solid #C2410C; margin-top: 6px; padding-top: 8px; font-size: 16px; font-weight: 800; color: #C2410C; }
  .footer { margin-top: 28px; border-top: 1px solid #EEE; padding-top: 12px; font-size: 9px; color: #8E8E93; line-height: 1.6; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">${esc(inv.cedente_ragione_sociale) || 'VOOM Crm'}</div>
      <div class="brand-sub">
        ${cedenteAddr ? `${esc(cedenteAddr)}<br/>` : ''}
        ${inv.cedente_partita_iva ? `P.IVA: ${esc(inv.cedente_partita_iva)}` : ''}
        ${inv.cedente_codice_fiscale ? ` — C.F.: ${esc(inv.cedente_codice_fiscale)}` : ''}
      </div>
    </div>
    <div class="doc-title">
      <h1>FATTURA</h1>
      <div class="doc-meta">N. ${esc(inv.invoice_number)}</div>
      <div class="doc-meta">Data: ${fmtDate(inv.invoice_date)}</div>
      ${inv.order_number ? `<div class="doc-meta">Ordine: ${esc(inv.order_number)}</div>` : ''}
      <div class="courtesy">COPIA DI CORTESIA</div>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <h3>Destinatario</h3>
      <div class="main">${esc(inv.cessionario_ragione_sociale) || '—'}</div>
      ${cessAddr ? `<div class="line">${esc(cessAddr)}</div>` : ''}
      ${inv.cessionario_partita_iva ? `<div class="line">P.IVA: ${esc(inv.cessionario_partita_iva)}</div>` : ''}
      ${inv.cessionario_codice_fiscale ? `<div class="line">C.F.: ${esc(inv.cessionario_codice_fiscale)}</div>` : ''}
      ${inv.cessionario_pec ? `<div class="line">PEC: ${esc(inv.cessionario_pec)}</div>` : ''}
      ${inv.cessionario_codice_sdi ? `<div class="line">Codice SDI: ${esc(inv.cessionario_codice_sdi)}</div>` : ''}
    </div>
    <div class="box">
      <h3>Pagamento</h3>
      ${extra.paymentMethodName ? `<div class="line"><b>Metodo:</b> ${esc(extra.paymentMethodName)}</div>` : ''}
      <div class="line"><b>Scadenza:</b> ${scadStr}</div>
      ${extra.agentName ? `<div class="line"><b>Agente:</b> ${esc(extra.agentName)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Descrizione</th>
        <th class="center" style="width:50px">Q.tà</th>
        <th class="right" style="width:95px">Prezzo unit.</th>
        <th class="center" style="width:55px">IVA</th>
        <th class="right" style="width:100px">Totale</th>
      </tr>
    </thead>
    <tbody>${lineRows || '<tr><td class="td" colspan="5">Dettaglio righe non disponibile</td></tr>'}</tbody>
  </table>

  <div class="bottom">
    <div class="paybox">
      <h3>Situazione pagamenti</h3>
      <div class="pay-row"><span>Totale documento</span><span>${eur(inv.totale_documento)}</span></div>
      <div class="pay-row"><span>Incassato</span><span>${eur(extra.paid)}</span></div>
      <div class="pay-row resid"><span>RESIDUO DA SALDARE</span><span>${eur(extra.residuo)}</span></div>
    </div>
    <div class="totals">
      <div class="tot-row"><span class="lbl">Imponibile</span><span>${eur(inv.imponibile)}</span></div>
      <div class="tot-row"><span class="lbl">IVA${inv.iva_percentuale != null ? ` (${inv.iva_percentuale}%)` : ''}</span><span>${eur(inv.iva_importo)}</span></div>
      <div class="tot-row grand"><span>TOTALE</span><span>${eur(inv.totale_documento)}</span></div>
    </div>
  </div>

  <div class="footer">
    Copia di cortesia non valida ai fini fiscali. Il documento originale è stato trasmesso al Sistema di Interscambio (SdI) dell'Agenzia delle Entrate.
  </div>
</body>
</html>`;
}

/**
 * Genera il PDF della fattura e apre lo share sheet nativo (mobile) o il
 * dialog di stampa (web). L'agente può così inoltrarla via WhatsApp/email.
 */
export async function generateAndShareInvoicePdf(inv: any, extra: InvoicePdfExtra): Promise<void> {
  const html = buildInvoiceHtml(inv, extra);

  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Fattura ${inv.invoice_number}`,
      UTI: 'com.adobe.pdf',
    });
  }
}
