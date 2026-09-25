// SOLO TEST ISOLATO: non importato dall'app, nessuna richiesta al CRM.
export type InspectionNote = { id: string; date: string; notes: string; photoCount: number };
export async function fetchCustomerInspectionNotes(): Promise<InspectionNote[]> {
  const w = window as any;
  if (w.notesTestMode === 'error') throw new Error('Errore simulato solo nel test');
  const rows = Array.from({ length: 55 }, (_, i) => ({
    id: `isolated-${i}`, date: '2026-09-24T10:00:00.000Z', photoCount: i % 2,
    notes: `Nota di prova ${i + 1}. Testo sufficientemente lungo per verificare lo scorrimento sullo schermo del telefono.`,
  }));
  if (w.notesTestMode === 'pending') return new Promise(resolve => { w.releaseTestNotes = () => resolve(rows); });
  return rows;
}