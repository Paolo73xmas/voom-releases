// Selettore grafico "a ruota" delle fasce orarie visite (multi-selezione).
// Spicchi proporzionali alla durata, fascia pranzo 11.30-14.30 in alto (parità web).
import React, { useEffect, useState, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Circle, G, Text as SvgText } from 'react-native-svg';
import { getVisitSlots, type VisitSlot } from '../../lib/visit-slots';
import { DS } from '../../lib/theme';

interface Props {
  value: string[];
  onChange?: (ids: string[]) => void;
  readOnly?: boolean;
  size?: number;
  slots?: VisitSlot[];
  testID?: string;
}

const DAY_START = 360;
const DAY_END = 1080;
const ROTATION = -165; // porta l'inizio della fascia 11.30 in alto

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function slicePath(cx: number, cy: number, rInner: number, rOuter: number, a0: number, a1: number) {
  const p1 = polar(cx, cy, rOuter, a0);
  const p2 = polar(cx, cy, rOuter, a1);
  const p3 = polar(cx, cy, rInner, a1);
  const p4 = polar(cx, cy, rInner, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y} Z`;
}

export function VisitSlotWheel({ value, onChange, readOnly, size = 230, slots: slotsProp, testID = 'visit-slot-wheel' }: Props) {
  const [loaded, setLoaded] = useState<VisitSlot[]>(slotsProp || []);
  const pressPoint = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (slotsProp && slotsProp.length > 0) {
      setLoaded(slotsProp);
      return;
    }
    getVisitSlots().then(setLoaded);
  }, [slotsProp]);

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 4;
  const rInner = size * 0.17;
  const angleOf = (min: number) => ((min - DAY_START) / (DAY_END - DAY_START)) * 360 + ROTATION;

  const toggle = (id: string) => {
    if (readOnly || !onChange) return;
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };

  return (
    <View testID={testID} style={styles.container}>
    <Pressable testID={`${testID}-disc`} disabled={readOnly || !onChange} style={{ width: size, height: size }} onPressIn={({ nativeEvent }) => {
      pressPoint.current = { x: nativeEvent.locationX, y: nativeEvent.locationY };
    }} onPress={() => {
      // Un responder React Native unico: i tocchi su testo/spicchi non vengono persi da SVG.G.
      // onPress web è un click senza locationX/Y: usa le coordinate del responder onPressIn.
      const point = pressPoint.current; pressPoint.current = null;
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
      const dx = point.x - cx;
      const dy = point.y - cy;
      const radius = Math.hypot(dx, dy);
      if (radius < rInner || radius > rOuter) return;
      const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 - ROTATION + 720) % 360;
      const minute = DAY_START + angle / 360 * (DAY_END - DAY_START);
      const slot = loaded.find(s => minute >= s.start && minute < s.end);
      if (slot) toggle(slot.id);
    }}>
    <Svg pointerEvents="none" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {loaded.map((s) => {
        const a0 = angleOf(s.start) + 1;
        const a1 = angleOf(s.end) - 1;
        const sel = value.includes(s.id);
        const mid = (a0 + a1) / 2;
        const lp = polar(cx, cy, (rInner + rOuter) / 2 + size * 0.035, mid);
        return (
          <G key={s.id}>
            <Path
              d={slicePath(cx, cy, rInner, rOuter, a0, a1)}
              fill={sel ? '#7C3AED' : DS.surface2}
              stroke={sel ? '#6D28D9' : DS.border}
              strokeWidth={1}
            />
            <SvgText
              x={lp.x}
              y={lp.y}
              textAnchor="middle"
              alignmentBaseline="central"
              fontSize={Math.max(9, size * 0.044)}
              fontWeight={sel ? '700' : '500'}
              fill={sel ? '#FFFFFF' : DS.ink2}
            >
              {s.label}
            </SvgText>
          </G>
        );
      })}
      <Circle cx={cx} cy={cy} r={rInner - 3} fill={DS.surface} stroke={DS.border} />
      <SvgText x={cx} y={cy - size * 0.025} textAnchor="middle" fontSize={size * 0.04} fill={DS.inkMuted}>
        Fasce
      </SvgText>
      <SvgText
        x={cx}
        y={cy + size * 0.05}
        textAnchor="middle"
        fontSize={size * 0.045}
        fontWeight="700"
        fill={value.length > 0 ? '#7C3AED' : DS.inkMuted}
      >
        {value.length > 0 ? `${value.length} scelte` : 'nessuna'}
      </SvgText>
    </Svg>
    </Pressable>
    {!readOnly && !!onChange && <View style={styles.options}>
      {loaded.map(slot => <Pressable key={slot.id} testID={`${testID}-option-${slot.id}`} accessibilityRole="checkbox" accessibilityState={{ checked: value.includes(slot.id) }} onPress={() => toggle(slot.id)} style={[styles.option, value.includes(slot.id) && styles.selected]}>
        <Text style={[styles.optionText, value.includes(slot.id) && styles.selectedText]}>{slot.label}</Text>
      </Pressable>)}
    </View>}
    <Text testID={`${testID}-selection`} style={styles.summary}>{value.length ? `Selezionate: ${loaded.filter(s => value.includes(s.id)).map(s => s.label).join(', ')}` : 'Nessuna fascia selezionata'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', width: '100%' },
  options: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 12 },
  option: { minHeight: 44, minWidth: 88, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: DS.border, backgroundColor: DS.surface2 },
  selected: { backgroundColor: '#7C3AED', borderColor: '#6D28D9' },
  optionText: { fontSize: 14, color: DS.ink2 },
  selectedText: { color: '#FFFFFF', fontWeight: '700' },
  summary: { color: DS.inkMuted, fontSize: 12, textAlign: 'center', marginTop: 10, lineHeight: 18 },
});
