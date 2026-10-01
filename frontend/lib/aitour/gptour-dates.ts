export function todayRome(): string { return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }); }
export function romeDate(value: string): string { return new Date(value).toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }); }
export function romeTime(value: string): string { return new Date(value).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Rome' }); }
export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
export function addDaysIso(date: string, n: number): string { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function isoDow(date: string): number { return new Date(`${date}T12:00:00Z`).getUTCDay() || 7; }
export function nextWorkingDay(date: string): string { let d = addDaysIso(date, 1); while (isoDow(d) === 7) d = addDaysIso(d, 1); return d; }
export function romeLocalToIso(date: string, time = '00:00'): string {
  if (!validDate(date) || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time)) throw new Error('Data o ora non valida');
  const [y, m, d] = date.split('-').map(Number), [h, mi, s = 0] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi, s);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(guess)).reduce<Record<string, number>>((a, x) => { if (x.type !== 'literal') a[x.type] = Number(x.value); return a; }, {});
  const offset = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - guess;
  return new Date(guess - offset).toISOString();
}