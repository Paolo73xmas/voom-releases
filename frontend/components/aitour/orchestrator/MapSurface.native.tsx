import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { MapSurfaceProps } from './map-surface-types';

export default function MapSurface({ html, id, selectedId, onMessage, onFailure }: MapSurfaceProps) {
  const ref = useRef<WebView>(null);
  const select = useCallback(() => {
    const key = JSON.stringify(selectedId ?? '').replace(/</g, '\\u003c');
    ref.current?.injectJavaScript(`window.selectStop && window.selectStop(${key});true;`);
  }, [selectedId]);
  useEffect(select, [select]);
  return <WebView ref={ref} testID={id} source={{ html }} style={styles.surface} originWhitelist={['*']}
    javaScriptEnabled domStorageEnabled={false} mixedContentMode="never" setSupportMultipleWindows={false}
    onShouldStartLoadWithRequest={request => request.url === 'about:blank' || request.url === 'about:srcdoc'}
    onMessage={event => { onMessage(event.nativeEvent.data); select(); }}
    onError={onFailure} onHttpError={onFailure} onContentProcessDidTerminate={onFailure} onRenderProcessGone={onFailure}
    scrollEnabled={false} />;
}
const styles = StyleSheet.create({ surface: { flex: 1, width: '100%', backgroundColor: 'transparent' } });