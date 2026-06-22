/**
 * RAC. ORDINE 2 — Complete rewrite based on web app OrderCollection.tsx
 * For Agent users only.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
  Keyboard, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { fetchCustomers } from '../lib/api/customers';
import { fetchProducts, fetchPaymentMethods, fetchShippingMethods } from '../lib/api/order-collection';
import { createReservation, getAvailableStock, getBranchAvailableStock } from '../lib/api/stock-reservation';
import { subtractStockForOrder, verifyAndSetStockSubtracted, subtractBranchStockForOrder, isBranchVirtual } from '../lib/api/stock-management';
import { processCashBackUsage, processCashBackAccumulation } from '../lib/api/cashback';
import { saveDraft, deleteDraft, getDrafts, generateDraftId, OrderDraft } from '../lib/drafts';
import { useVirtualBranch } from '../hooks/useVirtualBranch';
import type { AvailableStockMap } from '../types/reservation';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════
interface Customer {
  id: string;
  business_name: string;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  vat_number?: string;
  fiscal_code?: string;
  pec?: string;
  sdi?: string;
  customer_type?: string;
  tabaccheria_id?: string;
}

interface Product {
  id: string;
  name: string;
  short_description?: string;
  sku: string;
  unit_price: number;
  supplier_id: string;
  unit_of_measure?: string;
  accisa?: number;
  iva_percentage?: number;
  image_url?: string | null;
  is_active: boolean;
  cashback_eligible?: boolean;
  estero?: boolean;
  rottamazione_no?: boolean;
  stock_quantity?: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
}

interface PaymentMethod {
  id: string; name: string; description?: string; is_active: boolean;
}

interface ShippingMethod {
  id: string; name: string; description?: string; cost: number;
  is_active: boolean; foreign_only?: boolean;
}

interface PackageData {
  id: string; name: string; is_active: boolean;
  items: Array<{
    id: string; product_id: string; quantity: number;
    unit_price?: number | null;
    products: Product | null;
  }>;
}

// ═══════════════════════════════════════════════════════
// UTILITY FUNCTIONS (matching web app exactly)
// ═══════════════════════════════════════════════════════

/**
 * Web parity helper: rileva se la short_description del prodotto inizia con "EST-"
 * (prodotti dedicati all'estero). Per questi prodotti accisa e IVA sono SEMPRE 0.
 */
const isEsteroDescription = (shortDesc?: string | null): boolean => {
  return !!(shortDesc && shortDesc.trim().toUpperCase().startsWith('EST-'));
};

/**
 * Calculate line total for an item — matches web app logic.
 *
 * REGOLE (aggiornate alla web app — vedere OrderCollection.tsx):
 * • ACCISA: azzerata SOLO per prodotti con short_description "EST-" (prefisso).
 *   Un prodotto con estero=true MA senza prefisso "EST-" mantiene l'accisa anche in ordine estero.
 * • IVA: azzerata per ordini esteri (isForeign=true) OPPURE prodotti "EST-".
 */
const calculateLineTotal = (
  quantity: number, unitPrice: number,
  accisa: number = 0, ivaPercentage: number = 22,
  isForeign: boolean = false,
  shortDescription?: string | null
): number => {
  const isEstPrefix = isEsteroDescription(shortDescription);
  const effectiveAccisa = isEstPrefix ? 0 : accisa;
  const isVatExempt = isForeign || isEstPrefix;
  const priceWithAccisa = unitPrice + effectiveAccisa;
  const subtotal = priceWithAccisa * quantity;
  if (isVatExempt) return subtotal;
  return subtotal * (1 + ivaPercentage / 100);
};

/** Calculate shipping cost with VAT — matches web app */
const getShippingCostWithVAT = (shippingCost: number, isForeign: boolean): number => {
  if (isForeign) return shippingCost;
  return shippingCost * 1.22;
};

/** Distribute discount proportionally across items — matches web app */
function distributeDiscountToItems(
  items: Array<{ product_id: string; quantity: number; unit_price: number }>,
  discountAmount: number
): Array<{ product_id: string; quantity: number; unit_price: number; original_unit_price: number }> {
  const itemsTotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  if (itemsTotal <= 0 || discountAmount <= 0) {
    return items.map(i => ({ ...i, original_unit_price: i.unit_price }));
  }

  const rawDiscounts = items.map(item => {
    const lineValue = item.unit_price * item.quantity;
    const proportion = lineValue / itemsTotal;
    return Math.round(discountAmount * proportion * 100) / 100;
  });

  const totalDistributed = rawDiscounts.reduce((sum, d) => sum + d, 0);
  let roundingRemainder = Math.round((discountAmount - totalDistributed) * 100) / 100;

  if (roundingRemainder !== 0) {
    for (let i = items.length - 1; i >= 0 && Math.abs(roundingRemainder) > 0.001; i--) {
      const lineValue = items[i].unit_price * items[i].quantity;
      const maxAbsorbable = lineValue - rawDiscounts[i];
      if (roundingRemainder > 0 && maxAbsorbable > 0) {
        const toAdd = Math.min(roundingRemainder, maxAbsorbable);
        rawDiscounts[i] = Math.round((rawDiscounts[i] + toAdd) * 100) / 100;
        roundingRemainder = Math.round((roundingRemainder - toAdd) * 100) / 100;
      } else if (roundingRemainder < 0) {
        rawDiscounts[i] = Math.round((rawDiscounts[i] + roundingRemainder) * 100) / 100;
        roundingRemainder = 0;
      }
    }
  }

  return items.map((item, index) => {
    const lineValue = item.unit_price * item.quantity;
    const itemDiscount = rawDiscounts[index];
    const newLineValue = Math.max(0, lineValue - itemDiscount);
    const newUnitPrice = item.quantity > 0
      ? Math.max(0, Math.round((newLineValue / item.quantity) * 100) / 100)
      : 0;
    return { ...item, original_unit_price: item.unit_price, unit_price: newUnitPrice };
  });
}

const formatCurrency = (v: number) => `€${v.toFixed(2)}`;

const DEFAULT_ROTTAMAZIONE_LOTS = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
const DEFAULT_ROTTAMAZIONE_MULTIPLIER = 2.5;
const DEFAULT_ROTTAMAZIONE_IVA_RATE = 1.22;

