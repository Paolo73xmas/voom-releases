// Vista Settimanale AI Tour mobile: pianificazione dell'intera settimana con territori distribuiti per giorno.
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Switch, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DS, JAKARTA, SHADOWS } from '../../lib/theme';
import { hap } from '../../lib/haptics';
import { AI_PURPLE, AI_PURPLE_TEXT } from './shared';
import { loadCandidates } from '../../lib/aitour/data';
import { scoreCandidates } from '../../lib/aitour/scoring';
import { listAllZones, pointInZones, loadNeverVisitedFillers, type TerritoryZone } from '../../lib/aitour/territories';
import { buildWeekPlan, mondayOf, nextMonday, addDays, type WeekPlan, type WeekDayPlan } from '../../lib/aitour/week';
import type { AiTourSettings, GeoPoint } from '../../lib/aitour/types';
import { ENTITY_COLORS, fmtDur } from '../../lib/aitour/types';

export interface WeekPreset {
  weekStart: string;
  days: boolean[];
  startMode: string;
  startAddress: string;
  endMode: string;
  includeFillers: boolean;
  useTerritory: boolean;
  token: number;
}

interface Props {
  agentId: string;
  settings: AiTourSettings;
  resolvePoint: (mode: string, address: string, start: GeoPoint | null) => Promise<GeoPoint | null>;
  onGenerateDay: (day: WeekDayPlan, start: GeoPoint, end: GeoPoint | null) => Promise<void>;
  preset?: WeekPreset | null;
  onPresetConsumed?: () => void;
}

const DAY_BTNS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

function weekChoices(): { value: string; label: string }[] {
  const thisMon = mondayOf(new Date().toISOString().slice(0, 10));
  const nm = nextMonday();
  return [
    { value: thisMon, label: 'Questa settimana' },
    { value: nm, label: 'Prossima' },
    { value: addDays(nm, 7), label: `Dal ${new Date(addDays(nm, 7) + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}` },
    { value: addDays(nm, 14), label: `Dal ${new Date(addDays(nm, 14) + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}` },
  ];
}

interface PlanValues {
  weekStart: string;
  days: boolean[];
  startMode: string;
  startAddress: string;
  endMode: string;
  includeFillers: boolean;
  useTerritory: boolean;
}

