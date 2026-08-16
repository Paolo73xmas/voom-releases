// AI Tour mobile: assistente AI per la pianificazione dei giri visita (parità logica con la web app).
import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { DS, JAKARTA, SHADOWS } from '../lib/theme';
import { hap } from '../lib/haptics';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { listAllZones, pointInZones, type TerritoryZone } from '../lib/aitour/territories';
import { loadCandidates, loadFreeTabaccherie } from '../lib/aitour/data';
import { scoreCandidates, computePortfolioStats } from '../lib/aitour/scoring';
import { planTour, filterByArea, pickBestCluster, candidatesForDayType, type AreaFilter } from '../lib/aitour/planner';
import { getStrategySummary, recommendDayType } from '../lib/aitour/ai';
import { getSettings, saveTour, listTours, loadTourStops, deleteTour, type SavedTour } from '../lib/aitour/tours';
import { geocodeAddress } from '../lib/aitour/osrm';
import type { TourPlan, GeoPoint, AiTourSettings, DayType, EntityType, PriorityClass } from '../lib/aitour/types';
import { DEFAULT_SETTINGS, timeToMin, minToTime, fmtDur, fmtEur, haversineKm, ENTITY_LABELS, ENTITY_COLORS } from '../lib/aitour/types';

const AI_PURPLE = '#7C3AED';
const AI_PURPLE_SOFT = '#F3E8FF';

const PRIORITY_COLORS: Record<PriorityClass, string> = {
  Urgente: '#DC2626',
  Alta: '#EA580C',
  Media: '#D97706',
  Bassa: '#64748B',
};

const DAY_TYPES: { value: DayType; label: string; desc: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'clienti', label: 'Giro Clienti', desc: 'Clienti già acquisiti da rivisitare', icon: 'people-outline' },
  { value: 'sviluppo', label: 'Sviluppo Territorio', desc: 'Prospect, orfani, mai visitate e recuperi', icon: 'compass-outline' },
  { value: 'mista', label: 'Giornata Mista', desc: 'Mix ragionato di clienti e sviluppo', icon: 'shuffle-outline' },
  { value: 'ai', label: 'Decidi tu AI', desc: "L'AI analizza il portafoglio e sceglie", icon: 'sparkles-outline' },
];

type StartMode = 'current' | 'address' | 'home' | 'office';
type EndMode = 'none' | 'start' | 'address' | 'home' | 'office';
type AreaMode = 'auto' | 'territory' | 'province' | 'city' | 'radius';

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

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  planned: { label: 'Pianificato', color: '#1D4ED8', bg: '#DBEAFE' },
  active: { label: 'In corso', color: '#047857', bg: '#D1FAE5' },
  completed: { label: 'Completato', color: '#374151', bg: '#E5E7EB' },
  cancelled: { label: 'Annullato', color: '#991B1B', bg: '#FEE2E2' },
};

