/**
 * EmptyState — friendly placeholder with optional CTA.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS, FONT_SIZE, GRADIENTS } from '../lib/theme';
import { hap } from '../lib/haptics';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  iconGradient?: keyof typeof GRADIENTS;
}

export function EmptyState({
  icon = 'document-text-outline',
  title,
  message,
  ctaLabel,
  onCtaPress,
  iconGradient = 'primary',
}: Props) {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={GRADIENTS[iconGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.iconCircle}
      >
        <Ionicons name={icon} size={36} color="#FFF" />
      </LinearGradient>
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
      {ctaLabel && onCtaPress && (
        <TouchableOpacity
          style={styles.cta}
          onPress={() => { hap.light(); onCtaPress(); }}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaTxt}>{ctaLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  title: {
    fontSize: FONT_SIZE.lg,
    fontFamily: FONTS.semibold,
    color: COLORS.text,
    textAlign: 'center',
  },
  message: {
    fontSize: FONT_SIZE.md,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  cta: {
    marginTop: 18,
    paddingVertical: 11, paddingHorizontal: 22,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
  },
  ctaTxt: {
    fontSize: FONT_SIZE.base,
    fontFamily: FONTS.semibold,
    color: '#FFF',
  },
});