export function WeekTab({ agentId, settings, resolvePoint, onGenerateDay, preset, onPresetConsumed }: Props) {
  const [weekStart, setWeekStart] = useState(nextMonday());
  const [days, setDays] = useState([true, true, true, true, true, false]);
  const [startMode, setStartMode] = useState('current');
  const [startAddress, setStartAddress] = useState('');
  const [endMode, setEndMode] = useState('none');
  const [includeFillers, setIncludeFillers] = useState(true);
  const [useTerritory, setUseTerritory] = useState(true);
  const [zones, setZones] = useState<TerritoryZone[]>([]);
  const [planning, setPlanning] = useState(false);
  const [week, setWeek] = useState<WeekPlan | null>(null);
  const [startPoint, setStartPoint] = useState<GeoPoint | null>(null);
  const [endPoint, setEndPoint] = useState<GeoPoint | null>(null);
  const [genDay, setGenDay] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    setWeek(null);
    listAllZones()
      .then((all) => setZones(all.filter((z) => z.agent_id === agentId)))
      .catch((err) => console.warn('[AITour][week] zones:', err));
  }, [agentId]);

  const runPlan = useCallback(
    async (v: PlanValues) => {
      const activeDays = v.days.map((on, i) => (on ? i : -1)).filter((i) => i >= 0);
      if (activeDays.length === 0) {
        setErrMsg('Seleziona almeno un giorno');
        return;
      }
      setPlanning(true);
      setErrMsg('');
      try {
        const start = await resolvePoint(v.startMode, v.startAddress, null);
        if (!start) {
          setErrMsg(v.startMode === 'current' ? 'Posizione non disponibile: consenti la geolocalizzazione o usa un indirizzo' : 'Punto di partenza non valido');
          return;
        }
        const end = await resolvePoint(v.endMode, '', start);
        const myZones = (await listAllZones()).filter((z) => z.agent_id === agentId);
        setZones(myZones);
        const pool = await loadCandidates(agentId, settings);
        let all = scoreCandidates([...pool.clients, ...pool.prospects, ...pool.orphans], settings);
        if (v.useTerritory && myZones.length > 0) {
          // I clienti Progetti Speciali restano pianificabili anche fuori dal territorio
          all = all.filter((c) => c.projectType || pointInZones(c.lat, c.lng, myZones));
        }
        if (v.includeFillers) {
          try {
            const extra = await loadNeverVisitedFillers(agentId, all, v.useTerritory ? myZones : [], settings, 150);
            if (extra.length > 0) all = [...all, ...scoreCandidates(extra, settings)];
          } catch (err) {
            console.warn('[AITour][week] fillers mai visitate:', err);
          }
        }
        if (all.length === 0) {
          setErrMsg(v.useTerritory && myZones.length > 0 ? "Nessun soggetto nel territorio dell'agente" : 'Nessun soggetto con GPS nel portafoglio');
          return;
        }
        const plan = buildWeekPlan({ candidates: all, weekStart: v.weekStart, activeDays, settings, includeFillers: v.includeFillers, start });
        setWeek(plan);
        setStartPoint(start);
        setEndPoint(end);
        setExpanded(null);
      } catch (err) {
        console.error('[AITour][week] generate:', err);
        setErrMsg('Errore nella pianificazione della settimana');
      } finally {
        setPlanning(false);
      }
    },
    [agentId, settings, resolvePoint]
  );

  // Apertura da Vista Mensile: applica i valori e pianifica subito la settimana scelta
  useEffect(() => {
    if (!preset) return;
    setWeekStart(preset.weekStart);
    setDays([...preset.days]);
    setStartMode(preset.startMode);
    setStartAddress(preset.startAddress);
    setEndMode(preset.endMode);
    setIncludeFillers(preset.includeFillers);
    setUseTerritory(preset.useTerritory);
    onPresetConsumed?.();
    runPlan(preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset?.token]);

  const genDayTour = async (idx: number) => {
    if (!week || !startPoint) return;
    hap.medium();
    setGenDay(idx);
    try {
      await onGenerateDay(week.days[idx], startPoint, endPoint);
    } finally {
      setGenDay(null);
    }
  };

  const totalVisits = week ? week.days.reduce((s, d) => s + d.candidates.length, 0) : 0;
  const choices = weekChoices();
  const presetChoice = choices.some((c) => c.value === weekStart);

  const chip = (label: string, active: boolean, onPress: () => void, key?: string) => (
    <TouchableOpacity
      key={key || label}
      style={[styles.chip, active && styles.chipActive]}
      onPress={() => {
        hap.light();
        onPress();
      }}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View>
      {/* Settimana */}
      <Text style={styles.label}>Settimana (dal lunedì)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7 }} style={{ flexGrow: 0 }}>
        {choices.map((c) => chip(c.label, weekStart === c.value, () => setWeekStart(c.value), c.value))}
        {!presetChoice &&
          chip(
            `Dal ${new Date(weekStart + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}`,
            true,
            () => {},
            'custom'
          )}
      </ScrollView>

      {/* Giorni */}
      <Text style={styles.label}>Giorni della settimana</Text>
      <View style={styles.chipRow}>
        {DAY_BTNS.map((d, i) =>
          chip(d, days[i], () => setDays((prev) => prev.map((v, j) => (j === i ? !v : v))), d)
        )}
      </View>

      {/* Partenza */}
      <Text style={styles.label}>Partenza (tutti i giorni)</Text>
      <View style={styles.chipRow}>
        {chip('Posizione corrente', startMode === 'current', () => setStartMode('current'))}
        {chip('Indirizzo', startMode === 'address', () => setStartMode('address'))}
        {!!settings.home_lat && chip('Casa', startMode === 'home', () => setStartMode('home'))}
        {!!settings.office_lat && chip('Sede', startMode === 'office', () => setStartMode('office'))}
      </View>
      {startMode === 'address' && (
        <TextInput
          style={styles.input}
          value={startAddress}
          onChangeText={setStartAddress}
          placeholder="Via, città"
          placeholderTextColor={DS.inkMuted}
        />
      )}

      {/* Rientro */}
      <Text style={styles.label}>Rientro</Text>
      <View style={styles.chipRow}>
        {chip('Nessuno', endMode === 'none', () => setEndMode('none'))}
        {chip('Partenza', endMode === 'start', () => setEndMode('start'))}
        {!!settings.home_lat && chip('Casa', endMode === 'home', () => setEndMode('home'))}
        {!!settings.office_lat && chip('Sede', endMode === 'office', () => setEndMode('office'))}
      </View>

      {/* Switch */}
      <View style={styles.switchRow}>
        <Switch value={includeFillers} onValueChange={setIncludeFillers} trackColor={{ true: AI_PURPLE }} />
        <Text style={styles.switchLabel}>Riempi con prospect, orfani e mai visitate</Text>
      </View>
      {zones.length > 0 ? (
        <View style={styles.switchRow}>
          <Switch value={useTerritory} onValueChange={setUseTerritory} trackColor={{ true: AI_PURPLE }} />
          <Text style={styles.switchLabel}>
            Limita al territorio ({zones.length} {zones.length === 1 ? 'area' : 'aree'})
          </Text>
        </View>
      ) : (
        <Text style={styles.noZones}>Nessun territorio disegnato per questo agente (configurabile dalla web app)</Text>
      )}

      {errMsg ? (
        <View style={styles.errBox}>
          <Ionicons name="alert-circle" size={14} color="#991B1B" />
          <Text style={styles.errText}>{errMsg}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.generateBtn}
        onPress={() => runPlan({ weekStart, days, startMode, startAddress, endMode, includeFillers, useTerritory })}
        disabled={planning}
        activeOpacity={0.8}
      >
        {planning ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="calendar" size={17} color="#FFF" />}
        <Text style={styles.generateBtnText}>{planning ? 'PIANIFICAZIONE...' : 'PIANIFICA SETTIMANA'}</Text>
      </TouchableOpacity>

      {/* Risultato */}
      {week && (
        <View style={{ marginTop: 14 }}>
          <Text style={styles.kpiLine}>
            Visite pianificate: <Text style={styles.kpiBold}>{totalVisits}</Text> · In scadenza coperti:{' '}
            <Text style={styles.kpiBold}>
              {week.coveredDue}/{week.totalDue}
            </Text>{' '}
            · Giornata utile: <Text style={styles.kpiBold}>{fmtDur(week.usableMinPerDay)}</Text>
          </Text>
          {week.overflow.length > 0 && (
            <View style={styles.warnBox}>
              <Ionicons name="warning" size={13} color="#92400E" />
              <Text style={styles.warnText}>
                {week.overflow.length} clienti in scadenza non rientrano nella settimana (verranno riproposti):{' '}
                {week.overflow.slice(0, 5).map((c) => c.name).join(', ')}
                {week.overflow.length > 5 ? '...' : ''}
              </Text>
            </View>
          )}

          {week.days.map((d, idx) => (
            <View key={d.date} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dayTitle}>
                    {d.dow} {new Date(d.date + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                  </Text>
                  <Text style={styles.dayTerritory}>{d.label || (d.candidates.length ? 'Territorio misto' : '—')}</Text>
                </View>
                <View style={styles.dayCountBadge}>
                  <Text style={styles.dayCountText}>{d.candidates.length} visite</Text>
                </View>
              </View>
              <Text style={styles.dayMeta}>
                <Text style={{ color: '#DC2626', fontFamily: JAKARTA.semibold }}>{d.dueCount} in scadenza</Text> · {fmtDur(d.estVisitMin)} visite ·
                ~{fmtDur(d.estDriveMin)} guida ({d.estKm} km)
              </Text>
              {(expanded === idx ? d.candidates : d.candidates.slice(0, 6)).map((c) => (
                <View key={c.key} style={styles.candRow}>
                  <View style={[styles.candDot, { backgroundColor: ENTITY_COLORS[c.entityType] }]} />
                  <Text style={styles.candName} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={styles.candCity} numberOfLines={1}>
                    {c.city}
                  </Text>
                  <Text style={styles.candScore}>{c.score}</Text>
                </View>
              ))}
              {d.candidates.length > 6 && (
                <TouchableOpacity
                  onPress={() => {
                    hap.light();
                    setExpanded(expanded === idx ? null : idx);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.expandText}>{expanded === idx ? 'Mostra meno' : `Mostra tutte (${d.candidates.length})`}</Text>
                </TouchableOpacity>
              )}
              {d.candidates.length === 0 && <Text style={styles.noVisits}>Nessuna visita assegnata</Text>}
              <TouchableOpacity
                style={[styles.dayGenBtn, (d.candidates.length === 0 || genDay !== null) && { opacity: 0.5 }]}
                onPress={() => genDayTour(idx)}
                disabled={d.candidates.length === 0 || genDay !== null}
                activeOpacity={0.75}
              >
                {genDay === idx ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="sparkles" size={13} color="#FFF" />}
                <Text style={styles.dayGenText}>Genera tour del giorno</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: JAKARTA.semibold, fontSize: 12, color: DS.ink2, marginTop: 14, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    backgroundColor: DS.surface,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 13,
  },
  chipActive: { backgroundColor: AI_PURPLE, borderColor: AI_PURPLE },
  chipText: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink2 },
  chipTextActive: { color: '#FFF' },
  input: {
    backgroundColor: DS.surface,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: JAKARTA.regular,
    fontSize: 14,
    color: DS.ink,
    marginTop: 8,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 12 },
  switchLabel: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink2 },
  noZones: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted, marginTop: 10 },
  errBox: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 9,
    marginTop: 12,
  },
  errText: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 11, color: '#991B1B' },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AI_PURPLE,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
    ...SHADOWS.md,
  },
  generateBtnText: { fontFamily: JAKARTA.bold, fontSize: 14, color: '#FFF', letterSpacing: 0.4 },
  kpiLine: { fontFamily: JAKARTA.regular, fontSize: 12, color: DS.ink2, lineHeight: 18 },
  kpiBold: { fontFamily: JAKARTA.bold, color: DS.ink },
  warnBox: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    padding: 9,
    marginTop: 8,
  },
  warnText: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 11, color: '#92400E', lineHeight: 15 },
  dayCard: { backgroundColor: DS.surface, borderRadius: 12, padding: 12, marginTop: 10, ...SHADOWS.sm },
  dayHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dayTitle: { fontFamily: JAKARTA.bold, fontSize: 14, color: DS.ink },
  dayTerritory: { fontFamily: JAKARTA.semibold, fontSize: 11, color: AI_PURPLE_TEXT, marginTop: 1 },
  dayCountBadge: { backgroundColor: DS.surface2, borderRadius: 7, paddingVertical: 3, paddingHorizontal: 8 },
  dayCountText: { fontFamily: JAKARTA.semibold, fontSize: 11, color: DS.ink2 },
  dayMeta: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted, marginTop: 5, marginBottom: 6 },
  candRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DS.border,
  },
  candDot: { width: 8, height: 8, borderRadius: 4 },
  candName: { flexShrink: 1, fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink },
  candCity: { flex: 1, fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted },
  candScore: { fontFamily: JAKARTA.bold, fontSize: 12, color: DS.ink2 },
  expandText: { fontFamily: JAKARTA.semibold, fontSize: 11, color: AI_PURPLE_TEXT, marginTop: 6 },
  noVisits: { fontFamily: JAKARTA.regular, fontSize: 12, color: DS.inkMuted, paddingVertical: 8 },
  dayGenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: AI_PURPLE,
    borderRadius: 9,
    paddingVertical: 10,
    marginTop: 10,
  },
  dayGenText: { fontFamily: JAKARTA.semibold, fontSize: 12, color: '#FFF' },
});
