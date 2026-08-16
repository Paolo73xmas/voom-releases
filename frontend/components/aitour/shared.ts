// Costanti e helper condivisi UI AI Tour mobile
import { Linking, Platform } from 'react-native';

export const AI_PURPLE = '#7C3AED';
export const AI_PURPLE_SOFT = '#F3E8FF';

export function openNavigation(lat: number, lng: number, label: string) {
  const encoded = encodeURIComponent(label);
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${lat},${lng}&q=${encoded}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  });
  Linking.openURL(url as string).catch(() => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`).catch(() => {});
  });
}
