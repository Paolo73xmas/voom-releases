// Tab "Portafoglio" (parità web): attività recente dei clienti (ultime 3 visite
// con esito, ultimo ordine/ispezione, ultimo passaggio — rosso oltre 60 gg o mai)
// e potenziali punti vendita nelle zone assegnate. Solo consultazione su mobile.
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { DS, JAKARTA } from '../../lib/theme';
import { AI_PURPLE_TEXT } from './shared';
import { loadCustomerActivity, loadZonePotentials, type CustomerActivityRow, type PotentialRow } from '../../lib/aitour/portfolio';
import type { AiTourSettings } from '../../lib/aitour/types';
import type { TerritoryZone } from '../../lib/aitour/territories';

const LATE_DAYS = 60;
const PAGE = 50;

const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const OUTCOME_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
  positive: { label: 'Positivo', bg: '#D1FAE5', fg: '#047857' },
  negative: { label: 'Negativo', bg: '#FEE2E2', fg: '#B91C1C' },
  neutral: { label: 'Neutro', bg: '#E2E8F0', fg: '#475569' },
  no_sale: { label: 'No vendita', bg: '#FEF3C7', fg: '#B45309' },
};

const STATO_BADGE: Record<PotentialRow['stato'], { label: string; bg: string; fg: string }> = {
  libera: { label: 'Libera', bg: '#E2E8F0', fg: '#475569' },
  prospect: { label: 'Prospect', bg: '#DBEAFE', fg: '#1D4ED8' },
  orfano: { label: 'Orfano', bg: '#F3E8FF', fg: '#6D28D9' },
};

interface Props {
  agentId: string;
  settings: AiTourSettings;
  zones: TerritoryZone[];
}

