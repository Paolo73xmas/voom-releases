/**
 * Scadenziario — scadenze incassi fatture elettroniche.
 * Porting 1:1 della logica web (src/lib/scadenze.ts + ScadenzarioTab.tsx):
 * - parsing termini di pagamento dal metodo (nome + descrizione)
 * - scadenze programmate = data fattura + giorni condizione ("a 30", "a 60", ...)
 * - residuo = totale_documento - somma invoice_payments
 * - vista Agente: solo fatture legate ai PROPRI ordini; vista Admin: tutte.
 */
import { supabase } from '../supabase';
import { getCache, setCache } from '../memory-cache';

// ---------------------------------------------------------------------------
// Parsing termini di pagamento (porting esatto dal web)
// ---------------------------------------------------------------------------

/**
 * Giorni di incasso dalla condizione di pagamento (nome + descrizione del metodo).
 * "a N" (es. "TITOLO a 60", "50% a 30 e 50% a 60") -> [N, ...]; nessun numero
 * (Contanti, Assegno, Bonifico Istantaneo = pagamento immediato) -> +10 gg operativi.
 */
export function getPaymentTermDays(termsSource?: string | null): number[] {
  const s = (termsSource || '').toLowerCase();
  let nums = [...s.matchAll(/\ba\s*(\d{1,3})\b/g)].map((m) => parseInt(m[1], 10));
  if (nums.length === 0) {
    nums = [...s.matchAll(/\b(\d{1,3})\b(?!\s*%)/g)]
      .map((m) => parseInt(m[1], 10))
      .filter((n) => n >= 10);
  }
  nums = [...new Set(nums.filter((n) => n >= 1 && n <= 365))].sort((a, b) => a - b);
  return nums.length > 0 ? nums : [10];
}

/** Scadenze programmate: data fattura + giorni della condizione di pagamento. */
export function computeScadProgDates(invoiceDate: string | null, termsSource?: string | null): Date[] | null {
  if (!invoiceDate || !termsSource) return null;
  const base = new Date(invoiceDate);
  if (Number.isNaN(base.getTime())) return null;
  return getPaymentTermDays(termsSource).map((days) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  });
}

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export interface SollecitoInfo {
  sentAt: string;
  channel: string;
}

export interface ScadenzaRow {
  invoiceId: string;
  orderId: string | null;
  invoiceNumber: string;
  invoiceDate: string | null;
  customerName: string;
  agentName: string | null;
  paymentMethodName: string | null;
  paymentTermsSource: string | null;
  phone: string | null;
  totale: number;
  paid: number;
  residuo: number;
  /** Scadenze programmate (ISO yyyy-mm-dd), può essere vuoto se metodo sconosciuto */
  scadDates: string[];
  lastScad: string | null;
  daysLate: number;
  lastSollecito: SollecitoInfo | null;
  sollecitoCount: number;
}

export interface ScadenziarioKpi {
  overdue: number;
  due7: number;
  due30: number;
  total: number;
  overdueCount: number;
  openCount: number;
}

export interface ScadenziarioData {
  rows: ScadenzaRow[];
  kpi: ScadenziarioKpi;
  isAdminView: boolean;
}

/** Ruoli che vedono TUTTE le fatture (come dashboard/appuntamenti) */
const ADMIN_ROLES = ['admin', 'admincustom', 'supervisor'];

interface InvoiceLight {
  id: string;
  order_id: string | null;
  invoice_number: string;
  invoice_date: string | null;
  totale_documento: number | null;
  cessionario_ragione_sociale: string | null;
}

const INVOICE_LIGHT_FIELDS = 'id, order_id, invoice_number, invoice_date, totale_documento, cessionario_ragione_sociale';

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Fetch principale
// ---------------------------------------------------------------------------

async function fetchAllInvoicesAdmin(): Promise<InvoiceLight[]> {
  let all: InvoiceLight[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('electronic_invoices')
      .select(INVOICE_LIGHT_FIELDS)
      .eq('document_type', 'TD01')
      .neq('status', 'cancelled')
      .range(from, from + 999);
    if (error) throw error;
    all = all.concat((data || []) as InvoiceLight[]);
    if (!data || data.length < 1000) break;
  }
  return all;
}

async function fetchAgentOrderIds(userId: string): Promise<string[]> {
  let ids: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .eq('agent_id', userId)
      .range(from, from + 999);
    if (error) throw error;
    ids = ids.concat((data || []).map((o: { id: string }) => o.id));
    if (!data || data.length < 1000) break;
  }
  return ids;
}

