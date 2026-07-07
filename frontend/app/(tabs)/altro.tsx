import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DS, JAKARTA } from '../../lib/theme';
import { useRimborsiAccess } from '../../hooks/useRimborsiAccess';
import { hap } from '../../lib/haptics';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  sub?: string;
}

export default function AltroScreen() {
  const router = useRouter();
  const { hasAccess: hasRimborsiAccess } = useRimborsiAccess();

  const sections: { title: string; items: MenuItem[] }[] = [
    {
      title: 'Principale',
      items: [
        { label: 'Ordini', icon: 'cart-outline', route: '/(tabs)/orders', sub: 'Storico e dettaglio ordini' },
        { label: 'Prodotti', icon: 'pricetag-outline', route: '/(tabs)/products', sub: 'Catalogo con stock live' },
        { label: 'Calendario', icon: 'calendar-outline', route: '/(tabs)/calendar', sub: 'Appuntamenti e visite' },
        { label: 'Profilo', icon: 'person-outline', route: '/(tabs)/profile', sub: 'Account e impostazioni' },
      ],
    },
    {
      title: 'Strumenti',
      items: [
        { label: 'Bozze Ordine', icon: 'document-text-outline', route: '/drafts' },
        { label: 'Sostituzioni', icon: 'swap-horizontal-outline', route: '/substitutions' },
        ...(hasRimborsiAccess ? [{ label: 'Rimborsi', icon: 'receipt-outline', route: '/rimborsi' }] : []),
        { label: 'Reclami Orfani', icon: 'flag-outline', route: '/orphan-claims' },
        { label: 'Rivendite No Mappa', icon: 'globe-outline', route: '/rivendite-no-mappa' },
        { label: 'Anagrafica / Prima Visita', icon: 'clipboard-outline', route: '/anagrafica' },
        { label: 'Nuova Ispezione', icon: 'camera-outline', route: '/inspection/new' },
      ],
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {sections.map((section) => (
        <View key={section.title}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.card}>
            {section.items.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.row, idx < section.items.length - 1 && styles.rowBorder]}
                onPress={() => { hap.light(); router.push(item.route as any); }}
                activeOpacity={0.6}
              >
                <View style={styles.iconChip}>
                  <Ionicons name={item.icon as any} size={19} color={DS.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  {item.sub ? <Text style={styles.rowSub}>{item.sub}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={17} color={DS.borderStrong} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DS.surface2,
  },
  content: {
    padding: 20,
    paddingBottom: 120, // spazio per la tab bar flottante
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: JAKARTA.semibold,
    color: DS.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 8,
  },
  card: {
    backgroundColor: DS.surface,
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.border,
  },
  iconChip: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: DS.brandTint,
    alignItems: 'center', justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 15,
    fontFamily: JAKARTA.semibold,
    color: DS.ink,
  },
  rowSub: {
    fontSize: 12,
    fontFamily: JAKARTA.regular,
    color: DS.inkMuted,
    marginTop: 1,
  },
});
