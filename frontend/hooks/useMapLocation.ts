import { useCallback, useEffect, useRef, useState } from 'react';
import { locationPort } from '../lib/map/location-port';
import { MapLocationError, startFreshMapLocation, type LocationIssue, type MapFix } from '../lib/map/fresh-location';

export function useMapLocation() {
  const [initialView, setInitialView] = useState<{ lat: number; lng: number; hasFix: boolean } | null>(null);
  const [fix, setFix] = useState<MapFix | null>(null), [locating, setLocating] = useState(false);
  const [issue, setIssue] = useState<LocationIssue | null>(null);
  const active = useRef<ReturnType<typeof startFreshMapLocation> | null>(null);
  const mounted = useRef(false);
  const refresh = useCallback(async (initial = false): Promise<MapFix | null> => {
    if (!mounted.current || active.current) return null;
    const request = startFreshMapLocation(locationPort); active.current = request;
    setLocating(true); setIssue(null);
    try {
      const fresh = await request.promise;
      if (!mounted.current || active.current !== request) return null;
      setFix(fresh);
      setInitialView(previous => previous ?? { lat: fresh.lat, lng: fresh.lng, hasFix: true });
      if (fresh.accuracy == null || fresh.accuracy > 100) setIssue({ message: fresh.accuracy == null
        ? 'Posizione acquisita; precisione non disponibile.'
        : `Posizione approssimativa (±${Math.round(fresh.accuracy)} m). Per maggiore precisione abilita la posizione precisa.` });
      return fresh;
    } catch (error) {
      if (mounted.current && active.current === request && error instanceof MapLocationError && error.code !== 'cancelled') {
        setIssue({ message: error.message, openSettings: error.openSettings });
      }
      return null;
    } finally {
      if (mounted.current && active.current === request) {
        active.current = null; setLocating(false);
        // A default viewport is not a GPS fix: do not show a blue "you are here" marker.
        if (initial) setInitialView(previous => previous ?? { lat: 41.9028, lng: 12.4964, hasFix: false });
      }
    }
  }, []);
  const cancel = useCallback(() => {
    const request = active.current; active.current = null; request?.cancel();
    if (mounted.current) setLocating(false);
  }, []);
  useEffect(() => { mounted.current = true; void refresh(true); return () => { mounted.current = false; cancel(); }; }, [refresh, cancel]);
  return { initialView, fix, locating, issue, refresh, cancel, dismissIssue: () => setIssue(null) };
}