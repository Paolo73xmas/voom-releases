/**
 * Avatar — circular initials with gradient background.
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getUserInitials, getAvatarGradient, FONTS } from '../lib/theme';

interface Props {
  name?: string | null;
  email?: string | null;
  size?: number;
  style?: ViewStyle;
}

export function Avatar({ name, email, size = 40, style }: Props) {
  const initials = getUserInitials(name, email);
  const seed = (name || email || 'user').toLowerCase();
  const gradient = getAvatarGradient(seed);

  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, overflow: 'hidden' },
        style,
      ]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text
          style={{
            color: '#FFF',
            fontSize: size * 0.4,
            fontFamily: FONTS.bold,
            letterSpacing: 0.5,
          }}
        >
          {initials}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
