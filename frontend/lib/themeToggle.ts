// Cambio tema con riavvio soft (gli StyleSheet catturano i token per modulo)
import { Alert, Platform } from 'react-native';
import { applyThemeMode, setStoredThemeMode, type ThemeMode } from './theme';

export async function setThemeAndReload(mode: ThemeMode): Promise<void> {
  await setStoredThemeMode(mode);
  applyThemeMode(mode);
  if (Platform.OS === 'web') {
    (globalThis as unknown as Window).location?.reload();
    return;
  }
  try {
    const Updates = await import('expo-updates');
    await Updates.reloadAsync();
  } catch {
    try {
      const { DevSettings } = await import('react-native');
      DevSettings.reload();
    } catch {
      Alert.alert('Tema salvato', "Chiudi e riapri l'app per applicare il nuovo tema.");
    }
  }
}
