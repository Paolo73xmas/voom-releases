// Selettore grafico "a ruota" delle fasce orarie visite (multi-selezione).
// Spicchi proporzionali alla durata, fascia pranzo 11.30-14.30 in alto (parità web).
import React, { useEffect, useState } from 'react';
import Svg, { Path, Circle, G, Text as SvgText } from 'react-native-svg';
import { getVisitSlots, type VisitSlot } from '../../lib/visit-slots';
import { DS } from '../../lib/theme';

interface Props {
  value: string[];
  onChange?: (ids: string[]) => void;
  readOnly?: boolean;
  size?: number;
  slots?: VisitSlot[];
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

export function VisitSlotWheel({ value, onChange, readOnly, size = 230, slots: slotsProp }: Props) {
  const [loaded, setLoaded] = useState<VisitSlot[]>(slotsProp || []);

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
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {loaded.map((s) => {
        const a0 = angleOf(s.start) + 1;
        const a1 = angleOf(s.end) - 1;
        const sel = value.includes(s.id);
        const mid = (a0 + a1) / 2;
        const lp = polar(cx, cy, (rInner + rOuter) / 2 + size * 0.035, mid);
        return (
          <G key={s.id} onPress={() => toggle(s.id)}>
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
  );
}
