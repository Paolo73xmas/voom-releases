/**
 * MpvpSearchBar — barra ricerca unificata mobile (parità funzionale con il web).
 *
 * Due sezioni in un unico dropdown:
 *  1) CLIENTI / PUNTI VENDITA: fuzzy su `tabaccherie` (denominazione, indirizzo,
 *     comune, P.IVA, cod. fiscale, cf_iva). Ranking client-side, no typo.
 *  2) LUOGHI: geocoding Nominatim (città / vie), tollerante.
 *
 * Debounce 350ms + race-condition guard. Al submit sceglie il primo cliente
 * disponibile, altrimenti il primo luogo.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  searchMpvpCustomers,
  fetchPlaces,
  type MpvpCustomerResult,
  type PlaceSuggestion,
} from '../../lib/api/mpvp-customer-search';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: MpvpCustomerResult) => void;
  onSelectPlace: (place: PlaceSuggestion) => void;
  topInset: number;
}

const matchBadgeLabel = (field: MpvpCustomerResult['matchedField']): string => {
  if (field === 'p.iva') return 'P.IVA';
  if (field === 'cod.fiscale') return 'Cod. Fisc.';
  if (field === 'comune') return 'Comune';
  if (field === 'indirizzo') return 'Indirizzo';
  return 'Nome';
};

export function MpvpSearchBar({
  visible,
  onClose,
  onSelectCustomer,
  onSelectPlace,
  topInset,
}: Props) {
  const [searchText, setSearchText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [placeResults, setPlaceResults] = useState<PlaceSuggestion[]>([]);
  const [customerResults, setCustomerResults] = useState<MpvpCustomerResult[]>([]);

  const inputRef = useRef<TextInput | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqIdRef = useRef(0);

  // Auto-focus al primo mount (visible=true)
  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 60);
    } else {
      // reset quando si chiude
      setSearchText('');
      setPlaceResults([]);
      setCustomerResults([]);
      setIsLoading(false);
    }
  }, [visible]);

  const runSearch = useCallback((term: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!term || term.trim().length < 2) {
      setPlaceResults([]);
      setCustomerResults([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      const myReq = ++reqIdRef.current;
      try {
        const [customers, places] = await Promise.all([
          searchMpvpCustomers(term, 8).catch(() => [] as MpvpCustomerResult[]),
          fetchPlaces(term).catch(() => [] as PlaceSuggestion[]),
        ]);
        if (myReq !== reqIdRef.current) return;
        setCustomerResults(customers);
        setPlaceResults(places);
      } finally {
        if (myReq === reqIdRef.current) setIsLoading(false);
      }
    }, 350);
  }, []);

  const handleChange = (v: string) => {
    setSearchText(v);
    runSearch(v);
  };

  const handleSelectCustomer = (c: MpvpCustomerResult) => {
    if (c.latitude == null || c.longitude == null) return;
    Keyboard.dismiss();
    onSelectCustomer(c);
  };

  const handleSelectPlace = (p: PlaceSuggestion) => {
    Keyboard.dismiss();
    onSelectPlace(p);
  };

  const handleSubmit = () => {
    if (customerResults.length > 0) {
      handleSelectCustomer(customerResults[0]);
    } else if (placeResults.length > 0) {
      handleSelectPlace(placeResults[0]);
    }
  };

  const clearText = () => {
    setSearchText('');
    setPlaceResults([]);
    setCustomerResults([]);
    inputRef.current?.focus();
  };

  if (!visible) return null;

  const hasResults = customerResults.length > 0 || placeResults.length > 0;
  const showEmpty = !hasResults && !isLoading && searchText.trim().length >= 2;

  return (
    <View style={[s.overlay, { paddingTop: topInset + 8 }]} pointerEvents="box-none">
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.container}>
        {/* Input row */}
        <View style={s.inputRow}>
          <Ionicons name="search" size={20} color="#C2410C" />
          <TextInput
            ref={inputRef}
            style={s.input}
            placeholder="Cliente, P.IVA, città, via..."
            placeholderTextColor="#9CA3AF"
            value={searchText}
            onChangeText={handleChange}
            returnKeyType="search"
            onSubmitEditing={handleSubmit}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {isLoading && <ActivityIndicator size="small" color="#C2410C" />}
          {!isLoading && searchText.length > 0 && (
            <TouchableOpacity onPress={clearText} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} hitSlop={8} style={s.closeBtn}>
            <Text style={s.closeText}>Chiudi</Text>
          </TouchableOpacity>
        </View>

        {/* Dropdown risultati */}
        {(hasResults || showEmpty || (isLoading && !hasResults)) && (
          <View style={s.dropdown}>
            {showEmpty && (
              <View style={s.emptyRow}>
                <Text style={s.emptyText}>Nessun risultato</Text>
              </View>
            )}

            {isLoading && !hasResults && (
              <View style={s.emptyRow}>
                <ActivityIndicator size="small" color="#C2410C" />
                <Text style={[s.emptyText, { marginLeft: 8 }]}>Ricerca in corso...</Text>
              </View>
            )}

            <ScrollView
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 380 }}
              showsVerticalScrollIndicator={true}
            >
              {/* Sezione CLIENTI */}
              {customerResults.length > 0 && (
                <View>
                  <View style={[s.sectionHeader, { backgroundColor: '#FFF7ED', borderBottomColor: '#FFF7ED' }]}>
                    <Ionicons name="storefront" size={13} color="#C2410C" />
                    <Text style={[s.sectionHeaderText, { color: '#6D28D9' }]}>Clienti / Punti vendita</Text>
                  </View>
                  {customerResults.map((c) => (
                    <TouchableOpacity
                      key={`cust-${c.id}`}
                      style={s.resultRow}
                      onPress={() => handleSelectCustomer(c)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.iconBubble, { backgroundColor: '#FFF7ED' }]}>
                        <Ionicons name="storefront" size={14} color="#C2410C" />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={s.resultTitleRow}>
                          <Text style={s.resultTitle} numberOfLines={1}>
                            {c.denominazione || 'Punto vendita'}
                          </Text>
                          <View style={s.matchBadge}>
                            <Text style={s.matchBadgeText}>{matchBadgeLabel(c.matchedField)}</Text>
                          </View>
                        </View>
                        <Text style={s.resultSub} numberOfLines={1}>
                          {[c.indirizzo, c.comune, c.provincia ? `(${c.provincia})` : '']
                            .filter(Boolean)
                            .join(', ')}
                        </Text>
                        {c.partita_iva ? (
                          <View style={s.pivaRow}>
                            <Ionicons name="pricetag-outline" size={10} color="#9CA3AF" />
                            <Text style={s.pivaText}>P.IVA {c.partita_iva}</Text>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Sezione LUOGHI */}
              {placeResults.length > 0 && (
                <View>
                  <View style={[s.sectionHeader, { backgroundColor: '#EFF6FF', borderBottomColor: '#DBEAFE' }]}>
                    <Ionicons name="location" size={13} color="#2563EB" />
                    <Text style={[s.sectionHeaderText, { color: '#1D4ED8' }]}>Luoghi (città / vie)</Text>
                  </View>
                  {placeResults.map((p, i) => (
                    <TouchableOpacity
                      key={`place-${i}`}
                      style={s.resultRow}
                      onPress={() => handleSelectPlace(p)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.iconBubble, { backgroundColor: '#DBEAFE' }]}>
                        <Ionicons name="location" size={14} color="#2563EB" />
                      </View>
                      <Text style={s.placeLabel} numberOfLines={2}>{p.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  container: {
    marginHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    paddingVertical: Platform.OS === 'ios' ? 4 : 6,
  },
  closeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  closeText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  dropdown: {
    backgroundColor: '#FFFFFF',
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  iconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  resultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  matchBadge: {
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  matchBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#C2410C',
    letterSpacing: 0.3,
  },
  resultSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  pivaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  pivaText: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  placeLabel: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
});
