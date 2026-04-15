import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import VoomSplash from '../components/VoomSplash';

const PRIVACY_ACCEPTED_KEY = '@privacy_terms_accepted';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [dataReady, setDataReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      const accepted = await AsyncStorage.getItem(PRIVACY_ACCEPTED_KEY);
      setPrivacyAccepted(accepted === 'true');
      setPrivacyChecked(true);
      await initialize();
      setDataReady(true);
    };
    init();
  }, []);

  useEffect(() => {
    if (!splashDone || !dataReady || !privacyChecked || isLoading) return;

    if (!privacyAccepted) {
      router.replace('/privacy-terms');
    } else if (isAuthenticated) {
      router.replace('/(tabs)');
    } else {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, privacyChecked, privacyAccepted, splashDone, dataReady]);

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
