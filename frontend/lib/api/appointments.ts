import { supabase } from '../supabase';

export type AppointmentInput = {
  id: string; agentId: string; customerId: string | null; title: string;
  date: string; time: string; duration: number; notes: string; address: string; city: string;
};

export function localAppointmentDate(date: string, time: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Inserisci data AAAA-MM-GG e ora HH:MM valide.');
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const value = new Date(y, m - 1, d, h, min);
  if (value.getFullYear() !== y || value.getMonth() !== m - 1 || value.getDate() !== d || value.getHours() !== h || value.getMinutes() !== min) throw new Error('La data o l’orario scelto non esiste.');
  return value;
}

export async function createAppointment(input: AppointmentInput): Promise<string> {
  if (!input.agentId) throw new Error('Accedi prima di salvare.');
  if (!input.customerId && !input.title.trim()) throw new Error('Inserisci il titolo dell’impegno.');
  if (!Number.isInteger(input.duration) || input.duration < 5 || input.duration > 480) throw new Error('La durata deve essere tra 5 e 480 minuti.');
  const start = localAppointmentDate(input.date, input.time);
  const { error } = await supabase.from('appointments').insert({
    id: input.id, agent_id: input.agentId, created_by_id: input.agentId,
    customer_id: input.customerId, appointment_date: start.toISOString(),
    duration_minutes: input.duration, appointment_type: 'follow_up', status: 'scheduled',
    notes: input.notes.trim() || null, follow_up_reason: input.notes.trim() || null,
    quick_customer_name: input.customerId ? null : input.title.trim(),
    quick_customer_address: input.customerId ? null : input.address.trim(),
    quick_customer_city: input.customerId ? null : input.city.trim(),
    quick_customer_phone: input.customerId ? null : '',
  });
  if (error) {
    console.warn('[appointments] Salvataggio fallito:', error.code, error.message);
    // Retry con lo stesso UUID dopo risposta persa: niente doppio appuntamento.
    if (error.code === '23505') {
      const { data, error: checkError } = await supabase.from('appointments').select('id').eq('id', input.id).eq('agent_id', input.agentId).maybeSingle();
      if (!checkError && data) return data.id;
    }
    throw new Error('Appuntamento NON salvato. Controlla la connessione e riprova.');
  }
  return input.id;
}