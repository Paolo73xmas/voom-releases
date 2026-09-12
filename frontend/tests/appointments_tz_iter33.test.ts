import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({ insert: vi.fn() })),
  },
}));

import { localAppointmentDate } from '../lib/api/appointments';

describe('iter33 timezone regression - localAppointmentDate', () => {
  it('runtime timezone is Europe/Rome in this test process', () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(tz).toBe('Europe/Rome');
  });

  it('summer 18:07 local converts to 16:07Z (DST +2)', () => {
    const iso = localAppointmentDate('2026-07-15', '18:07').toISOString();
    expect(iso).toBe('2026-07-15T16:07:00.000Z');
  });

  it('winter 18:07 local converts to 17:07Z (DST +1)', () => {
    const iso = localAppointmentDate('2026-01-15', '18:07').toISOString();
    expect(iso).toBe('2026-01-15T17:07:00.000Z');
  });
});