export function PortfolioTab({ agentId, settings, zones }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState<CustomerActivityRow[]>([]);
  const [potentials, setPotentials] = useState<PotentialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPot, setLoadingPot] = useState(true);
  const [errMsg, setErrMsg] = useState('');
  const [search, setSearch] = useState('');
  const [searchPot, setSearchPot] = useState('');
  const [sortAsc, setSortAsc] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [shownPot, setShownPot] = useState(PAGE);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadingPot(true);
    setErrMsg('');
    loadCustomerActivity(agentId)
      .then((r) => { if (!cancelled) setRows(r); })
      .catch(() => { if (!cancelled) setErrMsg('Errore caricamento clienti'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    loadZonePotentials(agentId, settings, zones)
      .then((r) => { if (!cancelled) setPotentials(r); })
      .catch(() => { if (!cancelled) setErrMsg((e) => e || 'Errore caricamento potenziali in zona'); })
      .finally(() => { if (!cancelled) setLoadingPot(false); });
    return () => { cancelled = true; };
  }, [agentId, settings, zones]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.city.toLowerCase().includes(q)) : rows;
    return [...base].sort((a, b) => {
      const da = a.daysSincePassage ?? 99999;
      const db = b.daysSincePassage ?? 99999;
      return sortAsc ? da - db : db - da;
    });
  }, [rows, search, sortAsc]);

  const filteredPot = useMemo(() => {
    const q = searchPot.trim().toLowerCase();
    return q
      ? potentials.filter((r) => r.name.toLowerCase().includes(q) || r.city.toLowerCase().includes(q) || r.zone.toLowerCase().includes(q))
      : potentials;
  }, [potentials, searchPot]);

  const lateCount = rows.filter((r) => r.daysSincePassage == null || r.daysSincePassage > LATE_DAYS).length;

  return (
    <View style={styles.wrap}>
      {errMsg ? (
        <View style={styles.errBox}><Text style={styles.errText}>{errMsg}</Text></View>
      ) : null}

      {/* ===== Clienti e attività recente ===== */}
      <View style={styles.card}>
        <View style={styles.headRow}>
          <Text style={styles.cardTitle}>Clienti e attività recente</Text>
          <View style={styles.badge}><Text style={styles.badgeText}>{rows.length} clienti</Text></View>
          {lateCount > 0 && (
            <View style={[styles.badge, styles.badgeRed]}>
              <Text style={[styles.badgeText, styles.badgeTextRed]}>{lateCount} oltre {LATE_DAYS} gg</Text>
            </View>
          )}
        </View>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={15} color={DS.inkMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={(t) => { setSearch(t); setShown(PAGE); }}
            placeholder="Cerca cliente o comune..."
            placeholderTextColor={DS.inkMuted}
          />
          <TouchableOpacity style={styles.sortBtn} onPress={() => setSortAsc((x) => !x)} activeOpacity={0.7}>
            <Ionicons name={sortAsc ? 'arrow-up' : 'arrow-down'} size={13} color={AI_PURPLE_TEXT} />
            <Text style={styles.sortText}>Giorni</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginVertical: 24 }} color={AI_PURPLE_TEXT} />
        ) : filtered.length === 0 ? (
          <Text style={styles.emptyText}>Nessun cliente trovato</Text>
        ) : (
          <>
            {filtered.slice(0, shown).map((r) => {
              const late = r.daysSincePassage == null || r.daysSincePassage > LATE_DAYS;
              return (
                <TouchableOpacity
                  key={r.customerId}
                  style={styles.row}
                  onPress={() => router.push(`/customer/${r.customerId}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowTop}>
                    <Text style={styles.rowName} numberOfLines={1}>{r.name}</Text>
                    <Text style={[styles.daysText, late && styles.daysLate]}>
                      {r.daysSincePassage == null ? 'mai' : `${r.daysSincePassage} gg`}
                    </Text>
                  </View>
                  <Text style={styles.rowCity} numberOfLines={1}>{r.city}{r.address ? ` · ${r.address}` : ''}</Text>
                  <View style={styles.chipsRow}>
                    {r.lastVisits.length === 0 && <Text style={styles.noVisits}>nessuna visita</Text>}
                    {r.lastVisits.map((v, i) => {
                      const b = OUTCOME_BADGE[v.outcome || ''] || { label: v.outcome || 'Visita', bg: '#E2E8F0', fg: '#475569' };
                      return (
                        <View key={i} style={[styles.visitChip, { backgroundColor: b.bg }]}>
                          <Text style={[styles.visitChipText, { color: b.fg }]}>{fmtDate(v.date)} · {b.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <Text style={styles.datesLine}>
                    Ordine {fmtDate(r.lastOrderDate)} · Ispezione {fmtDate(r.lastInspectionDate)} · Passaggio {fmtDate(r.lastPassageDate)}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {filtered.length > shown && (
              <TouchableOpacity style={styles.moreBtn} onPress={() => setShown((s) => s + PAGE)} activeOpacity={0.7}>
                <Text style={styles.moreText}>Mostra altri ({filtered.length - shown})</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* ===== Potenziali clienti in zona ===== */}
      <View style={styles.card}>
        <View style={styles.headRow}>
          <Text style={styles.cardTitle}>Potenziali clienti in zona</Text>
          {zones.length > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{potentials.length} punti vendita</Text></View>
          )}
        </View>
        {zones.length === 0 ? (
          <Text style={styles.emptyText}>
            {"Nessun territorio assegnato: chiedi all'admin di assegnare le zone per vedere i potenziali clienti."}
          </Text>
        ) : (
          <>
            <View style={styles.searchRow}>
              <Ionicons name="search" size={15} color={DS.inkMuted} />
              <TextInput
                style={styles.searchInput}
                value={searchPot}
                onChangeText={(t) => { setSearchPot(t); setShownPot(PAGE); }}
                placeholder="Cerca punto vendita, comune o zona..."
                placeholderTextColor={DS.inkMuted}
              />
            </View>
            {loadingPot ? (
              <ActivityIndicator style={{ marginVertical: 24 }} color={AI_PURPLE_TEXT} />
            ) : filteredPot.length === 0 ? (
              <Text style={styles.emptyText}>Nessun potenziale trovato nelle zone</Text>
            ) : (
              <>
                {filteredPot.slice(0, shownPot).map((r) => {
                  const b = STATO_BADGE[r.stato];
                  return (
                    <View key={r.key} style={styles.row}>
                      <View style={styles.rowTop}>
                        <Text style={styles.rowName} numberOfLines={1}>{r.name}</Text>
                        <View style={[styles.visitChip, { backgroundColor: b.bg }]}>
                          <Text style={[styles.visitChipText, { color: b.fg }]}>{b.label}</Text>
                        </View>
                      </View>
                      <Text style={styles.rowCity} numberOfLines={1}>{r.city}{r.address ? ` · ${r.address}` : ''}</Text>
                      <Text style={styles.datesLine}>
                        {r.zone ? `Zona ${r.zone} · ` : ''}Già visitata: {r.lastVisitDate ? `sì (${fmtDate(r.lastVisitDate)})` : 'no'}
                      </Text>
                    </View>
                  );
                })}
                {filteredPot.length > shownPot && (
                  <TouchableOpacity style={styles.moreBtn} onPress={() => setShownPot((s) => s + PAGE)} activeOpacity={0.7}>
                    <Text style={styles.moreText}>Mostra altri ({filteredPot.length - shownPot})</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  card: { backgroundColor: DS.surface, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: DS.border },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 },
  cardTitle: { fontFamily: JAKARTA.bold, fontSize: 14, color: DS.ink },
  badge: { backgroundColor: DS.surface2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontFamily: JAKARTA.semibold, fontSize: 10, color: DS.ink2 },
  badgeRed: { backgroundColor: '#FEE2E2' },
  badgeTextRed: { color: '#B91C1C' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: DS.surface2, borderRadius: 10, paddingHorizontal: 10, marginBottom: 8, minHeight: 38,
  },
  searchInput: { flex: 1, fontFamily: JAKARTA.regular, fontSize: 13, color: DS.ink, paddingVertical: 8 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 6 },
  sortText: { fontFamily: JAKARTA.semibold, fontSize: 11, color: AI_PURPLE_TEXT },
  row: { borderTopWidth: 1, borderTopColor: DS.border, paddingVertical: 9, gap: 3 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { flex: 1, fontFamily: JAKARTA.semibold, fontSize: 13, color: DS.ink },
  rowCity: { fontFamily: JAKARTA.regular, fontSize: 11.5, color: DS.inkMuted },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  visitChip: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2.5 },
  visitChipText: { fontFamily: JAKARTA.semibold, fontSize: 9.5 },
  noVisits: { fontFamily: JAKARTA.regular, fontSize: 11, color: DS.inkMuted },
  datesLine: { fontFamily: JAKARTA.regular, fontSize: 10.5, color: DS.ink2, marginTop: 2 },
  daysText: { fontFamily: JAKARTA.bold, fontSize: 12, color: DS.ink2 },
  daysLate: { color: '#EF4444' },
  emptyText: { fontFamily: JAKARTA.regular, fontSize: 12, color: DS.inkMuted, textAlign: 'center', paddingVertical: 16 },
  errBox: { backgroundColor: '#FEE2E2', borderRadius: 10, padding: 10 },
  errText: { fontFamily: JAKARTA.medium, fontSize: 12, color: '#B91C1C' },
  moreBtn: { alignItems: 'center', paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  moreText: { fontFamily: JAKARTA.semibold, fontSize: 12, color: AI_PURPLE_TEXT },
});
