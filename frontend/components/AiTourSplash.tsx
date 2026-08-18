/**
 * AI Tour Splash — avvio app ispirato al poster "VOOM CRM · AI TOUR".
 * Sfondo scuro con glow violá, titolo bicolore, card del giro con percorso
 * animato tappa-per-tappa, KPI e feature chips. Spinge l'agente verso AI Tour.
 */
import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

const PURPLE = '#8B5CF6';
const PURPLE_DEEP = '#7C3AED';
const ORANGE = '#F97316';
const TEAL = '#2DD4BF';
const BG = '#0B0714';

interface Props {
  onFinish: () => void;
  /** true = anteprima/mockup: niente fade-out, i loop continuano */
  loop?: boolean;
}

// ─── Geometria del percorso (coordinate relative all'area mappa della card) ───
const ROUTE_W = Math.min(width - 88, 292);
const ROUTE_H = 168;
const PTS: { x: number; y: number }[] = [
  { x: 0.08, y: 0.82 }, // partenza (freccia teal)
  { x: 0.24, y: 0.52 },
  { x: 0.14, y: 0.18 },
  { x: 0.42, y: 0.10 },
  { x: 0.66, y: 0.30 },
  { x: 0.90, y: 0.14 },
  { x: 0.82, y: 0.62 },
  { x: 0.52, y: 0.80 },
].map((p) => ({ x: p.x * ROUTE_W, y: p.y * ROUTE_H }));

