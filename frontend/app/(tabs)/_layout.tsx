import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { COLORS, FONTS } from '../../lib/theme';
import { hap } from '../../lib/haptics';

/**
 * Custom tab bar background — translucent blur on iOS, solid on Android/web for clarity.
 */
function TabBarBackground() {
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={75} tint="light" style={[StyleSheet.absoluteFill, styles.blurFill]} />
    );
  }
  return <View style={[StyleSheet.absoluteFill, styles.solidFill]} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopColor: 'rgba(0,0,0,0.06)',
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === 'ios' ? 90 : 68,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: 10,
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
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={focused ? 26 : 23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Mappa',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={focused ? 26 : 23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'Clienti',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={focused ? 26 : 23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Ordini',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'cart' : 'cart-outline'} size={focused ? 26 : 23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Prodotti',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'pricetag' : 'pricetag-outline'} size={focused ? 26 : 23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
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
  blurFill: { backgroundColor: 'rgba(255,255,255,0.7)' },
  solidFill: { backgroundColor: '#FFFFFF' },
});
