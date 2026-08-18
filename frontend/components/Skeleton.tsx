/**
 * Skeleton loader with shimmer effect (no extra deps, uses Reanimated).
 */
import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withTiming, interpolate, Easing,
} from 'react-native-reanimated';
import { COLORS } from '../lib/theme';

interface Props {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const aStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0.55, 1, 0.55]),
  }));

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: COLORS.border },
        aStyle,
        style,
      ]}
    />
  );
}

export function SkeletonCard({ height = 80 }: { height?: number }) {
  return (
    <View style={[styles.card, { height }]}>
      <Skeleton height={14} width="60%" />
      <Skeleton height={12} width="40%" style={{ marginTop: 8 }} />
      <Skeleton height={10} width="80%" style={{ marginTop: 8 }} />
    </View>
  );
}

export function SkeletonList({ count = 5, height = 80 }: { count?: number; height?: number }) {
  return (
    <View style={{ padding: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
});
