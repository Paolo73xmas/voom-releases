// Vista Mensile AI Tour mobile: settimane rimanenti del mese con clienti in scadenza per cadenza e carico bilanciato.
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DS, JAKARTA, SHADOWS } from '../../lib/theme';
import { hap } from '../../lib/haptics';
import { AI_PURPLE, AI_PURPLE_TEXT } from './shared';
import { loadCandidates } from '../../lib/aitour/data';
import { scoreCandidates } from '../../lib/aitour/scoring';
import { listAllZones, pointInZones, loadNeverVisitedFillers, type TerritoryZone } from '../../lib/aitour/territories';
import { buildMonthPlan, currentMonthRef, type MonthPlan } from '../../lib/aitour/month';
import type { AiTourSettings, GeoPoint } from '../../lib/aitour/types';
import { ENTITY_COLORS } from '../../lib/aitour/types';
import type { WeekPreset } from './WeekTab';

interface Props {
  agentId: string;
  settings: AiTourSettings;
  resolvePoint: (mode: string, address: string, start: GeoPoint | null) => Promise<GeoPoint | null>;
  onOpenWeek: (preset: WeekPreset) => void;
}

const DAY_BTNS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];

function monthChoices(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('it-IT', { month: 'long', year: i === 0 ? undefined : '2-digit' });
    out.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return out;
}

