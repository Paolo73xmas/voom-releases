import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useAuthStore, initializeAuthListeners } from '../store/authStore';
import { COLORS, FONTS } from '../lib/theme';

// Tempo massimo di attesa per il caricamento dei font.
// Su Android Expo Go, il fetch dei font da Google può fallire o bloccarsi:
// in tal caso, procediamo comunque con i font di sistema (fallback).
const FONTS_LOAD_TIMEOUT_MS = 3000;

export default function RootLayout() {
  const initialize = useAuthStore((state) => state.initialize);
  const [fontsTimedOut, setFontsTimedOut] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    // Plus Jakarta Sans — nuovo design system (asset locali, nessun fetch remoto)
    Jakarta_400: require('../assets/fonts/PlusJakartaSans-Regular.ttf'),
    Jakarta_500: require('../assets/fonts/PlusJakartaSans-Medium.ttf'),
    Jakarta_600: require('../assets/fonts/PlusJakartaSans-SemiBold.ttf'),
    Jakarta_700: require('../assets/fonts/PlusJakartaSans-Bold.ttf'),
  });

  useEffect(() => {
    initializeAuthListeners();
    initialize();
  }, []);

  // ⏱️ Fallback: se i font non si caricano entro X secondi, procediamo lo stesso
  useEffect(() => {
    const t = setTimeout(() => {
      if (!fontsLoaded) {
        console.warn(`[RootLayout] Fonts not loaded after ${FONTS_LOAD_TIMEOUT_MS}ms, proceeding with system fonts`);
        setFontsTimedOut(true);
      }
    }, FONTS_LOAD_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [fontsLoaded]);

  // Non bloccare l'app se i font non sono caricati (degrade gracefully a font di sistema)
  const canRender = fontsLoaded || fontsTimedOut;

  if (!canRender) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontFamily: FONTS.semibold, fontSize: 17 },
          contentStyle: { backgroundColor: COLORS.bg },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="privacy-terms" options={{ headerShown: false }} />
        <Stack.Screen name="order-collection-v2" options={{ headerShown: false }} />
        <Stack.Screen name="drafts" options={{ headerShown: false }} />
        <Stack.Screen name="substitutions" options={{ headerShown: false }} />
        <Stack.Screen name="orphan-claims" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="customer/[id]"
          options={{ title: 'Dettaglio Cliente', headerBackTitle: 'Indietro', presentation: 'card' }}
        />
        <Stack.Screen
          name="order/[id]"
          options={{ title: 'Dettaglio Ordine', headerBackTitle: 'Indietro', presentation: 'card' }}
        />
        <Stack.Screen
          name="inspection/new"
          options={{ title: 'Nuova Ispezione', headerBackTitle: 'Indietro', presentation: 'modal' }}
        />
        <Stack.Screen
          name="anagrafica"
          options={{ headerShown: false, presentation: 'card' }}
        />
        <Stack.Screen
          name="rivendite-no-mappa"
          options={{ headerShown: false, presentation: 'card' }}
        />
        <Stack.Screen
          name="rimborsi"
          options={{ title: 'Rimborsi', headerBackTitle: 'Indietro', presentation: 'card' }}
        />
      </Stack>
    </>
  );
}
