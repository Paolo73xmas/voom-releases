// Porting del modulo web gptour-day-consent.ts @ 2eea9933 (solo percorsi import/tipi).
import type { TourIntent } from './gptour-intent';
import type { GptResult } from './gptour-api';
import type { AiTourSettings, TourCandidate } from './types';
import { IdentitySet } from './gptour-identity';

export function applyDayConsent(intent: TourIntent, text: string, previous?: TourIntent): TourIntent {
  let approved = previous?.extraDaysApproved || false;
  if (/\b(?:suddividi|dividi|distribuisci)\b.*\b(?:giorni|giornate)\b|\bsu (?:più|due|tre|\d+) giorni\b/i.test(text)) approved = true;
  if (/\b(?:solo|soltanto)\s+(?:domani|oggi|una giornata|un giorno)\b/i.test(text)) approved = false;
  const single = !!intent.singleDayRequested || /\b(domani|dopodomani|oggi|giornata|un giorno)\b/i.test(text);
  const window = text.match(/dalle\s+(\d{1,2}(?::[0-5]\d)?)\s+alle\s+(\d{1,2}(?::[0-5]\d)?)/i);
  const hhmm = (t: string) => t.includes(':') ? t.padStart(5, '0') : t.padStart(2, '0') + ':00';
  return { ...intent, extraDaysApproved: approved, singleDayRequested: single,
    maxDays: single && !approved ? 1 : approved ? null : intent.maxDays,
    requestedStartTime: window ? hhmm(window[1]) : previous?.requestedStartTime,
    requestedEndTime: window ? hhmm(window[2]) : previous?.requestedEndTime };
}

export function singleDayCapacityMessage(pool: TourCandidate[], intent: TourIntent, settings: AiTourSettings): string | null {
  if (!intent.wantAll || !intent.singleDayRequested || intent.extraDaysApproved) return null;
  const unique: TourCandidate[] = [], seen = new IdentitySet();
  for (const c of pool) if (!seen.has(c)) { seen.add(c); unique.push(c); }
  const minutes = (s: string) => Number(s.split(':')[0]) * 60 + Number(s.split(':')[1]);
  const available = minutes(intent.requestedEndTime || settings.work_end) - minutes(intent.requestedStartTime || settings.work_start);
  if (available <= 0) return 'L’orario richiesto non è valido: specifica inizio e fine della giornata.';
  const visits = unique.reduce((n, c) => n + c.visitMinutes, 0);
  if (visits <= available) return null;
  return `Le ${unique.length} tabaccherie ammesse richiedono almeno ${visits} minuti di visite, senza contare spostamenti e pausa; nella giornata richiesta sono disponibili ${available} minuti. Non posso inserirle tutte. Non ho escluso tappe né aggiunto altri giorni: vuoi modificare l’orario, scegliere un sottoinsieme oppure autorizzare più giornate?`;
}

/** A model suggestion is NOT consent to create tomorrow+1. Keep every selected key. */
export function enforceDayConsent(result: GptResult, intent: TourIntent): GptResult {
  if (!intent.singleDayRequested || intent.extraDaysApproved) return result;
  const selected = [...result.selection, ...result.days.flatMap(d => d.selection)];
  const seen = new Set<string>();
  return { ...result, multiDay: false, days: [],
    tourDate: intent.tourDates[0] || result.tourDate,
    startTime: intent.requestedStartTime || result.startTime, endTime: intent.requestedEndTime || result.endTime,
    selection: selected.filter(s => !seen.has(s.key) && !!seen.add(s.key)) };
}
