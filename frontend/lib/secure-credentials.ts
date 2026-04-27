/**
 * Secure Credentials Storage
 *
 * - Uses expo-secure-store on native (iOS Keychain / Android Keystore)
 * - Falls back to AsyncStorage on web (browsers don't support SecureStore)
 * - One-time migration from legacy AsyncStorage keys (@saved_email/@saved_password)
 *   to the secure store, so users with "Ricordami" enabled don't lose credentials.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_REMEMBER = 'voom_remember_me';
const KEY_EMAIL = 'voom_saved_email';
const KEY_PASSWORD = 'voom_saved_password';
const KEY_BIOMETRIC = 'voom_biometric_enabled';

// Legacy AsyncStorage keys (pre-SecureStore migration)
const LEGACY_REMEMBER = '@remember_me';
const LEGACY_EMAIL = '@saved_email';
const LEGACY_PASSWORD = '@saved_password';

const isWeb = Platform.OS === 'web';

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

/**
 * One-time migration from legacy plain-text AsyncStorage credentials
 * to SecureStore. Must be called BEFORE loadSavedCredentials on app boot.
 */
export async function migrateLegacyCredentialsIfAny(): Promise<void> {
  try {
    const legacyRemember = await AsyncStorage.getItem(LEGACY_REMEMBER);
    if (legacyRemember !== 'true') return;
    const legacyEmail = await AsyncStorage.getItem(LEGACY_EMAIL);
    const legacyPassword = await AsyncStorage.getItem(LEGACY_PASSWORD);
    if (legacyEmail && legacyPassword) {
      await setItem(KEY_REMEMBER, 'true');
      await setItem(KEY_EMAIL, legacyEmail);
      await setItem(KEY_PASSWORD, legacyPassword);
    }
    // Always remove legacy keys after migration attempt
    await AsyncStorage.multiRemove([LEGACY_REMEMBER, LEGACY_EMAIL, LEGACY_PASSWORD]);
  } catch (e) {
    console.warn('[secure-credentials] Migration failed:', e);
  }
}

export async function saveCredentials(email: string, password: string): Promise<void> {
  await setItem(KEY_REMEMBER, 'true');
  await setItem(KEY_EMAIL, email);
  await setItem(KEY_PASSWORD, password);
}

export async function clearCredentials(): Promise<void> {
  await deleteItem(KEY_REMEMBER);
  await deleteItem(KEY_EMAIL);
  await deleteItem(KEY_PASSWORD);
  await deleteItem(KEY_BIOMETRIC);
}

export async function loadSavedCredentials(): Promise<{ email: string; password: string } | null> {
  const remember = await getItem(KEY_REMEMBER);
  if (remember !== 'true') return null;
  const email = await getItem(KEY_EMAIL);
  const password = await getItem(KEY_PASSWORD);
  if (!email || !password) return null;
  return { email, password };
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await setItem(KEY_BIOMETRIC, 'true');
  } else {
    await deleteItem(KEY_BIOMETRIC);
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  const v = await getItem(KEY_BIOMETRIC);
  return v === 'true';
}
