// Costanti e helper condivisi UI AI Tour mobile
import { Linking, Platform } from 'react-native';
import { currentThemeMode } from '../../lib/theme';

/** Viola brand AI: SOLO per sfondi solidi (bottoni/badge/switch) con contenuto bianco sopra */
export const AI_PURPLE = '#7C3AED';
/** Viola per TESTI e icone sulle superfici: schiarito in dark mode per il contrasto */
export const AI_PURPLE_TEXT = currentThemeMode === 'dark' ? '#B79DFC' : '#5B21B6';
/** Sfondo "soft" viola: lavanda chiara in light, viola notte in dark (mai testi chiari su lavanda) */
export const AI_PURPLE_SOFT = currentThemeMode === 'dark' ? '#2B2150' : '#F3E8FF';
/** Bordo viola tenue abbinato a AI_PURPLE_SOFT */
export const AI_PURPLE_BORDER = currentThemeMode === 'dark' ? '#4A3B7A' : '#DDD6FE';

export function openNavigation(lat: number, lng: number) {
  // ATTENZIONE: mai aggiungere `q=` insieme a `daddr` su Apple Maps — `q` viene
  // trattato come RICERCA e può dirottare la navigazione su un altro punto
  // vendita con nome uguale/simile invece delle coordinate esatte.
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  });
  Linking.openURL(url as string).catch(() => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`).catch(() => {});
  });
}
