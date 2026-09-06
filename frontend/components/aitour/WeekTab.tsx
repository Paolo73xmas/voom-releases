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
import { planTour } from '../../lib/aitour/planner';
import { getStrategySummary } from '../../lib/aitour/ai';
import { saveToursBatch } from '../../lib/aitour/tours';
import { fetchFollowUpsForDates, fetchOverdueFollowUps, type PendingFollowUp, type OverdueFollowUp } from '../../lib/aitour/followups';
import { TourNameDialog } from './TourNameDialog';
import type { AiTourSettings, GeoPoint, TourPlan, TourCandidate } from '../../lib/aitour/types';
import { ENTITY_COLORS, fmtDur, timeToMin } from '../../lib/aitour/types';

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
  onGenerateDay: (day: WeekDayPlan, start: GeoPoint, end: GeoPoint | null, mandatoryKeys?: Set<string>) => Promise<void>;
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
  // Salva tutta la settimana in un colpo solo (nome + RPC atomica)
  const [saveOpen, setSaveOpen] = useState(false);
  const [savingWeek, setSavingWeek] = useState(false);
  const [saveProgress, setSaveProgress] = useState('');
  const [okMsg, setOkMsg] = useState('');
  // Follow-up in agenda per i giorni pianificati + follow-up scaduti mai gestiti
  const [weekPool, setWeekPool] = useState<TourCandidate[]>([]);
  const [weekFu, setWeekFu] = useState<Record<string, PendingFollowUp[]>>({});
  const [wfuIgnored, setWfuIgnored] = useState<Set<string>>(new Set());
  const [weekOverdue, setWeekOverdue] = useState<OverdueFollowUp[]>([]);
  const [wOverdueSel, setWOverdueSel] = useState<Set<string>>(new Set());

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
            // Timeout esplicito: se il registro risponde lento, si pianifica senza fillers (mai hang)
            const extra = await Promise.race([
              loadNeverVisitedFillers(agentId, all, v.useTerritory ? myZones : [], settings, 150),
              new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout fillers (15s)')), 15000)),
            ]);
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
        // Follow-up in agenda per i giorni pianificati + follow-up scaduti mai gestiti
        setWeekPool(all);
        setWfuIgnored(new Set());
        setWOverdueSel(new Set());
        setWeekFu({});
        setWeekOverdue([]);
        try {
          const [fu, od] = await Promise.all([
            fetchFollowUpsForDates(agentId, plan.days.map((d) => d.date)),
            fetchOverdueFollowUps(agentId),
          ]);
          setWeekFu(fu);
          const fuIds = new Set(Object.values(fu).flat().map((f) => f.customerId));
          setWeekOverdue(od.filter((o) => !fuIds.has(o.customerId)));
        } catch (err) {
          console.warn('[AITour][week] follow-up agenda:', err);
        }
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
      const adj = applyFollowUps(week.days[idx], followUpTargets());
      await onGenerateDay({ ...week.days[idx], candidates: adj.candidates }, startPoint, endPoint, adj.mandatory);
    } finally {
      setGenDay(null);
    }
  };

  const fmtIt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });

  // Mappa cliente -> giorno di destinazione dei follow-up considerati (scaduti -> primo giorno)
  const followUpTargets = (): Map<string, { date: string; time?: string; overdueDate?: string }> => {
    const map = new Map<string, { date: string; time?: string; overdueDate?: string }>();
    if (!week) return map;
    for (const d of week.days) {
      for (const f of weekFu[d.date] || []) {
        if (!wfuIgnored.has(`${d.date}|${f.customerId}`)) map.set(f.customerId, { date: d.date, time: f.time });
      }
    }
    const firstDate = week.days[0]?.date;
    if (firstDate) {
      for (const o of weekOverdue) {
        if (wOverdueSel.has(o.customerId) && !map.has(o.customerId)) map.set(o.customerId, { date: firstDate, overdueDate: o.date });
      }
    }
    return map;
  };

  // Applica i follow-up considerati a un giorno: tappa obbligatoria nel giorno giusto, rimossa dagli altri
  const applyFollowUps = (d: WeekDayPlan, targets: Map<string, { date: string; time?: string; overdueDate?: string }>) => {
    let cands = d.candidates.filter((c) => {
      const t = c.customerId ? targets.get(c.customerId) : undefined;
      return !t || t.date === d.date;
    });
    const mandatory = new Set<string>();
    for (const [cid, t] of targets) {
      if (t.date !== d.date) continue;
      const found = weekPool.find((c) => c.customerId === cid);
      if (!found) continue;
      cands = cands.filter((c) => c.customerId !== cid);
      const cand: TourCandidate = {
        ...found,
        isFollowUp: true,
        reason: t.overdueDate
          ? `Follow-up SCADUTO del ${fmtIt(t.overdueDate)} mai gestito. ${found.reason}`
          : `Follow-up in agenda${t.time ? ` alle ${t.time}` : ''}. ${found.reason}`,
        ...(t.time && !t.overdueDate
          ? { preferredSlots: [{ id: `fu_${cid}`, label: `follow-up ore ${t.time}`, start: timeToMin(t.time), end: timeToMin(t.time) }] }
          : {}),
      };
      cands.push(cand);
      mandatory.add(cand.key);
    }
    return { candidates: cands, mandatory };
  };

  const toggleWfu = (date: string, customerId: string) => {
    hap.light();
    setWfuIgnored((prev) => {
      const key = `${date}|${customerId}`;
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleWOverdue = (customerId: string) => {
    hap.light();
    setWOverdueSel((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId); else next.add(customerId);
      return next;
    });
  };

  const totalVisits = week ? week.days.reduce((s, d) => s + d.candidates.length, 0) : 0;
  const savableDays = week ? week.days.filter((d) => d.candidates.length > 0).length : 0;

  // Salva tutta la settimana: calcola il percorso dettagliato di ogni giorno e
  // salva TUTTI i tour in una sola chiamata server-side atomica (o tutti o nessuno).
  const confirmSaveWeek = async (name: string) => {
    if (!week || !startPoint) return;
    setSavingWeek(true);
    setOkMsg('');
    setErrMsg('');
    try {
      const targets = followUpTargets();
      const adjDays = week.days
        .map((d) => ({ d, adj: applyFollowUps(d, targets) }))
        .filter((x) => x.adj.candidates.length > 0);
      const plans: TourPlan[] = [];
      for (const { d, adj } of adjDays) {
        setSaveProgress(`Calcolo percorso di ${d.dow} (${plans.length + 1}/${adjDays.length})...`);
        const p = await planTour({
          candidates: adj.candidates,
          mandatoryKeys: adj.mandatory,
          start: startPoint,
          end: endPoint,
          tourDate: d.date,
          startMin: timeToMin(settings.work_start),
          endMin: timeToMin(settings.work_end),
          dayType: 'mista',
          resolvedDayType: 'mista',
          bufferPct: settings.buffer_pct_mista,
          bufferMaxMin: settings.buffer_max_min,
          area: { mode: 'auto' },
        });
        if (p.stops.length > 0) {
          p.areaLabel = d.label;
          plans.push(p);
        }
      }
      if (plans.length === 0) {
        setErrMsg("Nessuna visita pianificabile nell'orario configurato");
        return;
      }
      setSaveProgress("L'AI sta scrivendo la strategia di ogni giornata...");
      await Promise.all(plans.map(async (p) => {
        try { p.aiSummary = await getStrategySummary(p); } catch { p.aiSummary = ''; }
      }));
      setSaveProgress('Salvataggio sul server...');
      const ids = await saveToursBatch(agentId, plans, name);
      setOkMsg(`${ids.length} tour salvati${name ? ` con nome "${name}"` : ''}: li trovi in "I miei Tour"`);
      setSaveOpen(false);
      hap.success();
    } catch (err) {
      console.error('[AITour][week] salva settimana:', err);
      setErrMsg('Errore nel salvataggio della settimana: nessun tour salvato');
    } finally {
      setSavingWeek(false);
      setSaveProgress('');
    }
  };

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
          {okMsg ? (
            <View style={styles.okBox}>
              <Ionicons name="checkmark-circle" size={14} color="#047857" />
              <Text style={styles.okText}>{okMsg}</Text>
            </View>
          ) : null}
          {savableDays > 0 && (
            <TouchableOpacity
              style={[styles.saveWeekBtn, (genDay !== null || savingWeek) && { opacity: 0.5 }]}
              onPress={() => {
                hap.medium();
                setSaveOpen(true);
              }}
              disabled={genDay !== null || savingWeek}
              activeOpacity={0.8}
            >
              {savingWeek ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="save-outline" size={15} color="#FFF" />}
              <Text style={styles.saveWeekText}>
                {savingWeek ? 'SALVATAGGIO...' : `SALVA SETTIMANA (${savableDays} ${savableDays === 1 ? 'giorno' : 'giorni'})`}
              </Text>
            </TouchableOpacity>
          )}
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
          {weekOverdue.length > 0 && (
            <View style={styles.odPanel} testID="week-overdue-panel">
              <View style={styles.fuPanelHeader}>
                <Ionicons name="warning-outline" size={13} color="#991B1B" />
                <Text style={styles.odPanelTitle}>
                  {weekOverdue.length === 1 ? '1 follow-up SCADUTO mai gestito' : `${weekOverdue.length} follow-up SCADUTI mai gestiti`} (ultimi 60 giorni)
                </Text>
              </View>
              <Text style={styles.odPanelHint}>
                Spunta quelli da recuperare: verranno inseriti come tappe obbligatorie nel primo giorno della settimana.
              </Text>
              {weekOverdue.map((o) => {
                const on = wOverdueSel.has(o.customerId);
                return (
                  <TouchableOpacity
                    key={o.customerId}
                    style={[styles.fuItemRow, { borderColor: '#FECACA' }]}
                    onPress={() => toggleWOverdue(o.customerId)}
                    activeOpacity={0.7}
                    testID={`week-overdue-item-${o.customerId}`}
                  >
                    <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? '#DC2626' : DS.inkMuted} />
                    <Text style={styles.fuItemName} numberOfLines={1}>
                      {o.businessName}
                      {o.city ? <Text style={styles.fuItemCity}> · {o.city}</Text> : null}
                    </Text>
                    <Text style={styles.odItemDate}>era per il {fmtIt(o.date)}</Text>
                  </TouchableOpacity>
                );
              })}
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
              {(weekFu[d.date] || []).length > 0 && (
                <View style={styles.fuPanel} testID={`week-followup-panel-${idx}`}>
                  <View style={styles.fuPanelHeader}>
                    <Ionicons name="calendar-outline" size={13} color="#86198F" />
                    <Text style={styles.fuPanelTitle}>Follow-up in agenda ({(weekFu[d.date] || []).length})</Text>
                  </View>
                  {(weekFu[d.date] || []).map((f) => {
                    const on = !wfuIgnored.has(`${d.date}|${f.customerId}`);
                    return (
                      <TouchableOpacity
                        key={f.customerId}
                        style={styles.fuItemRow}
                        onPress={() => toggleWfu(d.date, f.customerId)}
                        activeOpacity={0.7}
                        testID={`week-followup-item-${idx}-${f.customerId}`}
                      >
                        <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? '#C026D3' : DS.inkMuted} />
                        <Text style={styles.fuItemName} numberOfLines={1}>
                          {f.businessName}
                        </Text>
                        <Text style={styles.fuItemTime}>ore {f.time}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  <Text style={styles.fuPanelHint}>Spuntati = tappa obbligatoria nel giro del giorno</Text>
                </View>
              )}
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
                style={[
                  styles.dayGenBtn,
                  ((d.candidates.length === 0 && !(weekFu[d.date] || []).some((f) => !wfuIgnored.has(`${d.date}|${f.customerId}`))) || genDay !== null) && { opacity: 0.5 },
                ]}
                onPress={() => genDayTour(idx)}
                disabled={(d.candidates.length === 0 && !(weekFu[d.date] || []).some((f) => !wfuIgnored.has(`${d.date}|${f.customerId}`))) || genDay !== null}
                activeOpacity={0.75}
              >
                {genDay === idx ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="sparkles" size={13} color="#FFF" />}
                <Text style={styles.dayGenText}>Genera tour del giorno</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Nome del blocco di tour della settimana */}
      <TourNameDialog
        visible={saveOpen}
        title={`Salva settimana (${savableDays} ${savableDays === 1 ? 'giorno' : 'giorni'})`}
        description="Calcolo il percorso dettagliato di ogni giorno e salvo tutti i tour in un colpo solo: o tutti o nessuno."
        saving={savingWeek}
        progress={saveProgress}
        onClose={() => { if (!savingWeek) setSaveOpen(false); }}
        onConfirm={confirmSaveWeek}
      />
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
  okBox: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
    padding: 9,
    marginTop: 8,
  },
  okText: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 11, color: '#047857' },
  saveWeekBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#059669',
    borderRadius: 11,
    paddingVertical: 12,
    marginTop: 10,
  },
  saveWeekText: { fontFamily: JAKARTA.bold, fontSize: 12.5, color: '#FFF', letterSpacing: 0.3 },
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
  // Pannelli follow-up in agenda / scaduti (parità web: fucsia = agenda, rosso = scaduti)
  fuPanel: { backgroundColor: '#FDF4FF', borderWidth: 1, borderColor: '#F0ABFC', borderRadius: 8, padding: 8, marginBottom: 6 },
  odPanel: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 8, padding: 8, marginTop: 8 },
  fuPanelHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  fuPanelTitle: { flex: 1, fontFamily: JAKARTA.bold, fontSize: 11, color: '#86198F' },
  odPanelTitle: { flex: 1, fontFamily: JAKARTA.bold, fontSize: 11, color: '#991B1B' },
  fuPanelHint: { fontFamily: JAKARTA.regular, fontSize: 9.5, color: '#A21CAF', marginTop: 4, lineHeight: 13 },
  odPanelHint: { fontFamily: JAKARTA.regular, fontSize: 10, color: '#B91C1C', marginTop: 3, marginBottom: 4, lineHeight: 13 },
  fuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F5D0FE',
    borderRadius: 7,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 4,
  },
  fuItemName: { flex: 1, fontFamily: JAKARTA.semibold, fontSize: 11.5, color: '#1E293B' },
  fuItemCity: { fontFamily: JAKARTA.regular, color: '#64748B' },
  fuItemTime: { fontFamily: JAKARTA.bold, fontSize: 11, color: '#A21CAF' },
  odItemDate: { fontFamily: JAKARTA.bold, fontSize: 10.5, color: '#B91C1C' },
});