const STEPS = ['Cliente', 'Prodotti', 'Pagamento', 'Spedizione', 'Riepilogo'];

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════
export default function OrderCollectionV2() {
  const router = useRouter();
  const params = useLocalSearchParams<{ draftId?: string }>();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();
  // ✅ Web parity: Virtual branches use central warehouse stock (no branch overlay)
  // ✅ Web parity: estero_orders_enabled flag controls visibility of "Italia/Estero" toggle
  const { isVirtualBranch, esteroOrdersEnabled, isLoading: vbLoading } = useVirtualBranch();

  // Toggle Italia/Estero visibile SOLO se:
  // - branch NON virtuale (sempre visibile)
  // - oppure branch virtuale CON estero_orders_enabled = true
  const canToggleEstero = !isVirtualBranch || esteroOrdersEnabled;

  // ── Navigation ──
  const [currentStep, setCurrentStep] = useState(0);

  // ── Data Lists ──
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  // ✅ Web parity: categorie disabilitate per l'utente (user_category_permissions con is_allowed=false)
  // Modello "Opt-out": l'utente vede TUTTO tranne le categorie esplicitamente disabilitate.
  // Admin/admincustom bypass: nessun filtro applicato.
  const [disabledCategoryIds, setDisabledCategoryIds] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [packages, setPackages] = useState<PackageData[]>([]);

  // ── Loading ──
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // ── Step 1: Customer ──
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');

  // ── Step 2: Products ──
  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [isForeignOrder, setIsForeignOrder] = useState(false);
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [packageSearch, setPackageSearch] = useState('');
  const [availableStockMap, setAvailableStockMap] = useState<AvailableStockMap>(new Map());

  // Edit price modal
  const [editCartItem, setEditCartItem] = useState<CartItem | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editQty, setEditQty] = useState(1);

  // Product detail/image modal
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);

  // ── Step 3: Payment ──
  const [selectedPayment, setSelectedPayment] = useState('');

  // ── Step 4: Shipping ──
  const [selectedShipping, setSelectedShipping] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');

  // ── Step 5: Summary ──
  const [notes, setNotes] = useState('');
  const [rottamazioneAmount, setRottamazioneAmount] = useState(0);
  const [rottamazioneDescription, setRottamazioneDescription] = useState('');
  const [cashBackToUse, setCashBackToUse] = useState(0);
  const [customerCashBackBalance, setCustomerCashBackBalance] = useState(0);
  const [cashBackMaxPercentage, setCashBackMaxPercentage] = useState(100);
  const [cashBackMinThreshold, setCashBackMinThreshold] = useState(0);
  const [scontoBenvenuto, setScontoBenvenuto] = useState(false);
  const [isFirstOrder, setIsFirstOrder] = useState(false);

  // Rottamazione config
  const [rottamazioneLots, setRottamazioneLots] = useState<number[]>(DEFAULT_ROTTAMAZIONE_LOTS);
  const [rottamazioneMultiplier, setRottamazioneMultiplier] = useState(DEFAULT_ROTTAMAZIONE_MULTIPLIER);
  const [rottamazioneIvaRate, setRottamazioneIvaRate] = useState(DEFAULT_ROTTAMAZIONE_IVA_RATE);

  // Location
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy?: number | null } | null>(null);

  // ── Draft system ──
  const [draftId, setDraftId] = useState<string>(generateDraftId());
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Auto-save draft when step changes or cart changes (only from step 1 onward with a customer)
  const autoSaveDraft = useCallback(async () => {
    if (!selectedCustomer || cart.length === 0) return;
    const draft: OrderDraft = {
      id: draftId,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.business_name,
      cart: cart.map(c => ({ product: c.product, quantity: c.quantity, unit_price: c.unit_price })),
      currentStep,
      isForeignOrder,
      selectedPaymentId: selectedPayment || null,
      selectedShippingId: selectedShipping || null,
      customShippingAddress: shippingAddress,
      notes,
      rottamazioneAmount,
      rottamazioneDescription,
      cashBackToUse,
      totalAmount: cartTotals.grandTotal,
      productCount: cartTotals.totalProducts,
      savedAt: new Date().toISOString(),
    };
    await saveDraft(draft);
  }, [draftId, selectedCustomer, cart, currentStep, isForeignOrder, selectedPayment, selectedShipping, shippingAddress, notes, rottamazioneAmount, rottamazioneDescription, cashBackToUse]);

  // ═══════════════════════════════════════════════════
  // HELPERS: Stock
  // ═══════════════════════════════════════════════════
  const getEffectiveStock = (productId: string, fallback: number): number => {
    const info = availableStockMap.get(productId);
    return info ? info.available_quantity : fallback;
  };

  const getReservedQty = (productId: string): number => {
    const info = availableStockMap.get(productId);
    return info ? info.reserved_quantity : 0;
  };

  // ═══════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════
  useEffect(() => {
    // Wait for virtual branch detection to complete BEFORE loading products/stock
    // (otherwise virtual branches load with branch_stock=0 instead of central warehouse)
    if (vbLoading) return;
    loadInitialData();
    loadLocation();
    loadRottamazioneConfig();
  }, [vbLoading]);

  // Restore draft after data is loaded
  useEffect(() => {
    if (!isLoading && !draftLoaded && params.draftId && customers.length > 0) {
      restoreDraft(params.draftId);
    }
  }, [isLoading, customers, params.draftId, draftLoaded]);

  const restoreDraft = async (incomingDraftId: string) => {
    try {
      const allDrafts = await getDrafts();
      const draft = allDrafts.find(d => d.id === incomingDraftId);
      if (!draft) { console.log('[drafts] Draft not found:', incomingDraftId); return; }

      console.log(`[drafts] Restoring draft: ${draft.customerName} (step ${draft.currentStep + 1})`);

      // Restore customer
      const customer = customers.find(c => c.id === draft.customerId);
      if (customer) setSelectedCustomer(customer);

      // Restore cart
      setCart(draft.cart);
      setIsForeignOrder(draft.isForeignOrder);
      setCurrentStep(draft.currentStep);

      // Restore selections
      if (draft.selectedPaymentId) setSelectedPayment(draft.selectedPaymentId);
      if (draft.selectedShippingId) setSelectedShipping(draft.selectedShippingId);
      if (draft.customShippingAddress) setShippingAddress(draft.customShippingAddress);
      if (draft.notes) setNotes(draft.notes);
      if (draft.rottamazioneAmount) setRottamazioneAmount(draft.rottamazioneAmount);
      if (draft.rottamazioneDescription) setRottamazioneDescription(draft.rottamazioneDescription);
      if (draft.cashBackToUse) setCashBackToUse(draft.cashBackToUse);

      // Use the same draft ID for updates
      setDraftId(incomingDraftId);
      setDraftLoaded(true);

      // Load cashback balance for the customer
      if (customer) loadCashBackBalance(customer.id);

      Alert.alert('Bozza Ripristinata', `Ordine per "${draft.customerName}" ripristinato allo Step ${draft.currentStep + 1}`);
    } catch (e) {
      console.error('[drafts] Error restoring draft:', e);
    }
  };

  // When isForeignOrder changes, re-fetch products and shipping (matching old Raccolta Ordine)
  const isForeignInitialMount = React.useRef(true);
  useEffect(() => {
    if (isForeignInitialMount.current) {
      isForeignInitialMount.current = false;
      return;
    }
    reloadForForeignToggle();
  }, [isForeignOrder]);

  // ✅ Web parity: se branch virtuale NON abilitato all'estero → forza Italia
  useEffect(() => {
    if (!vbLoading && !canToggleEstero && isForeignOrder) {
      console.log('[V2] Branch not authorized for foreign orders, forcing Italia');
      setIsForeignOrder(false);
    }
  }, [vbLoading, canToggleEstero, isForeignOrder]);

  /**
   * Refresh dello stock disponibile per i prodotti attualmente caricati.
   * Chiamato:
   *   - automaticamente ogni volta che si entra nello Step 2 (selezione prodotti)
   *   - manualmente via pulsante "Aggiorna" nello Step 2
   * Aggiorna SOLO lo stock, NON ricarica la lista prodotti (più veloce).
   */
  const [refreshingStock, setRefreshingStock] = useState(false);
  const refreshStock = useCallback(async (silent = false) => {
    if (products.length === 0) return;
    if (!silent) setRefreshingStock(true);
    try {
      const ids = products.map((p) => p.id);
      const stockMap = (user?.branchId && !isVirtualBranch)
        ? await getBranchAvailableStock(user.branchId, ids)
        : await getAvailableStock(ids);
      setAvailableStockMap(stockMap);
      console.log(`[V2] Stock refreshed for ${stockMap.size} products`);
    } catch (e) {
      console.warn('[V2] refreshStock failed:', e);
    } finally {
      if (!silent) setRefreshingStock(false);
    }
  }, [products, user?.branchId, isVirtualBranch]);

  // ✅ Auto-refresh stock when entering Step 2 (product selection)
  // Skip on the first mount (loadInitialData already loaded fresh stock)
  const stepRefreshInitialMount = React.useRef(true);
  useEffect(() => {
    if (currentStep !== 1) return;
    if (stepRefreshInitialMount.current) {
      stepRefreshInitialMount.current = false;
      return;
    }
    console.log('[V2] Entered Step 2, refreshing stock...');
    refreshStock(true);
  }, [currentStep, refreshStock]);

  const reloadForForeignToggle = async () => {
    setLoadingProducts(true);
    try {
      const [productsData, shippingsData] = await Promise.all([
        fetchProducts(isForeignOrder),
        fetchShippingMethods(isForeignOrder),
      ]);
      // ✅ Web parity: filtra categorie disabilitate anche al toggle Italia/Estero
      const filteredProducts = (productsData || []).filter(
        (p: Product) => !p.category_id || !disabledCategoryIds.includes(p.category_id)
      );
      setProducts(filteredProducts);
      setShippingMethods(shippingsData);

      // Reload available stock for new product set (branch-aware, virtual branches use central stock)
      if (filteredProducts.length > 0) {
        try {
          const ids = filteredProducts.map((p: Product) => p.id);
          const stockMap = (user?.branchId && !isVirtualBranch)
            ? await getBranchAvailableStock(user.branchId, ids)
            : await getAvailableStock(ids);
          setAvailableStockMap(stockMap);
        } catch (e) { /* fallback */ }
      }

      // ✅ Web parity: Check di compatibilità prodotti nel carrello al toggle
      // - Estero: rimuovere prodotti che non hanno estero=true
      // - Italia: rimuovere prodotti EST- (short_description inizia con "EST-")
      if (cart.length > 0) {
        let incompatible: typeof cart = [];
        if (isForeignOrder) {
          // Toggle a Estero: i prodotti rimasti devono tutti avere estero=true
          const eligibleIds = new Set(filteredProducts.filter(p => p.estero === true).map(p => p.id));
          incompatible = cart.filter(item => !eligibleIds.has(item.product.id));
          if (incompatible.length > 0) {
            const nomi = incompatible.map(i => i.product.short_description || i.product.name).join(', ');
            Alert.alert(
              'Conflitto Ordine Estero',
              `${incompatible.length} prodotto/i non abilitati per ordini esteri:\n\n${nomi}\n\nRimuovili dal carrello.`
            );
          }
        } else {
          // Toggle a Italia: NESSUN prodotto EST- può rimanere nel carrello
          incompatible = cart.filter(item => isEsteroDescription(item.product.short_description));
          if (incompatible.length > 0) {
            const nomi = incompatible.map(i => i.product.short_description || i.product.name).join(', ');
            Alert.alert(
              'Conflitto Ordine Italia',
              `${incompatible.length} prodotto/i estero (EST-) non possono essere ordinati in modalità Italia:\n\n${nomi}\n\nRimuovili dal carrello.`
            );
          }
        }
      }
    } catch (e) {
      console.error('[V2] Error reloading for foreign toggle:', e);
    } finally {
      setLoadingProducts(false);
    }
  };

  // ✅ Web parity: Helper per caricare le categorie disabilitate per l'utente corrente.
  // Modello "Opt-out": utente vede tutto tranne categorie esplicitamente bloccate.
  // Admin e admincustom bypassano sempre il filtro.
  const loadDisabledCategoryIds = useCallback(async (): Promise<string[]> => {
    if (!user?.id || !user?.role) return [];

    // Bypass per admin e admincustom: vedono tutti i prodotti
    if (user.role === 'admin' || user.role === 'admincustom') {
      return [];
    }

    try {
      const { data, error } = await supabase
        .from('user_category_permissions')
        .select('category_id')
        .eq('user_id', user.id)
        .eq('is_allowed', false);

      if (error) {
        console.warn('[V2] Failed to load category permissions:', error.message);
        return [];
      }

      const ids = (data || []).map((r: any) => r.category_id);
      if (ids.length > 0) {
        console.log(`[V2] User has ${ids.length} disabled categories - products will be filtered`);
      }
      return ids;
    } catch (e) {
      console.warn('[V2] loadDisabledCategoryIds error:', e);
      return [];
    }
  }, [user?.id, user?.role]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      console.log('[V2] Starting data load...');
      // ✅ Web parity: prima carico i permessi categorie, poi i prodotti.
      // Questo evita race conditions con il filtro disabledCategoryIds.
      const [custData, productsData, paymentsData, shippingsData, disabledIds] = await Promise.all([
        fetchCustomers(user?.id || '', user?.role || 'agent', user?.branchId),
        fetchProducts(isForeignOrder),
        fetchPaymentMethods(),
        fetchShippingMethods(isForeignOrder),
        loadDisabledCategoryIds(),
      ]);

      // Aggiorna lo state SUBITO così è disponibile per i prossimi reload (toggle Italia/Estero)
      setDisabledCategoryIds(disabledIds);

      console.log('[V2] Data loaded:', {
        customers: custData?.length || 0,
        products: productsData?.length || 0,
        payments: paymentsData?.length || 0,
        shipping: shippingsData?.length || 0,
        disabledCategories: disabledIds.length,
      });

      setCustomers(custData || []);
      // ✅ Web parity: filtra prodotti con categoria disabilitata per l'utente
      const filteredProducts = (productsData || []).filter(
        (p: Product) => !p.category_id || !disabledIds.includes(p.category_id)
      );
      const excluded = (productsData?.length || 0) - filteredProducts.length;
      if (excluded > 0) {
        console.log(`[V2] Filtered out ${excluded} products from disabled categories`);
      }
      setProducts(filteredProducts);
      setPaymentMethods(paymentsData || []);
      setShippingMethods(shippingsData || []);

      // Load available stock (branch-aware, virtual branches use central stock)
      if (filteredProducts.length > 0) {
        try {
          const ids = filteredProducts.map((p: Product) => p.id);
          const stockMap = (user?.branchId && !isVirtualBranch)
            ? await getBranchAvailableStock(user.branchId, ids)
            : await getAvailableStock(ids);
          setAvailableStockMap(stockMap);
          console.log(`[V2] Stock loaded for ${stockMap.size} products${user?.branchId && !isVirtualBranch ? ` (branch: ${user.branchId})` : ' (central warehouse)'}`);
        } catch (e) {
          console.log('[V2] Stock fallback:', e);
        }
      }
    } catch (err) {
      console.error('[V2] Error loading data:', err);
      Alert.alert('Errore', 'Impossibile caricare i dati');
    } finally {
      console.log('[V2] Loading complete');
      setIsLoading(false);
    }
  };

  const loadRottamazioneConfig = async () => {
    try {
      const { data } = await supabase.from('rottamazione_config').select('*').single();
      if (data) {
        if (data.lots) {
          const parsedLots = Array.isArray(data.lots)
            ? data.lots
            : typeof data.lots === 'string'
              ? JSON.parse(data.lots)
              : DEFAULT_ROTTAMAZIONE_LOTS;
          setRottamazioneLots(parsedLots);
        }
        if (data.multiplier) setRottamazioneMultiplier(data.multiplier);
        if (data.iva_rate) setRottamazioneIvaRate(data.iva_rate);
      }
    } catch { /* use defaults */ }
  };

  const loadLocation = async () => {
    try {
      const ExpoLocation = require('expo-location');
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy ?? null });
      }
    } catch (e) {
      console.log('[V2] Location not available:', e);
    }
  };

  const loadPackages = async () => {
    try {
      const { data } = await supabase
        .from('packages')
        .select('id, name, is_active, package_items(id, product_id, quantity, unit_price, products(id, name, short_description, sku, unit_price, supplier_id, unit_of_measure, accisa, iva_percentage, image_url, is_active, cashback_eligible, estero, rottamazione_no, stock_quantity))')
        .eq('is_active', true)
        .order('name');
      setPackages((data || []).map((p: any) => ({ ...p, items: p.package_items || [] })));
    } catch { /* non-critical */ }
  };

  const loadCashBackBalance = async (customerId: string) => {
    try {
      // Get latest cashback transaction to get current balance
      const { data, error } = await supabase
        .from('cashback_transactions')
        .select('balance_after')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data && !error) {
        setCustomerCashBackBalance(data.balance_after || 0);
        console.log(`[V2] CashBack balance for customer: €${data.balance_after}`);
      } else {
        setCustomerCashBackBalance(0);
      }
    } catch {
      console.log('[V2] No cashback balance found');
      setCustomerCashBackBalance(0);
    }

    // Load cashback config (max_order_percentage, min_usage_threshold)
    try {
      const { data: config, error: configErr } = await supabase
        .from('cashback_config')
        .select('max_order_percentage, min_usage_threshold, is_active')
        .eq('customer_id', customerId)
        .eq('is_active', true)
        .maybeSingle();

      if (config && !configErr) {
        setCashBackMaxPercentage(config.max_order_percentage ?? 100);
        setCashBackMinThreshold(config.min_usage_threshold ?? 0);
        console.log(`[V2] CashBack config: max ${config.max_order_percentage}%, min threshold €${config.min_usage_threshold}`);
      } else {
        setCashBackMaxPercentage(100);
        setCashBackMinThreshold(0);
      }
    } catch {
      setCashBackMaxPercentage(100);
      setCashBackMinThreshold(0);
    }
  };

  // ═══════════════════════════════════════════════════
  // COMPUTED VALUES
  // ═══════════════════════════════════════════════════

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(c => c.business_name?.toLowerCase().includes(q) || c.contact_name?.toLowerCase().includes(q));
  }, [customers, customerSearch]);

  const filteredProducts = useMemo(() => {
    let list = products;
    // ✅ Web parity: filtri lato client (oltre al filtro server-side in fetchProducts):
    if (!isForeignOrder) {
      // Modalità ITALIA: nasconde prodotti con short_description che inizia con "EST-"
      list = list.filter(p => !(p.short_description && p.short_description.toUpperCase().startsWith('EST-')));
    } else {
      // Modalità ESTERO: mostra SOLO prodotti con estero=true (colonna products.estero)
      // Filtra fuori tutti gli altri, anche se per qualche motivo dovessero essere arrivati nella lista
      list = list.filter(p => p.estero === true);
    }
    // Search filter
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      list = list.filter(p => (p.short_description || p.name).toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q));
    }
    // Sort alphabetically by short_description (then name as fallback)
    list = [...list].sort((a, b) => {
      const nameA = (a.short_description || a.name || '').toLowerCase();
      const nameB = (b.short_description || b.name || '').toLowerCase();
      return nameA.localeCompare(nameB, 'it');
    });
    return list.slice(0, 50);
  }, [products, productSearch, isForeignOrder]);

  const filteredShippingMethods = useMemo(() => {
    return shippingMethods.filter(m => {
      const isRitiro = m.name.toLowerCase().includes('ritiro');
      if (isRitiro) return true;
      if (isForeignOrder) return m.foreign_only === true;
      return m.foreign_only !== true;
    });
  }, [shippingMethods, isForeignOrder]);

  // ── Cart totals (matching web app calculation) ──
  const cartTotals = useMemo(() => {
    let imponibile = 0, accisaTotal = 0, ivaTotal = 0, lineTotal = 0;
    for (const item of cart) {
      const p = item.product;
      const accisa = p.accisa || 0;
      const iva = p.iva_percentage || 0;
      const base = item.unit_price * item.quantity;
      // ✅ Web parity rules:
      // • ACCISA: azzerata SOLO per prodotti EST- (prefisso). Prodotti estero=true SENZA
      //   prefisso "EST-" mantengono l'accisa anche in ordine estero.
      // • IVA: esente per ordini esteri OPPURE prodotti EST-.
      const isEstPrefix = isEsteroDescription(p.short_description);
      const effectiveAccisaLine = isEstPrefix ? 0 : accisa * item.quantity;
      const isVatExempt = isForeignOrder || isEstPrefix;
      imponibile += base;
      accisaTotal += effectiveAccisaLine;
      if (!isVatExempt) {
        ivaTotal += (base + effectiveAccisaLine) * (iva / 100);
      }
      lineTotal += calculateLineTotal(item.quantity, item.unit_price, accisa, iva, isForeignOrder, p.short_description);
    }
    const shippingMethod = shippingMethods.find(s => s.id === selectedShipping);
    const shippingBase = shippingMethod?.cost || 0;
    const shippingWithVAT = getShippingCostWithVAT(shippingBase, isForeignOrder);
    const totalProducts = cart.reduce((s, i) => s + i.quantity, 0);
    return {
      imponibile: Math.round(imponibile * 100) / 100,
      accisaTotal: Math.round(accisaTotal * 100) / 100,
      ivaTotal: Math.round(ivaTotal * 100) / 100,
      lineTotal: Math.round(lineTotal * 100) / 100,
      shippingBase,
      shippingWithVAT: Math.round(shippingWithVAT * 100) / 100,
      grandTotal: Math.round((lineTotal + shippingWithVAT) * 100) / 100,
      totalProducts,
    };
  }, [cart, isForeignOrder, selectedShipping, shippingMethods]);

  // ── Rottamazione helpers ──
  const getRottamazioneNetAmount = (gross: number) => Math.round((gross / rottamazioneIvaRate) * 100) / 100;

  const getAvailableRottamazioneLots = () => {
    if (isForeignOrder) return [0];
    const hasRottamazioneNoProducts = cart.some(i => i.product.rottamazione_no === true);
    if (hasRottamazioneNoProducts) return [0];
    const lots = Array.isArray(rottamazioneLots) ? rottamazioneLots : DEFAULT_ROTTAMAZIONE_LOTS;
    return lots.filter(lot => {
      if (lot === 0) return true;
      const netAmount = getRottamazioneNetAmount(lot);
      return cartTotals.imponibile >= netAmount * rottamazioneMultiplier;
    });
  };

  // ═══════════════════════════════════════════════════
  // CART MANAGEMENT
  // ═══════════════════════════════════════════════════

  const addToCart = (product: Product, qty: number) => {
    // ✅ Web parity: blocco hardcoded incompatibilità Italia/Estero
    // (defense-in-depth oltre al filtro lista)
    if (!isForeignOrder && isEsteroDescription(product.short_description)) {
      Alert.alert('Conflitto Ordine', `"${product.short_description || product.name}" è un prodotto estero (EST-) e non può essere aggiunto a un ordine Italia. Attiva "Estero" per ordinare questo articolo.`);
      return;
    }
    if (isForeignOrder && product.estero !== true) {
      Alert.alert('Conflitto Ordine Estero', `"${product.short_description || product.name}" non è abilitato per ordini esteri.`);
      return;
    }

    const stock = getEffectiveStock(product.id, product.stock_quantity || 0);
    const existing = cart.find(c => c.product.id === product.id);
    const currentQty = existing ? existing.quantity : 0;
    const maxAddable = stock - currentQty;

    if (maxAddable <= 0) {
      Alert.alert('Stock esaurito', `"${product.short_description || product.name}" non disponibile (disponibili: ${stock})`);
      return;
    }

    const actualQty = Math.min(qty, maxAddable);
    if (actualQty < qty) {
      Alert.alert('Limite disponibilità', `Aggiunti ${actualQty} pz invece di ${qty} (disponibili: ${stock})`);
    }

    if (existing) {
      setCart(prev => prev.map(c =>
        c.product.id === product.id ? { ...c, quantity: c.quantity + actualQty } : c
      ));
    } else {
      setCart(prev => [...prev, { product, quantity: actualQty, unit_price: product.unit_price }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(c => c.product.id !== productId));
  };

  const updateCartQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    const item = cart.find(c => c.product.id === productId);
    if (!item) return;
    const stock = getEffectiveStock(productId, item.product.stock_quantity || 0);
    const finalQty = Math.min(newQty, stock);
    setCart(prev => prev.map(c =>
      c.product.id === productId ? { ...c, quantity: finalQty } : c
    ));
  };

  const updateCartPrice = (productId: string, newPrice: number) => {
    setCart(prev => prev.map(c =>
      c.product.id === productId ? { ...c, unit_price: newPrice } : c
    ));
  };

  const clearCart = () => {
    Alert.alert('Svuota carrello', 'Sei sicuro?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Svuota', style: 'destructive', onPress: () => setCart([]) },
    ]);
  };

  // ═══════════════════════════════════════════════════
  // PACKAGE APPLICATION (with stock validation)
  // ═══════════════════════════════════════════════════

  const applyPackage = (pkg: PackageData) => {
    const inactiveItems: string[] = [];
    const outOfStockItems: string[] = [];
    const insufficientItems: string[] = [];

    for (const item of pkg.items) {
      const p = item.products;
      if (!p) continue;
      const label = p.short_description || p.name;
      if (p.is_active === false) { inactiveItems.push(label); continue; }
      const stock = getEffectiveStock(p.id || item.product_id, p.stock_quantity ?? 0);
      const existing = cart.find(c => c.product.id === (p.id || item.product_id));
      const totalReq = (existing?.quantity || 0) + item.quantity;
      if (stock <= 0) outOfStockItems.push(label);
      else if (totalReq > stock) insufficientItems.push(`${label} (richiesti: ${totalReq}, disponibili: ${stock})`);
    }

    if (inactiveItems.length || outOfStockItems.length || insufficientItems.length) {
      const msgs: string[] = [];
      if (inactiveItems.length) msgs.push(`Prodotti non attivi:\n${inactiveItems.join('\n')}`);
      if (outOfStockItems.length) msgs.push(`Prodotti esauriti:\n${outOfStockItems.join('\n')}`);
      if (insufficientItems.length) msgs.push(`Stock insufficiente:\n${insufficientItems.join('\n')}`);
      Alert.alert('Impossibile applicare il pacchetto', `"${pkg.name}"\n\n${msgs.join('\n\n')}`);
      return;
    }

    // Apply package items to cart — use package item price (unit_price) if available, otherwise product price
    const newCart = [...cart];
    for (const item of pkg.items) {
      const p = item.products;
      if (!p) continue;
      // Package item unit_price overrides product unit_price (e.g., 0 for gifts/omaggi)
      const itemPrice = (item.unit_price != null) ? item.unit_price : p.unit_price;
      const existingIdx = newCart.findIndex(c => c.product.id === (p.id || item.product_id));
      if (existingIdx >= 0) {
        newCart[existingIdx] = { ...newCart[existingIdx], quantity: newCart[existingIdx].quantity + item.quantity, unit_price: itemPrice };
      } else {
        newCart.push({ product: { ...p, id: p.id || item.product_id }, quantity: item.quantity, unit_price: itemPrice });
      }
    }
    setCart(newCart);
    setShowPackageModal(false);
    Alert.alert('Pacchetto applicato', `"${pkg.name}" aggiunto al carrello`);
  };

  // ═══════════════════════════════════════════════════
  // ORDER SUBMISSION (matching web app logic exactly)
  // ═══════════════════════════════════════════════════

  const handleSubmitOrder = async () => {
    if (!selectedCustomer || !user || cart.length === 0) return;
    if (!selectedPayment) { Alert.alert('Errore', 'Seleziona un metodo di pagamento'); return; }
    if (!selectedShipping) { Alert.alert('Errore', 'Seleziona un metodo di spedizione'); return; }
    if (rottamazioneAmount > 0 && !rottamazioneDescription.trim()) {
      Alert.alert('Errore', 'Inserisci la descrizione della merce da rottamare'); return;
    }
    // Validate CashBack min threshold
    if (cashBackToUse > 0 && cashBackMinThreshold > 0 && cashBackToUse < cashBackMinThreshold) {
      Alert.alert('Errore CashBack', `L'importo minimo di utilizzo CashBack è ${formatCurrency(cashBackMinThreshold)}`); return;
    }

    setIsSubmitting(true);
    try {
      const isRottamazione = rottamazioneAmount > 0;
      const isUsingCashBack = !isRottamazione && cashBackToUse > 0;

      // ── Build items with prices adjusted for rottamazione/cashback ──
      let finalItems: Array<{ product_id: string; quantity: number; unit_price: number; discount_percent: number; original_unit_price?: number }>;

      if (isRottamazione) {
        const netAmount = getRottamazioneNetAmount(rottamazioneAmount);
        const eligibleItems = cart.filter(c => c.product.rottamazione_no !== true);
        if (eligibleItems.length > 0) {
          const eligible = eligibleItems.map(c => ({ product_id: c.product.id, quantity: c.quantity, unit_price: c.unit_price }));
          const excluded = cart.filter(c => c.product.rottamazione_no === true);
          const distributed = distributeDiscountToItems(eligible, netAmount);
          finalItems = [
            ...distributed.map(d => ({ product_id: d.product_id, quantity: d.quantity, unit_price: d.unit_price, discount_percent: 0, original_unit_price: d.original_unit_price })),
            ...excluded.map(c => ({ product_id: c.product.id, quantity: c.quantity, unit_price: c.unit_price, discount_percent: 0 })),
          ];
        } else {
          finalItems = cart.map(c => ({ product_id: c.product.id, quantity: c.quantity, unit_price: c.unit_price, discount_percent: 0 }));
        }
      } else if (isUsingCashBack) {
        const eligible = cart.filter(c => c.product.cashback_eligible === true);
        const nonEligible = cart.filter(c => c.product.cashback_eligible !== true);
        if (eligible.length > 0) {
          const eligibleMapped = eligible.map(c => ({ product_id: c.product.id, quantity: c.quantity, unit_price: c.unit_price }));
          const distributed = distributeDiscountToItems(eligibleMapped, cashBackToUse);
          finalItems = [
            ...distributed.map(d => ({ product_id: d.product_id, quantity: d.quantity, unit_price: d.unit_price, discount_percent: 0, original_unit_price: d.original_unit_price })),
            ...nonEligible.map(c => ({ product_id: c.product.id, quantity: c.quantity, unit_price: c.unit_price, discount_percent: 0 })),
          ];
        } else {
          finalItems = cart.map(c => ({ product_id: c.product.id, quantity: c.quantity, unit_price: c.unit_price, discount_percent: 0 }));
        }
      } else if (scontoBenvenuto && isFirstOrder) {
        // Sconto Benvenuto: 25% on rottamazione-eligible products
        const eligible = cart.filter(c => c.product.rottamazione_no !== true);
        const excluded = cart.filter(c => c.product.rottamazione_no === true);
        const discountAmount = eligible.reduce((s, c) => s + c.unit_price * c.quantity, 0) * 0.25;
        if (eligible.length > 0 && discountAmount > 0) {
          const eligibleMapped = eligible.map(c => ({ product_id: c.product.id, quantity: c.quantity, unit_price: c.unit_price }));
          const distributed = distributeDiscountToItems(eligibleMapped, discountAmount);
          finalItems = [
            ...distributed.map(d => ({ product_id: d.product_id, quantity: d.quantity, unit_price: d.unit_price, discount_percent: 25, original_unit_price: d.original_unit_price })),
            ...excluded.map(c => ({ product_id: c.product.id, quantity: c.quantity, unit_price: c.unit_price, discount_percent: 0 })),
          ];
        } else {
          finalItems = cart.map(c => ({ product_id: c.product.id, quantity: c.quantity, unit_price: c.unit_price, discount_percent: 0 }));
        }
      } else {
        finalItems = cart.map(c => ({ product_id: c.product.id, quantity: c.quantity, unit_price: c.unit_price, discount_percent: 0 }));
      }

      // ── Calculate total_amount (matching web app: with IVA + Accisa, EST- aware) ──
      let itemsTotal = 0;
      for (const oi of finalItems) {
        const product = cart.find(c => c.product.id === oi.product_id)?.product;
        const accisa = product?.accisa || 0;
        const iva = product?.iva_percentage || 0;
        itemsTotal += calculateLineTotal(oi.quantity, oi.unit_price, accisa, iva, isForeignOrder, product?.short_description);
      }

      const shippingMethod = shippingMethods.find(s => s.id === selectedShipping);
      const shippingBase = shippingMethod?.cost || 0;
      const shippingWithVAT = getShippingCostWithVAT(shippingBase, isForeignOrder);
      const finalTotalAmount = Math.round((itemsTotal + shippingWithVAT) * 100) / 100;

      // ── Build detailed notes (matching web app format) ──
      const notesParts: string[] = [];
      if (isRottamazione) {
        const netAmt = getRottamazioneNetAmount(rottamazioneAmount);
        const priceDetails = finalItems
          .filter(fi => fi.original_unit_price !== undefined && fi.original_unit_price !== fi.unit_price)
          .map(fi => {
            const p = cart.find(c => c.product.id === fi.product_id)?.product;
            const name = p?.short_description || p?.name || fi.product_id;
            return `${name}: ${formatCurrency(fi.original_unit_price!)} → ${formatCurrency(fi.unit_price)}`;
          }).join(', ');
        notesParts.push(`[Rottamazione €${rottamazioneAmount.toFixed(2)} (lordo IVA incl.) - netto spalmato: €${netAmt.toFixed(2)} - ${rottamazioneDescription}${priceDetails ? ` - dettaglio: ${priceDetails}` : ''}]`);
      } else if (isUsingCashBack) {
        notesParts.push(`[CashBack €${cashBackToUse.toFixed(2)} utilizzato]`);
      } else if (scontoBenvenuto && isFirstOrder) {
        const eligibleItems = cart.filter(c => c.product.rottamazione_no !== true);
        const eligibleSubt = eligibleItems.reduce((s, c) => s + c.unit_price * c.quantity, 0);
        const discountAmt = Math.round(eligibleSubt * 0.25 * 100) / 100;
        notesParts.push(`[Sconto Benvenuto 25% applicato - Imponibile eligible: €${eligibleSubt.toFixed(2)} - Sconto: €${discountAmt.toFixed(2)}]`);
      }
      if (notes.trim()) notesParts.push(notes.trim());
      const finalNotes = notesParts.length > 0 ? notesParts.join('\n') : undefined;

      // ── Generate order number ──
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const timeStr = date.toISOString().slice(11, 19).replace(/:/g, '');
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const orderNumber = `ORD-${dateStr}-${timeStr}-${randomSuffix}`;

      // ── Fetch customer & agent info for order anagrafica ──
      const { data: agentInfo } = await supabase
        .from('profiles')
        .select('full_name, email, phone, codice_agente_prestashop')
        .eq('id', user.id)
        .single();

      // ── INSERT ORDER ──
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_id: selectedCustomer.id,
          agent_id: user.id,
          branch_id: user.branchId || null,
          order_date: new Date().toISOString(),
          status: 'draft',
          total_amount: finalTotalAmount,
          shipping_cost: shippingBase,
          shipping_method_id: selectedShipping,
          payment_method_id: selectedPayment,
          is_foreign: isForeignOrder,
          notes: finalNotes || null,
          shipping_address: shippingAddress || null,
          latitude: location?.latitude || null,
          longitude: location?.longitude || null,
          gps_accuracy: location?.accuracy ?? null,
          // Customer anagrafica
          contact_name: selectedCustomer.contact_name || null,
          contact_surname: selectedCustomer.contact_surname || null,
          contact_phone: selectedCustomer.contact_phone || null,
          contact_email: selectedCustomer.contact_email || null,
          vat_number: selectedCustomer.vat_number || null,
          fiscal_code: selectedCustomer.fiscal_code || null,
          pec: selectedCustomer.pec || null,
          sdi: selectedCustomer.sdi || null,
          customer_type: selectedCustomer.customer_type || null,
          // Agent anagrafica
          agent_full_name: agentInfo?.full_name || null,
          agent_email: agentInfo?.email || null,
          agent_phone: agentInfo?.phone || null,
          codice_agente_prestashop: agentInfo?.codice_agente_prestashop || null,
          // CashBack & Rottamazione fields
          cashback_used: isUsingCashBack ? cashBackToUse : 0,
          generates_cashback: !isRottamazione && cashBackToUse <= 0,
          rottamazione_amount: isRottamazione ? rottamazioneAmount : 0,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // ── INSERT ORDER ITEMS via RPC ──
      const orderItems = finalItems.map(fi => ({
        product_id: fi.product_id,
        quantity: fi.quantity,
        unit_price: fi.unit_price,
        discount_percent: fi.discount_percent,
      }));

      const { error: itemsError } = await supabase.rpc('insert_order_items_safe', {
        p_order_id: order.id,
        p_items: orderItems,
      });

      if (itemsError) {
        await supabase.from('orders').delete().eq('id', order.id);
        throw itemsError;
      }

      // ── STOCK RESERVATION (non-blocking) ──
      let reservationWarnings: string[] = [];
      try {
        const resItems = cart.map(c => ({ product_id: c.product.id, quantity: c.quantity }));
        const resResult = await createReservation(order.id, resItems, user.id, user.branchId || undefined);
        if (resResult.warnings?.length) {
          reservationWarnings = resResult.warnings.map(w => {
            const p = cart.find(c => c.product.id === w.product_id)?.product;
            return `${p?.short_description || p?.name || w.product_id}: richiesti ${w.requested}, disponibili ${w.available}`;
          });
        }
      } catch (e) { console.log('[reservation] non-blocking:', e); }

      // ── STOCK SUBTRACTION (non-blocking, matching web app — branch aware) ──
      try {
        const stockItems = cart.map(c => ({ product_id: c.product.id, quantity: c.quantity }));
        const orderBranchId = user.branchId || null;

        if (orderBranchId) {
          // Check if branch is virtual
          const isVirtual = await isBranchVirtual(orderBranchId);
          if (!isVirtual) {
            // Non-virtual branch: subtract ONLY branch stock
            console.log('[STOCK-AUDIT] 📦 Non-virtual branch → subtractBranchStockForOrder');
            await subtractBranchStockForOrder(orderBranchId, stockItems, user.id);
            await supabase.from('orders').update({ stock_subtracted: true }).eq('id', order.id);
          } else {
            // Virtual branch: subtract global stock (like HQ)
            console.log('[STOCK-AUDIT] 📦 Virtual branch → subtractStockForOrder (global)');
            await subtractStockForOrder(stockItems, user.id, order.id);
            await verifyAndSetStockSubtracted(order.id, stockItems);
          }
        } else {
          // HQ agent (no branch): subtract global stock
          console.log('[STOCK-AUDIT] 📦 HQ agent → subtractStockForOrder (global)');
          await subtractStockForOrder(stockItems, user.id, order.id);
          await verifyAndSetStockSubtracted(order.id, stockItems);
        }
      } catch (stockError) {
        console.error('[STOCK-AUDIT] ❌ Stock subtraction error (non-blocking):', stockError);
      }

      // ── CASHBACK PROCESSING (non-blocking) ──
      try {
        if (isUsingCashBack) {
          await processCashBackUsage(selectedCustomer.id, order.id, cashBackToUse);
        } else if (!isRottamazione) {
          const accItems = finalItems.map(fi => ({
            product_id: fi.product_id, quantity: fi.quantity, unit_price: fi.unit_price,
            cashback_eligible: cart.find(c => c.product.id === fi.product_id)?.product.cashback_eligible,
          }));
          await processCashBackAccumulation(selectedCustomer.id, order.id, accItems);
        }
      } catch (e) { console.log('[cashback] non-blocking:', e); }

      // ── UPDATE CUSTOMER ──
      await supabase.from('customers').update({ category: 'client', last_visit_date: new Date().toISOString() }).eq('id', selectedCustomer.id);

      // ── Update tabaccheria stato_visita ──
      if (selectedCustomer.tabaccheria_id) {
        await supabase.from('tabaccherie').update({ stato_visita: 'ordinato' }).eq('id', selectedCustomer.tabaccheria_id).then(() => {});
      }

      // ── SUCCESS ──
      // Delete the draft since order was submitted
      await deleteDraft(draftId);
      const warnText = reservationWarnings.length ? `\n\nAttenzione disponibilità:\n${reservationWarnings.join('\n')}` : '';
      // Haptic success feedback
      try { const { hap } = await import('../lib/haptics'); hap.success(); } catch {}
      Alert.alert('Ordine Creato!', `Ordine ${order.order_number} creato con successo\nTotale: ${formatCurrency(finalTotalAmount)}${warnText}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error('Error creating order:', error);
      try { const { hap } = await import('../lib/haptics'); hap.error(); } catch {}
      Alert.alert('Errore', error.message || "Impossibile creare l'ordine");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ═══════════════════════════════════════════════════
  // STEP NAVIGATION
  // ═══════════════════════════════════════════════════

  const canAdvance = () => {
    switch (currentStep) {
      case 0: return !!selectedCustomer;
      case 1: return cart.length > 0;
      case 2: return !!selectedPayment;
      case 3: return !!selectedShipping;
      default: return true;
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      if (currentStep === 0 && selectedCustomer) {
        loadCashBackBalance(selectedCustomer.id);
        loadPackages();
        checkFirstOrder(selectedCustomer.id);
      }
      setCurrentStep(currentStep + 1);
      // Auto-save draft on every step advance
      setTimeout(() => autoSaveDraft(), 100);
    }
  };

  const checkFirstOrder = async (customerId: string) => {
    try {
      const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId);
      if (!error) {
        const first = (count || 0) === 0;
        setIsFirstOrder(first);
        console.log(`[V2] First order check for customer: ${first ? 'YES (primo ordine)' : `NO (${count} ordini esistenti)`}`);
      }
    } catch {
      setIsFirstOrder(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
    else router.back();
  };

  // ═══════════════════════════════════════════════════
  // RENDER: STEPPER
  // ═══════════════════════════════════════════════════

  const renderStepper = () => (
    <View style={s.stepper}>
      {STEPS.map((step, i) => (
        <React.Fragment key={i}>
          <TouchableOpacity
            style={[s.stepDot, i < currentStep && s.stepDotDone, i === currentStep && s.stepDotCurrent]}
            onPress={() => i < currentStep && setCurrentStep(i)}
          >
            {i < currentStep ? (
              <Ionicons name="checkmark" size={14} color="#fff" />
            ) : (
              <Text style={[s.stepNum, (i === currentStep) && s.stepNumActive]}>{i + 1}</Text>
            )}
          </TouchableOpacity>
          {i < STEPS.length - 1 && <View style={[s.stepLine, i < currentStep && s.stepLineDone]} />}
        </React.Fragment>
      ))}
    </View>
  );

  // ═══════════════════════════════════════════════════
  // RENDER: STEP 1 — CUSTOMER
  // ═══════════════════════════════════════════════════

  const renderStep1 = () => (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Seleziona Cliente</Text>
      <View style={s.searchBar}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput style={s.searchInput} placeholder="Cerca cliente..." value={customerSearch} onChangeText={setCustomerSearch} placeholderTextColor="#9CA3AF" />
        {customerSearch.length > 0 && <TouchableOpacity onPress={() => setCustomerSearch('')}><Ionicons name="close-circle" size={18} color="#9CA3AF" /></TouchableOpacity>}
      </View>
      <FlatList
        data={filteredCustomers}
        keyExtractor={c => c.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.customerRow, selectedCustomer?.id === item.id && s.customerRowSelected]}
            onPress={() => setSelectedCustomer(item)}
          >
            <Ionicons name={selectedCustomer?.id === item.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={selectedCustomer?.id === item.id ? '#1E40AF' : '#D1D5DB'} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={s.customerName}>{item.business_name}</Text>
              {item.city && <Text style={s.customerCity}>{item.city}{item.province ? ` (${item.province})` : ''}</Text>}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );

  // ═══════════════════════════════════════════════════
  // RENDER: STEP 2 — PRODUCTS
  // ═══════════════════════════════════════════════════

  const renderProductRow = ({ item }: { item: Product }) => {
    const inCart = cart.find(c => c.product.id === item.id);
    const stock = getEffectiveStock(item.id, item.stock_quantity || 0);
    const reserved = getReservedQty(item.id);
    const cartQty = inCart ? inCart.quantity : 0;
    const isOutOfStock = stock <= 0;
    const isMaxedOut = !isOutOfStock && cartQty >= stock;
    const remaining = Math.max(0, stock - cartQty);

    return (
      <View style={[
        s.prodRow,
        inCart && s.prodRowInCart,
        isOutOfStock && s.prodRowDisabled,
      ]}>
        <View style={{ position: 'relative' }}>
          <TouchableOpacity style={s.prodIcon} onPress={() => setSelectedProductDetail(item)}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={s.prodImg} contentFit="cover" cachePolicy="memory-disk" transition={150} />
            ) : (
              <View style={s.prodImgPlaceholder}><Ionicons name="cube-outline" size={16} color="#9CA3AF" /></View>
            )}
          </TouchableOpacity>
          {inCart && (
            <View style={s.cartBadge}>
              <Text style={s.cartBadgeText}>{inCart.quantity}</Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={s.prodInfo} disabled={!inCart} onPress={() => { if (inCart) { setEditCartItem(inCart); setEditPrice(inCart.unit_price.toString()); setEditQty(inCart.quantity); } }}>
          <Text style={[s.prodName, inCart && { color: '#1E40AF' }, isOutOfStock && { color: '#9CA3AF' }]} numberOfLines={1}>
            {item.short_description || item.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[s.prodPrice, isOutOfStock && { color: '#9CA3AF' }]}>{formatCurrency(inCart ? inCart.unit_price : item.unit_price)}</Text>
            {(item.accisa || 0) > 0 && !isEsteroDescription(item.short_description) && <Text style={s.prodAccisa}>+{formatCurrency(item.accisa || 0)} acc.</Text>}
            {isOutOfStock && (
              <View style={s.outOfStockBadge}>
                <Text style={s.outOfStockText}>ESAURITO</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        {!isOutOfStock && (
          <View style={[s.stockBadge, stock <= 10 ? s.stockAmber : s.stockGreen]}>
            <Text style={s.stockText}>{stock}</Text>
            {reserved > 0 && <Text style={s.stockReserved}>({reserved})</Text>}
          </View>
        )}

        <View style={s.prodActions}>
          <TouchableOpacity
            style={[s.addBtn, (isOutOfStock || isMaxedOut) && s.addBtnDisabled]}
            onPress={() => addToCart(item, 1)}
            disabled={isOutOfStock || isMaxedOut}
          >
            <Text style={[s.addBtnText, (isOutOfStock || isMaxedOut) && { color: '#9CA3AF' }]}>+1</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.addBtn, s.addBtn10, (isOutOfStock || isMaxedOut) && s.addBtnDisabled]}
            onPress={() => addToCart(item, 10)}
            disabled={isOutOfStock || isMaxedOut}
          >
            <Text style={[s.addBtnText, (isOutOfStock || isMaxedOut) && { color: '#9CA3AF' }]}>
              {!isOutOfStock && !isMaxedOut && remaining < 10 ? `+${remaining}` : '+10'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderStep2 = () => (
    <View style={s.stepContent}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={s.stepTitle}>Prodotti</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={s.headerBtn}
            onPress={() => refreshStock(false)}
            disabled={refreshingStock}
          >
            {refreshingStock ? (
              <ActivityIndicator size="small" color="#6B7280" />
            ) : (
              <Ionicons name="refresh" size={16} color="#10B981" />
            )}
            <Text style={[s.headerBtnText, { color: refreshingStock ? '#9CA3AF' : '#10B981' }]}>
              Aggiorna
            </Text>
          </TouchableOpacity>
          {canToggleEstero && (
            <TouchableOpacity style={s.headerBtn} onPress={() => setIsForeignOrder(!isForeignOrder)}>
              <Ionicons name={isForeignOrder ? 'airplane' : 'flag'} size={16} color={isForeignOrder ? '#DC2626' : '#6B7280'} />
              <Text style={[s.headerBtnText, isForeignOrder && { color: '#DC2626' }]}>{isForeignOrder ? 'Estero' : 'Italia'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.headerBtn} onPress={() => { loadPackages(); setShowPackageModal(true); }}>
            <Ionicons name="cube" size={16} color="#1E40AF" />
            <Text style={[s.headerBtnText, { color: '#1E40AF' }]}>Pacchetto</Text>
          </TouchableOpacity>
          {cart.length > 0 && (
            <TouchableOpacity style={s.headerBtn} onPress={clearCart}>
              <Ionicons name="trash-outline" size={16} color="#DC2626" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* CashBack badge */}
      {!isForeignOrder && customerCashBackBalance > 0 && (
        <View style={s.cashbackBadge}>
          <Ionicons name="wallet-outline" size={14} color="#059669" />
          <Text style={s.cashbackBadgeText}>CashBack disponibile: {formatCurrency(customerCashBackBalance)}</Text>
        </View>
      )}

      <View style={s.searchBar}>
        <Ionicons name="search" size={18} color="#9CA3AF" />
        <TextInput style={s.searchInput} placeholder="Cerca prodotto..." value={productSearch} onChangeText={setProductSearch} placeholderTextColor="#9CA3AF" />
        {productSearch.length > 0 && <TouchableOpacity onPress={() => setProductSearch('')}><Ionicons name="close-circle" size={18} color="#9CA3AF" /></TouchableOpacity>}
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={p => p.id}
        renderItem={renderProductRow}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        style={{ flex: 1 }}
      />

      {/* Cart summary bar */}
      {cart.length > 0 && (
        <View style={s.cartBar}>
          <Text style={s.cartBarText}>{cartTotals.totalProducts} prodotti</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.cartBarTotal}>{formatCurrency(cartTotals.grandTotal)}</Text>
            <Text style={s.cartBarDetail}>Imp: {formatCurrency(cartTotals.imponibile)} + Acc: {formatCurrency(cartTotals.accisaTotal)} + IVA: {formatCurrency(cartTotals.ivaTotal)}</Text>
          </View>
        </View>
      )}
    </View>
  );

  // ═══════════════════════════════════════════════════
  // RENDER: STEP 3 — PAYMENT
  // ═══════════════════════════════════════════════════

  const renderStep3 = () => (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Metodo di Pagamento</Text>
      {paymentMethods.map(pm => (
        <TouchableOpacity key={pm.id} style={[s.optionRow, selectedPayment === pm.id && s.optionSelected]} onPress={() => setSelectedPayment(pm.id)}>
          <Ionicons name={selectedPayment === pm.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={selectedPayment === pm.id ? '#1E40AF' : '#D1D5DB'} />
          <Text style={s.optionText}>{pm.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ═══════════════════════════════════════════════════
  // RENDER: STEP 4 — SHIPPING
  // ═══════════════════════════════════════════════════

  const renderStep4 = () => (
    <View style={s.stepContent}>
      <Text style={s.stepTitle}>Metodo di Spedizione</Text>
      {filteredShippingMethods.map(sm => (
        <TouchableOpacity key={sm.id} style={[s.optionRow, selectedShipping === sm.id && s.optionSelected]} onPress={() => setSelectedShipping(sm.id)}>
          <Ionicons name={selectedShipping === sm.id ? 'radio-button-on' : 'radio-button-off'} size={20} color={selectedShipping === sm.id ? '#1E40AF' : '#D1D5DB'} />
          <View style={{ flex: 1 }}>
            <Text style={s.optionText}>{sm.name}</Text>
            {sm.cost > 0 && <Text style={s.optionSub}>{formatCurrency(sm.cost)} {!isForeignOrder && `(${formatCurrency(sm.cost * 1.22)} con IVA)`}</Text>}
          </View>
        </TouchableOpacity>
      ))}
      <Text style={[s.stepTitle, { marginTop: 20 }]}>Indirizzo di spedizione (opzionale)</Text>
      <TextInput style={s.textArea} placeholder="Indirizzo personalizzato..." value={shippingAddress} onChangeText={setShippingAddress} multiline placeholderTextColor="#9CA3AF" />
    </View>
  );

  // ═══════════════════════════════════════════════════
  // RENDER: STEP 5 — SUMMARY
  // ═══════════════════════════════════════════════════

  const renderStep5 = () => {
    const availableLots = getAvailableRottamazioneLots();
    // Eligibility counts
    const cashbackEligibleItems = cart.filter(c => c.product.cashback_eligible === true);
    const cashbackNonEligibleItems = cart.filter(c => c.product.cashback_eligible !== true);
    const eligibleSubtotal = cashbackEligibleItems.reduce((s, c) => s + c.unit_price * c.quantity, 0);
    const rottamazioneEligibleItems = cart.filter(c => c.product.rottamazione_no !== true);
    const rottamazioneExcludedItems = cart.filter(c => c.product.rottamazione_no === true);
    const rottamazioneEligibleSubtotal = rottamazioneEligibleItems.reduce((s, c) => s + c.unit_price * c.quantity, 0);

    // CashBack max calculation
    const maxByPercentage = Math.round((eligibleSubtotal * cashBackMaxPercentage / 100) * 100) / 100;
    const maxCashBack = Math.min(customerCashBackBalance, eligibleSubtotal, maxByPercentage);

    // Spreaded prices preview for rottamazione
    const getSpreadedPrices = () => {
      if (rottamazioneAmount <= 0) return [];
      const netAmount = getRottamazioneNetAmount(rottamazioneAmount);
      const eligible = rottamazioneEligibleItems.map(c => ({ product_id: c.product.id, quantity: c.quantity, unit_price: c.unit_price }));
      const distributed = eligible.length > 0 ? distributeDiscountToItems(eligible, netAmount) : [];
      return cart.map(c => {
        const isExcluded = c.product.rottamazione_no === true;
        const dist = distributed.find(d => d.product_id === c.product.id);
        return {
          product: c.product,
          quantity: c.quantity,
          originalPrice: c.unit_price,
          newPrice: dist ? dist.unit_price : c.unit_price,
          excluded: isExcluded,
        };
      });
    };

    return (
      <ScrollView style={s.stepContent} keyboardShouldPersistTaps="handled">
        <Text style={s.stepTitle}>Riepilogo Ordine</Text>

        {/* Customer */}
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>Cliente</Text>
          <Text style={s.summaryValue}>{selectedCustomer?.business_name}</Text>
        </View>

        {/* Items summary */}
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>Prodotti ({cartTotals.totalProducts} pz)</Text>
          {cart.map(c => (
            <View key={c.product.id} style={s.summaryItemRow}>
              <Text style={s.summaryItemName} numberOfLines={1}>{c.product.short_description || c.product.name}</Text>
              <Text style={s.summaryItemQty}>x{c.quantity}</Text>
              <Text style={s.summaryItemPrice}>{formatCurrency(c.unit_price * c.quantity)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={s.summaryCard}>
          <View style={s.summaryTotalRow}><Text style={s.summaryLabel}>Imponibile</Text><Text style={s.summaryValue}>{formatCurrency(cartTotals.imponibile)}</Text></View>
          <View style={s.summaryTotalRow}><Text style={s.summaryLabel}>Accisa</Text><Text style={s.summaryValue}>{formatCurrency(cartTotals.accisaTotal)}</Text></View>
          {!isForeignOrder && <View style={s.summaryTotalRow}><Text style={s.summaryLabel}>IVA</Text><Text style={s.summaryValue}>{formatCurrency(cartTotals.ivaTotal)}</Text></View>}
          <View style={s.summaryTotalRow}><Text style={s.summaryLabel}>Spedizione {!isForeignOrder && '(IVA incl.)'}</Text><Text style={s.summaryValue}>{formatCurrency(cartTotals.shippingWithVAT)}</Text></View>
          <View style={[s.summaryTotalRow, s.summaryGrandTotal]}>
            <Text style={s.summaryGrandLabel}>TOTALE</Text>
            <Text style={s.summaryGrandValue}>{formatCurrency(cartTotals.grandTotal)}</Text>
          </View>
        </View>

        {/* ═══ CashBack Section (matching old Raccolta Ordine) ═══ */}
        {!isForeignOrder && rottamazioneAmount === 0 && !scontoBenvenuto && (
          <View style={{ marginBottom: 10 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="gift" size={18} color="#10B981" />
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#065F46' }}>Utilizza CashBack</Text>
              </View>
              <View style={{ backgroundColor: '#10B981', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF' }}>Saldo: {formatCurrency(customerCashBackBalance)}</Text>
              </View>
            </View>
            <View style={[s.summaryCard, { borderWidth: 1, borderColor: '#A7F3D0' }]}>
              {customerCashBackBalance > 0 && cashbackEligibleItems.length > 0 ? (
                <>
                  {/* Eligible info box */}
                  <View style={{ flexDirection: 'row', backgroundColor: '#EFF6FF', borderRadius: 8, padding: 10, gap: 8, marginBottom: 10 }}>
                    <Ionicons name="information-circle" size={16} color="#1E40AF" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E40AF' }}>
                        Subtotale prodotti eligible: {formatCurrency(eligibleSubtotal)}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#3B82F6', marginTop: 2 }}>
                        Prodotti: {cashbackEligibleItems.map(c => c.product.short_description || c.product.name).join(', ')}
                      </Text>
                    </View>
                  </View>

                  {/* Input */}
                  <Text style={{ fontSize: 12, fontWeight: '600', color: '#065F46', marginBottom: 4 }}>Importo CashBack da utilizzare (€)</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput
                      style={[s.textInput, { flex: 1 }]}
                      keyboardType="numeric"
                      value={cashBackToUse > 0 ? cashBackToUse.toString() : ''}
                      onChangeText={t => {
                        const v = parseFloat(t) || 0;
                        setCashBackToUse(Math.min(v, maxCashBack));
                      }}
                      placeholder="0,00"
                      placeholderTextColor="#9CA3AF"
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                    />
                    <TouchableOpacity
                      style={{ backgroundColor: '#059669', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 }}
                      onPress={() => {
                        Keyboard.dismiss();
                        const val = cashBackToUse;
                        if (val > maxCashBack) {
                          setCashBackToUse(maxCashBack);
                          Alert.alert('Limite CashBack', `Importo ridotto al massimo consentito: ${formatCurrency(maxCashBack)}`);
                        } else if (val > 0 && cashBackMinThreshold > 0 && val < cashBackMinThreshold) {
                          Alert.alert('Soglia minima', `L'importo minimo di utilizzo è ${formatCurrency(cashBackMinThreshold)}`);
                        } else if (val > 0) {
                          Alert.alert('CashBack Confermato', `CashBack di ${formatCurrency(val)} verrà applicato all'ordine.\n\nLo sconto sarà spalmato sui prodotti eligible.`);
                        }
                      }}
                    >
                      <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>OK</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.maxBtn} onPress={() => {
                      Keyboard.dismiss();
                      setCashBackToUse(maxCashBack);
                      if (maxCashBack < customerCashBackBalance && cashBackMaxPercentage < 100) {
                        Alert.alert('Limite CashBack', `Il CashBack è limitato al ${cashBackMaxPercentage}% del valore dei prodotti idonei (${formatCurrency(eligibleSubtotal)}).\n\nMassimo utilizzabile: ${formatCurrency(maxCashBack)}`);
                      }
                    }}>
                      <Text style={s.maxBtnText}>MAX</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Rules box */}
                  <View style={{ flexDirection: 'row', backgroundColor: '#FFFBEB', borderRadius: 8, padding: 10, gap: 6, marginTop: 10 }}>
                    <Ionicons name="alert-circle-outline" size={14} color="#92400E" />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: '#92400E', fontStyle: 'italic', marginBottom: 6 }}>
                        Lo sconto CashBack verrà spalmato proporzionalmente sui prezzi unitari dei prodotti eligible.
                      </Text>
                      <Text style={{ fontSize: 10, color: '#92400E', marginBottom: 2 }}>• Max utilizzabile (saldo): {formatCurrency(customerCashBackBalance)}</Text>
                      <Text style={{ fontSize: 10, color: '#92400E', marginBottom: 2 }}>• Subtotale prodotti eligible: {formatCurrency(eligibleSubtotal)}</Text>
                      {cashBackMinThreshold > 0 && (
                        <Text style={{ fontSize: 10, color: '#92400E', marginBottom: 2 }}>• Soglia minima: {formatCurrency(cashBackMinThreshold)}</Text>
                      )}
                      <Text style={{ fontSize: 10, color: '#92400E', fontWeight: '700' }}>• Limite: {cashBackMaxPercentage}% del valore eligible = {formatCurrency(maxByPercentage)}</Text>
                    </View>
                  </View>

                  {cashBackToUse > 0 && cashBackMinThreshold > 0 && cashBackToUse < cashBackMinThreshold && (
                    <View style={{ flexDirection: 'row', backgroundColor: '#FEE2E2', borderRadius: 8, padding: 8, gap: 6, marginTop: 6 }}>
                      <Ionicons name="warning" size={14} color="#DC2626" />
                      <Text style={{ fontSize: 11, color: '#DC2626', flex: 1 }}>Importo minimo richiesto: {formatCurrency(cashBackMinThreshold)}</Text>
                    </View>
                  )}
                </>
              ) : customerCashBackBalance > 0 ? (
                <Text style={{ fontSize: 12, color: '#DC2626' }}>Nessun prodotto idoneo al CashBack nel carrello</Text>
              ) : (
                <Text style={s.summarySubLabel}>Nessun CashBack disponibile per questo cliente</Text>
              )}
            </View>
          </View>
        )}

        {/* ═══ Rottamazione Section (matching old Raccolta Ordine) ═══ */}
        {!isForeignOrder && cashBackToUse === 0 && !scontoBenvenuto && (
          <View style={{ marginBottom: 10 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="refresh" size={18} color="#8B5CF6" />
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#5B21B6' }}>Rottamazione</Text>
              {rottamazioneAmount > 0 && (
                <View style={{ backgroundColor: '#F97316', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, marginLeft: 'auto' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#FFF' }}>{formatCurrency(rottamazioneAmount)}</Text>
                </View>
              )}
            </View>
            <View style={[s.summaryCard, { borderWidth: 1, borderColor: '#C4B5FD' }]}>
              {rottamazioneEligibleItems.length > 0 ? (
                <>
                  <Text style={{ fontSize: 12, color: '#5B21B6', marginBottom: 8 }}>Seleziona importo rottamazione</Text>
                  {/* Lots */}
                  <View style={{ flexWrap: 'wrap', flexDirection: 'row', gap: 6 }}>
                    {availableLots.map(lot => (
                      <TouchableOpacity
                        key={lot}
                        style={[s.lotChip, rottamazioneAmount === lot && s.lotChipActive, { minWidth: 'auto' }]}
                        onPress={() => { setRottamazioneAmount(lot); if (lot === 0) setRottamazioneDescription(''); }}
                      >
                        <Text style={[s.lotChipText, rottamazioneAmount === lot && s.lotChipTextActive]}>
                          {lot === 0 ? 'Nessuna' : `${formatCurrency(lot)} (min: ${formatCurrency(lot * rottamazioneMultiplier)})`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {rottamazioneAmount > 0 && (
                    <>
                      <TextInput
                        style={[s.textInput, { marginTop: 10, minHeight: 60, textAlignVertical: 'top' }]}
                        placeholder="Descrivi la merce da rottamare... *"
                        value={rottamazioneDescription}
                        onChangeText={setRottamazioneDescription}
                        multiline
                        placeholderTextColor="#9CA3AF"
                      />
                      {!rottamazioneDescription.trim() && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FCD34D', borderRadius: 8, padding: 8, gap: 6, marginTop: 6 }}>
                          <Ionicons name="warning" size={14} color="#92400E" />
                          <Text style={{ fontSize: 11, color: '#92400E', flex: 1 }}>La descrizione della merce da rottamare è obbligatoria</Text>
                        </View>
                      )}
                    </>
                  )}

                  {/* Rules box */}
                  <View style={{ backgroundColor: '#F5F3FF', borderRadius: 8, padding: 10, marginTop: 10 }}>
                    <Text style={{ fontSize: 11, color: '#5B21B6', marginBottom: 2 }}>• Imponibile attuale: {formatCurrency(cartTotals.imponibile)}</Text>
                    {rottamazioneEligibleSubtotal < cartTotals.imponibile && (
                      <Text style={{ fontSize: 11, color: '#5B21B6', fontWeight: '700', marginBottom: 2 }}>• Imponibile eligible (esclusi "Rott. No"): {formatCurrency(rottamazioneEligibleSubtotal)}</Text>
                    )}
                    <Text style={{ fontSize: 11, color: '#5B21B6', marginBottom: 2 }}>• Formula: imponibile minimo = rottamazione × {rottamazioneMultiplier}</Text>
                    {rottamazioneAmount > 0 && (
                      <>
                        <Text style={{ fontSize: 11, color: '#5B21B6', marginBottom: 2 }}>• Importo lordo (IVA incl.): {formatCurrency(rottamazioneAmount)}</Text>
                        <Text style={{ fontSize: 11, color: '#5B21B6', fontWeight: '700', marginBottom: 2 }}>• Netto da spalmare (scorporo IVA {Math.round((rottamazioneIvaRate - 1) * 100)}%): {formatCurrency(getRottamazioneNetAmount(rottamazioneAmount))}</Text>
                        <Text style={{ fontSize: 10, color: '#7C3AED', fontStyle: 'italic', marginTop: 4 }}>Lo sconto netto verrà spalmato solo sui prodotti eligible alla rottamazione</Text>
                      </>
                    )}
                  </View>

                  {/* Summary box */}
                  {rottamazioneAmount > 0 && (
                    <View style={{ backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FB923C', borderRadius: 10, padding: 12, marginTop: 8 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, color: '#9A3412', flex: 1 }}>Rottamazione (lordo IVA incl.):</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#EA580C' }}>{formatCurrency(rottamazioneAmount)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 12, color: '#9A3412', flex: 1 }}>Sconto netto spalmato (scorporo IVA {Math.round((rottamazioneIvaRate - 1) * 100)}%):</Text>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#DC2626' }}>-{formatCurrency(getRottamazioneNetAmount(rottamazioneAmount))}</Text>
                      </View>
                    </View>
                  )}

                  {/* Preview prezzi spalmati */}
                  {rottamazioneAmount > 0 && (
                    <View style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#93C5FD', borderRadius: 10, padding: 12, marginTop: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E40AF', marginBottom: 6 }}>
                        Preview prezzi con Rottamazione (netto {formatCurrency(getRottamazioneNetAmount(rottamazioneAmount))}):
                      </Text>
                      {getSpreadedPrices().map((item) => (
                        <Text
                          key={item.product.id}
                          style={{ fontSize: 11, color: item.excluded ? '#9CA3AF' : '#1F2937', marginBottom: 2 }}
                        >
                          {item.excluded
                            ? `✗ ${item.product.short_description || item.product.name}: ${formatCurrency(item.originalPrice)} (${item.quantity} pz) — Escluso`
                            : `${item.product.short_description || item.product.name}: ${formatCurrency(item.originalPrice)} → ${formatCurrency(item.newPrice)} (${item.quantity} pz)`
                          }
                        </Text>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <Text style={{ fontSize: 12, color: '#DC2626' }}>Nessun prodotto idoneo alla rottamazione nel carrello</Text>
              )}
            </View>
          </View>
        )}

        {/* ═══ Sconto Benvenuto Section — only for first order, Italian, no other discounts ═══ */}
        {!isForeignOrder && isFirstOrder && rottamazioneAmount === 0 && cashBackToUse === 0 && (
          <View style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Ionicons name="star" size={18} color="#D97706" />
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#92400E' }}>Sconto Benvenuto (25%)</Text>
              <View style={{ backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginLeft: 'auto' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400E' }}>Primo Ordine</Text>
              </View>
            </View>
            <View style={[s.summaryCard, { borderWidth: 1, borderColor: '#FCD34D' }]}>
              {rottamazioneEligibleItems.length > 0 ? (
                <>
                  <Text style={{ fontSize: 12, color: '#92400E', marginBottom: 8 }}>
                    Sconto del 25% sull'imponibile dei prodotti eligible alla rottamazione
                  </Text>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
                    Prodotti eligible: {rottamazioneEligibleItems.length}/{cart.length} · Imponibile: {formatCurrency(rottamazioneEligibleSubtotal)}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#D97706', marginBottom: 8 }}>
                    Sconto: -{formatCurrency(rottamazioneEligibleSubtotal * 0.25)}
                  </Text>

                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: scontoBenvenuto ? '#FEF3C7' : '#F9FAFB', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: scontoBenvenuto ? '#F59E0B' : '#E5E7EB' }}
                    onPress={() => setScontoBenvenuto(!scontoBenvenuto)}
                  >
                    <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: scontoBenvenuto ? '#F59E0B' : '#D1D5DB', backgroundColor: scontoBenvenuto ? '#F59E0B' : '#FFF', alignItems: 'center', justifyContent: 'center' }}>
                      {scontoBenvenuto && <Ionicons name="checkmark" size={14} color="#FFF" />}
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: scontoBenvenuto ? '#92400E' : '#6B7280' }}>
                      {scontoBenvenuto ? 'Sconto Benvenuto applicato' : 'Applica Sconto Benvenuto'}
                    </Text>
                  </TouchableOpacity>

                  {scontoBenvenuto && (
                    <View style={{ backgroundColor: '#FFFBEB', borderRadius: 8, padding: 10, marginTop: 8 }}>
                      <Text style={{ fontSize: 10, color: '#92400E', fontStyle: 'italic' }}>
                        Lo sconto del 25% verrà spalmato proporzionalmente sui prezzi unitari dei prodotti eligible alla rottamazione.
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <Text style={{ fontSize: 12, color: '#DC2626' }}>Nessun prodotto eligible per lo Sconto Benvenuto</Text>
              )}
            </View>
          </View>
        )}

        {/* Notes */}
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>Note</Text>
          <TextInput style={s.textArea} placeholder="Note per l'ordine..." value={notes} onChangeText={setNotes} multiline placeholderTextColor="#9CA3AF" />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    );
  };

  // ═══════════════════════════════════════════════════
  // RENDER: MODALS
  // ═══════════════════════════════════════════════════

  const renderPackageModal = () => (
    <Modal visible={showPackageModal} animationType="slide" transparent>
      <View style={s.modalOverlay}>
        <View style={s.modalContent}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Seleziona Pacchetto</Text>
            <TouchableOpacity onPress={() => setShowPackageModal(false)}><Ionicons name="close" size={24} color="#374151" /></TouchableOpacity>
          </View>
          <View style={[s.searchBar, { marginHorizontal: 16 }]}>
            <Ionicons name="search" size={18} color="#9CA3AF" />
            <TextInput style={s.searchInput} placeholder="Cerca pacchetto..." value={packageSearch} onChangeText={setPackageSearch} placeholderTextColor="#9CA3AF" />
          </View>
          <FlatList
            data={packages.filter(p => !packageSearch.trim() || p.name.toLowerCase().includes(packageSearch.toLowerCase()))}
            keyExtractor={p => p.id}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item: pkg }) => (
              <View style={s.packageCard}>
                <Text style={s.packageName}>{pkg.name}</Text>
                <Text style={s.packageDetail}>{pkg.items.length} prodotti · {pkg.items.reduce((s, i) => s + i.quantity, 0)} pz</Text>
                <TouchableOpacity style={s.packageApplyBtn} onPress={() => applyPackage(pkg)}>
                  <Text style={s.packageApplyText}>Aggiungi</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  const renderEditPriceModal = () => {
    if (!editCartItem) return null;
    const stock = getEffectiveStock(editCartItem.product.id, editCartItem.product.stock_quantity || 0);

    const handleConfirmEdit = () => {
      Keyboard.dismiss();
      if (editCartItem) {
        // Apply price — normalize comma to dot for decimal
        const normalized = editPrice.trim().replace(',', '.');
        const p = normalized === '' ? 0 : parseFloat(normalized);
        if (!isNaN(p) && p >= 0) {
          updateCartPrice(editCartItem.product.id, p);
        }
        // Apply quantity
        if (editQty <= 0) {
          removeFromCart(editCartItem.product.id);
        } else {
          updateCartQty(editCartItem.product.id, editQty);
        }
      }
      setEditCartItem(null);
    };

    const handleRemoveItem = () => {
      Keyboard.dismiss();
      if (editCartItem) removeFromCart(editCartItem.product.id);
      setEditCartItem(null);
    };

    return (
      <Modal visible={!!editCartItem} animationType="slide" transparent onRequestClose={() => { Keyboard.dismiss(); setEditCartItem(null); }}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => Keyboard.dismiss()}>
          <TouchableOpacity activeOpacity={1} style={s.modalContent}>
            {/* Header */}
            <View style={s.modalHeader}>
              <Text style={s.modalTitle} numberOfLines={1}>Modifica Prodotto</Text>
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); setEditCartItem(null); }}>
                <Ionicons name="close" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              {/* Product name */}
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937', marginBottom: 4 }}>
                {editCartItem.product.short_description || editCartItem.product.name}
              </Text>
              <Text style={s.summarySubLabel}>
                Prezzo originale: {formatCurrency(editCartItem.product.unit_price)} · Stock: {stock}
              </Text>

              {/* ── Quantity control ── */}
              <Text style={[s.summaryLabel, { marginTop: 16, marginBottom: 8 }]}>Quantità</Text>
              <View style={s.qtyRow}>
                <TouchableOpacity
                  style={[s.qtyBtn, editQty <= 1 && s.qtyBtnDisabled]}
                  onPress={() => { Keyboard.dismiss(); setEditQty(Math.max(1, editQty - 1)); }}
                  disabled={editQty <= 1}
                >
                  <Ionicons name="remove" size={22} color={editQty <= 1 ? '#D1D5DB' : '#1E40AF'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.qtyBtn, editQty <= 1 && s.qtyBtnDisabled]}
                  onPress={() => { Keyboard.dismiss(); setEditQty(Math.max(1, editQty - 10)); }}
                  disabled={editQty <= 1}
                >
                  <Text style={[s.qtyBtnLabel, editQty <= 1 && { color: '#D1D5DB' }]}>-10</Text>
                </TouchableOpacity>

                <View style={s.qtyDisplay}>
                  <Text style={s.qtyDisplayText}>{editQty}</Text>
                </View>

                <TouchableOpacity
                  style={[s.qtyBtn, editQty >= stock && s.qtyBtnDisabled]}
                  onPress={() => { Keyboard.dismiss(); setEditQty(Math.min(stock, editQty + 10)); }}
                  disabled={editQty >= stock}
                >
                  <Text style={[s.qtyBtnLabel, editQty >= stock && { color: '#D1D5DB' }]}>+10</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.qtyBtn, editQty >= stock && s.qtyBtnDisabled]}
                  onPress={() => { Keyboard.dismiss(); setEditQty(Math.min(stock, editQty + 1)); }}
                  disabled={editQty >= stock}
                >
                  <Ionicons name="add" size={22} color={editQty >= stock ? '#D1D5DB' : '#1E40AF'} />
                </TouchableOpacity>
              </View>

              {/* ── Price input ── */}
              <Text style={[s.summaryLabel, { marginTop: 16, marginBottom: 8 }]}>Prezzo unitario</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TextInput
                  style={[s.textInput, { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' }]}
                  keyboardType="numeric"
                  value={editPrice}
                  onChangeText={setEditPrice}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                  selectTextOnFocus
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                <TouchableOpacity
                  style={[s.headerBtn, { backgroundColor: '#F3F4F6', paddingVertical: 12 }]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setEditPrice(editCartItem.product.unit_price.toString());
                  }}
                >
                  <Ionicons name="refresh" size={16} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* ── Action buttons ── */}
              <TouchableOpacity style={[s.confirmPriceBtn, { marginTop: 20 }]} onPress={handleConfirmEdit}>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={s.confirmPriceBtnText}>OK - Conferma</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.confirmPriceBtn, { marginTop: 8, backgroundColor: '#DC2626' }]}
                onPress={handleRemoveItem}
              >
                <Ionicons name="trash" size={18} color="#FFFFFF" />
                <Text style={s.confirmPriceBtnText}>Rimuovi dal carrello</Text>
              </TouchableOpacity>

              <View style={{ height: 20 }} />
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  const renderProductDetailModal = () => (
    <Modal visible={!!selectedProductDetail} animationType="fade" transparent>
      <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setSelectedProductDetail(null)}>
        <View style={[s.modalContent, { maxHeight: 500 }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle} numberOfLines={2}>{selectedProductDetail?.short_description || selectedProductDetail?.name}</Text>
            <TouchableOpacity onPress={() => setSelectedProductDetail(null)}><Ionicons name="close" size={24} color="#374151" /></TouchableOpacity>
          </View>
          {selectedProductDetail?.image_url && (
            <Image source={{ uri: selectedProductDetail.image_url }} style={{ width: '100%', height: 250 }} contentFit="contain" cachePolicy="memory-disk" transition={200} />
          )}
          <View style={{ padding: 16 }}>
            <Text style={s.summaryValue}>Prezzo: {formatCurrency(selectedProductDetail?.unit_price || 0)}</Text>
            {(selectedProductDetail?.accisa || 0) > 0 && !isEsteroDescription(selectedProductDetail?.short_description) && <Text style={s.prodAccisa}>Accisa: {formatCurrency(selectedProductDetail?.accisa || 0)}</Text>}
            <Text style={s.summarySubLabel}>SKU: {selectedProductDetail?.sku}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ═══════════════════════════════════════════════════
  // RENDER: MAIN
  // ═══════════════════════════════════════════════════

  if (isLoading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#1E40AF" />
          <Text style={{ marginTop: 12, color: '#6B7280' }}>Caricamento...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header — dynamic safe area */}
        <View style={[s.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <TouchableOpacity onPress={handleBack} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Raccolta Ordine</Text>
          {/* Save draft & exit button */}
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}
            onPress={async () => {
              if (selectedCustomer && cart.length > 0) {
                await autoSaveDraft();
                Alert.alert('Bozza Salvata', `Ordine per "${selectedCustomer.business_name}" salvato come bozza.\n\nPuoi riprenderlo da "Bozze Ordine".`, [
                  { text: 'OK', onPress: () => router.back() },
                ]);
              } else {
                router.back();
              }
            }}
          >
            <Ionicons name="save-outline" size={18} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Bozza</Text>
          </TouchableOpacity>
        </View>

        {renderStepper()}

        {/* Step Content */}
        <View style={{ flex: 1, paddingHorizontal: 12 }}>
          {currentStep === 0 && renderStep1()}
          {currentStep === 1 && renderStep2()}
          {currentStep === 2 && renderStep3()}
          {currentStep === 3 && renderStep4()}
          {currentStep === 4 && renderStep5()}
        </View>

        {/* Bottom Navigation — with safe area inset */}
        <View style={[s.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {currentStep > 0 && (
            <TouchableOpacity style={s.backBtn} onPress={handleBack}>
              <Ionicons name="arrow-back" size={18} color="#374151" />
              <Text style={s.backBtnText}>Indietro</Text>
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }} />
          {currentStep < STEPS.length - 1 ? (
            <TouchableOpacity style={[s.nextBtn, !canAdvance() && s.nextBtnDisabled]} onPress={handleNext} disabled={!canAdvance()}>
              <Text style={s.nextBtnText}>Avanti</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[s.submitBtn, isSubmitting && s.nextBtnDisabled]} onPress={handleSubmitOrder} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                  <Text style={s.nextBtnText}>Crea Ordine</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {renderPackageModal()}
        {renderEditPriceModal()}
        {renderProductDetailModal()}
      </KeyboardAvoidingView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1E40AF', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  stepDotDone: { backgroundColor: '#10B981' },
  stepDotCurrent: { backgroundColor: '#1E40AF' },
  stepNum: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  stepNumActive: { color: '#FFFFFF' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginHorizontal: 4 },
  stepLineDone: { backgroundColor: '#10B981' },
  stepContent: { flex: 1, paddingTop: 12 },
  stepTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, color: '#1F2937' },
  customerRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginBottom: 6 },
  customerRowSelected: { borderWidth: 2, borderColor: '#1E40AF', backgroundColor: '#EFF6FF' },
  customerName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  customerCity: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  headerBtnText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  prodRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 8, padding: 8, marginBottom: 4, gap: 8 },
  prodRowInCart: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  prodRowDisabled: { backgroundColor: '#F9FAFB', opacity: 0.7 },
  prodIcon: { width: 40, height: 40, borderRadius: 6, overflow: 'hidden' },
  prodImg: { width: 40, height: 40, borderRadius: 6 },
  prodImgPlaceholder: { width: 40, height: 40, borderRadius: 6, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  cartBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: '#DC2626', borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, borderWidth: 2, borderColor: '#FFFFFF', zIndex: 10 },
  cartBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  prodInfo: { flex: 1 },
  prodName: { fontSize: 13, fontWeight: '500', color: '#1F2937' },
  prodPrice: { fontSize: 12, fontWeight: '600', color: '#059669' },
  prodAccisa: { fontSize: 10, color: '#9CA3AF' },
  stockBadge: { backgroundColor: '#F3F4F6', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, alignItems: 'center', minWidth: 36 },
  stockGreen: { backgroundColor: '#ECFDF5' },
  stockAmber: { backgroundColor: '#FEF3C7' },
  stockRed: { backgroundColor: '#FEE2E2' },
  outOfStockBadge: { backgroundColor: '#FEE2E2', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  outOfStockText: { fontSize: 9, fontWeight: '800', color: '#DC2626', letterSpacing: 0.5 },
  stockText: { fontSize: 11, fontWeight: '700', color: '#059669' },
  stockReserved: { fontSize: 9, color: '#9CA3AF', marginTop: 1 },
  prodActions: { flexDirection: 'row', gap: 4 },
  addBtn: { backgroundColor: '#DBEAFE', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, minWidth: 36, alignItems: 'center' },
  addBtn10: { backgroundColor: '#C7D2FE' },
  addBtnDisabled: { backgroundColor: '#E5E7EB', opacity: 0.5 },
  addBtnText: { fontSize: 12, fontWeight: '700', color: '#1E40AF' },
  cartBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E40AF', borderRadius: 10, padding: 12, marginTop: 8 },
  cartBarText: { color: '#93C5FD', fontSize: 13, fontWeight: '600' },
  cartBarTotal: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  cartBarDetail: { color: '#93C5FD', fontSize: 10 },
  optionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginBottom: 6, gap: 10 },
  optionSelected: { borderWidth: 2, borderColor: '#1E40AF', backgroundColor: '#EFF6FF' },
  optionText: { fontSize: 15, fontWeight: '500', color: '#1F2937' },
  optionSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  textInput: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12, fontSize: 14, color: '#1F2937', borderWidth: 1, borderColor: '#E5E7EB' },
  textArea: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12, fontSize: 14, color: '#1F2937', borderWidth: 1, borderColor: '#E5E7EB', minHeight: 80, textAlignVertical: 'top' },
  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14, marginBottom: 10 },
  summaryLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  summarySubLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  summaryValue: { fontSize: 15, fontWeight: '600', color: '#1F2937', marginTop: 2 },
  summaryItemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
  summaryItemName: { flex: 1, fontSize: 13, color: '#374151' },
  summaryItemQty: { fontSize: 12, color: '#6B7280', width: 30 },
  summaryItemPrice: { fontSize: 13, fontWeight: '600', color: '#1F2937', width: 70, textAlign: 'right' },
  summaryTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryGrandTotal: { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 6, paddingTop: 8 },
  summaryGrandLabel: { fontSize: 16, fontWeight: '800', color: '#1E40AF' },
  summaryGrandValue: { fontSize: 16, fontWeight: '800', color: '#1E40AF' },
  lotChip: { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  lotChipActive: { backgroundColor: '#1E40AF' },
  lotChipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  lotChipTextActive: { color: '#FFFFFF' },
  rottamazioneNet: { fontSize: 12, color: '#059669', fontWeight: '600', marginBottom: 8 },
  maxBtn: { backgroundColor: '#1E40AF', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12 },
  maxBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  cashbackBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ECFDF5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginBottom: 8, borderWidth: 1, borderColor: '#A7F3D0' },
  cashbackBadgeText: { fontSize: 12, fontWeight: '600', color: '#059669' },
  confirmPriceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1E40AF', borderRadius: 10, paddingVertical: 14 },
  confirmPriceBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  qtyBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#BFDBFE' },
  qtyBtnDisabled: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  qtyBtnLabel: { fontSize: 13, fontWeight: '700', color: '#1E40AF' },
  qtyDisplay: { minWidth: 56, height: 48, borderRadius: 12, backgroundColor: '#1E40AF', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  qtyDisplayText: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  bottomBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#F3F4F6' },
  backBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1E40AF', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 },
  nextBtnDisabled: { backgroundColor: '#9CA3AF' },
  nextBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#059669', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1 },
  packageCard: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 14, marginBottom: 8 },
  packageName: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  packageDetail: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  packageApplyBtn: { backgroundColor: '#1E40AF', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 10 },
  packageApplyText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
});
