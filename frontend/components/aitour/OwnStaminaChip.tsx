// Chip "stamina" personale dell'agente (parità web OwnStaminaChip):
// visibile solo se l'admin ha attivato stamina_visible; barra 0-100 aggiornata ogni 2 min.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { JAKARTA } from '../../lib/theme';
import { fetchOwnStamina, staminaColor, todayStr } from '../../lib/aitour/contribution';

export function OwnStaminaChip() {
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const s = await fetchOwnStamina(todayStr());
        if (!stop) setScore(s);
      } catch (err) {
        console.warn('[AITour] own stamina:', err);
        if (!stop) setScore(null);
      }
    };
    load();
    const t = setInterval(load, 120000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  if (score === null) return null;
  const color = staminaColor(score);
  return (
    <View style={styles.chip}>
      <Ionicons name="flash" size={12} color={color} />
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(100, score)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.pct, { color }]}>{score}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  barTrack: { width: 56, height: 6, borderRadius: 3, backgroundColor: 'rgba(148,163,184,0.35)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  pct: { fontFamily: JAKARTA.semibold, fontSize: 10 },
});