async function getCurrentPositionMobile(): Promise<{ lat: number; lng: number } | null> {
  try {
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== 'granted') {
      if (perm.canAskAgain) {
        perm = await Location.requestForegroundPermissionsAsync();
      }
      if (perm.status !== 'granted') {
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
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (e) {
    console.warn('[AITour] posizione corrente:', e);
    return null;
  }
}

function openNavigation(lat: number, lng: number, label: string) {
  const encoded = encodeURIComponent(label);
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${lat},${lng}&q=${encoded}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  });
  Linking.openURL(url as string).catch(() => {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`).catch(() => {});
  });
}

export default function AITourScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const agentId = user?.id || '';

  const [tab, setTab] = useState<'genera' | 'tours'>('genera');
  const [phase, setPhase] = useState<'form' | 'result'>('form');
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

  // Visite obbligatorie
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<{ id: string; business_name: string; city: string | null }[]>([]);
  const [selectedMandatory, setSelectedMandatory] = useState<{ id: string; business_name: string }[]>([]);

  // Tour salvati
  const [savedTours, setSavedTours] = useState<SavedTour[]>([]);
  const [loadingTours, setLoadingTours] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    getSettings(agentId).then((s) => {
      setSettings(s);
      setForm((old) => ({ ...old, startTime: autoStartTime(old.date, s.work_start), endTime: s.work_end }));
    });
    listAllZones()
      .then((z) => {
        const mine = z.filter((x) => x.agent_id === agentId);
        setAgentZones(mine);
        if (mine.length > 0) setForm((old) => (old.areaMode === 'auto' ? { ...old, areaMode: 'territory' } : old));
      })
      .catch(() => setAgentZones([]));
  }, [agentId]);

  // Ricerca clienti per visite obbligatorie
  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('customers')
        .select('id, business_name, city')
        .eq('agent_id', agentId)
        .not('latitude', 'is', null)
        .ilike('business_name', `%${search.trim()}%`)
        .limit(8);
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
  };

  const resolvePoint = useCallback(
    async (mode: string, address: string, start: GeoPoint | null): Promise<GeoPoint | null> => {
      if (mode === 'none') return null;
      if (mode === 'start') return start;
      if (mode === 'current') {
        const p = await getCurrentPositionMobile();
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
    setGenerating(true);
    setInfoMsg('');
    setErrMsg('');
    setSavedTourId(null);
    setShowExcluded(false);
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
      const start = await resolvePoint(v.startMode, v.startAddress, null);
      if (!start) {
        setErrMsg(
          v.startMode === 'current'
            ? 'Posizione non disponibile: consenti la geolocalizzazione o usa un indirizzo manuale'
            : 'Punto di partenza non valido'
        );
        setGenerating(false);
        return;
      }
      const end = await resolvePoint(v.endMode, v.endAddress, start);

      setProgress('Analisi del portafoglio commerciale...');
      const loaded = await loadCandidates(agentId, settings);
      scoreCandidates([...loaded.clients, ...loaded.prospects, ...loaded.orphans], settings);

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
      const area: AreaFilter = {
        mode: v.areaMode,
        province: v.province,
        city: v.city,
        radiusKm,
        zones: v.areaMode === 'territory' ? agentZones : undefined,
      };
      candidates = filterByArea(candidates, area, start);
      let areaLabel =
        v.areaMode === 'territory'
          ? agentZones.map((z) => z.zone_name).join(' + ') || 'territorio assegnato'
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
        if (v.areaMode === 'territory' && agentZones.length > 0) {
          let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
          for (const z of agentZones) {
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
        if (v.areaMode === 'territory' && agentZones.length > 0) {
          free = free.filter((c) => pointInZones(c.lat, c.lng, agentZones));
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
        const cand = all.find((c) => c.customerId === id);
        if (cand) {
          mandatoryKeys.add(cand.key);
          if (!candidates.find((c) => c.key === cand.key)) candidates = [...candidates, cand];
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

      setProgress("L'AI sta scrivendo la strategia del giro...");
      newPlan.aiSummary = await getStrategySummary(newPlan);
      setPlan(newPlan);
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

  const save = async () => {
    if (!plan || !agentId || savedTourId) return;
    hap.medium();
    setSaving(true);
    try {
      const id = await saveTour(agentId, plan);
      setSavedTourId(id);
      hap.success();
    } catch (err) {
      console.error('[AITour] save:', err);
      setErrMsg('Errore nel salvataggio del tour');
    } finally {
      setSaving(false);
    }
  };

  const viewSaved = async (tour: SavedTour) => {
    hap.light();
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
                <Ionicons name={d.icon} size={16} color={active ? AI_PURPLE : DS.ink2} />
                <Text style={[styles.dayTypeLabel, active && { color: AI_PURPLE }]}>{d.label}</Text>
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
        {renderChip('Automatica (AI)', form.areaMode === 'auto', () => set('areaMode', 'auto'))}
        {renderChip('Provincia', form.areaMode === 'province', () => set('areaMode', 'province'))}
        {renderChip('Comune', form.areaMode === 'city', () => set('areaMode', 'city'))}
        {renderChip('Raggio km', form.areaMode === 'radius', () => set('areaMode', 'radius'))}
      </View>
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
          placeholder="Cerca cliente o prospect..."
          placeholderTextColor={DS.inkMuted}
        />
      </View>
      {results.length > 0 && (
        <View style={styles.resultsBox}>
          {results.map((r) => (
            <TouchableOpacity key={r.id} style={styles.resultRow} onPress={() => addMandatory(r)} activeOpacity={0.6}>
              <Text style={styles.resultName} numberOfLines={1}>
                {r.business_name} <Text style={styles.resultCity}>{r.city || ''}</Text>
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {selectedMandatory.length > 0 && (
        <View style={styles.chipRow}>
          {selectedMandatory.map((s) => (
            <View key={s.id} style={styles.mandChip}>
              <Text style={styles.mandChipText} numberOfLines={1}>
                {s.business_name}
              </Text>
              <TouchableOpacity onPress={() => removeMandatory(s.id)} hitSlop={8}>
                <Ionicons name="close" size={14} color={AI_PURPLE} />
              </TouchableOpacity>
            </View>
          ))}
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
        {/* Azioni */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              hap.light();
              setPhase('form');
              setReadOnly(false);
              setSavedTourId(null);
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
              onPress={save}
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
        </View>

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
          <View style={[styles.alertBox, { backgroundColor: AI_PURPLE_SOFT, borderColor: '#DDD6FE' }]}>
            <Ionicons name="sparkles" size={14} color={AI_PURPLE} />
            <Text style={[styles.alertText, { color: '#5B21B6' }]}>{plan.aiRecommendation}</Text>
          </View>
        ) : null}
        {plan.aiSummary ? (
          <View style={[styles.alertBox, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
            <Ionicons name="sparkles" size={14} color="#2563EB" />
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
              </View>
            </View>
            <View style={styles.stopBadges}>
              <View style={[styles.entityBadge, { borderColor: ENTITY_COLORS[s.candidate.entityType] }]}>
                <Text style={[styles.entityBadgeText, { color: ENTITY_COLORS[s.candidate.entityType] }]}>
                  {ENTITY_LABELS[s.candidate.entityType]}
                </Text>
              </View>
              <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[s.candidate.priorityClass] + '1A' }]}>
                <Text style={[styles.priorityBadgeText, { color: PRIORITY_COLORS[s.candidate.priorityClass] }]}>
                  {s.candidate.priorityClass} · {s.candidate.score}/100
                </Text>
              </View>
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => {
                  hap.light();
                  openNavigation(s.candidate.lat, s.candidate.lng, s.candidate.name);
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
        <ActivityIndicator style={{ marginTop: 40 }} color={AI_PURPLE} />
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
            <Ionicons name="sparkles" size={18} color={AI_PURPLE} />
            <Text style={styles.title}>AI Tour</Text>
          </View>
          <Text style={styles.subtitle}>Pianificazione AI dei giri visita</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.segmented}>
        <TouchableOpacity
          style={[styles.segment, tab === 'genera' && styles.segmentActive]}
          onPress={() => {
            hap.light();
            setTab('genera');
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.segmentText, tab === 'genera' && styles.segmentTextActive]}>Genera Tour</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, tab === 'tours' && styles.segmentActive]}
          onPress={() => {
            hap.light();
            setTab('tours');
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.segmentText, tab === 'tours' && styles.segmentTextActive]}>I miei Tour</Text>
        </TouchableOpacity>
      </View>

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
          <ActivityIndicator size="large" color={AI_PURPLE} />
          <Text style={styles.generatingText}>{progress}</Text>
          <Text style={styles.generatingHint}>Selezione commerciale → clustering → pianificazione temporale</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            tab === 'tours' ? <RefreshControl refreshing={loadingTours} onRefresh={loadSavedTours} tintColor={AI_PURPLE} /> : undefined
          }
        >
          {tab === 'genera' ? (phase === 'form' ? renderForm() : renderResult()) : renderSavedTours()}
        </ScrollView>
      )}
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
  segmentText: { fontFamily: JAKARTA.semibold, fontSize: 13, color: DS.inkMuted },
  segmentTextActive: { color: DS.ink },
  content: { padding: 12 },
  label: { fontFamily: JAKARTA.semibold, fontSize: 12, color: DS.ink2, marginTop: 14, marginBottom: 6 },
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
  mandChipText: { fontFamily: JAKARTA.medium, fontSize: 12, color: '#5B21B6', maxWidth: 220 },
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
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
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
  stopBadges: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 9, flexWrap: 'wrap' },
  entityBadge: { borderWidth: 1, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 },
  entityBadgeText: { fontFamily: JAKARTA.semibold, fontSize: 10 },
  priorityBadge: { borderRadius: 6, paddingVertical: 3, paddingHorizontal: 7 },
  priorityBadgeText: { fontFamily: JAKARTA.semibold, fontSize: 10 },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
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
