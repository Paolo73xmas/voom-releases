import React, { useEffect, useState, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AiTourSplash from '../components/AiTourSplash';

const PRIVACY_ACCEPTED_KEY = '@privacy_terms_accepted';

// Durata massima dello splash prima di forzare la fine (Android Expo Go fallback)
const SPLASH_MAX_DURATION_MS = 7000;
// Durata massima totale prima di forzare la navigazione (anche se splash o auth bloccati)
const HARD_NAVIGATION_DEADLINE_MS = 12000;

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthStore();
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const navigatedRef = useRef(false);

  // 1) Carica stato privacy in parallelo allo splash
  useEffect(() => {
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

  // 2) FALLBACK SPLASH: forza fine animazione dopo SPLASH_MAX_DURATION_MS
  // (su Android Expo Go reanimated può non far scattare onFinish del componente AiTourSplash)
  useEffect(() => {
    const t = setTimeout(() => {
      if (!splashDone) {
        console.warn(`[Index] Forcing splashDone after ${SPLASH_MAX_DURATION_MS}ms`);
        setSplashDone(true);
      }
    }, SPLASH_MAX_DURATION_MS);
    return () => clearTimeout(t);
  }, [splashDone]);

  // 3) Navigazione "happy path"
  useEffect(() => {
    if (navigatedRef.current) return;
    if (!splashDone || !privacyChecked || isLoading) return;

    navigatedRef.current = true;
    if (!privacyAccepted) {
      router.replace('/privacy-terms');
    } else if (isAuthenticated) {
      router.replace('/(tabs)');
    } else {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, privacyChecked, privacyAccepted, splashDone]);

  // 4) HARD DEADLINE: dopo HARD_NAVIGATION_DEADLINE_MS naviga COMUNQUE,
  //    a prescindere da splashDone / privacyChecked / isLoading.
  //    Indipendente: scatta anche se NESSUNA delle altre condizioni è vera.
  useEffect(() => {
    const t = setTimeout(() => {
      if (navigatedRef.current) return;
      console.warn(`[Index] HARD DEADLINE: forcing navigation after ${HARD_NAVIGATION_DEADLINE_MS}ms`);
      navigatedRef.current = true;
      // Se la privacy non è stata controllata in tempo, assumiamo "da accettare"
      if (!privacyChecked || !privacyAccepted) {
        router.replace('/privacy-terms');
      } else if (isAuthenticated) {
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    }, HARD_NAVIGATION_DEADLINE_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.container}>
      {!splashDone && (
        <AiTourSplash onFinish={() => setSplashDone(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0714',
  },
});
