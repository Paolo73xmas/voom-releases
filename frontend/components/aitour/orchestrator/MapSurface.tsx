import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import type { MapSurfaceProps } from './map-surface-types';
import { loadWebLeaflet, loadWebMapStyles } from './web-leaflet';
import { createWebMap, type WebMapController } from './web-map-controller';

/** Preview only: normal browser requests carry the genuine app Referer required by OSM.
 * Shadow DOM scopes CSS, not script privileges. Trusted pinned code; data never executed. */
export default function MapSurface({ data, id, selectedId, onMessage, onFailure }: MapSurfaceProps) {
  const ref = useRef<View>(null), controller = useRef<WebMapController | null>(null);
  const latest = useRef({ selectedId, onMessage, onFailure }); latest.current = { selectedId, onMessage, onFailure };
  useEffect(() => {
    const host = ref.current as unknown as HTMLElement;
    if (!host?.attachShadow) { latest.current.onFailure(); return; }
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    let active = true;
    Promise.all([loadWebLeaflet(), loadWebMapStyles(root)]).then(([L]) => {
      if (!active) return;
      controller.current = createWebMap(L, root, data, event => { if (active) latest.current.onMessage(JSON.stringify(event)); });
      controller.current.select(latest.current.selectedId);
    }).catch(() => { if (active) latest.current.onFailure(); });
    return () => { active = false; controller.current?.destroy(); controller.current = null; root.replaceChildren(); };
  }, [data]);
  useEffect(() => { controller.current?.select(selectedId); }, [selectedId]);
  return <View ref={ref} testID={id} style={styles.surface} />;
}
const styles = StyleSheet.create({ surface: { flex: 1, width: '100%', height: '100%' } });