export function MonthTab({ agentId, settings, resolvePoint, onOpenWeek }: Props) {
  const [monthRef, setMonthRef] = useState(currentMonthRef());
  const [days, setDays] = useState([true, true, true, true, true, false]);
  const [startMode, setStartMode] = useState('current');
  const [startAddress, setStartAddress] = useState('');
  const [endMode, setEndMode] = useState('none');
  const [includeFillers, setIncludeFillers] = useState(true);
  const [useTerritory, setUseTerritory] = useState(true);
  const [zones, setZones] = useState<TerritoryZone[]>([]);
  const [planning, setPlanning] = useState(false);
  const [month, setMonth] = useState<MonthPlan | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    setMonth(null);
    listAllZones()
      .then((all) => setZones(all.filter((z) => z.agent_id === agentId)))
      .catch((err) => console.warn('[AITour][month] zones:', err));
  }, [agentId]);

  const generateMonth = async () => {
    const daysPerWeek = days.filter(Boolean).length;
    if (daysPerWeek === 0) {
      setErrMsg('Seleziona almeno un giorno');
      return;
    }
    hap.medium();
    setPlanning(true);
    setErrMsg('');
    try {
      let start: GeoPoint | null = null;
      try {
        start = await resolvePoint(startMode, startAddress, null);
      } catch {
        start = null;
      }
      const pool = await loadCandidates(agentId, settings);
      let all = scoreCandidates([...pool.clients, ...pool.prospects, ...pool.orphans], settings);
      if (useTerritory && zones.length > 0) {
        // I clienti Progetti Speciali restano pianificabili anche fuori dal territorio
        all = all.filter((c) => c.projectType || pointInZones(c.lat, c.lng, zones));
      }
      if (includeFillers) {
        try {
          const extra = await loadNeverVisitedFillers(agentId, all, useTerritory ? zones : [], settings, 300);
          if (extra.length > 0) all = [...all, ...scoreCandidates(extra, settings)];
        } catch (err) {
          console.warn('[AITour][month] fillers mai visitate:', err);
        }
      }
      if (all.length === 0) {
        setErrMsg(useTerritory && zones.length > 0 ? "Nessun soggetto nel territorio dell'agente" : 'Nessun soggetto con GPS nel portafoglio');
        return;
      }
      const plan = buildMonthPlan({ candidates: all, monthRef, daysPerWeek, settings, includeFillers, start });
      if (plan.weeks.length === 0) {
        setErrMsg('Nessuna settimana rimanente nel mese selezionato');
        return;
      }
      setMonth(plan);
      setExpanded(null);
    } catch (err) {
      console.error('[AITour][month] generate:', err);
      setErrMsg('Errore nella pianificazione del mese');
    } finally {
      setPlanning(false);
    }
  };

  const openWeek = (weekStart: string) => {
    hap.light();
    onOpenWeek({
      weekStart,
      days: [...days],
      startMode,
      startAddress,
      endMode,
      includeFillers,
      useTerritory,
      token: Date.now(),
    });
  };

  const monthLabel = new Date(monthRef + '-01T12:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

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
      <Text style={styles.label}>Mese</Text>
      <View style={styles.chipRow}>{monthChoices().map((m) => chip(m.label, monthRef === m.value, () => setMonthRef(m.value), m.value))}</View>

      <Text style={styles.label}>Giorni per settimana</Text>
      <View style={styles.chipRow}>
        {DAY_BTNS.map((d, i) => chip(d, days[i], () => setDays((prev) => prev.map((v, j) => (j === i ? !v : v))), d))}
      </View>

      <Text style={styles.label}>Partenza (per stime e settimane)</Text>
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

      <Text style={styles.label}>Rientro</Text>
      <View style={styles.chipRow}>
        {chip('Nessuno', endMode === 'none', () => setEndMode('none'))}
        {chip('Partenza', endMode === 'start', () => setEndMode('start'))}
        {!!settings.home_lat && chip('Casa', endMode === 'home', () => setEndMode('home'))}
        {!!settings.office_lat && chip('Sede', endMode === 'office', () => setEndMode('office'))}
      </View>

      <View style={styles.switchRow}>
        <Switch value={includeFillers} onValueChange={setIncludeFillers} trackColor={{ true: AI_PURPLE }} />
        <Text style={styles.switchLabel}>Riempi con prospect, orfani e mai visitate</Text>
      </View>
      {zones.length > 0 && (
        <View style={styles.switchRow}>
          <Switch value={useTerritory} onValueChange={setUseTerritory} trackColor={{ true: AI_PURPLE }} />
          <Text style={styles.switchLabel}>
            Limita al territorio ({zones.length} {zones.length === 1 ? 'area' : 'aree'})
          </Text>
        </View>
      )}

      {errMsg ? (
        <View style={styles.errBox}>
          <Ionicons name="alert-circle" size={14} color="#991B1B" />
          <Text style={styles.errText}>{errMsg}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={styles.generateBtn} onPress={generateMonth} disabled={planning} activeOpacity={0.8}>
        {planning ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="calendar-number" size={17} color="#FFF" />}
        <Text style={styles.generateBtnText}>{planning ? 'PIANIFICAZIONE...' : 'PIANIFICA MESE'}</Text>
      </TouchableOpacity>

      {month && (
        <View style={{ marginTop: 14 }}>
          <Text style={styles.kpiLine}>
            <Text style={[styles.kpiBold, { textTransform: 'capitalize' }]}>{monthLabel}</Text> · Settimane rimanenti:{' '}
            <Text style={styles.kpiBold}>{month.weeks.length}</Text> · In scadenza nel mese:{' '}
            <Text style={styles.kpiBold}>
              {month.coveredDue}/{month.totalDue}
            </Text>{' '}
            · Capacità/settimana: <Text style={styles.kpiBold}>~{month.capacityPerWeek} visite</Text>
            {month.laterDue > 0 ? ` · ${month.laterDue} scadranno nei mesi successivi` : ''}
          </Text>
          {month.unplaced.length > 0 && (
            <View style={styles.warnBox}>
              <Ionicons name="warning" size={13} color="#92400E" />
              <Text style={styles.warnText}>
                {month.unplaced.length} clienti in scadenza superano la capacità del mese:{' '}
                {month.unplaced.slice(0, 5).map((c) => c.name).join(', ')}
                {month.unplaced.length > 5 ? '...' : ''}
              </Text>
            </View>
          )}

          {month.weeks.map((w, idx) => {
            const members = [...w.due, ...w.fillers];
            return (
              <View key={w.weekStart} style={styles.weekCard}>
                <View style={styles.weekHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.weekTitle}>Settimana {w.label}</Text>
                    <Text style={styles.weekTerritory}>{w.territories || (members.length ? 'Territorio misto' : '—')}</Text>
                  </View>
                  {w.overloaded && (
                    <View style={styles.fullBadge}>
                      <Text style={styles.fullBadgeText}>piena</Text>
                    </View>
                  )}
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>
                      {members.length}/{w.capacity}
                    </Text>
                  </View>
                </View>
                <Text style={styles.weekMeta}>
                  <Text style={{ color: '#DC2626', fontFamily: JAKARTA.semibold }}>{w.due.length} in scadenza</Text> · {w.fillers.length} sviluppo
                  (prospect/orfani)
                </Text>
                {(expanded === idx ? members : members.slice(0, 6)).map((c) => (
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
                {members.length > 6 && (
                  <TouchableOpacity
                    onPress={() => {
                      hap.light();
                      setExpanded(expanded === idx ? null : idx);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.expandText}>{expanded === idx ? 'Mostra meno' : `Mostra tutte (${members.length})`}</Text>
                  </TouchableOpacity>
                )}
                {members.length === 0 && <Text style={styles.noVisits}>Nessuna visita prevista</Text>}
                <TouchableOpacity
                  style={[styles.openWeekBtn, members.length === 0 && { opacity: 0.5 }]}
                  onPress={() => openWeek(w.weekStart)}
                  disabled={members.length === 0}
                  activeOpacity={0.75}
                >
                  <Text style={styles.openWeekText}>Pianifica questa settimana</Text>
                  <Ionicons name="arrow-forward" size={14} color="#FFF" />
                </TouchableOpacity>
              </View>
            );
          })}
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
  weekCard: { backgroundColor: DS.surface, borderRadius: 12, padding: 12, marginTop: 10, ...SHADOWS.sm },
  weekHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  weekTitle: { fontFamily: JAKARTA.bold, fontSize: 14, color: DS.ink },
  weekTerritory: { fontFamily: JAKARTA.semibold, fontSize: 11, color: AI_PURPLE_TEXT, marginTop: 1 },
  fullBadge: { backgroundColor: '#FEF3C7', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 7 },
  fullBadgeText: { fontFamily: JAKARTA.semibold, fontSize: 10, color: '#92400E' },
  countBadge: { backgroundColor: DS.surface2, borderRadius: 7, paddingVertical: 3, paddingHorizontal: 8 },
  countText: { fontFamily: JAKARTA.semibold, fontSize: 11, color: DS.ink2 },
  weekMeta: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted, marginTop: 5, marginBottom: 6 },
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
  openWeekBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: AI_PURPLE,
    borderRadius: 9,
    paddingVertical: 10,
    marginTop: 10,
  },
  openWeekText: { fontFamily: JAKARTA.semibold, fontSize: 12, color: '#FFF' },
});
