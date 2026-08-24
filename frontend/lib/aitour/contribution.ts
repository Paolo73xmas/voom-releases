// Stamina agente (parità web src/lib/aitour/contribution.ts, solo lato agente):
// RPC self-only agent_own_stamina — restituisce SOLO lo score 0-100 se l'admin
// ha attivato la visibilità (stamina_visible) per l'agente.
import { supabase } from '../supabase';

export async function fetchOwnStamina(day: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('agent_own_stamina', { p_day: day });
  if (error) throw error;
  const res = data as { visible?: boolean; score?: number };
  return res?.visible ? Number(res.score ?? 0) : null;
}

export function staminaColor(pct: number): string {
  if (pct >= 80) return '#16a34a';
  if (pct >= 50) return '#d97706';
  return '#dc2626';
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
