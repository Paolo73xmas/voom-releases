// AI Tour mobile: assistente AI per la pianificazione dei giri visita (parità logica con la web app).
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  RefreshControl,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { DS, JAKARTA, SHADOWS, COLORS, currentThemeMode } from '../lib/theme';
import { hap } from '../lib/haptics';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { listAllZones, pointInZones, zoneLabel, intersectDrawnWithZones, type TerritoryZone } from '../lib/aitour/territories';
import { loadCandidates, loadFreeTabaccherie, type CandidatePool } from '../lib/aitour/data';
import { scoreCandidates, computePortfolioStats } from '../lib/aitour/scoring';
import { planTour, planFixedOrder, filterByArea, pickBestCluster, candidatesForDayType, sweepPartition, type AreaFilter } from '../lib/aitour/planner';
import { getStrategySummary, recommendDayType } from '../lib/aitour/ai';
import { getSettings, saveTour, saveToursBatch, listTours, loadTourStops, deleteTour, replaceTourPlan, type SavedTour } from '../lib/aitour/tours';
import { getActiveTour, loadLiveState, startLiveTour, type LiveState } from '../lib/aitour/live';
import { geocodeAddress } from '../lib/aitour/osrm';
import { LiveTourView } from '../components/aitour/LiveTourView';
import { TourMapView, type TourMapStop } from '../components/aitour/TourMapView';
import { PortfolioTab } from '../components/aitour/PortfolioTab';
import { TourEditModal } from '../components/aitour/TourEditModal';
import { DrawAreasMap } from '../components/aitour/DrawAreasMap';
import { BriefModal } from '../components/aitour/BriefModal';
import { TourNameDialog } from '../components/aitour/TourNameDialog';
import { selectCandidatesV4, resolveStopRefs, applyAppointment, targetCap, withinRadiusOfAnchors, type TourBriefV4 } from '../lib/aitour/brief-v4';
import { WeekTab, type WeekPreset } from '../components/aitour/WeekTab';
import { MonthTab } from '../components/aitour/MonthTab';
import { CandidateEntityBadge } from '../components/aitour/OrphanHistoryBadge';
import { AI_PURPLE, AI_PURPLE_SOFT, AI_PURPLE_TEXT, AI_PURPLE_BORDER, openNavigation } from '../components/aitour/shared';
import type { TourPlan, GeoPoint, AiTourSettings, DayType, EntityType, PriorityClass, TourCandidate } from '../lib/aitour/types';
import { DEFAULT_SETTINGS, timeToMin, minToTime, fmtDur, fmtEur, haversineKm, ENTITY_LABELS, ENTITY_COLORS } from '../lib/aitour/types';
import type { WeekDayPlan } from '../lib/aitour/week';

const PRIORITY_COLORS: Record<PriorityClass, string> =
  currentThemeMode === 'dark'
    ? { Urgente: '#F87171', Alta: '#A78BFA', Media: '#FBBF24', Bassa: '#94A3B8' }
    : { Urgente: '#DC2626', Alta: '#8B5CF6', Media: '#D97706', Bassa: '#64748B' };

const DAY_TYPES: { value: DayType; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'clienti', label: 'Giro Clienti', desc: 'Clienti già acquisiti da rivisitare', icon: 'people-outline' },
  { value: 'sviluppo', label: 'Sviluppo Territorio', desc: 'Prospect, orfani, mai visitate e recuperi', icon: 'compass-outline' },
  { value: 'mista', label: 'Giornata Mista', desc: 'Mix ragionato di clienti e sviluppo', icon: 'shuffle-outline' },
  { value: 'ai', label: 'Decidi tu AI', desc: "L'AI analizza il portafoglio e sceglie", icon: 'sparkles-outline' },
];

type StartMode = 'current' | 'address' | 'home' | 'office';
type EndMode = 'none' | 'start' | 'address' | 'home' | 'office';
type AreaMode = 'auto' | 'territory' | 'province' | 'city' | 'radius' | 'draw';

interface FormValues {
  date: string;
  startTime: string;
  endTime: string;
  startMode: StartMode;
  startAddress: string;
  endMode: EndMode;
  endAddress: string;
  dayType: DayType;
  areaMode: AreaMode;
  province: string;
  city: string;
  radiusKm: string;
  mandatoryCustomerIds: string[];
  /** Orario preferenziale di arrivo per le visite obbligatorie (customerId -> "HH:MM", vuoto = nessuna preferenza) */
  mandatoryTimes: Record<string, string>;
  /** Zone del territorio selezionate (vuoto = tutte) */
  territoryZoneIds: string[];
  /** Aree disegnate a mano sulla mappa (anelli GeoJSON [lng,lat]) per areaMode='draw' */
  drawnRings: number[][][];
}

const localDateStr = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Tour di oggi: l'orario di inizio proposto è l'ora attuale (arrotondata ai 5 min), non un work_start già passato
function autoStartTime(date: string, workStart: string): string {
  if (date !== localDateStr()) return workStart;
  const now = new Date();
  const nowMin = Math.min(Math.ceil((now.getHours() * 60 + now.getMinutes()) / 5) * 5, 23 * 60 + 55);
  return nowMin > timeToMin(workStart) ? minToTime(nowMin) : workStart;
}

function dateChipLabel(offset: number): { top: string; bottom: string } {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const dow = d.toLocaleDateString('it-IT', { weekday: 'short' });
  const dm = d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
  if (offset === 0) return { top: 'Oggi', bottom: dm };
  if (offset === 1) return { top: 'Domani', bottom: dm };
  return { top: dow.charAt(0).toUpperCase() + dow.slice(1), bottom: dm };
}

function fmtTourDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' });
}

const TOUR_TYPE_LABELS: Record<string, string> = {
  clienti: 'Giro Clienti',
  sviluppo: 'Sviluppo',
  mista: 'Mista',
  ai: 'AI',
};

// Uscita volontaria dalla vista live (per tour id): niente rientro automatico
// finché l'utente non tocca "Riprendi vista live" (flag di sessione app)
const liveExitFlags = new Set<string>();

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  planned: { label: 'Pianificato', color: '#1D4ED8', bg: '#DBEAFE' },
  active: { label: 'In corso', color: '#047857', bg: '#D1FAE5' },
  completed: { label: 'Completato', color: COLORS.textSecondary, bg: '#E5E7EB' },
  cancelled: { label: 'Annullato', color: '#991B1B', bg: '#FEE2E2' },
};

// Promessa con timeout garantito: risolve comunque null se non si conclude entro ms.
// Necessario perché alcune API native di expo-location (getForegroundPermissionsAsync,
// getLastKnownPositionAsync) possono NON risolversi mai su iOS/Expo Go: un semplice
// .catch non basta, serve un timer che sblocca sempre la UI.
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      () => { clearTimeout(t); resolve(null); }
    );
  });
}

async function getCurrentPositionMobile(onPhase?: (msg: string) => void): Promise<{ lat: number; lng: number } | null> {
  try {
    onPhase?.('permessi posizione');
    let perm = await withTimeout(Location.getForegroundPermissionsAsync(), 4000);
    if (!perm || perm.status !== 'granted') {
      if (!perm || perm.canAskAgain) {
        // Qui può comparire il popup di sistema: attende legittimamente l'utente
        perm = await Location.requestForegroundPermissionsAsync().catch(() => null);
      }
      if (!perm || perm.status !== 'granted') {
        Alert.alert(
          'Posizione non disponibile',
          'Per partire dalla tua posizione serve il permesso di localizzazione. Puoi abilitarlo dalle impostazioni o usare un indirizzo manuale.',
          [
            { text: 'Annulla', style: 'cancel' },
            { text: 'Apri Impostazioni', onPress: () => Linking.openSettings() },
          ]
        );
        return null;
      }
    }
    onPhase?.('lettura GPS');
    // Ultima posizione nota e GPS attuale in parallelo, OGNUNA con timeout proprio:
    // se una delle due non risponde mai, l'altra (o il timeout) sblocca comunque.
    const lastP = withTimeout(Location.getLastKnownPositionAsync({ maxAge: 300000 }), 4000);
    const current = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      9000
    );
    const pos = current || (await lastP);
    if (!pos) return null;
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (e) {
    console.warn('[AITour] posizione corrente:', e);
    return null;
  }
}

