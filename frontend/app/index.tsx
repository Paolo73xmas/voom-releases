import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VoomSplash from '../components/VoomSplash';

const PRIVACY_ACCEPTED_KEY = '@privacy_terms_accepted';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    // initialize() viene già chiamato in _layout.tsx - qui controlliamo SOLO la privacy
    // (evita race condition con doppia inizializzazione che bloccava lo splash)
    const init = async () => {
      try {
        const accepted = await AsyncStorage.getItem(PRIVACY_ACCEPTED_KEY);
        setPrivacyAccepted(accepted === 'true');
      } catch (e) {
        console.warn('[Index] privacy check error:', e);
        setPrivacyAccepted(false);
      } finally {
        setPrivacyChecked(true);
      }
    };
    init();
  }, []);

  useEffect(() => {
    // Naviga solo quando: splash finito + privacy verificata + auth NON in caricamento
    if (!splashDone || !privacyChecked || isLoading) return;

    if (!privacyAccepted) {
      router.replace('/privacy-terms');
    } else if (isAuthenticated) {
      router.replace('/(tabs)');
    } else {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, privacyChecked, privacyAccepted, splashDone]);

  // Safety net: se per qualche ragione (rete lenta, hang) restiamo bloccati
  // sullo splash per più di 15 secondi, andiamo direttamente al login.
  useEffect(() => {
    const t = setTimeout(() => {
      if (splashDone && privacyChecked && isLoading) {
        console.warn('[Index] Forcing navigation after stuck splash (15s)');
        router.replace(privacyAccepted ? '/login' : '/privacy-terms');
      }
    }, 15000);
    return () => clearTimeout(t);
  }, [splashDone, privacyChecked, isLoading, privacyAccepted]);

  return (
    <View style={styles.container}>
      {!splashDone && (
        <VoomSplash onFinish={() => setSplashDone(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
});
