/**
 * VOOM Splash Screen — Futuristic / Sci-Fi loading effect
 * Uses react-native-reanimated for smooth native animations
 */
import React, { useEffect } from 'react';
import { View, Image, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');
const LOGO = require('../assets/voom-logo.jpg');

interface SplashProps {
  onFinish: () => void;
}

export default function VoomSplash({ onFinish }: SplashProps) {
  // Animation values
  const bgOpacity = useSharedValue(1);
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const logoRotate = useSharedValue(-10);
  const glowRadius = useSharedValue(0);
  const glowOpacity = useSharedValue(0);
  const ring1Scale = useSharedValue(0.5);
  const ring1Opacity = useSharedValue(0);
  const ring2Scale = useSharedValue(0.5);
  const ring2Opacity = useSharedValue(0);
  const ring3Scale = useSharedValue(0.5);
  const ring3Opacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);
  const subtitleOpacity = useSharedValue(0);
  const scanLineY = useSharedValue(-height);
  const particleOpacity = useSharedValue(0);

  useEffect(() => {
    // Scan line sweep
    scanLineY.value = withRepeat(
      withTiming(height, { duration: 1800, easing: Easing.linear }),
      2,
      false
    );

    // Logo entrance — scale up + fade in + slight rotation
    logoOpacity.value = withDelay(300, withTiming(1, { duration: 800, easing: Easing.out(Easing.exp) }));
    logoScale.value = withDelay(300, withTiming(1, { duration: 1000, easing: Easing.out(Easing.back(1.5)) }));
    logoRotate.value = withDelay(300, withTiming(0, { duration: 1000, easing: Easing.out(Easing.exp) }));

    // Glow pulse
    glowOpacity.value = withDelay(600, withSequence(
      withTiming(0.8, { duration: 600 }),
      withRepeat(
        withSequence(
          withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.8, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        3,
        true
      )
    ));
    glowRadius.value = withDelay(600, withSequence(
      withTiming(40, { duration: 600 }),
      withRepeat(
        withSequence(
          withTiming(20, { duration: 800 }),
          withTiming(50, { duration: 800 })
        ),
        3,
        true
      )
    ));

    // Expanding rings
    ring1Opacity.value = withDelay(800, withSequence(
      withTiming(0.6, { duration: 400 }),
      withTiming(0, { duration: 800 })
    ));
    ring1Scale.value = withDelay(800, withTiming(2.5, { duration: 1200, easing: Easing.out(Easing.ease) }));

    ring2Opacity.value = withDelay(1100, withSequence(
      withTiming(0.5, { duration: 400 }),
      withTiming(0, { duration: 800 })
    ));
    ring2Scale.value = withDelay(1100, withTiming(2.5, { duration: 1200, easing: Easing.out(Easing.ease) }));

    ring3Opacity.value = withDelay(1400, withSequence(
      withTiming(0.4, { duration: 400 }),
      withTiming(0, { duration: 800 })
    ));
    ring3Scale.value = withDelay(1400, withTiming(2.5, { duration: 1200, easing: Easing.out(Easing.ease) }));

    // Particles
    particleOpacity.value = withDelay(700, withSequence(
      withTiming(1, { duration: 500 }),
      withDelay(1500, withTiming(0, { duration: 500 }))
    ));

    // Text VOOM
    textOpacity.value = withDelay(1200, withTiming(1, { duration: 600, easing: Easing.out(Easing.exp) }));
    textTranslateY.value = withDelay(1200, withTiming(0, { duration: 600, easing: Easing.out(Easing.exp) }));

    // Subtitle
    subtitleOpacity.value = withDelay(1600, withTiming(1, { duration: 500 }));

    // Fade out & finish
    bgOpacity.value = withDelay(3200, withTiming(0, { duration: 600, easing: Easing.in(Easing.ease) }, () => {
      runOnJS(onFinish)();
    }));
  }, []);

  // FALLBACK: garantisce che onFinish sia chiamato anche se runOnJS dovesse
  // fallire o tardare (problema noto di reanimated su alcuni Android Expo Go).
  // Tempo totale animazione = 3200 + 600 = 3800ms, diamo qualche secondo extra.
  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      console.log('[VoomSplash] Fallback timer triggered onFinish');
      onFinish();
    }, 5000);
    return () => clearTimeout(fallbackTimer);
  }, []);

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotate.value}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    shadowRadius: glowRadius.value,
  }));

  const makeRingStyle = (scale: Animated.SharedValue<number>, opacity: Animated.SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    }));

  const ring1Style = makeRingStyle(ring1Scale, ring1Opacity);
  const ring2Style = makeRingStyle(ring2Scale, ring2Opacity);
  const ring3Style = makeRingStyle(ring3Scale, ring3Opacity);

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
  }));

  const particleStyle = useAnimatedStyle(() => ({
    opacity: particleOpacity.value,
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Scan line effect */}
      <Animated.View style={[styles.scanLine, scanStyle]} />

      {/* Floating particles */}
      <Animated.View style={[styles.particlesContainer, particleStyle]}>
        {Array.from({ length: 12 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.particle,
              {
                left: Math.random() * width,
                top: Math.random() * height * 0.6 + height * 0.15,
                width: 2 + Math.random() * 3,
                height: 2 + Math.random() * 3,
                opacity: 0.3 + Math.random() * 0.5,
              },
            ]}
          />
        ))}
      </Animated.View>

      {/* Center content */}
      <View style={styles.center}>
        {/* Expanding rings */}
        <Animated.View style={[styles.ring, ring1Style]} />
        <Animated.View style={[styles.ring, ring2Style]} />
        <Animated.View style={[styles.ring, ring3Style]} />

        {/* Glow behind logo */}
        <Animated.View style={[styles.glow, glowStyle]} />

        {/* Logo */}
        <Animated.View style={[styles.logoWrap, logoStyle]}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </Animated.View>

        {/* Subtitle */}
        <Animated.View style={subtitleStyle}>
          <Text style={styles.subtitle}>Crm</Text>
        </Animated.View>
      </View>

      {/* Bottom line accent */}
      <View style={styles.bottomAccent}>
        <View style={styles.accentLine} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A0E1A',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    zIndex: 1,
  },
  particlesContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  particle: {
    position: 'absolute',
    borderRadius: 10,
    backgroundColor: '#60A5FA',
  },
  ring: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  glow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 20,
  },
  logoWrap: {
    width: 130,
    height: 130,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 30,
    elevation: 15,
  },
  logo: {
    width: 100,
    height: 100,
  },
  textWrap: {
    marginTop: 28,
  },
  voomText: {
    fontSize: 32,
    fontWeight: '200',
    color: '#FFFFFF',
    letterSpacing: 12,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 13,
    color: 'rgba(148, 163, 184, 0.8)',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  bottomAccent: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  accentLine: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(59, 130, 246, 0.4)',
    borderRadius: 1,
  },
});
