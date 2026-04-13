import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../store/authStore';

export default function RootLayout() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1E40AF',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          contentStyle: {
            backgroundColor: '#F3F4F6',
          },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="privacy-terms" options={{ headerShown: false }} />
        <Stack.Screen name="order-collection-v2" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="customer/[id]" 
          options={{ 
            title: 'Dettaglio Cliente',
            headerBackTitle: 'Indietro',
            presentation: 'card',
          }} 
        />
        <Stack.Screen 
          name="order/[id]" 
          options={{ 
            title: 'Dettaglio Ordine',
            headerBackTitle: 'Indietro',
            presentation: 'card',
          }} 
        />
        <Stack.Screen 
          name="inspection/new" 
          options={{ 
            title: 'Nuova Ispezione',
            headerBackTitle: 'Indietro',
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="order-collection" 
          options={{ 
            title: 'Raccolta Ordine',
            headerBackTitle: 'Indietro',
            presentation: 'card',
          }} 
        />
        <Stack.Screen 
          name="anagrafica" 
          options={{ 
            headerShown: false,
            presentation: 'card',
          }} 
        />
        <Stack.Screen 
          name="rivendite-no-mappa" 
          options={{ 
            headerShown: false,
            presentation: 'card',
          }} 
        />
      </Stack>
    </>
  );
}
