import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import type { MapSurfaceProps } from './map-surface-types';

/** Browser-only embedded map, like TourMapView. App shell and controls remain React Native. */
export default function MapSurface({ html, id, selectedId, onMessage, onFailure }: MapSurfaceProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const callbacks = useRef({ onMessage, selectedId }); callbacks.current = { onMessage, selectedId };
  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== ref.current?.contentWindow || typeof event.data !== 'string') return;
      callbacks.current.onMessage(event.data);
      ref.current?.contentWindow?.postMessage(JSON.stringify({ type: 'select-stop', id: callbacks.current.selectedId }), '*');
    };
    globalThis.addEventListener?.('message', listener);
    return () => globalThis.removeEventListener?.('message', listener);
  }, []);
  useEffect(() => { ref.current?.contentWindow?.postMessage(JSON.stringify({ type: 'select-stop', id: selectedId }), '*'); }, [selectedId]);
  return React.createElement('iframe', { ref, srcDoc: html, title: 'Mappa del giro Orchestrator',
    'data-testid': id, sandbox: 'allow-scripts', style: styles.surface, onError: onFailure });
}
const styles = StyleSheet.create({ surface: { width: '100%', height: '100%', borderWidth: 0 } });