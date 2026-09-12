import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, currentThemeMode } from '../../lib/theme';
import { hap } from '../../lib/haptics';

/**
 * Custom tab bar background — translucent blur on iOS, solid on Android/web for clarity.
 */
function TabBarBackground() {
  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={75}
        tint={currentThemeMode === 'dark' ? 'dark' : 'light'}
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: currentThemeMode === 'dark' ? 'rgba(11,7,20,0.72)' : 'rgba(255,255,255,0.7)' },
        ]}
      />
    );
  }
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.surface }]} />;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  // Calcolo dinamico altezza/padding tab bar in base alla safe area del dispositivo:
  // - Android con gesture bar: insets.bottom ≈ 16px → tab bar si solleva di 16px
  // - Android con 3-button bar: insets.bottom ≈ 48px → tab bar si solleva di 48px
  // - iOS notched: insets.bottom ≈ 34px
  // - Dispositivi senza barra: insets.bottom = 0 → comportamento standard
  const baseHeight = Platform.OS === 'ios' ? 60 : 58;
  const basePadBottom = Platform.OS === 'ios' ? 8 : 8;
  const tabBarHeight = baseHeight + insets.bottom;
  const tabBarPadBottom = basePadBottom + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopColor: currentThemeMode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabBarHeight,
          paddingBottom: tabBarPadBottom,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontFamily: FONTS.medium,
          marginTop: 2,
        },
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontFamily: FONTS.semibold, fontSize: 17 },
      }}
      screenListeners={{
        // Subtle haptic on tab change (only mobile native)
        tabPress: () => hap.select(),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarButtonTestID: 'tab-dashboard',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={focused ? 26 : 23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Mappa',
          tabBarButtonTestID: 'tab-map',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={focused ? 26 : 23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Clienti',
          tabBarButtonTestID: 'tab-customers',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={focused ? 26 : 23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="altro"
        options={{
          title: 'Altro',
          tabBarButtonTestID: 'tab-more',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={focused ? 25 : 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          href: null,
          title: 'Ordini',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cart' : 'cart-outline'} size={focused ? 26 : 23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          href: null,
          title: 'Prodotti',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'pricetag' : 'pricetag-outline'} size={focused ? 26 : 23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          href: null,
          title: 'Calendario',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={focused ? 26 : 23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: 'Profilo',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={focused ? 26 : 23} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
});