export default function AITourScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const agentId = user?.id || '';

  const [tab, setTab] = useState<'genera' | 'settimana' | 'mensile' | 'portafoglio' | 'tours'>('genera');
  const [phase, setPhase] = useState<'form' | 'result'>('form');
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [activePausedTour, setActivePausedTour] = useState<SavedTour | null>(null);
  const [starting, setStarting] = useState(false);
  const [weekPreset, setWeekPreset] = useState<WeekPreset | null>(null);
  const [settings, setSettings] = useState<AiTourSettings>({ ...DEFAULT_SETTINGS });
  const [agentZones, setAgentZones] = useState<TerritoryZone[]>([]);
  const [form, setForm] = useState<FormValues>({
    date: localDateStr(),
    startTime: autoStartTime(localDateStr(), DEFAULT_SETTINGS.work_start),
    endTime: DEFAULT_SETTINGS.work_end,
    startMode: 'current',
    startAddress: '',
    endMode: 'none',
    endAddress: '',
    dayType: 'ai',
    areaMode: 'auto',
    province: '',
    city: '',
    radiusKm: '15',
    mandatoryCustomerIds: [],
    mandatoryTimes: {},
    territoryZoneIds: [],
    drawnRings: [],
  });
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const [infoMsg, setInfoMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');
  const [plan, setPlan] = useState<TourPlan | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [savedTourId, setSavedTourId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const [resultView, setResultView] = useState<'list' | 'map'>('list');

  // "Dillo all'AI": brief in linguaggio naturale + giro (eventuale) su 2 giorni
  const [briefOpen, setBriefOpen] = useState(false);
  // Tour multi-giornata: piani per giorno + giorno visualizzato
  const [dayPlans, setDayPlans] = useState<TourPlan[] | null>(null);
  const [dayIdx, setDayIdx] = useState(0);
  // Giro troppo grande per una giornata: contesto per proporre la strutturazione multi-giorno
  const [multiDayAsk, setMultiDayAsk] = useState<{
    // 'leftover': il giorno 1 resta com'è, si pianificano solo gli esclusi;
    // 'overflow': le tappe obbligatorie sforano l'orario → si ripianifica tutto da zero sui giorni
    mode: 'leftover' | 'overflow';
    overrunMin?: number;
    leftover: TourCandidate[];
    start: GeoPoint;
    end: GeoPoint | null;
    baseDate: string;
    startMin: number;
    endMin: number;
    dayType: DayType;
    resolvedDayType: Exclude<DayType, 'ai'>;
    bufferPct: number;
    area: AreaFilter;
    areaLabel: string;
    returnFlexible?: boolean;
    maxDays?: number | null;
  } | null>(null);
  // Salvataggio con nome
  const [saveNameOpen, setSaveNameOpen] = useState(false);

  // Modifica giro (post-generazione e su tour salvato non ancora avviato)
  const [pool, setPool] = useState<CandidatePool | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [loadingPool, setLoadingPool] = useState(false);
  const [recalcing, setRecalcing] = useState(false);
  const [viewedTourStatus, setViewedTourStatus] = useState<string | null>(null);
  const allCandidates = useMemo(() => (pool ? [...pool.clients, ...pool.prospects, ...pool.orphans] : []), [pool]);
  const briefProjects = useMemo(
    () => (pool ? ([...new Set([...pool.clients, ...pool.prospects].map((c) => c.projectName).filter(Boolean))] as string[]) : []),
    [pool]
  );
  const briefCities = useMemo(
    () => (pool ? ([...new Set([...pool.clients, ...pool.prospects, ...pool.orphans].map((c) => c.city).filter(Boolean))] as string[]) : []),
    [pool]
  );

  // Visite obbligatorie
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<
    { id: string; business_name: string; city: string | null; address: string | null; contact_name: string | null; contact_surname: string | null }[]
  >([]);
  const [selectedMandatory, setSelectedMandatory] = useState<{ id: string; business_name: string }[]>([]);

  // Tour salvati
  const [savedTours, setSavedTours] = useState<SavedTour[]>([]);
  const [loadingTours, setLoadingTours] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    setPool(null);
    getSettings(agentId).then((s) => {
      setSettings(s);
      setForm((old) => ({ ...old, startTime: autoStartTime(old.date, s.work_start), endTime: s.work_end }));
    });
    listAllZones()
      .then((z) => {
        const mine = z.filter((x) => x.agent_id === agentId);
        setAgentZones(mine);
        if (mine.length > 0) {
          // Nessuna zona preselezionata: è l'agente a scegliere dove andare (parità web)
          setForm((old) => ({
            ...old,
            areaMode: old.areaMode === 'auto' ? 'territory' : old.areaMode,
            territoryZoneIds: [],
          }));
        }
      })
      .catch(() => setAgentZones([]));
    // Riprendi automaticamente un tour live in corso (a meno che l'utente non sia uscito volontariamente)
    getActiveTour(agentId).then(async (t) => {
      if (t) {
        if (liveExitFlags.has(t.id)) {
          setActivePausedTour(t);
        } else {
          setActivePausedTour(null);
          try {
            setLiveState(await loadLiveState(t));
          } catch (err) {
            console.warn('[AITour] resume live:', err);
          }
        }
      } else {
        setActivePausedTour(null);
      }
    });
  }, [agentId]);

  // Ricerca clienti per visite obbligatorie
  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      // Ricerca su ragione sociale, nome/cognome referente, indirizzo e città (parità web)
      const q = search.trim().replace(/[,()]/g, ' ').trim();
      const pat = `%${q}%`;
      const { data } = await supabase
        .from('customers')
        .select('id, business_name, city, address, contact_name, contact_surname')
        .eq('agent_id', agentId)
        .not('latitude', 'is', null)
        .or(`business_name.ilike.${pat},contact_name.ilike.${pat},contact_surname.ilike.${pat},address.ilike.${pat},city.ilike.${pat}`)
        .limit(10);
      setResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [search, agentId]);

  const loadSavedTours = useCallback(async () => {
    if (!agentId) return;
    setLoadingTours(true);
    try {
      setSavedTours(await listTours(agentId));
    } catch (e) {
      console.error('[AITour] listTours:', e);
    } finally {
      setLoadingTours(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (tab === 'tours') loadSavedTours();
  }, [tab, loadSavedTours]);

  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => setForm((old) => ({ ...old, [k]: val }));

  const stepTime = (field: 'startTime' | 'endTime', deltaMin: number) => {
    hap.light();
    setForm((old) => {
      const next = Math.min(23 * 60 + 45, Math.max(0, timeToMin(old[field]) + deltaMin));
      return { ...old, [field]: minToTime(next) };
    });
  };

  const addMandatory = (r: { id: string; business_name: string }) => {
    hap.light();
    if (!selectedMandatory.find((s) => s.id === r.id)) {
      const next = [...selectedMandatory, r];
      setSelectedMandatory(next);
      set('mandatoryCustomerIds', next.map((s) => s.id));
    }
    setSearch('');
    setResults([]);
  };

  const removeMandatory = (id: string) => {
    const next = selectedMandatory.filter((s) => s.id !== id);
    setSelectedMandatory(next);
    set('mandatoryCustomerIds', next.map((s) => s.id));
    setForm((old) => {
      const times = { ...old.mandatoryTimes };
      delete times[id];
      return { ...old, mandatoryTimes: times };
    });
  };

  const resolvePoint = useCallback(
    async (mode: string, address: string, start: GeoPoint | null, onPhase?: (msg: string) => void): Promise<GeoPoint | null> => {
      if (mode === 'none') return null;
      if (mode === 'start') return start;
      if (mode === 'current') {
        const p = await getCurrentPositionMobile(onPhase);
        return p ? { ...p, label: 'Posizione corrente' } : null;
      }
      if (mode === 'home') return settings.home_lat ? { lat: settings.home_lat, lng: settings.home_lng as number, label: 'Casa' } : null;
      if (mode === 'office') return settings.office_lat ? { lat: settings.office_lat, lng: settings.office_lng as number, label: 'Sede' } : null;
      if (mode === 'address' && address.trim()) {
        const g = await geocodeAddress(address.trim());
        return g ? { lat: g.lat, lng: g.lng, label: address.trim() } : null;
      }
      return null;
    },
    [settings]
  );

  const generate = async () => {
    if (!agentId) return;
    hap.medium();
    // Territorio con più zone: l'agente deve scegliere dove andare (nessuna zona preselezionata)
    if (form.areaMode === 'territory' && agentZones.length > 1 && form.territoryZoneIds.length === 0) {
      setErrMsg('Seleziona almeno una zona del territorio per il giro (tocca le zone in cui vuoi andare)');
      return;
    }
    if (form.areaMode === 'draw' && form.drawnRings.length === 0) {
      setErrMsg("Disegna almeno un'area sulla mappa per generare il giro");
      return;
    }
    setGenerating(true);
    setInfoMsg('');
    setErrMsg('');
    setSavedTourId(null);
    setShowExcluded(false);
    setDayPlans(null);
    setDayIdx(0);
    setMultiDayAsk(null);
    const v = form;
    try {
      // Tour di oggi: l'orario di inizio effettivo non può essere nel passato
      const nowDt = new Date();
      const today = localDateStr();
      let effStartMin = timeToMin(v.startTime);
      if (v.date === today) {
        const nowMin = nowDt.getHours() * 60 + nowDt.getMinutes();
        if (nowMin > effStartMin) {
          effStartMin = nowMin;
          setInfoMsg(`Tour di oggi: partenza adeguata all'ora attuale (${minToTime(nowMin)})`);
        }
      }
      if (effStartMin >= timeToMin(v.endTime)) {
        setErrMsg("L'orario di fine è già passato: modifica l'orario o la data del tour");
        setGenerating(false);
        return;
      }

      setProgress('Determino il punto di partenza...');
      // Timeout complessivo di sicurezza: qualunque blocco imprevisto in questa fase
      // termina comunque con un messaggio, mai con la schermata bloccata.
      let start = await withTimeout(
        resolvePoint(v.startMode, v.startAddress, null, (m) => setProgress(`Determino il punto di partenza... (${m})`)),
        30000
      );
      // GPS non disponibile (permesso negato o segnale assente): fallback automatico
      // su Sede/Casa se configurate, così il giro si genera comunque.
      if (!start && v.startMode === 'current') {
        if (settings.office_lat) start = { lat: settings.office_lat, lng: settings.office_lng as number, label: 'Sede' };
        else if (settings.home_lat) start = { lat: settings.home_lat, lng: settings.home_lng as number, label: 'Casa' };
        if (start) {
          const fb = `GPS non disponibile: parto dalla ${start.label} (abilita la localizzazione per partire dalla tua posizione)`;
          setInfoMsg((old) => (old ? `${old} • ${fb}` : fb));
        }
      }
      if (!start) {
        setErrMsg(
          v.startMode === 'current'
            ? 'Posizione non disponibile: consenti la localizzazione a Expo Go/VOOM nelle impostazioni del telefono, oppure imposta Sede/Casa o un indirizzo di partenza'
            : 'Punto di partenza non valido'
        );
        setGenerating(false);
        return;
      }
      const end = await resolvePoint(v.endMode, v.endAddress, start);

      // Aree disegnate a mano: fail-fast PRIMA delle chiamate costose (portafoglio/AI)
      const drawnZones = v.areaMode === 'draw' ? intersectDrawnWithZones(v.drawnRings, agentZones) : [];
      if (v.areaMode === 'draw' && drawnZones.length === 0) {
        setErrMsg('Le aree disegnate non toccano le tue zone assegnate: ridisegnale dentro le zone');
        setGenerating(false);
        return;
      }

      setProgress('Analisi del portafoglio commerciale...');
      const loaded = await loadCandidates(agentId, settings);
      scoreCandidates([...loaded.clients, ...loaded.prospects, ...loaded.orphans], settings);
      setPool(loaded);
      setViewedTourStatus(null);

      let resolved: Exclude<DayType, 'ai'> = v.dayType === 'ai' ? 'mista' : v.dayType;
      let recommendation: string | null = null;
      if (v.dayType === 'ai') {
        setProgress("L'AI sta valutando il tipo di giornata...");
        const rec = await recommendDayType(computePortfolioStats(loaded));
        resolved = rec.dayType;
        recommendation = rec.motivation;
      }

      setProgress('Selezione visite e clustering territoriale...');
      let candidates = candidatesForDayType(loaded, resolved);
      const radiusKm = Math.max(3, Math.min(120, Number(v.radiusKm) || 15));
      // Zone territorio selezionate nel form (vuoto = tutte)
      const zonesForTour =
        v.areaMode === 'territory' && v.territoryZoneIds.length > 0
          ? agentZones.filter((z) => v.territoryZoneIds.includes(z.id))
          : agentZones;
      const isTerritory = v.areaMode === 'territory' || v.areaMode === 'draw';
      const territoryZones = v.areaMode === 'draw' ? drawnZones : zonesForTour;
      const area: AreaFilter = {
        mode: isTerritory ? 'territory' : (v.areaMode as Exclude<AreaMode, 'territory' | 'draw'>),
        province: v.province,
        city: v.city,
        radiusKm,
        zones: isTerritory ? territoryZones : undefined,
      };
      candidates = filterByArea(candidates, area, start);
      let areaLabel =
        v.areaMode === 'draw'
          ? `aree disegnate sulla mappa (${v.drawnRings.length})`
          : v.areaMode === 'territory'
          ? zonesForTour.map((z) => zoneLabel(z)).join(' + ') || 'territorio assegnato'
          : v.areaMode === 'province'
            ? `provincia ${v.province}`
            : v.areaMode === 'city'
              ? v.city
              : v.areaMode === 'radius'
                ? `entro ${radiusKm} km`
                : '';
      if (v.areaMode === 'auto') {
        const cluster = pickBestCluster(candidates, start);
        candidates = cluster.list;
        areaLabel = cluster.label;
      }

      // Sviluppo/mista: aggiungi tabaccherie libere e mai visitate nel territorio scelto
      if (resolved === 'sviluppo' || resolved === 'mista') {
        let bounds = { minLat: 35, maxLat: 47.5, minLng: 6, maxLng: 19 };
        const filters: { provincia?: string; comune?: string; refLat: number; refLng: number } = { refLat: start.lat, refLng: start.lng };
        if (isTerritory && territoryZones.length > 0) {
          let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
          for (const z of territoryZones) {
            for (const pt of z.geometry.coordinates[0]) {
              const [lng, lat] = pt as [number, number];
              minLat = Math.min(minLat, lat);
              maxLat = Math.max(maxLat, lat);
              minLng = Math.min(minLng, lng);
              maxLng = Math.max(maxLng, lng);
            }
          }
          bounds = { minLat: minLat - 0.01, maxLat: maxLat + 0.01, minLng: minLng - 0.01, maxLng: maxLng + 0.01 };
          filters.refLat = (minLat + maxLat) / 2;
          filters.refLng = (minLng + maxLng) / 2;
        } else if (v.areaMode === 'province' && v.province) {
          filters.provincia = v.province;
        } else if (v.areaMode === 'city' && v.city) {
          filters.comune = v.city;
        } else if (v.areaMode === 'radius') {
          const dLat = radiusKm / 111;
          const dLng = radiusKm / (111 * Math.cos((start.lat * Math.PI) / 180));
          bounds = { minLat: start.lat - dLat, maxLat: start.lat + dLat, minLng: start.lng - dLng, maxLng: start.lng + dLng };
        } else {
          let minLat = start.lat, maxLat = start.lat, minLng = start.lng, maxLng = start.lng;
          for (const c of candidates) {
            minLat = Math.min(minLat, c.lat);
            maxLat = Math.max(maxLat, c.lat);
            minLng = Math.min(minLng, c.lng);
            maxLng = Math.max(maxLng, c.lng);
          }
          const pad = candidates.length === 0 ? 0.09 : 0.04;
          bounds = { minLat: minLat - pad, maxLat: maxLat + pad, minLng: minLng - pad, maxLng: maxLng + pad };
        }
        if (candidates.length > 0) {
          filters.refLat = candidates.reduce((s, c) => s + c.lat, 0) / candidates.length;
          filters.refLng = candidates.reduce((s, c) => s + c.lng, 0) / candidates.length;
        }
        const exclude = new Set(candidates.map((c) => c.tabaccheriaId).filter((x): x is string => !!x));
        let free = await loadFreeTabaccherie(bounds, exclude, settings, { ...filters, agentId }, resolved === 'sviluppo' ? 80 : 50);
        if (isTerritory && territoryZones.length > 0) {
          free = free.filter((c) => pointInZones(c.lat, c.lng, territoryZones));
        }
        if (free.length > 0) {
          scoreCandidates(free, settings);
          candidates = [...candidates, ...free];
          if (!areaLabel && v.areaMode === 'auto' && candidates.length > 0) areaLabel = free[0]?.city || '';
        }
      }

      // Le obbligatorie entrano anche se fuori area/tipo giornata
      const mandatoryKeys = new Set<string>();
      for (const id of v.mandatoryCustomerIds) {
        const all = [...loaded.clients, ...loaded.prospects, ...loaded.orphans];
        const found = all.find((c) => c.customerId === id);
        if (found) {
          // Orario preferenziale di arrivo scelto dall'agente: diventa la fascia oraria della tappa (±30 min nel planner)
          const t = v.mandatoryTimes?.[id];
          const cand = t && /^\d{2}:\d{2}$/.test(t)
            ? { ...found, preferredSlots: [{ id: `mand_${id}`, label: `ore ${t} (richiesta)`, start: timeToMin(t), end: timeToMin(t) }] }
            : found;
          mandatoryKeys.add(cand.key);
          const idx = candidates.findIndex((c) => c.key === cand.key);
          if (idx >= 0) candidates = candidates.map((c, i) => (i === idx ? cand : c));
          else candidates = [...candidates, cand];
        }
      }
      if (candidates.length === 0) {
        setErrMsg('Nessun soggetto disponibile con i filtri scelti');
        setGenerating(false);
        return;
      }

      setProgress('Calcolo percorsi e tempi di guida...');
      const bufferPct = resolved === 'clienti' ? settings.buffer_pct_clienti : resolved === 'sviluppo' ? settings.buffer_pct_sviluppo : settings.buffer_pct_mista;
      const newPlan = await planTour({
        candidates,
        mandatoryKeys,
        start,
        end,
        tourDate: v.date,
        startMin: effStartMin,
        endMin: timeToMin(v.endTime),
        dayType: v.dayType,
        resolvedDayType: resolved,
        bufferPct,
        bufferMaxMin: settings.buffer_max_min,
        area,
      });
      newPlan.areaLabel = areaLabel;
      newPlan.aiRecommendation = recommendation;

      if (newPlan.stops.length === 0) {
        // Diagnostica: quasi sempre la causa è una partenza troppo lontana dalle visite
        const nearestKm = candidates.length > 0 ? Math.min(...candidates.map((c) => haversineKm(start.lat, start.lng, c.lat, c.lng))) * 1.3 : 0;
        const travelMin = Math.round((nearestKm / (nearestKm > 120 ? 80 : nearestKm > 40 ? 55 : 38)) * 60);
        const windowMin = timeToMin(v.endTime) - effStartMin;
        if (travelMin > 0 && travelMin >= windowMin * 0.5) {
          const h = Math.floor(travelMin / 60);
          const m = travelMin % 60;
          setErrMsg(
            `Nessuna visita rientra nell'orario: la partenza è a circa ${h > 0 ? `${h}h ` : ''}${m}min di guida dalla visita più vicina. Cambia il punto di partenza o amplia l'orario.`
          );
        } else {
          setErrMsg("Nessuna visita pianificabile nell'orario indicato: amplia la finestra oraria o modifica l'area");
        }
        setGenerating(false);
        return;
      }

      // INTENSIFICAZIONE: se il giro lascia oltre 90 minuti liberi, riempi con
      // Mai Visitate/Orfani (e libere) VICINI alle tappe pianificate, senza disperdersi
      let finalPlan = newPlan;
      const leftoverMin = Math.round(Math.max(0, timeToMin(v.endTime) - newPlan.finishMin));
      if (leftoverMin > 90) {
        setProgress(`Restano ~${leftoverMin} min liberi: aggiungo Mai Visitate e Orfani vicini...`);
        try {
          let bMinLat = start.lat, bMaxLat = start.lat, bMinLng = start.lng, bMaxLng = start.lng;
          for (const s of newPlan.stops) {
            bMinLat = Math.min(bMinLat, s.candidate.lat); bMaxLat = Math.max(bMaxLat, s.candidate.lat);
            bMinLng = Math.min(bMinLng, s.candidate.lng); bMaxLng = Math.max(bMaxLng, s.candidate.lng);
          }
          const fillBounds = { minLat: bMinLat - 0.05, maxLat: bMaxLat + 0.05, minLng: bMinLng - 0.07, maxLng: bMaxLng + 0.07 };
          const plannedKeys = new Set(newPlan.stops.map((s) => s.candidate.key));
          const inBox = (c: { lat: number; lng: number }) =>
            c.lat >= fillBounds.minLat && c.lat <= fillBounds.maxLat && c.lng >= fillBounds.minLng && c.lng <= fillBounds.maxLng;
          // orfani vicini non ancora nel giro
          let fillers = loaded.orphans.filter((c) => !plannedKeys.has(c.key) && inBox(c));
          if (isTerritory && territoryZones.length > 0) {
            fillers = fillers.filter((c) => pointInZones(c.lat, c.lng, territoryZones));
          }
          // mai visitate del territorio + tabaccherie libere vicine al giro
          const excludeIds = new Set<string>();
          for (const s of newPlan.stops) if (s.candidate.tabaccheriaId) excludeIds.add(s.candidate.tabaccheriaId);
          for (const c of candidates) if (c.tabaccheriaId) excludeIds.add(c.tabaccheriaId);
          let fillFree = await loadFreeTabaccherie(
            fillBounds, excludeIds, settings,
            { refLat: (fillBounds.minLat + fillBounds.maxLat) / 2, refLng: (fillBounds.minLng + fillBounds.maxLng) / 2, agentId },
            40,
          );
          if (isTerritory && territoryZones.length > 0) {
            fillFree = fillFree.filter((c) => pointInZones(c.lat, c.lng, territoryZones));
          }
          scoreCandidates(fillFree, settings);
          const known = new Set([...plannedKeys, ...fillers.map((c) => c.key)]);
          for (const c of fillFree) if (!known.has(c.key)) fillers.push(c);
          if (fillers.length > 0) {
            const densePlan = await planTour({
              candidates: [...newPlan.stops.map((s) => s.candidate), ...fillers],
              mandatoryKeys,
              start,
              end,
              tourDate: v.date,
              startMin: effStartMin,
              endMin: timeToMin(v.endTime),
              dayType: v.dayType,
              resolvedDayType: resolved,
              bufferPct,
              bufferMaxMin: settings.buffer_max_min,
              area,
            });
            if (densePlan.stops.length > newPlan.stops.length) {
              densePlan.areaLabel = areaLabel;
              densePlan.aiRecommendation = recommendation;
              densePlan.warnings.unshift(`Giornata intensificata: +${densePlan.stops.length - newPlan.stops.length} visite di sviluppo vicine al giro per ridurre il tempo libero`);
              finalPlan = densePlan;
            }
          }
        } catch (err) {
          console.warn('[AITour] intensificazione fallita, tengo il piano base:', err);
        }
      }
      const residualMin = Math.round(Math.max(0, timeToMin(v.endTime) - finalPlan.finishMin));
      if (residualMin > 90) {
        finalPlan.warnings.push(`Restano circa ${Math.floor(residualMin / 60)}h ${residualMin % 60}m liberi: nessun altro punto raggiungibile nelle vicinanze del giro`);
      }
      // Area scelta dall'agente: persistita sul tour, rispettata dalle operazioni live ("Più Visite")
      finalPlan.areaFilter = {
        mode: v.areaMode,
        province: v.areaMode === 'province' ? v.province : undefined,
        city: v.areaMode === 'city' ? v.city : undefined,
        radiusKm: v.areaMode === 'radius' ? radiusKm : undefined,
        zoneIds: v.areaMode === 'territory' ? zonesForTour.map((z) => z.id) : undefined,
        drawnRings: v.areaMode === 'draw' ? drawnZones.map((z) => z.geometry.coordinates[0] as number[][]) : undefined,
      };

      setProgress("L'AI sta scrivendo la strategia del giro...");
      finalPlan.aiSummary = await getStrategySummary(finalPlan);
      // Giro troppo grande per una giornata: proponi la strutturazione su più giorni
      // solo se la giornata è davvero satura (poco tempo residuo) e restano soggetti fuori
      const plannedKeysAll = new Set(finalPlan.stops.map((s) => s.candidate.key));
      const leftoverAll = candidates.filter((c) => !plannedKeysAll.has(c.key));
      const overrunForm = Math.round(finalPlan.finishMin - timeToMin(v.endTime));
      if (overrunForm > 30 && finalPlan.stops.length >= 4) {
        // Giro con tappe obbligatorie che sfora l'orario: proponi la ripartizione su più giorni
        setMultiDayAsk({
          mode: 'overflow', overrunMin: overrunForm,
          leftover: candidates, start, end, baseDate: v.date,
          startMin: timeToMin(v.startTime), endMin: timeToMin(v.endTime),
          dayType: v.dayType, resolvedDayType: resolved, bufferPct, area, areaLabel,
        });
      } else if (leftoverAll.length >= 3 && residualMin <= 60) {
        setMultiDayAsk({
          mode: 'leftover',
          leftover: leftoverAll, start, end, baseDate: v.date,
          startMin: timeToMin(v.startTime), endMin: timeToMin(v.endTime),
          dayType: v.dayType, resolvedDayType: resolved, bufferPct, area, areaLabel,
        });
      }
      setPlan(finalPlan);
      setReadOnly(false);
      setPhase('result');
      hap.success();
    } catch (err) {
      console.error('[AITour] generate:', err);
      setErrMsg('Errore nella generazione del tour');
    } finally {
      setGenerating(false);
      setProgress('');
    }
  };

  // Apre "Dillo all'AI": carica il pool in background per arricchire il contesto (progetti/comuni)
  const openBrief = () => {
    hap.light();
    setErrMsg('');
    if (!pool && agentId) {
      loadCandidates(agentId, settings)
        .then((l) => {
          scoreCandidates([...l.clients, ...l.prospects, ...l.orphans], settings);
          setPool(l);
        })
        .catch(() => {});
    }
    setBriefOpen(true);
  };

  // Passa alla visualizzazione di un altro giorno di un giro multi-giornata,
  // conservando le eventuali modifiche fatte al giorno corrente
  const switchDay = (i: number) => {
    if (!dayPlans || !plan || i === dayIdx) return;
    hap.light();
    const updated = dayPlans.map((x, j) => (j === dayIdx ? plan : x));
    setDayPlans(updated);
    setPlan(updated[i]);
    setDayIdx(i);
  };

  // Strutturazione multi-giornata: ogni giorno riparte dallo stesso punto della richiesta
  const nextWorkDate = (d: string): string => {
    const dt = new Date(d + 'T12:00:00');
    do { dt.setDate(dt.getDate() + 1); } while (dt.getDay() === 0); // mai di domenica
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };

  const continueMultiDay = async () => {
    const ctx = multiDayAsk;
    if (!ctx || !plan) return;
    hap.medium();
    setMultiDayAsk(null);
    setGenerating(true);
    setPhase('form');
    try {
      // Cluster-first, route-second: partiziona le tappe in settori geografici
      // attorno alla partenza e dedica ogni giornata a un settore diverso
      const usableMin = Math.max(60, ctx.endMin - ctx.startMin);
      const capDays = ctx.maxDays && ctx.maxDays >= 2 ? Math.min(6, ctx.maxDays) : 6;
      let k: number;
      if (ctx.mode === 'overflow') {
        const effFinish = plan.finishMin - (ctx.returnFlexible ? plan.returnMin : 0);
        const totalMin = Math.max(usableMin + 1, effFinish - ctx.startMin);
        k = Math.min(capDays, Math.max(2, Math.ceil(totalMin / usableMin)));
      } else {
        k = Math.min(capDays - 1, Math.max(1, Math.ceil(ctx.leftover.length / Math.max(1, plan.stops.length))));
      }
      const queue = sweepPartition(ctx.leftover, ctx.start, k);
      const plans: TourPlan[] = ctx.mode === 'overflow' ? [] : [plan];
      let date = ctx.baseDate;
      let firstDay = ctx.mode === 'overflow';
      let carry: TourCandidate[] = [];
      let dropped = 0;
      while ((queue.length > 0 || carry.length > 0) && plans.length < capDays) {
        const pool = [...(queue.shift() || []), ...carry];
        carry = [];
        if (pool.length === 0) continue;
        if (!firstDay) date = nextWorkDate(date);
        firstDay = false;
        setProgress(`Pianificazione del giorno ${plans.length + 1} (${pool.length} visite in zona)...`);
        const p = await planTour({
          candidates: pool,
          mandatoryKeys: new Set<string>(),
          start: ctx.start,
          end: ctx.end,
          tourDate: date,
          startMin: ctx.startMin,
          endMin: ctx.endMin,
          dayType: ctx.dayType,
          resolvedDayType: ctx.resolvedDayType,
          bufferPct: ctx.bufferPct,
          bufferMaxMin: settings.buffer_max_min,
          area: ctx.area,
          returnFlexible: ctx.returnFlexible,
        });
        if (p.stops.length === 0) { dropped += pool.length; continue; }
        p.areaLabel = ctx.areaLabel;
        p.aiRecommendation = plan.aiRecommendation;
        p.areaFilter = plan.areaFilter;
        if (plans.length > 0) {
          const dLabel = new Date(date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: '2-digit' });
          p.warnings.unshift(`Giorno ${plans.length + 1} (${dLabel}): partenza dallo stesso punto della richiesta`);
        }
        plans.push(p);
        const done = new Set(p.stops.map((s) => s.candidate.key));
        // Le tappe della zona non entrate vengono assegnate al SETTORE RIMANENTE più vicino
        // (non al giorno successivo cieco: eviterebbe di ripassare nelle stesse zone)
        const leftHere = pool.filter((c) => !done.has(c.key));
        if (leftHere.length > 0 && queue.length > 0) {
          for (const c of leftHere) {
            let bi = 0;
            let bd = Infinity;
            queue.forEach((g, i) => {
              for (const x of g) {
                const d = haversineKm(c.lat, c.lng, x.lat, x.lng);
                if (d < bd) { bd = d; bi = i; }
              }
            });
            queue[bi].push(c);
          }
        } else if (leftHere.length > 0 && leftHere.length < 3) {
          // Residuo piccolo a settori finiti: NIENTE mini-giornata, prova ad assorbirlo
          // nella giornata già pianificata con più tempo libero residuo
          let absorbed = leftHere;
          const byBuffer = plans
            .map((pp, i) => ({ pp, i }))
            .filter(({ pp }) => pp.bufferMin >= 45)
            .sort((a, b) => b.pp.bufferMin - a.pp.bufferMin);
          for (const { pp, i } of byBuffer) {
            if (absorbed.length === 0) break;
            setProgress(`Riassegno ${absorbed.length} visite residue al giorno ${i + 1}...`);
            try {
              const merged = await planTour({
                candidates: [...pp.stops.map((s) => s.candidate), ...absorbed],
                mandatoryKeys: new Set(pp.stops.map((s) => s.candidate.key)),
                start: ctx.start,
                end: ctx.end,
                tourDate: pp.tourDate,
                startMin: ctx.startMin,
                endMin: ctx.endMin,
                dayType: ctx.dayType,
                resolvedDayType: ctx.resolvedDayType,
                bufferPct: ctx.bufferPct,
                bufferMaxMin: settings.buffer_max_min,
                area: ctx.area,
                returnFlexible: ctx.returnFlexible,
              });
              if (merged.stops.length > pp.stops.length) {
                merged.areaLabel = pp.areaLabel;
                merged.aiRecommendation = pp.aiRecommendation;
                merged.areaFilter = pp.areaFilter;
                merged.warnings.unshift(...pp.warnings.filter((w) => w.startsWith('Giorno ')));
                plans[i] = merged;
                const inMerged = new Set(merged.stops.map((s) => s.candidate.key));
                absorbed = absorbed.filter((c) => !inMerged.has(c.key));
              }
            } catch (err) {
              console.warn('[AITour] assorbimento residuo fallito:', err);
            }
          }
          carry = absorbed;
        } else {
          carry = leftHere;
        }
      }
      const leftoverEnd = dropped + carry.length + queue.reduce((s, g) => s + g.length, 0);
      if (plans.length === 0) {
        setErrMsg('Nessuna visita pianificabile: orario troppo stretto');
        return;
      }
      if (plans.length === 1 && ctx.mode === 'leftover') {
        setInfoMsg('Nessuna visita aggiuntiva pianificabile nelle giornate successive');
        return;
      }
      if (leftoverEnd > 0) {
        plans[plans.length - 1].warnings.push(`${leftoverEnd} soggetti restano fuori anche dopo ${plans.length} giornate`);
      }
      // Strategia AI specifica per ogni giornata che non la ha già
      setProgress("L'AI sta scrivendo la strategia di ogni giornata...");
      await Promise.all(plans.filter((p) => !p.aiSummary).map(async (p) => {
        try { p.aiSummary = await getStrategySummary(p); } catch { p.aiSummary = ''; }
      }));
      setDayPlans(plans);
      setDayIdx(0);
      setPlan(plans[0]);
      setInfoMsg(`Giro strutturato su ${plans.length} giornate: passa tra i giorni con i pulsanti in alto, Salva li salva tutti`);
      hap.success();
    } catch (err) {
      console.error('[AITour] continueMultiDay:', err);
      setErrMsg('Errore nella pianificazione multi-giornata');
    } finally {
      setGenerating(false);
      setProgress('');
      setPhase('result');
    }
  };

  // Genera un giro a partire dal brief V4 interpretato dall'AI ("Dillo all'AI")
  const generateFromBrief = async (brief: TourBriefV4) => {
    if (!agentId) return;
    setBriefOpen(false);
    hap.medium();
    setGenerating(true);
    setInfoMsg('');
    setErrMsg('');
    setSavedTourId(null);
    setShowExcluded(false);
    setDayPlans(null);
    setDayIdx(0);
    setMultiDayAsk(null);
    try {
      // Data richiesta: oggi/domani/esplicita; per date future niente aggancio all'ora corrente
      const todayStr = localDateStr();
      let date = todayStr;
      if (brief.requestedDate.type === 'tomorrow') {
        date = brief.requestedDate.value || localDateStr(1);
      } else if ((brief.requestedDate.type === 'explicit' || brief.requestedDate.type === 'selected') && brief.requestedDate.value) {
        date = brief.requestedDate.value;
      }
      if (date < todayStr) date = todayStr;
      const startTime = brief.route.startTime || settings.work_start;
      let endTime = brief.route.endTime || settings.work_end;
      // finishBy = fine tassativa: comprime l'orario e rende il rientro NON flessibile
      if (brief.route.finishBy && timeToMin(brief.route.finishBy) < timeToMin(endTime)) endTime = brief.route.finishBy;
      let effStartMin = timeToMin(startTime);
      if (date === todayStr) {
        const nowDt = new Date();
        const nowMin = nowDt.getHours() * 60 + nowDt.getMinutes();
        if (nowMin > effStartMin) effStartMin = nowMin;
      }
      const endMin = timeToMin(endTime);
      if (effStartMin >= endMin) {
        setErrMsg(`Per oggi l'orario di fine (${endTime}) è già passato: di' ad esempio "domani" nella richiesta`);
        setGenerating(false);
        return;
      }

      setProgress('Determino il punto di partenza...');
      // Timeout complessivo di sicurezza: mai schermata bloccata su questa fase
      let start = await withTimeout(
        resolvePoint(form.startMode, form.startAddress, null, (m) => setProgress(`Determino il punto di partenza... (${m})`)),
        30000
      );
      // GPS non disponibile: fallback automatico su Sede/Casa se configurate
      if (!start && form.startMode === 'current') {
        if (settings.office_lat) start = { lat: settings.office_lat, lng: settings.office_lng as number, label: 'Sede' };
        else if (settings.home_lat) start = { lat: settings.home_lat, lng: settings.home_lng as number, label: 'Casa' };
        if (start) {
          setInfoMsg(`GPS non disponibile: parto dalla ${start.label} (abilita la localizzazione per partire dalla tua posizione)`);
        }
      }
      if (!start) {
        setErrMsg('Posizione non disponibile: consenti la localizzazione a Expo Go/VOOM nelle impostazioni del telefono, oppure imposta Sede/Casa o un indirizzo di partenza');
        setGenerating(false);
        return;
      }
      // Rientro: al punto di partenza o a casa anagrafica; ritorno flessibile (può sforare)
      // salvo finishBy tassativo detto dall'agente
      const wantsReturn = brief.route.returnHome || brief.route.returnToStart;
      let briefEnd: GeoPoint | null = null;
      if (brief.route.returnToStart) briefEnd = { lat: start.lat, lng: start.lng, label: 'Rientro al punto di partenza' };
      else if (brief.route.returnHome) {
        briefEnd = settings.home_lat && settings.home_lng
          ? { lat: settings.home_lat, lng: settings.home_lng, label: 'Rientro a casa' }
          : { lat: start.lat, lng: start.lng, label: 'Rientro al punto di partenza' };
      }
      const returnFlexible = wantsReturn && !brief.route.finishBy;

      setProgress('Analisi del portafoglio commerciale...');
      const loaded = await loadCandidates(agentId, settings);
      scoreCandidates([...loaded.clients, ...loaded.prospects, ...loaded.orphans], settings);
      setPool(loaded);
      setViewedTourStatus(null);

      setProgress('Applico la tua richiesta...');
      const sel = selectCandidatesV4(brief, loaded);
      let candidates = sel.candidates;
      const briefWarnings: string[] = [...sel.warnings];

      // Aree multiple: include (unione), exclude, prefer (boost punteggio)
      let placeCenter: GeoPoint | null = null;
      const includes = brief.areas.filter((a) => a.mode === 'include');
      const excludes = brief.areas.filter((a) => a.mode === 'exclude');
      const prefers = brief.areas.filter((a) => a.mode === 'prefer');
      if (includes.length > 0) {
        const keep = new Set<string>();
        for (const a of includes) {
          if (a.kind === 'city') filterByArea(candidates, { mode: 'city', city: a.value }, start).forEach((c) => keep.add(c.key));
          else if (a.kind === 'province') filterByArea(candidates, { mode: 'province', province: a.value }, start).forEach((c) => keep.add(c.key));
          else {
            const g = await geocodeAddress(a.value);
            if (g) {
              if (!placeCenter) placeCenter = { lat: g.lat, lng: g.lng, label: a.value };
              candidates.filter((c) => haversineKm(g.lat, g.lng, c.lat, c.lng) <= 30).forEach((c) => keep.add(c.key));
            } else {
              briefWarnings.push(`Luogo "${a.value}" non trovato: filtro zona non applicato`);
            }
          }
        }
        if (keep.size > 0) candidates = candidates.filter((c) => keep.has(c.key));
      }
      for (const a of excludes) {
        if (a.kind === 'city') candidates = candidates.filter((c) => (c.city || '').trim().toLowerCase() !== a.value.trim().toLowerCase());
        else if (a.kind === 'province') candidates = candidates.filter((c) => (c.province || '').trim().toUpperCase() !== a.value.trim().toUpperCase());
        else {
          const g = await geocodeAddress(a.value);
          if (g) candidates = candidates.filter((c) => haversineKm(g.lat, g.lng, c.lat, c.lng) > 10);
        }
      }
      if (prefers.length > 0) {
        const prefCities = new Set(prefers.filter((a) => a.kind === 'city').map((a) => a.value.trim().toLowerCase()));
        const prefProv = new Set(prefers.filter((a) => a.kind === 'province').map((a) => a.value.trim().toUpperCase()));
        candidates = candidates.map((c) =>
          prefCities.has((c.city || '').trim().toLowerCase()) || prefProv.has((c.province || '').trim().toUpperCase())
            ? { ...c, score: c.score + 15 } : c);
      }

      // new_around: nuovi punti vendita da acquisire vicino alle ancore (top clienti o bacino)
      if (sel.newAround) {
        const radius = sel.newAround.radiusKm;
        const anchors = sel.anchors.filter((a) => candidates.some((c) => c.key === a.key));
        const base = anchors.length > 0 ? anchors : candidates;
        if (base.length > 0) {
          let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
          for (const a of base) {
            minLat = Math.min(minLat, a.lat); maxLat = Math.max(maxLat, a.lat);
            minLng = Math.min(minLng, a.lng); maxLng = Math.max(maxLng, a.lng);
          }
          const dLat = radius / 111, dLng = radius / 80;
          const bounds = { minLat: minLat - dLat, maxLat: maxLat + dLat, minLng: minLng - dLng, maxLng: maxLng + dLng };
          const exclude = new Set(candidates.map((c) => c.tabaccheriaId).filter((x): x is string => !!x));
          let free = await loadFreeTabaccherie(bounds, exclude, settings, { refLat: (minLat + maxLat) / 2, refLng: (minLng + maxLng) / 2, agentId }, 60);
          free = withinRadiusOfAnchors(free, base, radius);
          const inKeys = new Set(candidates.map((c) => c.key));
          const extra = withinRadiusOfAnchors([...loaded.prospects, ...loaded.orphans].filter((c) => !inKeys.has(c.key)), base, radius);
          scoreCandidates(free, settings);
          candidates = [...candidates, ...free, ...extra];
        }
      }

      // Tappe nominate dall'agente: risoluzione fuzzy sul portafoglio reale
      const allPool = [...loaded.clients, ...loaded.prospects, ...loaded.orphans];
      const mandatoryKeys = new Set<string>();
      const mandResolved = resolveStopRefs(brief.mandatoryStops, allPool);
      for (const r of mandResolved) {
        if (r.candidate) {
          const withAppt = applyAppointment(r.candidate, r.ref.appointment);
          const idx = candidates.findIndex((c) => c.key === withAppt.key);
          if (idx >= 0) candidates[idx] = withAppt; else candidates.push(withAppt);
          mandatoryKeys.add(withAppt.key);
        } else {
          const opts = r.options.map((o) => `${o.name}${o.city ? ` (${o.city})` : ''}`).slice(0, 3).join(' / ');
          briefWarnings.push(`Tappa obbligatoria "${r.ref.rawReference}": ${r.status === 'ambiguous' ? `più clienti possibili (${opts}) — precisa il nome o la città` : 'cliente non trovato nel portafoglio'} — NON inserita`);
        }
      }
      for (const r of resolveStopRefs(brief.preferredStops, allPool)) {
        if (r.candidate) {
          const boosted = { ...r.candidate, score: r.candidate.score + 30 };
          const idx = candidates.findIndex((c) => c.key === boosted.key);
          if (idx >= 0) candidates[idx] = boosted; else candidates.push(boosted);
        } else {
          briefWarnings.push(`Tappa desiderata "${r.ref.rawReference}": cliente non identificato — ignorata`);
        }
      }

      // Compatto: clustering, ma gli obbligatori restano SEMPRE nel giro
      if (brief.route.compact !== 'off' && candidates.length > 0) {
        const center = placeCenter || start;
        const cluster = pickBestCluster(candidates, center);
        if (cluster.list.length > 0) {
          const inCluster = new Set(cluster.list.map((c) => c.key));
          candidates = [...cluster.list, ...candidates.filter((c) => mandatoryKeys.has(c.key) && !inCluster.has(c.key))];
        }
      }

      // Target visite: "tutti" = obbligatorie; cap secondo mode e scope
      if (brief.visitTarget.mode === 'all') candidates.forEach((c) => mandatoryKeys.add(c.key));
      const cap = targetCap(brief.visitTarget);
      if (cap && candidates.length > cap) {
        const mand = candidates.filter((c) => mandatoryKeys.has(c.key));
        const rest = candidates.filter((c) => !mandatoryKeys.has(c.key)).sort((a, b) => b.score - a.score);
        candidates = brief.visitTarget.scope === 'automatic_plus_mandatory'
          ? [...mand, ...rest.slice(0, cap)]
          : [...mand, ...rest.slice(0, Math.max(0, cap - mand.length))];
      }
      if (brief.visitTarget.mode === 'minimum' && brief.visitTarget.value && candidates.length < brief.visitTarget.value) {
        briefWarnings.push(`Hai chiesto almeno ${brief.visitTarget.value} visite ma i soggetti disponibili sono ${candidates.length}`);
      }

      if (candidates.length === 0) {
        setErrMsg('Nessun soggetto corrisponde alla richiesta: modifica i chip e riprova');
        setGenerating(false);
        return;
      }

      const resolved: Exclude<DayType, 'ai'> = brief.dayType || 'mista';
      const bufferPct = resolved === 'clienti' ? settings.buffer_pct_clienti : resolved === 'sviluppo' ? settings.buffer_pct_sviluppo : settings.buffer_pct_mista;
      const firstArea = includes[0] || prefers[0] || null;
      const areaLabel = firstArea?.value || (brief.route.compact !== 'off' ? 'zona compatta' : '');
      const areaFilter: AreaFilter = firstArea?.kind === 'city'
        ? { mode: 'city', city: firstArea.value }
        : firstArea?.kind === 'province'
        ? { mode: 'province', province: firstArea.value }
        : { mode: 'auto' };

      setProgress('Pianificazione del giro...');
      const plan1 = await planTour({
        candidates, mandatoryKeys, start, end: briefEnd, tourDate: date,
        startMin: effStartMin, endMin,
        dayType: resolved, resolvedDayType: resolved, bufferPct, bufferMaxMin: settings.buffer_max_min,
        area: areaFilter, returnFlexible,
      });
      if (plan1.stops.length === 0) {
        setErrMsg('Nessuna visita pianificabile con la richiesta indicata: prova ad ampliare la zona o l\'orario');
        setGenerating(false);
        return;
      }
      plan1.areaLabel = areaLabel;
      plan1.aiRecommendation = brief.summary || null;
      plan1.warnings.unshift(...briefWarnings);
      const wantVal = brief.visitTarget.mode === 'exact' || brief.visitTarget.mode === 'approximately'
        ? brief.visitTarget.value
        : brief.visitTarget.mode === 'range' ? brief.visitTarget.min : null;
      if (wantVal && plan1.stops.length < wantVal) {
        plan1.warnings.unshift(`Pianificate ${plan1.stops.length} visite delle ${brief.visitTarget.mode === 'approximately' ? '~' : ''}${wantVal} richieste: soggetti disponibili, orario o zona compatta non permettono di più`);
      }
      if (firstArea?.kind === 'city' || firstArea?.kind === 'province') {
        plan1.areaFilter = { mode: firstArea.kind, city: firstArea.kind === 'city' ? firstArea.value : undefined, province: firstArea.kind === 'province' ? firstArea.value : undefined };
      }

      setProgress("L'AI sta scrivendo la strategia del giro...");
      plan1.aiSummary = await getStrategySummary(plan1);
      setPlan(plan1);
      setReadOnly(false);
      setPhase('result');
      hap.success();
      // Giro troppo grande: proponi più giornate salvo divieto esplicito ("devono stare tutti oggi")
      if (brief.route.splitAllowed !== false) {
        const plannedKeys = new Set(plan1.stops.map((s) => s.candidate.key));
        const leftoverAll = candidates.filter((c) => !plannedKeys.has(c.key));
        const effFinish1 = plan1.finishMin - (returnFlexible ? plan1.returnMin : 0);
        const residualBrief = Math.max(0, endMin - effFinish1);
        const overrunBrief = Math.round(effFinish1 - endMin);
        if (overrunBrief > 30 && plan1.stops.length >= 4) {
          setMultiDayAsk({
            mode: 'overflow', overrunMin: overrunBrief,
            leftover: candidates, start, end: briefEnd, baseDate: date,
            startMin: timeToMin(startTime), endMin,
            dayType: resolved, resolvedDayType: resolved, bufferPct, area: areaFilter, areaLabel,
            returnFlexible, maxDays: brief.route.maxDays,
          });
        } else if (leftoverAll.length >= 3 && residualBrief <= 60) {
          setMultiDayAsk({
            mode: 'leftover',
            leftover: leftoverAll, start, end: briefEnd, baseDate: date,
            startMin: timeToMin(startTime), endMin,
            dayType: resolved, resolvedDayType: resolved, bufferPct, area: areaFilter, areaLabel,
            returnFlexible, maxDays: brief.route.maxDays,
          });
        }
      }
    } catch (err) {
      console.error('[AITour] brief generate:', err);
      setErrMsg('Errore nella generazione del giro');
    } finally {
      setGenerating(false);
      setProgress('');
    }
  };

  // Apre Modifica giro: per i tour salvati richiamati il pool candidati non è
  // caricato, quindi lo carica al volo (serve per cercare/aggiungere tappe).
  const openEdit = async () => {
    if (!agentId) return;
    hap.light();
    if (!pool) {
      setLoadingPool(true);
      try {
        const loaded = await loadCandidates(agentId, settings);
        scoreCandidates([...loaded.clients, ...loaded.prospects, ...loaded.orphans], settings);
        setPool(loaded);
      } catch (err) {
        console.error('[AITour] openEdit pool:', err);
        setErrMsg('Errore nel caricamento dei clienti');
        setLoadingPool(false);
        return;
      }
      setLoadingPool(false);
    }
    setEditOpen(true);
  };

  // Ricalcolo dal pannello Modifica giro: ordine AI o sequenza manuale.
  // Per un tour salvato richiamato (status planned) persiste subito le modifiche.
  const recalc = async (keys: string[], mandatoryKeys: Set<string>, fixedOrder: boolean) => {
    if (!plan) return;
    setRecalcing(true);
    setErrMsg('');
    setInfoMsg('');
    try {
      const byKey = new Map(allCandidates.map((c) => [c.key, c]));
      // Le tappe di un tour salvato possono non esistere nel pool (chiavi diverse): fallback ai candidati del piano
      for (const s of plan.stops) if (!byKey.has(s.candidate.key)) byKey.set(s.candidate.key, s.candidate);
      const chosen = keys.map((k) => byKey.get(k)).filter((c): c is TourCandidate => !!c);
      let next: TourPlan;
      if (fixedOrder) {
        next = await planFixedOrder(chosen, plan);
      } else {
        next = await planTour({
          candidates: chosen,
          mandatoryKeys: new Set(chosen.map((c) => c.key)),
          start: plan.start,
          end: plan.end,
          tourDate: plan.tourDate,
          startMin: plan.startMin,
          endMin: plan.endMin,
          dayType: plan.dayType,
          resolvedDayType: plan.resolvedDayType,
          bufferPct: 0,
          area: { mode: 'auto' },
        });
        // Le obbligatorie "vere" scelte dall'utente restano marcate
        next.stops = next.stops.map((s) => ({ ...s, mandatory: mandatoryKeys.has(s.candidate.key) }));
      }
      next.areaLabel = plan.areaLabel;
      next.aiRecommendation = plan.aiRecommendation;
      next.areaFilter = plan.areaFilter;
      next.aiSummary = await getStrategySummary(next);
      setPlan(next);
      setEditOpen(false);
      hap.success();
      if (readOnly && savedTourId && viewedTourStatus === 'planned') {
        await replaceTourPlan(savedTourId, next);
        if (tab === 'tours') loadSavedTours();
        setInfoMsg('Giro ricalcolato e tour salvato aggiornato');
      } else {
        setInfoMsg('Giro ricalcolato');
      }
    } catch (err) {
      console.error('[AITour] recalc:', err);
      setErrMsg('Errore nel ricalcolo');
    } finally {
      setRecalcing(false);
    }
  };

  const save = async (name: string) => {
    if (!plan || !agentId || savedTourId) return;
    hap.medium();
    setSaving(true);
    try {
      // Salvataggio lato server (RPC atomica): con multi-giornata o tutti i giorni o nessuno
      if (dayPlans && dayPlans.length > 1) {
        const all = dayPlans.map((p, i) => (i === dayIdx ? plan : p));
        const ids = await saveToursBatch(agentId, all, name);
        setSavedTourId(ids[dayIdx] || ids[0] || null);
        setInfoMsg(`${ids.length} tour salvati, uno per giornata${name ? ` — "${name}"` : ''}`);
      } else {
        const ids = await saveToursBatch(agentId, [plan], name);
        setSavedTourId(ids[0] || null);
      }
      setSaveNameOpen(false);
      hap.success();
    } catch (err) {
      console.error('[AITour] save:', err);
      setErrMsg('Errore nel salvataggio del tour: nessun tour salvato');
    } finally {
      setSaving(false);
    }
  };

  // Avvia la Modalità Live: salva il tour se necessario, poi lo attiva
  const startLive = async () => {
    if (!plan || !agentId) return;
    hap.medium();
    setStarting(true);
    setErrMsg('');
    try {
      let tourId = savedTourId;
      if (!tourId) {
        tourId = await saveTour(agentId, plan);
        setSavedTourId(tourId);
      }
      await startLiveTour(tourId);
      const tour = (await getActiveTour(agentId))!;
      setLiveState(await loadLiveState(tour));
      hap.success();
    } catch (err) {
      console.error('[AITour] startLive:', err);
      setErrMsg("Errore nell'avvio del tour");
    } finally {
      setStarting(false);
    }
  };

  const exitLive = async () => {
    const t = liveState?.tour;
    setLiveState(null);
    setPhase('form');
    setSavedTourId(null);
    setPlan(null);
    if (tab === 'tours') loadSavedTours();
    // Uscita volontaria: il giro resta attivo, niente rientro automatico
    if (t) liveExitFlags.add(t.id);
    if (agentId) {
      const still = await getActiveTour(agentId);
      setActivePausedTour(still);
    }
  };

  const resumeLive = async () => {
    if (!activePausedTour) return;
    hap.medium();
    liveExitFlags.delete(activePausedTour.id);
    try {
      setLiveState(await loadLiveState(activePausedTour));
      setActivePausedTour(null);
    } catch (err) {
      console.error('[AITour] resumeLive:', err);
      setErrMsg('Errore nel caricamento del tour live');
    }
  };

  // Dalla Vista Settimanale: genera il tour ottimizzato di un singolo giorno
  const generateFromWeek = async (day: WeekDayPlan, start: GeoPoint, end: GeoPoint | null) => {
    try {
      const newPlan = await planTour({
        candidates: day.candidates,
        mandatoryKeys: new Set<string>(),
        start,
        end,
        tourDate: day.date,
        startMin: timeToMin(settings.work_start),
        endMin: timeToMin(settings.work_end),
        dayType: 'mista',
        resolvedDayType: 'mista',
        bufferPct: settings.buffer_pct_mista,
        bufferMaxMin: settings.buffer_max_min,
        area: { mode: 'auto' },
      });
      if (newPlan.stops.length === 0) {
        setErrMsg("Nessuna visita pianificabile nell'orario configurato");
        return;
      }
      newPlan.areaLabel = day.label;
      newPlan.aiSummary = await getStrategySummary(newPlan);
      setSavedTourId(null);
      setPlan(newPlan);
      setReadOnly(false);
      setPhase('result');
      setTab('genera');
      hap.success();
    } catch (err) {
      console.error('[AITour] generateFromWeek:', err);
      setErrMsg('Errore nella generazione del tour del giorno');
    }
  };

  const viewSaved = async (tour: SavedTour) => {
    hap.light();
    setDayPlans(null);
    setDayIdx(0);
    // Tour in corso: riprendi direttamente la Modalità Live
    if (tour.status === 'active') {
      try {
        liveExitFlags.delete(tour.id);
        setLiveState(await loadLiveState(tour));
        setActivePausedTour(null);
        return;
      } catch (err) {
        console.warn('[AITour] resume live from list:', err);
      }
    }
    try {
      const { stops, geometry } = await loadTourStops(tour.id);
      const planLike: TourPlan = {
        stops: stops.map((s) => ({
          candidate: {
            key: `${s.entity_type}:${s.customer_id || s.id}`,
            entityType: s.entity_type as EntityType,
            customerId: s.customer_id,
            tabaccheriaId: null,
            name: s.business_name,
            address: s.address || '',
            city: s.city || '',
            province: '',
            lat: s.latitude,
            lng: s.longitude,
            lastVisitDate: null,
            lastOrderDate: null,
            orderCount: 0,
            totalRevenue: 0,
            revenue6m: 0,
            avgOrderValue: 0,
            avgReorderDays: null,
            daysSinceOrder: null,
            daysSinceVisit: null,
            followUpDate: null,
            appointmentAt: null,
            notes: null,
            orphanStatus: null,
            estimatedRevenue: null,
            score: s.priority_score || 0,
            priorityClass: (s.priority_class || 'Media') as PriorityClass,
            reason: s.ai_reason || '',
            nextSuggestedVisit: null,
            visitMinutes: s.planned_duration_minutes || 20,
            preferredSlots: ((s as unknown as { preferred_slots?: TourCandidate['preferredSlots'] }).preferred_slots) || null,
            potentialValue: 0,
          },
          sequence: s.planned_sequence,
          arrivalMin: s.planned_arrival ? timeToMin(s.planned_arrival) : 0,
          departureMin: s.planned_departure ? timeToMin(s.planned_departure) : 0,
          travelMinFromPrev: s.travel_minutes || 0,
          travelKmFromPrev: Number(s.travel_km || 0),
          mandatory: s.mandatory,
        })),
        geometry,
        start: { lat: tour.start_lat ?? stops[0]?.latitude ?? 45.46, lng: tour.start_lng ?? stops[0]?.longitude ?? 9.19, label: tour.start_label || 'Partenza' },
        end: tour.end_lat != null ? { lat: tour.end_lat, lng: tour.end_lng as number, label: tour.end_label || 'Rientro' } : null,
        tourDate: tour.tour_date,
        startMin: timeToMin(tour.start_time),
        endMin: timeToMin(tour.end_time),
        dayType: tour.tour_type as DayType,
        resolvedDayType: (tour.resolved_tour_type || 'mista') as Exclude<DayType, 'ai'>,
        areaLabel: '',
        totalKm: Number(tour.planned_distance_km || 0),
        driveMin: tour.planned_drive_minutes || 0,
        visitMin: tour.planned_visit_minutes || 0,
        bufferMin: tour.planned_buffer_minutes || 0,
        returnMin: 0,
        returnKm: 0,
        finishMin: timeToMin(tour.start_time) + (tour.planned_drive_minutes || 0) + (tour.planned_visit_minutes || 0),
        potentialValue: Number(tour.potential_value || 0),
        avgScore: stops.length ? Math.round(stops.reduce((a, s) => a + (s.priority_score || 0), 0) / stops.length) : 0,
        excluded: [],
        aiSummary: tour.ai_summary || '',
        aiRecommendation: null,
        warnings: [],
        routingFallback: false,
      };
      setPlan(planLike);
      setSavedTourId(tour.id);
      setViewedTourStatus(tour.status);
      setReadOnly(true);
      setPhase('result');
      setTab('genera');
    } catch (err) {
      console.error('[AITour] viewSaved:', err);
      setErrMsg('Errore nel caricamento del tour');
    }
  };

  const confirmDelete = (tour: SavedTour) => {
    const doDelete = async () => {
      try {
        await deleteTour(tour.id);
        setSavedTours((old) => old.filter((t) => t.id !== tour.id));
      } catch (e) {
        console.error('[AITour] delete:', e);
        setErrMsg("Errore nell'eliminazione del tour");
      }
    };
    if (Platform.OS === 'web') {
      // Alert.alert multi-bottone non funziona su react-native-web
      if ((globalThis as unknown as { confirm?: (m: string) => boolean }).confirm?.(`Eliminare il tour del ${fmtTourDate(tour.tour_date)}?`)) {
        doDelete();
      }
      return;
    }
    Alert.alert('Elimina tour', `Eliminare il tour del ${fmtTourDate(tour.tour_date)}?`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Elimina', style: 'destructive', onPress: doDelete },
    ]);
  };

  // ---------- RENDER ----------

  const renderChip = (label: string, active: boolean, onPress: () => void, disabled = false, key?: string) => (
    <TouchableOpacity
      key={key || label}
      style={[styles.chip, active && styles.chipActive, disabled && styles.chipDisabled]}
      onPress={() => {
        if (disabled) return;
        hap.light();
        onPress();
      }}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive, disabled && styles.chipTextDisabled]}>{label}</Text>
    </TouchableOpacity>
  );

  const renderForm = () => (
    <View>
      {/* Dillo all'AI: brief in linguaggio naturale (voce o testo) */}
      <TouchableOpacity style={styles.briefCard} onPress={openBrief} activeOpacity={0.85}>
        <View style={styles.briefIcon}>
          <Ionicons name="mic" size={20} color="#FFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.briefCardTitle}>{"Dillo all'AI"}</Text>
          <Text style={styles.briefCardDesc}>{"Descrivi il giro a voce o per iscritto e lascia che l'AI lo costruisca"}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={AI_PURPLE_TEXT} />
      </TouchableOpacity>

      <View style={styles.briefDivider}>
        <View style={styles.briefDividerLine} />
        <Text style={styles.briefDividerText}>oppure imposta manualmente</Text>
        <View style={styles.briefDividerLine} />
      </View>

      {/* Data */}
      <Text style={styles.label}>Data</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateRow} contentContainerStyle={{ gap: 8 }}>
        {[0, 1, 2, 3, 4, 5, 6].map((off) => {
          const d = localDateStr(off);
          const { top, bottom } = dateChipLabel(off);
          const active = form.date === d;
          return (
            <TouchableOpacity
              key={d}
              style={[styles.dateChip, active && styles.dateChipActive]}
              onPress={() => {
                hap.light();
                setForm((old) => ({ ...old, date: d, startTime: autoStartTime(d, settings.work_start) }));
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.dateChipTop, active && styles.dateChipTextActive]}>{top}</Text>
              <Text style={[styles.dateChipBottom, active && styles.dateChipTextActive]}>{bottom}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Orari */}
      <View style={styles.timesRow}>
        <View style={styles.timeCol}>
          <Text style={styles.label}>Ora inizio</Text>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => stepTime('startTime', -15)} hitSlop={8}>
              <Ionicons name="remove" size={18} color={DS.ink2} />
            </TouchableOpacity>
            <Text style={styles.stepValue}>{form.startTime}</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => stepTime('startTime', 15)} hitSlop={8}>
              <Ionicons name="add" size={18} color={DS.ink2} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.timeCol}>
          <Text style={styles.label}>Ora fine</Text>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => stepTime('endTime', -15)} hitSlop={8}>
              <Ionicons name="remove" size={18} color={DS.ink2} />
            </TouchableOpacity>
            <Text style={styles.stepValue}>{form.endTime}</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => stepTime('endTime', 15)} hitSlop={8}>
              <Ionicons name="add" size={18} color={DS.ink2} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Tipo giornata */}
      <Text style={styles.label}>Tipo giornata</Text>
      <View style={styles.dayTypeGrid}>
        {DAY_TYPES.map((d) => {
          const active = form.dayType === d.value;
          return (
            <TouchableOpacity
              key={d.value}
              style={[styles.dayTypeCard, active && styles.dayTypeCardActive]}
              onPress={() => {
                hap.light();
                set('dayType', d.value);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.dayTypeHeader}>
                <Ionicons name={d.icon} size={16} color={active ? AI_PURPLE_TEXT : DS.ink2} />
                <Text style={[styles.dayTypeLabel, active && { color: AI_PURPLE_TEXT }]}>{d.label}</Text>
              </View>
              <Text style={styles.dayTypeDesc}>{d.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Partenza */}
      <Text style={styles.label}>Partenza</Text>
      <View style={styles.chipRow}>
        {renderChip('Posizione corrente', form.startMode === 'current', () => set('startMode', 'current'))}
        {renderChip('Indirizzo', form.startMode === 'address', () => set('startMode', 'address'))}
        {renderChip('Casa', form.startMode === 'home', () => set('startMode', 'home'), !settings.home_lat)}
        {renderChip('Sede', form.startMode === 'office', () => set('startMode', 'office'), !settings.office_lat)}
      </View>
      {form.startMode === 'address' && (
        <TextInput
          style={styles.input}
          value={form.startAddress}
          onChangeText={(t) => set('startAddress', t)}
          placeholder="Via, città"
          placeholderTextColor={DS.inkMuted}
        />
      )}

      {/* Rientro */}
      <Text style={styles.label}>Rientro</Text>
      <View style={styles.chipRow}>
        {renderChip('Nessuno', form.endMode === 'none', () => set('endMode', 'none'))}
        {renderChip('Partenza', form.endMode === 'start', () => set('endMode', 'start'))}
        {renderChip('Indirizzo', form.endMode === 'address', () => set('endMode', 'address'))}
        {renderChip('Casa', form.endMode === 'home', () => set('endMode', 'home'), !settings.home_lat)}
        {renderChip('Sede', form.endMode === 'office', () => set('endMode', 'office'), !settings.office_lat)}
      </View>
      {form.endMode === 'address' && (
        <TextInput
          style={styles.input}
          value={form.endAddress}
          onChangeText={(t) => set('endAddress', t)}
          placeholder="Via, città"
          placeholderTextColor={DS.inkMuted}
        />
      )}

      {/* Area */}
      <Text style={styles.label}>Area</Text>
      <View style={styles.chipRow}>
        {agentZones.length > 0 && renderChip('Territorio assegnato', form.areaMode === 'territory', () => set('areaMode', 'territory'))}
        {agentZones.length > 0 && renderChip('Disegna aree (mappa)', form.areaMode === 'draw', () => set('areaMode', 'draw'))}
        {renderChip('Automatica (AI)', form.areaMode === 'auto', () => set('areaMode', 'auto'))}
        {renderChip('Provincia', form.areaMode === 'province', () => set('areaMode', 'province'))}
        {renderChip('Comune', form.areaMode === 'city', () => set('areaMode', 'city'))}
        {renderChip('Raggio km', form.areaMode === 'radius', () => set('areaMode', 'radius'))}
      </View>
      {form.areaMode === 'territory' && agentZones.length > 1 && (
        <>
          <Text style={[styles.zonesHint, form.territoryZoneIds.length === 0 && { color: '#B45309', fontFamily: JAKARTA.semibold }]} testID="aitour-territory-zones-count">
            {form.territoryZoneIds.length === 0
              ? 'Seleziona le zone del giro (tocca le zone in cui vuoi andare)'
              : `Zone del giro: ${form.territoryZoneIds.length}/${agentZones.length} (tocca per includere/escludere)`}
          </Text>
          <View style={styles.chipRow}>
            {agentZones.map((z) => {
              const active = form.territoryZoneIds.includes(z.id);
              return renderChip(
                zoneLabel(z),
                active,
                () => {
                  setForm((old) => {
                    const has = old.territoryZoneIds.includes(z.id);
                    return {
                      ...old,
                      territoryZoneIds: has
                        ? old.territoryZoneIds.filter((id) => id !== z.id)
                        : [...old.territoryZoneIds, z.id],
                    };
                  });
                },
                false,
                z.id,
              );
            })}
          </View>
        </>
      )}
      {form.areaMode === 'draw' && agentZones.length > 0 && !!agentId && (
        <DrawAreasMap agentId={agentId} zones={agentZones} onRingsChange={(r) => set('drawnRings', r)} />
      )}
      {form.areaMode === 'province' && (
        <TextInput
          style={styles.input}
          value={form.province}
          onChangeText={(t) => set('province', t.toUpperCase())}
          placeholder="Sigla provincia, es. MI"
          placeholderTextColor={DS.inkMuted}
          maxLength={2}
          autoCapitalize="characters"
        />
      )}
      {form.areaMode === 'city' && (
        <TextInput
          style={styles.input}
          value={form.city}
          onChangeText={(t) => set('city', t)}
          placeholder="Comune, es. Rozzano"
          placeholderTextColor={DS.inkMuted}
        />
      )}
      {form.areaMode === 'radius' && (
        <TextInput
          style={styles.input}
          value={form.radiusKm}
          onChangeText={(t) => set('radiusKm', t.replace(/[^0-9]/g, ''))}
          placeholder="Raggio massimo (km)"
          placeholderTextColor={DS.inkMuted}
          keyboardType="number-pad"
          maxLength={3}
        />
      )}

      {/* Visite obbligatorie */}
      <Text style={styles.label}>Visite obbligatorie (facoltativo)</Text>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={DS.inkMuted} style={{ marginLeft: 10 }} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Cerca per nome, referente, indirizzo o città..."
          placeholderTextColor={DS.inkMuted}
        />
      </View>
      {results.length > 0 && (
        <View style={styles.resultsBox}>
          {results.map((r) => (
            <TouchableOpacity key={r.id} style={styles.resultRow} onPress={() => addMandatory(r)} activeOpacity={0.6}>
              <Text style={styles.resultName} numberOfLines={1}>
                {r.business_name}
                {(r.contact_name || r.contact_surname) ? (
                  <Text style={styles.resultCity}> · {[r.contact_name, r.contact_surname].filter(Boolean).join(' ')}</Text>
                ) : null}
                <Text style={styles.resultCity}> {[r.address, r.city].filter(Boolean).join(', ')}</Text>
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {selectedMandatory.length > 0 && (
        <View style={{ gap: 6 }}>
          {selectedMandatory.map((s) => (
            <View key={s.id} style={styles.mandRow}>
              <Text style={styles.mandChipText} numberOfLines={1}>
                {s.business_name}
              </Text>
              <Text style={styles.mandTimeLabel}>arrivo preferito</Text>
              <TextInput
                style={styles.mandTimeInput}
                value={form.mandatoryTimes[s.id] || ''}
                onChangeText={(t) => set('mandatoryTimes', { ...form.mandatoryTimes, [s.id]: t })}
                placeholder="HH:MM"
                placeholderTextColor={DS.inkMuted}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                testID={`aitour-mandatory-time-${s.id}`}
              />
              <TouchableOpacity onPress={() => removeMandatory(s.id)} hitSlop={8}>
                <Ionicons name="close" size={14} color={AI_PURPLE_TEXT} />
              </TouchableOpacity>
            </View>
          ))}
          <Text style={styles.mandTimeHint}>L&apos;orario di arrivo preferito è facoltativo: il giro proverà ad arrivare dal cliente attorno a quell&apos;ora (±30 min).</Text>
        </View>
      )}

      {/* Genera */}
      <TouchableOpacity style={styles.generateBtn} onPress={generate} disabled={generating} activeOpacity={0.8}>
        <Ionicons name="sparkles" size={18} color="#FFF" />
        <Text style={styles.generateBtnText}>GENERA CON AI</Text>
      </TouchableOpacity>
      <Text style={styles.generateHint}>Selezione commerciale → clustering → pianificazione temporale</Text>
    </View>
  );

  const renderResult = () => {
    if (!plan) return null;
    const counts: Record<EntityType, number> = { client: 0, prospect: 0, orphan: 0, free: 0, never: 0 };
    for (const s of plan.stops) counts[s.candidate.entityType]++;
    const kpis: { label: string; value: string }[] = [
      { label: 'Orario', value: `${minToTime(plan.startMin)} → ${minToTime(plan.finishMin)}` },
      { label: 'Visite', value: `${plan.stops.length}` },
      { label: 'Km', value: `${plan.totalKm.toFixed(0)}` },
      { label: 'Guida', value: fmtDur(plan.driveMin) },
      { label: 'In visita', value: fmtDur(plan.visitMin) },
      { label: 'Buffer', value: fmtDur(plan.bufferMin) },
      { label: 'Valore pot.', value: fmtEur(plan.potentialValue) },
      { label: 'Priorità media', value: `${plan.avgScore}/100` },
    ];
    const compositionParts = [
      counts.client > 0 ? `${counts.client} CLI` : '',
      counts.prospect > 0 ? `${counts.prospect} PRO` : '',
      counts.orphan > 0 ? `${counts.orphan} ORF` : '',
      counts.never > 0 ? `${counts.never} MAI VIS.` : '',
      counts.free > 0 ? `${counts.free} NUOVE` : '',
    ].filter(Boolean);

    return (
      <View>
        {/* Giro multi-giornata: tab per passare da un giorno all'altro */}
        {dayPlans && dayPlans.length > 1 && (
          <View style={styles.splitBanner}>
            <Ionicons name="calendar" size={16} color={AI_PURPLE_TEXT} />
            <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {dayPlans.map((p, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.dayTabBtn, dayIdx === i && styles.dayTabBtnActive]}
                  onPress={() => switchDay(i)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dayTabText, dayIdx === i && styles.dayTabTextActive]}>
                    Giorno {i + 1} ({p.stops.length})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        {/* Azioni */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              hap.light();
              setPhase('form');
              setReadOnly(false);
              setSavedTourId(null);
              setDayPlans(null);
              setDayIdx(0);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={15} color={DS.ink2} />
            <Text style={styles.actionBtnText}>Nuovo</Text>
          </TouchableOpacity>
          {!readOnly && (
            <TouchableOpacity style={styles.actionBtn} onPress={generate} disabled={generating} activeOpacity={0.7}>
              <Ionicons name="refresh" size={15} color={DS.ink2} />
              <Text style={styles.actionBtnText}>Rigenera</Text>
            </TouchableOpacity>
          )}
          {!readOnly && (
            <TouchableOpacity
              style={[styles.actionBtn, styles.saveBtn, savedTourId != null && styles.savedBtn]}
              onPress={() => { hap.light(); setSaveNameOpen(true); }}
              disabled={saving || savedTourId != null}
              activeOpacity={0.7}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Ionicons name={savedTourId ? 'checkmark' : 'save-outline'} size={15} color="#FFF" />
              )}
              <Text style={[styles.actionBtnText, { color: '#FFF' }]}>{savedTourId ? 'Salvato' : 'Salva'}</Text>
            </TouchableOpacity>
          )}
          {(!readOnly || viewedTourStatus === 'planned') && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={openEdit}
              disabled={loadingPool || recalcing}
              activeOpacity={0.7}
              testID="aitour-edit-btn"
            >
              {loadingPool || recalcing ? (
                <ActivityIndicator size="small" color={DS.ink2} />
              ) : (
                <Ionicons name="pencil" size={15} color={DS.ink2} />
              )}
              <Text style={styles.actionBtnText}>Modifica</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Pannello Modifica giro */}
        <TourEditModal
          visible={editOpen}
          onClose={() => setEditOpen(false)}
          plan={plan}
          allCandidates={allCandidates}
          onRecalc={recalc}
          recalcing={recalcing}
        />

        {/* Meta */}
        <Text style={styles.resultMeta}>
          {fmtTourDate(plan.tourDate)} · {TOUR_TYPE_LABELS[plan.resolvedDayType] || plan.resolvedDayType}
          {plan.areaLabel ? ` · ${plan.areaLabel}` : ''}
        </Text>

        {/* KPI */}
        <View style={styles.kpiGrid}>
          {kpis.map((k) => (
            <View key={k.label} style={styles.kpiChip}>
              <Text style={styles.kpiLabel}>{k.label.toUpperCase()}</Text>
              <Text style={styles.kpiValue}>{k.value}</Text>
            </View>
          ))}
          {compositionParts.length > 0 && (
            <View style={[styles.kpiChip, { minWidth: '48%' }]}>
              <Text style={styles.kpiLabel}>COMPOSIZIONE</Text>
              <Text style={styles.kpiValue}>{compositionParts.join(' · ')}</Text>
            </View>
          )}
        </View>

        {plan.aiRecommendation ? (
          <View style={[styles.alertBox, { backgroundColor: AI_PURPLE_SOFT, borderColor: AI_PURPLE_BORDER }]}>
            <Ionicons name="sparkles" size={14} color={AI_PURPLE_TEXT} />
            <Text style={[styles.alertText, { color: AI_PURPLE_TEXT }]}>{plan.aiRecommendation}</Text>
          </View>
        ) : null}
        {plan.aiSummary ? (
          <View style={[styles.alertBox, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <Ionicons name="sparkles" size={14} color="#7C3AED" />
            <Text style={[styles.alertText, { color: '#1E3A8A' }]}>{plan.aiSummary}</Text>
          </View>
        ) : null}
        {plan.warnings.map((w, i) => (
          <View key={i} style={[styles.alertBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <Ionicons name="warning" size={14} color="#DC2626" />
            <Text style={[styles.alertText, { color: '#991B1B' }]}>{w}</Text>
          </View>
        ))}
        {plan.routingFallback && <Text style={styles.fallbackNote}>Tempi stimati (servizio routing temporaneamente non disponibile).</Text>}

        {/* Vista Elenco / Mappa */}
        <View style={styles.viewToggle}>
          {(
            [
              { key: 'list', label: 'Elenco', icon: 'list' },
              { key: 'map', label: 'Mappa', icon: 'map' },
            ] as const
          ).map((v) => (
            <TouchableOpacity
              key={v.key}
              style={[styles.viewToggleBtn, resultView === v.key && styles.viewToggleBtnActive]}
              onPress={() => {
                hap.light();
                setResultView(v.key);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name={v.icon} size={14} color={resultView === v.key ? '#FFF' : DS.ink2} />
              <Text style={[styles.viewToggleText, resultView === v.key && { color: '#FFF' }]}>{v.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {resultView === 'map' ? (
          <TourMapView
            stops={plan.stops.map(
              (s): TourMapStop => ({
                key: s.candidate.key,
                lat: s.candidate.lat,
                lng: s.candidate.lng,
                color: ENTITY_COLORS[s.candidate.entityType],
                label: String(s.sequence),
                mandatory: s.mandatory,
                name: s.candidate.name,
                crmName: s.candidate.crmName,
                entity: ENTITY_LABELS[s.candidate.entityType],
                line1: `Arrivo ${minToTime(s.arrivalMin)} · visita ${s.candidate.visitMinutes} min · ${s.candidate.score}/100`,
                line2: `Dal punto precedente: ${Math.round(s.travelMinFromPrev)} min · ${s.travelKmFromPrev.toFixed(1)} km`,
                reason: s.candidate.reason,
              })
            )}
            geometry={plan.geometry}
            start={plan.start}
            end={plan.end}
            height={440}
          />
        ) : (
          <>
        {/* Partenza */}
        <View style={styles.startRow}>
          <View style={styles.startDot}>
            <Ionicons name="flag" size={12} color="#FFF" />
          </View>
          <Text style={styles.startText}>
            {minToTime(plan.startMin)} · Partenza da {plan.start.label}
          </Text>
        </View>

        {/* Fermate */}
        {plan.stops.map((s) => (
          <View key={s.candidate.key} style={styles.stopCard}>
            <View style={styles.travelRow}>
              <Ionicons name="car-outline" size={13} color={DS.inkMuted} />
              <Text style={styles.travelText}>
                {Math.round(s.travelMinFromPrev)} min{s.travelKmFromPrev > 0 ? ` · ${s.travelKmFromPrev.toFixed(1)} km` : ''}
              </Text>
            </View>
            <View style={styles.stopHeader}>
              <View style={styles.seqBadge}>
                <Text style={styles.seqText}>{s.sequence}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stopName} numberOfLines={2}>
                  {s.candidate.name}
                  {s.mandatory ? ' ★' : ''}
                </Text>
                <Text style={styles.stopAddress} numberOfLines={1}>
                  {[s.candidate.address, s.candidate.city].filter(Boolean).join(', ')}
                </Text>
              </View>
              <View style={styles.stopTimeBox}>
                <Text style={styles.stopArrival}>{minToTime(s.arrivalMin)}</Text>
                <Text style={styles.stopDeparture}>→ {minToTime(s.departureMin)}</Text>
                {(s.waitMin || 0) > 0 && <Text style={styles.stopWait}>attesa {s.waitMin}m</Text>}
              </View>
            </View>
            <View style={styles.stopBadges}>
              <CandidateEntityBadge candidate={s.candidate} />
              <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[s.candidate.priorityClass] + '1A' }]}>
                <Text style={[styles.priorityBadgeText, { color: PRIORITY_COLORS[s.candidate.priorityClass] }]}>
                  {s.candidate.priorityClass} · {s.candidate.score}/100
                </Text>
              </View>
              {(s.candidate.preferredSlots?.length || 0) > 0 && (
                <View style={[styles.slotBadge, s.outsideWindow && styles.slotBadgeWarn]}>
                  <Ionicons name="time-outline" size={10} color={s.outsideWindow ? '#DC2626' : '#B45309'} />
                  <Text style={[styles.slotBadgeText, s.outsideWindow ? { color: '#DC2626' } : null]}>
                    {(s.candidate.preferredSlots || []).map((x) => x.label).join(', ')}{s.outsideWindow ? ' ⚠' : ''}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => {
                  hap.light();
                  openNavigation(s.candidate.lat, s.candidate.lng);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="navigate" size={13} color="#FFF" />
                <Text style={styles.navBtnText}>Naviga</Text>
              </TouchableOpacity>
            </View>
            {s.candidate.reason ? <Text style={styles.stopReason}>{s.candidate.reason}</Text> : null}
          </View>
        ))}

        {/* Rientro */}
        {plan.end && (
          <View style={styles.startRow}>
            <View style={[styles.startDot, { backgroundColor: DS.ink2 }]}>
              <Ionicons name="home" size={12} color="#FFF" />
            </View>
            <Text style={styles.startText}>
              {minToTime(plan.finishMin)} · Rientro a {plan.end.label}
            </Text>
          </View>
        )}
          </>
        )}

        {/* Escluse */}
        {plan.excluded.length > 0 && (
          <View style={styles.excludedSection}>
            <TouchableOpacity
              style={styles.excludedToggle}
              onPress={() => {
                hap.light();
                setShowExcluded((x) => !x);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.excludedTitle}>Visite escluse ({plan.excluded.length})</Text>
              <Ionicons name={showExcluded ? 'chevron-up' : 'chevron-down'} size={16} color={DS.inkMuted} />
            </TouchableOpacity>
            {showExcluded &&
              plan.excluded.map((e) => (
                <View key={e.candidate.key} style={styles.excludedRow}>
                  <Text style={styles.excludedName} numberOfLines={1}>
                    {e.candidate.name} <Text style={styles.excludedScore}>({e.candidate.score}/100)</Text>
                  </Text>
                  <Text style={styles.excludedWhy}>{e.why}</Text>
                </View>
              ))}
          </View>
        )}
      </View>
    );
  };

  const renderSavedTours = () => (
    <View>
      {loadingTours && savedTours.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={AI_PURPLE_TEXT} />
      ) : savedTours.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="map-outline" size={40} color={DS.inkMuted} />
          <Text style={styles.emptyTitle}>Nessun tour salvato</Text>
          <Text style={styles.emptyText}>Genera un tour con l&apos;AI e salvalo per ritrovarlo qui</Text>
        </View>
      ) : (
        savedTours.map((t) => {
          const st = STATUS_META[t.status] || { label: t.status, color: DS.ink2, bg: DS.surface2 };
          return (
            <TouchableOpacity key={t.id} style={styles.tourCard} onPress={() => viewSaved(t)} activeOpacity={0.7}>
              <View style={styles.tourHeader}>
                <Text style={styles.tourDate}>{fmtTourDate(t.tour_date)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                  <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                </View>
                <TouchableOpacity onPress={() => confirmDelete(t)} hitSlop={10} style={{ marginLeft: 'auto' }}>
                  <Ionicons name="trash-outline" size={17} color={DS.error} />
                </TouchableOpacity>
              </View>
              {t.name ? (
                <Text style={styles.tourName} numberOfLines={1}>{t.name}</Text>
              ) : null}
              <Text style={styles.tourInfo}>
                {t.start_time?.slice(0, 5)}–{t.end_time?.slice(0, 5)} · {TOUR_TYPE_LABELS[t.resolved_tour_type || t.tour_type] || t.tour_type} ·{' '}
                {t.planned_visits} visite · {Number(t.planned_distance_km || 0).toFixed(0)} km
                {t.potential_value ? ` · ${fmtEur(Number(t.potential_value))}` : ''}
              </Text>
              {t.start_label ? (
                <Text style={styles.tourStart} numberOfLines={1}>
                  Da: {t.start_label}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={DS.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Ionicons name="sparkles" size={18} color={AI_PURPLE_TEXT} />
            <Text style={styles.title}>AI Tour</Text>
          </View>
          <Text style={styles.subtitle}>Pianificazione AI dei giri visita</Text>
        </View>
        {!liveState && tab === 'genera' && phase === 'result' && plan && (
          <TouchableOpacity
            style={styles.headerStartBtn}
            onPress={startLive}
            disabled={starting}
            activeOpacity={0.8}
          >
            {starting ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="play" size={15} color="#FFF" />}
            <Text style={styles.headerStartText}>Avvia Tour</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Modalità Live: sostituisce tutto il contenuto */}
      {liveState ? (
        <LiveTourView key={liveState.tour.id} initial={liveState} settings={settings} onExit={exitLive} />
      ) : (
        <>
          {/* Tabs */}
          <View style={styles.segmented}>
            {(
              [
                { key: 'genera', label: 'Genera' },
                { key: 'settimana', label: 'Settimana' },
                { key: 'mensile', label: 'Mese' },
                { key: 'portafoglio', label: 'Portafoglio' },
                { key: 'tours', label: 'I miei Tour' },
              ] as const
            ).map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[styles.segment, tab === t.key && styles.segmentActive]}
                onPress={() => {
                  hap.light();
                  setTab(t.key);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.segmentText, tab === t.key && styles.segmentTextActive]} numberOfLines={1}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

      {/* Tour live in corso ma vista live chiusa volontariamente */}
      {activePausedTour ? (
        <View style={styles.pausedBanner}>
          <View style={styles.pausedBadge}>
            <Text style={styles.pausedBadgeText}>TOUR LIVE</Text>
          </View>
          <Text style={styles.pausedText}>
            Tour in corso ({fmtTourDate(activePausedTour.tour_date)} · {activePausedTour.start_time?.slice(0, 5)}–{activePausedTour.end_time?.slice(0, 5)}): sei uscito dalla vista live, il giro resta attivo.
          </Text>
          <TouchableOpacity style={styles.pausedResumeBtn} onPress={resumeLive} activeOpacity={0.8}>
            <Ionicons name="play" size={13} color="#FFF" />
            <Text style={styles.pausedResumeText}>Riprendi vista live</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {errMsg ? (
        <View style={styles.errBanner}>
          <Ionicons name="alert-circle" size={14} color="#991B1B" />
          <Text style={styles.errBannerText}>{errMsg}</Text>
          <TouchableOpacity onPress={() => setErrMsg('')} hitSlop={8}>
            <Ionicons name="close" size={14} color="#991B1B" />
          </TouchableOpacity>
        </View>
      ) : null}

      {infoMsg ? (
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={14} color="#1D4ED8" />
          <Text style={styles.infoBannerText}>{infoMsg}</Text>
        </View>
      ) : null}

      {generating ? (
        <View style={styles.generatingBox}>
          <ActivityIndicator size="large" color={AI_PURPLE_TEXT} />
          <Text style={styles.generatingText}>{progress}</Text>
          <Text style={styles.generatingHint}>Selezione commerciale → clustering → pianificazione temporale</Text>
        </View>
      ) : (
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bottomOffset={170}
          refreshControl={
            tab === 'tours' ? <RefreshControl refreshing={loadingTours} onRefresh={loadSavedTours} tintColor={AI_PURPLE} /> : undefined
          }
        >
          {tab === 'genera' && (phase === 'form' ? renderForm() : renderResult())}
          {tab === 'settimana' && (
            <WeekTab
              agentId={agentId}
              settings={settings}
              resolvePoint={resolvePoint}
              onGenerateDay={generateFromWeek}
              preset={weekPreset}
              onPresetConsumed={() => setWeekPreset(null)}
            />
          )}
          {tab === 'mensile' && (
            <MonthTab
              agentId={agentId}
              settings={settings}
              resolvePoint={resolvePoint}
              onOpenWeek={(p) => {
                setWeekPreset(p);
                setTab('settimana');
              }}
            />
          )}
          {tab === 'portafoglio' && (
            <PortfolioTab agentId={agentId} settings={settings} zones={agentZones} />
          )}
          {tab === 'tours' && renderSavedTours()}
        </KeyboardAwareScrollView>
      )}
        </>
      )}

      <BriefModal
        visible={briefOpen}
        onClose={() => setBriefOpen(false)}
        onConfirm={generateFromBrief}
        projects={briefProjects}
        cities={briefCities}
      />

      {/* Salvataggio con nome (singolo o multi-giornata, RPC atomica) */}
      <TourNameDialog
        visible={saveNameOpen}
        title={dayPlans && dayPlans.length > 1 ? `Salva ${dayPlans.length} giornate` : 'Salva tour'}
        description={
          dayPlans && dayPlans.length > 1
            ? 'Verranno salvati tutti i giorni del giro in un colpo solo, uno per giornata.'
            : 'Il tour verrà salvato in "I miei Tour".'
        }
        saving={saving}
        onClose={() => { if (!saving) setSaveNameOpen(false); }}
        onConfirm={save}
      />

      {/* Il giro non entra in una giornata: proposta multi-giornata */}
      <Modal visible={!!multiDayAsk} transparent animationType="fade" onRequestClose={() => setMultiDayAsk(null)}>
        <View style={styles.multiDayBackdrop}>
          <View style={styles.multiDayCard}>
            <View style={styles.multiDayTitleRow}>
              <Ionicons name="calendar" size={20} color={AI_PURPLE_TEXT} />
              <Text style={styles.multiDayTitle}>Il giro necessita di più giornate</Text>
            </View>
            <Text style={styles.multiDayDesc}>
              {multiDayAsk?.mode === 'overflow'
                ? `Il giro pianificato sfora l'orario della giornata di circa ${multiDayAsk?.overrunMin} minuti.`
                : `${multiDayAsk?.leftover.length} visite non entrano nella giornata richiesta.`}{' '}
              Vuoi che crei dei tour su più giorni? Ogni giornata partirà sempre dal punto da cui hai fatto la
              richiesta: sarà una tua scelta se rientrare davvero al punto di partenza o fermarti dove finisce il giro
              e riprendere da lì.
            </Text>
            <TouchableOpacity style={styles.multiDayYes} onPress={continueMultiDay} activeOpacity={0.8}>
              <Text style={styles.multiDayYesText}>Sì, crea più giornate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.multiDayNo} onPress={() => { hap.light(); setMultiDayAsk(null); }} activeOpacity={0.7}>
              <Text style={styles.multiDayNoText}>No, solo questa giornata</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.surface2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: DS.surface,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
    gap: 6,
  },
  backBtn: { padding: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontFamily: JAKARTA.bold, fontSize: 18, color: DS.ink },
  subtitle: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted, marginTop: 1 },
  briefCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: AI_PURPLE_SOFT,
    borderWidth: 1,
    borderColor: AI_PURPLE,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  briefIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: AI_PURPLE, justifyContent: 'center', alignItems: 'center' },
  briefCardTitle: { fontFamily: JAKARTA.bold, fontSize: 15, color: AI_PURPLE_TEXT },
  briefCardDesc: { fontFamily: JAKARTA.regular, fontSize: 12, color: DS.ink2, marginTop: 2, lineHeight: 16 },
  briefDivider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  briefDividerLine: { flex: 1, height: 1, backgroundColor: DS.border },
  briefDividerText: { fontFamily: JAKARTA.medium, fontSize: 11, color: DS.inkMuted },
  splitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: AI_PURPLE_SOFT,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  splitBannerText: { flex: 1, fontFamily: JAKARTA.semibold, fontSize: 12, color: AI_PURPLE_TEXT },
  dayTabBtn: { borderWidth: 1, borderColor: AI_PURPLE, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  dayTabBtnActive: { backgroundColor: AI_PURPLE },
  dayTabText: { fontFamily: JAKARTA.semibold, fontSize: 12, color: AI_PURPLE_TEXT },
  dayTabTextActive: { color: '#FFF' },
  tourName: { fontFamily: JAKARTA.semibold, fontSize: 12.5, color: AI_PURPLE_TEXT, marginTop: 3 },
  multiDayBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 24 },
  multiDayCard: { backgroundColor: DS.surface, borderRadius: 16, padding: 20, gap: 12 },
  multiDayTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  multiDayTitle: { flex: 1, fontFamily: JAKARTA.bold, fontSize: 16, color: DS.ink },
  multiDayDesc: { fontFamily: JAKARTA.regular, fontSize: 13, color: DS.ink2, lineHeight: 19 },
  multiDayYes: { backgroundColor: AI_PURPLE, borderRadius: 12, paddingVertical: 13, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  multiDayYesText: { fontFamily: JAKARTA.bold, fontSize: 14, color: '#FFF' },
  multiDayNo: { paddingVertical: 10, alignItems: 'center', minHeight: 44, justifyContent: 'center' },
  multiDayNoText: { fontFamily: JAKARTA.medium, fontSize: 14, color: DS.inkMuted },
  segmented: {
    flexDirection: 'row',
    backgroundColor: DS.surface3,
    margin: 12,
    marginBottom: 0,
    borderRadius: 10,
    padding: 3,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: DS.surface, ...SHADOWS.sm },
  segmentText: { fontFamily: JAKARTA.semibold, fontSize: 11.5, color: DS.inkMuted },
  segmentTextActive: { color: DS.ink },
  pausedBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#DC2626',
    backgroundColor: DS.surface,
  },
  pausedBadge: { backgroundColor: '#DC2626', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  pausedBadgeText: { fontFamily: JAKARTA.bold, fontSize: 10, color: '#FFF', letterSpacing: 0.5 },
  pausedText: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 11.5, color: DS.ink2, minWidth: 160, lineHeight: 16 },
  pausedResumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginLeft: 'auto',
  },
  pausedResumeText: { fontFamily: JAKARTA.semibold, fontSize: 12, color: '#FFF' },
  content: { padding: 12 },
  label: { fontFamily: JAKARTA.semibold, fontSize: 12, color: DS.ink2, marginTop: 14, marginBottom: 6 },
  zonesHint: { fontFamily: JAKARTA.medium, fontSize: 10.5, color: DS.inkMuted, marginTop: 8, marginBottom: 6 },
  dateRow: { flexGrow: 0 },
  dateChip: {
    backgroundColor: DS.surface,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 64,
  },
  dateChipActive: { backgroundColor: AI_PURPLE, borderColor: AI_PURPLE },
  dateChipTop: { fontFamily: JAKARTA.semibold, fontSize: 12, color: DS.ink },
  dateChipBottom: { fontFamily: JAKARTA.regular, fontSize: 10, color: DS.inkMuted, marginTop: 1 },
  dateChipTextActive: { color: '#FFF' },
  timesRow: { flexDirection: 'row', gap: 12 },
  timeCol: { flex: 1 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: DS.surface,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: DS.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { fontFamily: JAKARTA.bold, fontSize: 16, color: DS.ink },
  dayTypeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayTypeCard: {
    width: '48.5%',
    backgroundColor: DS.surface,
    borderWidth: 1.5,
    borderColor: DS.border,
    borderRadius: 12,
    padding: 10,
  },
  dayTypeCardActive: { borderColor: AI_PURPLE, backgroundColor: AI_PURPLE_SOFT },
  dayTypeHeader: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dayTypeLabel: { fontFamily: JAKARTA.semibold, fontSize: 12, color: DS.ink, flexShrink: 1 },
  dayTypeDesc: { fontFamily: JAKARTA.regular, fontSize: 10, color: DS.inkMuted, marginTop: 3 },
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
  chipDisabled: { opacity: 0.45 },
  chipText: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink2 },
  chipTextActive: { color: '#FFF' },
  chipTextDisabled: { color: DS.inkMuted },
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
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DS.surface,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 10,
  },
  searchInput: { flex: 1, paddingHorizontal: 8, paddingVertical: 10, fontFamily: JAKARTA.regular, fontSize: 14, color: DS.ink },
  resultsBox: {
    backgroundColor: DS.surface,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
  },
  resultRow: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DS.border },
  resultName: { fontFamily: JAKARTA.medium, fontSize: 13, color: DS.ink },
  resultCity: { fontFamily: JAKARTA.regular, fontSize: 12, color: DS.inkMuted },
  mandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: AI_PURPLE_SOFT,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 11,
    maxWidth: '100%',
  },
  mandChipText: { fontFamily: JAKARTA.medium, fontSize: 12, color: AI_PURPLE_TEXT, maxWidth: 220, flex: 1 },
  mandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: AI_PURPLE_SOFT, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 9 },
  mandTimeLabel: { fontFamily: JAKARTA.regular, fontSize: 9.5, color: DS.inkMuted },
  mandTimeInput: { borderWidth: 1, borderColor: AI_PURPLE_BORDER, borderRadius: 7, paddingVertical: 4, paddingHorizontal: 6, fontFamily: JAKARTA.semibold, fontSize: 12, color: AI_PURPLE_TEXT, backgroundColor: DS.surface, width: 62, textAlign: 'center' },
  mandTimeHint: { fontFamily: JAKARTA.regular, fontSize: 10, color: DS.inkMuted },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: AI_PURPLE,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 20,
    ...SHADOWS.md,
  },
  generateBtnText: { fontFamily: JAKARTA.bold, fontSize: 15, color: '#FFF', letterSpacing: 0.4 },
  generateHint: { fontFamily: JAKARTA.regular, fontSize: 10, color: DS.inkMuted, textAlign: 'center', marginTop: 8 },
  generatingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, gap: 12 },
  generatingText: { fontFamily: JAKARTA.semibold, fontSize: 14, color: DS.ink2, textAlign: 'center' },
  generatingHint: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted, textAlign: 'center' },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#DBEAFE',
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  infoBannerText: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 11, color: '#1D4ED8' },
  errBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  errBannerText: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 11, color: '#991B1B' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: DS.surface,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionBtnText: { fontFamily: JAKARTA.semibold, fontSize: 12, color: DS.ink2 },
  saveBtn: { backgroundColor: '#059669', borderColor: '#059669', marginLeft: 'auto' },
  savedBtn: { backgroundColor: '#6B7280', borderColor: '#6B7280' },
  headerStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: AI_PURPLE,
    borderRadius: 10,
    paddingHorizontal: 13,
    minHeight: 40,
    marginLeft: 8,
  },
  headerStartText: { fontFamily: JAKARTA.bold, fontSize: 12.5, color: '#FFF' },
  resultMeta: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.inkMuted, marginTop: 12 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  kpiChip: {
    backgroundColor: DS.surface,
    borderRadius: 9,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: '31%',
    flexGrow: 1,
  },
  kpiLabel: { fontFamily: JAKARTA.medium, fontSize: 9, color: DS.inkMuted, letterSpacing: 0.3 },
  kpiValue: { fontFamily: JAKARTA.bold, fontSize: 13, color: DS.ink, marginTop: 1 },
  alertBox: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    alignItems: 'flex-start',
  },
  alertText: { flex: 1, fontFamily: JAKARTA.medium, fontSize: 12, lineHeight: 17 },
  fallbackNote: { fontFamily: JAKARTA.regular, fontSize: 10, color: DS.inkMuted, marginTop: 6 },
  viewToggle: { flexDirection: 'row', gap: 8, marginTop: 12 },
  viewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: DS.surface,
    borderWidth: 1,
    borderColor: DS.border,
    borderRadius: 9,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  viewToggleBtnActive: { backgroundColor: AI_PURPLE, borderColor: AI_PURPLE },
  viewToggleText: { fontFamily: JAKARTA.semibold, fontSize: 12, color: DS.ink2 },
  startRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 2 },
  startDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: AI_PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startText: { fontFamily: JAKARTA.semibold, fontSize: 13, color: DS.ink2, flex: 1 },
  stopCard: {
    backgroundColor: DS.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    ...SHADOWS.sm,
  },
  travelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 7 },
  travelText: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted },
  stopHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  seqBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: AI_PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  seqText: { fontFamily: JAKARTA.bold, fontSize: 13, color: '#FFF' },
  stopName: { fontFamily: JAKARTA.semibold, fontSize: 14, color: DS.ink },
  stopAddress: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted, marginTop: 2 },
  stopTimeBox: { alignItems: 'flex-end' },
  stopArrival: { fontFamily: JAKARTA.bold, fontSize: 15, color: DS.ink },
  stopDeparture: { fontFamily: JAKARTA.regular, fontSize: 10, color: DS.inkMuted, marginTop: 1 },
  stopWait: { fontFamily: JAKARTA.medium, fontSize: 9.5, color: '#B45309', marginTop: 1 },
  slotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: '#B45309',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  slotBadgeWarn: { borderColor: '#DC2626' },
  slotBadgeText: { fontFamily: JAKARTA.medium, fontSize: 9.5, color: '#B45309' },
  stopBadges: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9, flexWrap: 'wrap' },
  priorityBadge: { borderRadius: 6, paddingVertical: 3, paddingHorizontal: 7 },
  priorityBadgeText: { fontFamily: JAKARTA.semibold, fontSize: 10 },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#7C3AED',
    borderRadius: 7,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginLeft: 'auto',
  },
  navBtnText: { fontFamily: JAKARTA.semibold, fontSize: 11, color: '#FFF' },
  stopReason: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.ink2, marginTop: 8, lineHeight: 16 },
  excludedSection: {
    backgroundColor: DS.surface,
    borderRadius: 12,
    marginTop: 14,
    overflow: 'hidden',
  },
  excludedToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  excludedTitle: { fontFamily: JAKARTA.semibold, fontSize: 13, color: DS.ink2 },
  excludedRow: { paddingHorizontal: 12, paddingBottom: 10 },
  excludedName: { fontFamily: JAKARTA.medium, fontSize: 12, color: DS.ink },
  excludedScore: { fontFamily: JAKARTA.regular, color: DS.inkMuted },
  excludedWhy: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted, marginTop: 1 },
  emptyBox: { alignItems: 'center', marginTop: 60, gap: 8, paddingHorizontal: 30 },
  emptyTitle: { fontFamily: JAKARTA.semibold, fontSize: 15, color: DS.ink2 },
  emptyText: { fontFamily: JAKARTA.regular, fontSize: 12, color: DS.inkMuted, textAlign: 'center' },
  tourCard: {
    backgroundColor: DS.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    ...SHADOWS.sm,
  },
  tourHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tourDate: { fontFamily: JAKARTA.bold, fontSize: 14, color: DS.ink },
  statusBadge: { borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 },
  statusText: { fontFamily: JAKARTA.semibold, fontSize: 10 },
  tourInfo: { fontFamily: JAKARTA.regular, fontSize: 12, color: DS.ink2, marginTop: 5 },
  tourStart: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted, marginTop: 2 },
});