const SEGMENTS = PTS.slice(0, -1).map((a, i) => {
  const b = PTS[i + 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return { left: (a.x + b.x) / 2 - len / 2, top: (a.y + b.y) / 2 - 1.5, len, angle };
});

const CHIPS = [
  { icon: 'map' as const, color: PURPLE, title: 'PIANIFICA', text: 'giri visita intelligenti ottimizzati per te' },
  { icon: 'calendar' as const, color: ORANGE, title: 'PROGRAMMA', text: 'le visite e gestisci il tuo calendario' },
  { icon: 'sparkles' as const, color: TEAL, title: 'SUGGESTION AI', text: 'basate su dati reali e comportamenti' },
  { icon: 'trending-up' as const, color: '#A78BFA', title: 'AUMENTA LE VENDITE', text: 'con insight azionabili e follow-up' },
];

export default function AiTourSplash({ onFinish, loop = false }: Props) {
  const bgOpacity = useSharedValue(1);
  const glowIn = useSharedValue(0);
  const titleIn = useSharedValue(0);
  const aiTourIn = useSharedValue(0);
  const taglineIn = useSharedValue(0);
  const cardIn = useSharedValue(0);
  const routeProgress = useSharedValue(0); // 0→1 disegna tappe e segmenti
  const kpiIn = useSharedValue(0);
  const chipsProgress = useSharedValue(0);
  const livePulse = useSharedValue(0);
  const startPulse = useSharedValue(0);

  useEffect(() => {
    glowIn.value = withTiming(1, { duration: 700 });
    titleIn.value = withDelay(150, withTiming(1, { duration: 550, easing: Easing.out(Easing.exp) }));
    aiTourIn.value = withDelay(350, withTiming(1, { duration: 700, easing: Easing.out(Easing.back(1.6)) }));
    taglineIn.value = withDelay(650, withTiming(1, { duration: 500 }));
    cardIn.value = withDelay(800, withTiming(1, { duration: 600, easing: Easing.out(Easing.exp) }));
    routeProgress.value = withDelay(1150, withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }));
    kpiIn.value = withDelay(2100, withTiming(1, { duration: 450 }));
    chipsProgress.value = withDelay(1400, withTiming(1, { duration: 1100, easing: Easing.out(Easing.ease) }));
    livePulse.value = withDelay(900, withRepeat(
      withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })),
      loop ? -1 : 4, false,
    ));
    startPulse.value = withDelay(1100, withRepeat(
      withSequence(withTiming(1, { duration: 800 }), withTiming(0, { duration: 800 })),
      loop ? -1 : 3, false,
    ));
    if (!loop) {
      bgOpacity.value = withDelay(3600, withTiming(0, { duration: 550, easing: Easing.in(Easing.ease) }, () => {
        runOnJS(onFinish)();
      }));
    }
  }, []);

  // FALLBACK: onFinish garantito anche se runOnJS fallisce (Android Expo Go)
  useEffect(() => {
    if (loop) return;
    const t = setTimeout(() => onFinish(), 5000);
    return () => clearTimeout(t);
  }, []);

  const containerStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowIn.value }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleIn.value,
    transform: [{ translateY: interpolate(titleIn.value, [0, 1], [18, 0]) }],
  }));
  const aiTourStyle = useAnimatedStyle(() => ({
    opacity: aiTourIn.value,
    transform: [{ scale: interpolate(aiTourIn.value, [0, 1], [0.7, 1]) }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineIn.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardIn.value,
    transform: [{ translateY: interpolate(cardIn.value, [0, 1], [36, 0]) }],
  }));
  const kpiStyle = useAnimatedStyle(() => ({ opacity: kpiIn.value }));
  const liveStyle = useAnimatedStyle(() => ({
    opacity: 0.65 + livePulse.value * 0.35,
    transform: [{ scale: 1 + livePulse.value * 0.05 }],
  }));
  const startRingStyle = useAnimatedStyle(() => ({
    opacity: (1 - startPulse.value) * 0.7,
    transform: [{ scale: 1 + startPulse.value * 1.1 }],
  }));

  // Segmenti e tappe: fasce di progressione staggered da un unico valore
  const n = SEGMENTS.length;
  const segStyles = SEGMENTS.map((_, i) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => ({
      opacity: interpolate(routeProgress.value, [i / n, (i + 0.6) / n], [0, 1], 'clamp'),
    })),
  );
  const dotStyles = PTS.map((_, i) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => {
      const t = interpolate(routeProgress.value, [Math.max(0, i - 0.4) / n, Math.min(n, i + 0.4) / n], [0, 1], 'clamp');
      return { opacity: t, transform: [{ scale: 0.4 + t * 0.6 }] };
    }),
  );
  const chipStyles = CHIPS.map((_, i) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => {
      const t = interpolate(chipsProgress.value, [i / CHIPS.length, (i + 1) / CHIPS.length], [0, 1], 'clamp');
      return { opacity: t, transform: [{ translateX: interpolate(t, [0, 1], [-26, 0]) }] };
    }),
  );

  const particles = useMemo(
    () => Array.from({ length: 14 }).map(() => ({
      left: Math.random() * width,
      top: Math.random() * height,
      size: 2 + Math.random() * 3,
      opacity: 0.15 + Math.random() * 0.35,
    })),
    [],
  );

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {/* Glow viola di sfondo (nebulosa) */}
      <Animated.View style={glowStyle}>
        <View style={[styles.nebula, { top: -height * 0.12, left: -width * 0.35, backgroundColor: 'rgba(124,58,237,0.16)' }]} />
        <View style={[styles.nebula, { bottom: -height * 0.15, right: -width * 0.4, backgroundColor: 'rgba(139,92,246,0.13)' }]} />
        <View style={[styles.nebulaSmall, { top: height * 0.34, right: -60, backgroundColor: 'rgba(249,115,22,0.07)' }]} />
        {particles.map((p, i) => (
          <View key={i} style={[styles.particle, { left: p.left, top: p.top, width: p.size, height: p.size, opacity: p.opacity }]} />
        ))}
      </Animated.View>

      <View style={styles.content}>
        {/* Titoli */}
        <Animated.View style={titleStyle}>
          <Text style={styles.voomText}>VOOM CRM</Text>
        </Animated.View>
        <Animated.View style={aiTourStyle}>
          <Text style={styles.aiTourText}>
            <Text style={{ color: PURPLE }}>AI </Text>
            <Text style={{ color: ORANGE }}>TOUR</Text>
          </Text>
        </Animated.View>
        <Animated.View style={taglineStyle}>
          <Text style={styles.tagline}>Genera i giri visita, segui il Tour Live{'\n'}e allena l&apos;AI con dati reali.</Text>
        </Animated.View>

        {/* Card "Il tuo giro di oggi" */}
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>Il tuo giro di oggi</Text>
              <Text style={styles.cardSub}>8 visite pianificate</Text>
            </View>
            <Animated.View style={[styles.liveBadge, liveStyle]}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>TOUR LIVE</Text>
            </Animated.View>
          </View>

          <View style={[styles.routeArea, { width: ROUTE_W, height: ROUTE_H }]}>
            {/* griglia stradale accennata */}
            {[0.25, 0.55, 0.85].map((f) => (
              <View key={`h${f}`} style={[styles.gridLine, { top: ROUTE_H * f, width: ROUTE_W, height: 1 }]} />
            ))}
            {[0.22, 0.5, 0.78].map((f) => (
              <View key={`v${f}`} style={[styles.gridLine, { left: ROUTE_W * f, height: ROUTE_H, width: 1 }]} />
            ))}
            {/* segmenti percorso */}
            {SEGMENTS.map((s, i) => (
              <Animated.View
                key={`s${i}`}
                style={[styles.segment, { left: s.left, top: s.top, width: s.len, transform: [{ rotate: `${s.angle}deg` }] }, segStyles[i]]}
              />
            ))}
            {/* partenza */}
            <Animated.View style={[styles.startRing, { left: PTS[0].x - 17, top: PTS[0].y - 17 }, startRingStyle]} />
            <Animated.View style={[styles.startDot, { left: PTS[0].x - 13, top: PTS[0].y - 13 }, dotStyles[0]]}>
              <Ionicons name="navigate" size={13} color="#04211C" />
            </Animated.View>
            {/* tappe numerate */}
            {PTS.slice(1).map((p, i) => (
              <Animated.View key={`d${i}`} style={[styles.stopDot, { left: p.x - 12, top: p.y - 12 }, dotStyles[i + 1]]}>
                <Text style={styles.stopNum}>{i + 1}</Text>
              </Animated.View>
            ))}
          </View>

          <Animated.View style={[styles.kpiRow, kpiStyle]}>
            <View style={styles.kpi}>
              <Text style={styles.kpiValue}>132 km</Text>
              <Text style={styles.kpiLabel}>Distanza</Text>
            </View>
            <View style={styles.kpiDivider} />
            <View style={styles.kpi}>
              <Text style={styles.kpiValue}>8h 15m</Text>
              <Text style={styles.kpiLabel}>Durata stimata</Text>
            </View>
            <View style={styles.kpiDivider} />
            <View style={styles.kpi}>
              <Text style={styles.kpiValue}>8</Text>
              <Text style={styles.kpiLabel}>Visite</Text>
            </View>
          </Animated.View>
        </Animated.View>

        {/* Feature chips */}
        <View style={styles.chips}>
          {CHIPS.map((c, i) => (
            <Animated.View key={c.title} style={[styles.chip, chipStyles[i]]}>
              <View style={[styles.chipIcon, { backgroundColor: c.color + '26', borderColor: c.color + '55' }]}>
                <Ionicons name={c.icon} size={15} color={c.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.chipTitle, { color: c.color }]}>{c.title}</Text>
                <Text style={styles.chipText} numberOfLines={1}>{c.text}</Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const FONT_BLACK = Platform.select({ ios: '900' as const, default: '900' as const });

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    zIndex: 9999,
    overflow: 'hidden',
  },
  nebula: {
    position: 'absolute',
    width: width * 0.95,
    height: width * 0.95,
    borderRadius: width * 0.5,
  },
  nebulaSmall: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
  },
  particle: { position: 'absolute', borderRadius: 6, backgroundColor: '#A78BFA' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  voomText: { fontSize: 33, fontWeight: FONT_BLACK, color: '#FFFFFF', letterSpacing: 1.5, textAlign: 'center' },
  aiTourText: { fontSize: 46, fontWeight: FONT_BLACK, letterSpacing: 2, textAlign: 'center', marginTop: 2 },
  tagline: { marginTop: 10, fontSize: 13.5, lineHeight: 19, color: 'rgba(201,196,212,0.92)', textAlign: 'center' },
  card: {
    marginTop: 22,
    backgroundColor: 'rgba(20,16,31,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
    borderRadius: 18,
    padding: 14,
    shadowColor: PURPLE_DEEP,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardTitle: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
  cardSub: { color: 'rgba(167,139,250,0.9)', fontSize: 11, marginTop: 1 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: TEAL,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(45,212,191,0.10)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: TEAL },
  liveText: { color: TEAL, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  routeArea: { backgroundColor: 'rgba(10,7,18,0.85)', borderRadius: 12, overflow: 'hidden' },
  gridLine: { position: 'absolute', backgroundColor: 'rgba(139,92,246,0.08)' },
  segment: {
    position: 'absolute',
    height: 3,
    borderRadius: 2,
    backgroundColor: PURPLE,
    shadowColor: PURPLE,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
  },
  startRing: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: TEAL,
  },
  startDot: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: TEAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopDot: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PURPLE_DEEP,
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopNum: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  kpiRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  kpi: { flex: 1, alignItems: 'center' },
  kpiValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  kpiLabel: { color: 'rgba(148,143,163,0.9)', fontSize: 9.5, marginTop: 1 },
  kpiDivider: { width: 1, height: 24, backgroundColor: 'rgba(139,92,246,0.25)' },
  chips: { marginTop: 20, width: '100%', maxWidth: 340, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(20,16,31,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.22)',
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  chipIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipTitle: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 },
  chipText: { fontSize: 10.5, color: 'rgba(190,185,205,0.85)', marginTop: 1 },
});
