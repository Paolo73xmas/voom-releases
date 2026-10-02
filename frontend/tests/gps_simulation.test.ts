// Simulazione GPS admin: solo ruoli admin, posizione = punto atteso, mai per gli agenti.
import { describe, expect, it, vi } from 'vitest';
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => undefined) } }));
import { isGpsSimulated, setGpsSimulation, setGpsSimulationAllowed, simulatedPosition } from '../lib/aitour/gps-simulation';

const point = { lat: 45.4, lng: 9.2 };
describe('gps-simulation', () => {
  it('agents can never enable it', () => {
    setGpsSimulationAllowed('agent'); setGpsSimulation(true);
    expect(isGpsSimulated()).toBe(false);
    expect(simulatedPosition(point)).toBeNull();
  });
  it('admins get the expected point; null target stays null (no invented position)', () => {
    setGpsSimulationAllowed('admin'); setGpsSimulation(true);
    expect(isGpsSimulated()).toBe(true);
    expect(simulatedPosition(point)).toEqual(point);
    expect(simulatedPosition(null)).toBeNull();
    setGpsSimulation(false);
    expect(simulatedPosition(point)).toBeNull();
  });
  it('switching back to an agent role turns it off even if it was on', () => {
    setGpsSimulationAllowed('admincustom'); setGpsSimulation(true);
    expect(isGpsSimulated()).toBe(true);
    setGpsSimulationAllowed('agentcustom');
    expect(isGpsSimulated()).toBe(false);
  });
});