async function fetchAgentInvoices(orderIds: string[]): Promise<InvoiceLight[]> {
  let all: InvoiceLight[] = [];
  for (const batch of chunk(orderIds, 100)) {
    const { data, error } = await supabase
      .from('electronic_invoices')
      .select(INVOICE_LIGHT_FIELDS)
      .eq('document_type', 'TD01')
      .neq('status', 'cancelled')
      .in('order_id', batch);
    if (error) throw error;
    all = all.concat((data || []) as InvoiceLight[]);
  }
  return all;
}

/** Mappa invoice_id -> totale incassato (somma invoice_payments) */
async function fetchPaidMap(invoiceIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const batch of chunk(invoiceIds, 100)) {
    const { data, error } = await supabase
      .from('invoice_payments')
      .select('invoice_id, amount')
      .in('invoice_id', batch);
    if (error) throw error;
    for (const row of data || []) {
      map.set(row.invoice_id, (map.get(row.invoice_id) || 0) + Number(row.amount || 0));
    }
  }
  return map;
}

interface OrderInfo {
  agentId: string | null;
  businessName: string | null;
  phone: string | null;
  paymentMethodName: string | null;
  paymentTermsSource: string | null;
}

/** Info ordine (metodo pagamento + cliente/telefono) per gli ordini "reali" */
async function fetchOrderInfoMap(orderIds: string[]): Promise<Map<string, OrderInfo>> {
  const map = new Map<string, OrderInfo>();
  for (const batch of chunk(orderIds, 100)) {
    const { data, error } = await supabase
      .from('orders')
      .select('id, agent_id, payment_methods(name, description), customers!orders_customer_id_fkey(business_name, contact_phone, contact_mobile)')
      .in('id', batch);
    if (error) throw error;
    for (const o of (data || []) as any[]) {
      const pm = o.payment_methods as { name?: string; description?: string } | null;
      const c = o.customers as { business_name?: string; contact_phone?: string; contact_mobile?: string } | null;
      map.set(o.id, {
        agentId: o.agent_id || null,
        businessName: c?.business_name || null,
        phone: c?.contact_mobile || c?.contact_phone || null,
        paymentMethodName: pm?.description || pm?.name || null,
        paymentTermsSource: [pm?.name, pm?.description].filter(Boolean).join(' ') || null,
      });
    }
  }
  return map;
}

/** Mappa invoice_id -> { ultimo sollecito, conteggio } */
async function fetchSollecitoMap(invoiceIds: string[]): Promise<Map<string, { last: SollecitoInfo; count: number }>> {
  const map = new Map<string, { last: SollecitoInfo; count: number }>();
  for (const batch of chunk(invoiceIds, 100)) {
    const { data, error } = await supabase
      .from('sollecito_log')
      .select('invoice_id, channel, sent_at')
      .in('invoice_id', batch)
      .order('sent_at', { ascending: false });
    if (error) throw error;
    for (const row of data || []) {
      const cur = map.get(row.invoice_id);
      if (!cur) {
        map.set(row.invoice_id, { last: { sentAt: row.sent_at, channel: row.channel }, count: 1 });
      } else {
        cur.count += 1;
      }
    }
  }
  return map;
}

async function resolveAgentNames(agentIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const ids = [...new Set(agentIds.filter(Boolean))];
  for (const batch of chunk(ids, 100)) {
    const { data } = await supabase.from('profiles').select('id, full_name').in('id', batch);
    for (const p of data || []) map.set(p.id, p.full_name || '');
  }
  return map;
}

