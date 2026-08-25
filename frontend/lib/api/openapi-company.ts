// Recupera Anagrafica (parità web src/lib/openapi-company.ts): ricerca dati azienda
// per P.IVA / Codice Fiscale tramite la Edge Function `openapi-invoice-proxy` (Openapi.it).
// Il proxy autorizza anche i ruoli agent/agentcustom per le azioni di lookup.
import { supabase } from '../supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;
const PROXY_URL = `${SUPABASE_URL}/functions/v1/openapi-invoice-proxy`;

// Il proxy verifica il ruolo dal JWT di sessione (non basta la anon key)
async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || SUPABASE_ANON_KEY;
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
  };
}

export interface CompanyAddress {
  toponym?: string;
  street?: string;
  streetNumber?: string;
  streetName?: string;
  zipCode?: string;
  town?: string;
  // Openapi restituisce a volte "RM" (stringa), a volte { code: "RM" }
  province?: { code?: string } | string;
}

export interface CompanyStartData {
  taxCode?: string;
  companyName?: string;
  vatCode?: string;
  address?: {
    registeredOffice?: CompanyAddress;
  };
  activityStatus?: string;
}

export interface CompanyPecData {
  pec?: string;
}

export interface CompanySdiData {
  sdiCode?: string;
  id?: string;
}

export interface CompanyFullData {
  start: CompanyStartData | null;
  pec: CompanyPecData | null;
  sdi: CompanySdiData | null;
  errors: string[];
}

async function fetchCompanyEndpoint<T>(action: string, query: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ action, query }),
    });
    const text = await response.text();
    if (text.trimStart().startsWith('<')) {
      const errorMsg = response.status === 401 ? 'Autenticazione fallita (401)' : `Risposta non valida dal server (HTTP ${response.status})`;
      return { data: null, error: errorMsg };
    }
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text);
    } catch {
      return { data: null, error: `Risposta non valida: ${text.substring(0, 100)}` };
    }
    if (!response.ok) {
      return { data: null, error: (json?.error as string) || `HTTP ${response.status}` };
    }
    // Openapi.it restituisce { data: [...] } per gli endpoint lista
    const responseData = json?.data;
    const record = Array.isArray(responseData) ? responseData[0] : responseData;
    return { data: (record ?? null) as T | null, error: null };
  } catch (err: unknown) {
    return { data: null, error: `Errore di rete: ${(err as Error).message}` };
  }
}

/** Ricerca dati azienda per P.IVA o Codice Fiscale (3 endpoint in parallelo: dati, PEC, SDI) */
export async function searchCompany(query: string): Promise<CompanyFullData> {
  const sanitized = query.trim().toUpperCase().replace(/\s+/g, '');
  if (!sanitized) {
    return { start: null, pec: null, sdi: null, errors: ['Inserisci una P.IVA o un Codice Fiscale'] };
  }
  const isValidPIVA = /^\d{11}$/.test(sanitized);
  const isValidCF = /^[A-Z0-9]{16}$/.test(sanitized);
  if (!isValidPIVA && !isValidCF) {
    return {
      start: null,
      pec: null,
      sdi: null,
      errors: ['Formato non valido. Inserisci una P.IVA (11 cifre) o un Codice Fiscale (16 caratteri)'],
    };
  }

  const [startResult, pecResult, sdiResult] = await Promise.all([
    fetchCompanyEndpoint<CompanyStartData>('company-start', sanitized),
    fetchCompanyEndpoint<CompanyPecData>('company-pec', sanitized),
    fetchCompanyEndpoint<CompanySdiData>('company-sdi', sanitized),
  ]);

  const errors: string[] = [];
  if (startResult.error) errors.push(`Dati azienda: ${startResult.error}`);
  if (pecResult.error) errors.push(`PEC: ${pecResult.error}`);
  if (sdiResult.error) errors.push(`Codice SDI: ${sdiResult.error}`);

  return {
    start: startResult.data,
    pec: pecResult.data,
    sdi: sdiResult.data,
    errors,
  };
}
