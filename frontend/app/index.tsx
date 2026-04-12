import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PRIVACY_ACCEPTED_KEY = '@privacy_terms_accepted';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Check privacy acceptance
      const accepted = await AsyncStorage.getItem(PRIVACY_ACCEPTED_KEY);
      setPrivacyAccepted(accepted === 'true');
      setPrivacyChecked(true);
      // Initialize auth
      await initialize();
    };
    init();
  }, []);

  useEffect(() => {
    if (!privacyChecked || isLoading) return;

    if (!privacyAccepted) {
      router.replace('/privacy-terms');
    } else if (isAuthenticated) {
      router.replace('/(tabs)');
    } else {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, privacyChecked, privacyAccepted]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Text style={styles.logo}>VOOM</Text>
        <Text style={styles.subtitle}>Sales Management</Text>
      </View>
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text style={styles.loadingText}>Caricamento...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E40AF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  logo: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 18,
    color: '#93C5FD',
    marginTop: 8,
  },
  loadingText: {
    marginTop: 16,
    color: '#93C5FD',
    fontSize: 16,
  },
});