export async function fetchScadenziario(userId: string, role: string): Promise<ScadenziarioData> {
  const isAdminView = ADMIN_ROLES.includes(role);

  // 1. Fatture TD01 non annullate (tutte per admin, solo dei propri ordini per l'agente)
  let invoices: InvoiceLight[];
  if (isAdminView) {
    invoices = await fetchAllInvoicesAdmin();
  } else {
    const myOrderIds = await fetchAgentOrderIds(userId);
    invoices = myOrderIds.length > 0 ? await fetchAgentInvoices(myOrderIds) : [];
  }

  // 2. Pagamenti ricevuti -> residuo -> fatture aperte
  const paidMap = await fetchPaidMap(invoices.map((i) => i.id));
  const open = invoices.filter(
    (inv) => (inv.totale_documento || 0) - (paidMap.get(inv.id) || 0) > 0.01
  );

  // 3. Info ordini (metodo pagamento, cliente, telefono) — solo ordini reali
  const realOrderIds = [...new Set(
    open.map((i) => i.order_id).filter((id): id is string => !!id && !id.startsWith('DRAFT') && !id.startsWith('CUSTOM'))
  )];
  const orderInfoMap = await fetchOrderInfoMap(realOrderIds);

  // 4. Nomi agenti (solo vista admin) + storico solleciti
  const agentNames = isAdminView
    ? await resolveAgentNames([...orderInfoMap.values()].map((o) => o.agentId || ''))
    : new Map<string, string>();
  const sollecitoMap = await fetchSollecitoMap(open.map((i) => i.id));

  // 5. Costruzione righe
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  const rows: ScadenzaRow[] = open.map((inv) => {
    const paid = paidMap.get(inv.id) || 0;
    const residuo = (inv.totale_documento || 0) - paid;
    const info = inv.order_id ? orderInfoMap.get(inv.order_id) : undefined;
    const scadDates = computeScadProgDates(inv.invoice_date, info?.paymentTermsSource) || [];
    const lastScad = scadDates.length > 0 ? scadDates[scadDates.length - 1] : null;
    const daysLate = lastScad && lastScad.getTime() < todayMs
      ? Math.floor((todayMs - lastScad.getTime()) / 86400000)
      : 0;
    const sol = sollecitoMap.get(inv.id);
    return {
      invoiceId: inv.id,
      orderId: inv.order_id,
      invoiceNumber: inv.invoice_number,
      invoiceDate: inv.invoice_date,
      customerName: inv.cessionario_ragione_sociale || info?.businessName || 'Cliente',
      agentName: isAdminView && info?.agentId ? agentNames.get(info.agentId) || null : null,
      paymentMethodName: info?.paymentMethodName || null,
      paymentTermsSource: info?.paymentTermsSource || null,
      phone: info?.phone || null,
      totale: inv.totale_documento || 0,
      paid,
      residuo,
      scadDates: scadDates.map((d) => d.toISOString()),
      lastScad: lastScad ? lastScad.toISOString() : null,
      daysLate,
      lastSollecito: sol ? sol.last : null,
      sollecitoCount: sol ? sol.count : 0,
    };
  });

  // Ordinamento: scadenza più vicina/vecchia prima (null in fondo) — come web
  rows.sort((a, b) => (a.lastScad ? new Date(a.lastScad).getTime() : Infinity) - (b.lastScad ? new Date(b.lastScad).getTime() : Infinity));

  // 6. KPI
  const kpi: ScadenziarioKpi = { overdue: 0, due7: 0, due30: 0, total: 0, overdueCount: 0, openCount: rows.length };
  for (const r of rows) {
    kpi.total += r.residuo;
    if (!r.lastScad) continue;
    const t = new Date(r.lastScad).getTime();
    if (t < todayMs) { kpi.overdue += r.residuo; kpi.overdueCount += 1; }
    else if (t <= todayMs + 7 * 86400000) kpi.due7 += r.residuo;
    else if (t <= todayMs + 30 * 86400000) kpi.due30 += r.residuo;
  }

  return { rows, kpi, isAdminView };
}

/** Versione con cache in memoria (TTL 2 min) — condivisa tra dashboard e schermata */
export async function fetchScadenziarioCached(userId: string, role: string, force: boolean = false): Promise<ScadenziarioData> {
  const cacheKey = `scadenziario:${userId}`;
  if (!force) {
    const cached = getCache<ScadenziarioData>(cacheKey);
    if (cached) return cached;
  }
  const data = await fetchScadenziario(userId, role);
  setCache(cacheKey, data, 120_000);
  return data;
}

// ---------------------------------------------------------------------------
// Dettaglio fattura (per PDF) + storico solleciti
// ---------------------------------------------------------------------------

export async function fetchInvoiceForPdf(invoiceId: string): Promise<any> {
  const { data, error } = await supabase
    .from('electronic_invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();
  if (error) throw error;
  return data;
}

/**
 * Registra il sollecito nello storico (best-effort: la RLS lato web consente
 * l'insert solo ad admin/admincustom/supplier — per gli agenti fallisce in
 * silenzio senza bloccare il flusso).
 */
export async function logSollecito(
  invoiceId: string,
  invoiceNumber: string,
  recipient: string | null,
  userId?: string | null,
  userName?: string | null
): Promise<SollecitoInfo | null> {
  try {
    const { data, error } = await supabase
      .from('sollecito_log')
      .insert({
        invoice_id: invoiceId,
        invoice_number: invoiceNumber,
        channel: 'whatsapp',
        recipient: recipient || null,
        sent_by: userId || null,
        sent_by_name: userName || null,
      })
      .select('sent_at, channel')
      .single();
    if (error || !data) return null;
    return { sentAt: data.sent_at, channel: data.channel };
  } catch {
    return null;
  }
}
