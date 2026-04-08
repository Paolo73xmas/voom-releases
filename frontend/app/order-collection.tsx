import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Image,
  Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuthStore } from '../store/authStore';
import { fetchCustomers, fetchCustomerById } from '../lib/api/customers';
import { 
  fetchProducts, 
  fetchPaymentMethods, 
  fetchShippingMethods,
  createOrder,
  Product,
  PaymentMethod,
  ShippingMethod,
} from '../lib/api/order-collection';
import { Customer } from '../types';
import { supabase } from '../lib/supabase';

interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
}

interface CashBackBalance {
  available_balance: number;
}

interface RottamazioneConfig {
  lots: number[];
  multiplier: number;
  iva_rate: number;
}

const DEFAULT_ROTTAMAZIONE_LOTS = [0, 100, 200, 300, 400, 500];
const DEFAULT_ROTTAMAZIONE_MULTIPLIER = 2.5;
const DEFAULT_ROTTAMAZIONE_IVA_RATE = 1.22;

const STEPS = ['Cliente', 'Prodotti', 'Pagamento', 'Spedizione', 'Riepilogo'];

export default function OrderCollectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuthStore();

  // Steps
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);

  // Loading states
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Selections
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [selectedShipping, setSelectedShipping] = useState<string>('');
  const [isForeignOrder, setIsForeignOrder] = useState(false);
  const [notes, setNotes] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');

  // CashBack
  const [cashBackBalance, setCashBackBalance] = useState<number>(0);
  const [cashBackToUse, setCashBackToUse] = useState<number>(0);

  // Rottamazione
  const [rottamazioneConfig, setRottamazioneConfig] = useState<RottamazioneConfig>({
    lots: DEFAULT_ROTTAMAZIONE_LOTS,
    multiplier: DEFAULT_ROTTAMAZIONE_MULTIPLIER,
    iva_rate: DEFAULT_ROTTAMAZIONE_IVA_RATE,
  });
  const [rottamazioneAmount, setRottamazioneAmount] = useState<number>(0);
  const [rottamazioneDescription, setRottamazioneDescription] = useState('');

  // Search
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);

  // Product detail modal
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);
  const [showCartModal, setShowCartModal] = useState(false);

  // Location
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    loadInitialData();
    loadRottamazioneConfig();
    getLocation();
  }, [user]);

  useEffect(() => {
    if (params.customerId) {
      loadCustomerFromParams();
    }
  }, [params.customerId]);

  useEffect(() => {
    if (selectedCustomer) {
      loadCashBackBalance();
    }
  }, [selectedCustomer]);

  // When Estero toggle changes, reload products and shipping methods
  const isForeignInitialMount = useRef(true);
  useEffect(() => {
    if (isForeignInitialMount.current) {
      isForeignInitialMount.current = false;
      return; // Skip on initial mount - loadInitialData handles first load
    }
    if (!user) return;
    reloadForForeignToggle();
  }, [isForeignOrder]);

  const reloadForForeignToggle = async () => {
    setLoadingProducts(true);
    try {
      const [productsData, shippingsData] = await Promise.all([
        fetchProducts(isForeignOrder),
        fetchShippingMethods(isForeignOrder),
      ]);
      setProducts(productsData);
      setShippingMethods(shippingsData);

      // Check for incompatible cart items (non-estero products in estero mode)
      if (isForeignOrder && cart.length > 0) {
        const eligibleIds = new Set(productsData.map((p: Product) => p.id));
        const incompatible = cart.filter(item => !eligibleIds.has(item.product.id));
        if (incompatible.length > 0) {
          const nomi = incompatible.map(i => i.product.short_description || i.product.name).join(', ');
          Alert.alert(
            'Conflitto Ordine Estero',
            `Hai ${incompatible.length} prodotto/i nel carrello NON abilitati per ordini esteri:\n\n${nomi}\n\nRimuovili dal carrello prima di procedere.`,
            [{ text: 'Ho capito', style: 'default' }]
          );
        }
      }

      // Reset shipping selection as available methods may change
      setSelectedShipping('');
    } catch (error) {
      console.error('Error reloading for foreign toggle:', error);
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadCustomerFromParams = async () => {
    try {
      const customer = await fetchCustomerById(params.customerId as string);
      if (customer) {
        setSelectedCustomer(customer);
        setCurrentStep(1);
      }
    } catch (error) {
      console.error('Error loading customer:', error);
    }
  };

  const loadRottamazioneConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('rottamazione_config')
        .select('*')
        .single();
      
      if (data && !error) {
        const lotsRaw = data.lots;
        const lots = Array.isArray(lotsRaw) 
          ? lotsRaw 
          : (typeof lotsRaw === 'string' ? JSON.parse(lotsRaw) : DEFAULT_ROTTAMAZIONE_LOTS);
        setRottamazioneConfig({
          lots: Array.isArray(lots) ? lots : DEFAULT_ROTTAMAZIONE_LOTS,
          multiplier: data.multiplier || DEFAULT_ROTTAMAZIONE_MULTIPLIER,
          iva_rate: data.iva_rate || DEFAULT_ROTTAMAZIONE_IVA_RATE,
        });
      }
    } catch (error) {
      console.log('Using default rottamazione config');
    }
  };

  const loadCashBackBalance = async () => {
    if (!selectedCustomer) return;
    try {
      // Get latest cashback transaction to get current balance
      const { data, error } = await supabase
        .from('cashback_transactions')
        .select('balance_after')
        .eq('customer_id', selectedCustomer.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data && !error) {
        setCashBackBalance(data.balance_after || 0);
      } else {
        setCashBackBalance(0);
      }
    } catch (error) {
      console.log('No cashback balance found');
      setCashBackBalance(0);
    }
  };

  const loadInitialData = async () => {
    if (!user) return;
    
    setLoadingCustomers(true);
    setLoadingProducts(true);

    try {
      const [customersData, productsData, paymentsData, shippingsData] = await Promise.all([
        fetchCustomers(user.id, user.role),
        fetchProducts(isForeignOrder),
        fetchPaymentMethods(),
        fetchShippingMethods(isForeignOrder),
      ]);

      setCustomers(customersData);
      setProducts(productsData);
      setPaymentMethods(paymentsData);
      setShippingMethods(shippingsData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Errore', 'Impossibile caricare i dati');
    } finally {
      setLoadingCustomers(false);
      setLoadingProducts(false);
    }
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    } catch (error) {
      console.log('Location error:', error);
    }
  };

  // Calculate line total with Accisa and IVA
  const calculateLineTotal = (
    quantity: number,
    unitPrice: number,
    accisa: number = 0,
    ivaPercentage: number = 22
  ): number => {
    const priceWithAccisa = unitPrice + accisa;
    const subtotal = priceWithAccisa * quantity;
    
    if (isForeignOrder) {
      return subtotal; // No IVA for foreign orders
    }
    
    return subtotal * (1 + ivaPercentage / 100);
  };

  // Cart functions
  const addMultipleToCart = (product: Product, count: number) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + count }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: count, unit_price: product.unit_price }]);
    }
  };

  const addToCart = (product: Product) => addMultipleToCart(product, 1);

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(cart.map(item =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      ));
    }
  };

  const getCartSubtotal = (): number => {
    return cart.reduce((sum, item) => {
      return sum + (item.unit_price * item.quantity);
    }, 0);
  };

  const getCartTotal = (): number => {
    const subtotal = cart.reduce((sum, item) => {
      const lineTotal = calculateLineTotal(
        item.quantity,
        item.unit_price,
        item.product.accisa || 0,
        item.product.iva_percentage || 22
      );
      return sum + lineTotal;
    }, 0);

    const shipping = shippingMethods.find(m => m.id === selectedShipping);
    const shippingCost = shipping?.cost || 0;
    const shippingWithVAT = isForeignOrder ? shippingCost : shippingCost * 1.22;

    // Apply discounts
    const discount = rottamazioneAmount > 0 
      ? getRottamazioneNetAmount(rottamazioneAmount) 
      : cashBackToUse;

    return Math.max(0, subtotal + shippingWithVAT - discount);
  };

  const getTotalAccisa = (): number => {
    return cart.reduce((sum, item) => {
      return sum + ((item.product.accisa || 0) * item.quantity);
    }, 0);
  };

  const getTotalIVA = (): number => {
    if (isForeignOrder) return 0;
    return cart.reduce((sum, item) => {
      const baseWithAccisa = (item.unit_price + (item.product.accisa || 0)) * item.quantity;
      const iva = baseWithAccisa * ((item.product.iva_percentage || 22) / 100);
      return sum + iva;
    }, 0);
  };

  // Rottamazione functions
  const getRottamazioneNetAmount = (grossAmount: number): number => {
    if (grossAmount <= 0) return 0;
    return Math.round((grossAmount / rottamazioneConfig.iva_rate) * 100) / 100;
  };

  const getAvailableRottamazioneLots = (): number[] => {
    if (isForeignOrder) return [0];
    const lots = Array.isArray(rottamazioneConfig.lots) ? rottamazioneConfig.lots : [0];
    const imponibile = getCartSubtotal();
    return lots.filter(lot => {
      if (lot === 0) return true;
      const requiredImponibile = lot * rottamazioneConfig.multiplier;
      return imponibile >= requiredImponibile;
    });
  };

  // CashBack eligible subtotal
  const getCashBackEligibleSubtotal = (): number => {
    return cart
      .filter(item => item.product.cashback_eligible === true)
      .reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  // Calculate rottamazione spreaded prices across all products
  const getSpreadedPrices = () => {
    if (rottamazioneAmount === 0) return [];
    const netDiscount = getRottamazioneNetAmount(rottamazioneAmount);
    const totalImponibile = getCartSubtotal();
    if (totalImponibile === 0) return [];

    return cart.map(item => {
      const itemImponibile = item.unit_price * item.quantity;
      const itemShare = itemImponibile / totalImponibile;
      const itemDiscount = netDiscount * itemShare;
      const discountPerUnit = itemDiscount / item.quantity;
      const newUnitPrice = Math.round((item.unit_price - discountPerUnit) * 100) / 100;

      return {
        product: item.product,
        quantity: item.quantity,
        originalPrice: item.unit_price,
        newPrice: newUnitPrice,
      };
    });
  };

  // Conflict detection: non-estero products in cart while estero mode is active
  const getIncompatibleCartItems = (): CartItem[] => {
    if (!isForeignOrder) return [];
    const eligibleIds = new Set(products.map(p => p.id));
    return cart.filter(item => !eligibleIds.has(item.product.id));
  };

  const hasCartConflict = isForeignOrder && cart.length > 0 && getIncompatibleCartItems().length > 0;

  // Navigation
  const canProceed = () => {
    switch (currentStep) {
      case 0: return selectedCustomer !== null;
      case 1: return cart.length > 0 && !hasCartConflict;
      case 2: return selectedPayment !== '';
      case 3: return selectedShipping !== '';
      case 4: return rottamazioneAmount === 0 || rottamazioneDescription.trim() !== '';
      default: return false;
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && hasCartConflict) {
      Alert.alert(
        'Impossibile procedere',
        'Hai prodotti nel carrello NON abilitati per ordini esteri. Rimuovili dal carrello prima di continuare.',
        [{ text: 'Apri carrello', onPress: () => setShowCartModal(true) }]
      );
      return;
    }
    if (canProceed() && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCustomer || !user || cart.length === 0) return;

    if (rottamazioneAmount > 0 && !rottamazioneDescription.trim()) {
      Alert.alert('Errore', 'Inserisci la descrizione della merce da rottamare');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createOrder({
        customer_id: selectedCustomer.id,
        agent_id: user.id,
        payment_method_id: selectedPayment,
        shipping_method_id: selectedShipping,
        is_foreign: isForeignOrder,
        shipping_address: shippingAddress || undefined,
        notes: notes || undefined,
        latitude: location?.latitude,
        longitude: location?.longitude,
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: 0,
        })),
      });

      Alert.alert(
        'Ordine Creato!',
        `Ordine ${result.orderNumber} creato con successo`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      console.error('Error creating order:', error);
      Alert.alert('Errore', error.message || 'Impossibile creare l\'ordine');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered data
  const filteredCustomers = customers.filter(c =>
    c.business_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.city.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const filteredProducts = products.filter(p => {
    // When Estero is OFF, hide products with short_description starting with "EST-"
    if (!isForeignOrder && p.short_description && p.short_description.toUpperCase().startsWith('EST-')) {
      return false;
    }
    // Search filter
    const search = productSearch.toLowerCase();
    if (!search) return true;
    return (
      p.name.toLowerCase().includes(search) ||
      p.sku.toLowerCase().includes(search) ||
      (p.short_description?.toLowerCase() || '').includes(search)
    );
  });

  // Render product row - compact list layout with small icon, name+price, accisa, +1, +10
  const renderProductRow = ({ item }: { item: Product }) => {
    const inCart = cart.find(c => c.product.id === item.id);
    const hasImage = item.image_url && item.image_url.trim() !== '';
    
    return (
      <View style={[styles.productRow, inCart && styles.productRowInCart]}>
        {/* Small Icon - tappable to open image modal */}
        <TouchableOpacity 
          style={styles.productIconWrap}
          onPress={() => setSelectedProductDetail(item)}
        >
          {hasImage ? (
            <Image 
              source={{ uri: item.image_url! }} 
              style={styles.productIcon}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.productIconPlaceholder}>
              <Ionicons name="cube-outline" size={18} color="#9CA3AF" />
            </View>
          )}
          {inCart && (
            <View style={styles.rowCartBadge}>
              <Text style={styles.rowCartBadgeText}>{inCart.quantity}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Name + Price */}
        <View style={styles.productRowInfo}>
          <Text style={styles.productRowName} numberOfLines={1}>
            {item.short_description || item.name}
          </Text>
          <Text style={styles.productRowPrice}>{formatCurrency(item.unit_price)}</Text>
        </View>

        {/* Accisa */}
        <View style={styles.productRowAccisaWrap}>
          {(item.accisa || 0) > 0 ? (
            <Text style={styles.productRowAccisa}>+{formatCurrency(item.accisa || 0)}</Text>
          ) : (
            <Text style={styles.productRowAccisaEmpty}>—</Text>
          )}
        </View>

        {/* +1 Button */}
        <TouchableOpacity 
          style={styles.addOneBtn} 
          onPress={() => addMultipleToCart(item, 1)}
        >
          <Text style={styles.addOneBtnText}>+1</Text>
        </TouchableOpacity>

        {/* +10 Button */}
        <TouchableOpacity 
          style={styles.addTenBtn} 
          onPress={() => addMultipleToCart(item, 10)}
        >
          <Text style={styles.addTenBtnText}>+10</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Render cart item with details
  const renderCartItem = (item: CartItem) => {
    const lineTotal = calculateLineTotal(
      item.quantity,
      item.unit_price,
      item.product.accisa || 0,
      item.product.iva_percentage || 22
    );

    // Check if this item is incompatible with current estero mode
    const isIncompatible = isForeignOrder && !products.some(p => p.id === item.product.id);

    return (
      <View key={item.product.id} style={[styles.cartItem, isIncompatible && styles.cartItemIncompatible]}>
        {/* Incompatibility badge */}
        {isIncompatible && (
          <View style={styles.incompatibleBadge}>
            <Ionicons name="alert-circle" size={12} color="#FFFFFF" />
            <Text style={styles.incompatibleBadgeText}>Non abilitato Estero</Text>
            <TouchableOpacity
              style={styles.incompatibleRemoveBtn}
              onPress={() => removeFromCart(item.product.id)}
            >
              <Text style={styles.incompatibleRemoveText}>Rimuovi</Text>
            </TouchableOpacity>
          </View>
        )}
        {/* Product Image */}
        <View style={styles.cartItemImage}>
          {item.product.image_url ? (
            <Image 
              source={{ uri: item.product.image_url }} 
              style={styles.cartItemImg}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.cartItemImgPlaceholder}>
              <Ionicons name="cube" size={20} color="#9CA3AF" />
            </View>
          )}
        </View>

        {/* Item Details */}
        <View style={styles.cartItemDetails}>
          <Text style={styles.cartItemName} numberOfLines={1}>
            {item.product.short_description || item.product.name}
          </Text>
          <Text style={styles.cartItemPrice}>
            {formatCurrency(item.unit_price)} 
            {(item.product.accisa || 0) > 0 && ` + ${formatCurrency(item.product.accisa || 0)} acc.`}
          </Text>
          <Text style={styles.cartItemIva}>
            IVA {item.product.iva_percentage || 22}% = {formatCurrency(lineTotal)}
          </Text>
        </View>

        {/* Quantity Controls */}
        <View style={styles.quantityControls}>
          <TouchableOpacity
            style={styles.quantityBtn}
            onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
          >
            <Ionicons name="remove" size={16} color="#EF4444" />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{item.quantity}</Text>
          <TouchableOpacity
            style={styles.quantityBtn}
            onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
          >
            <Ionicons name="add" size={16} color="#10B981" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderCustomerStep();
      case 1:
        return renderProductsStep();
      case 2:
        return renderPaymentStep();
      case 3:
        return renderShippingStep();
      case 4:
        return renderSummaryStep();
      default:
        return null;
    }
  };

  const renderCustomerStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Seleziona Cliente</Text>
      
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca cliente..."
          value={customerSearch}
          onChangeText={setCustomerSearch}
          onFocus={() => setShowCustomerList(true)}
        />
      </View>

      {selectedCustomer && !showCustomerList && (
        <View style={styles.selectedCard}>
          <View style={styles.selectedCustomerInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{selectedCustomer.business_name.charAt(0)}</Text>
            </View>
            <View>
              <Text style={styles.selectedName}>{selectedCustomer.business_name}</Text>
              <Text style={styles.selectedCity}>{selectedCustomer.city}, {selectedCustomer.province}</Text>
              {cashBackBalance > 0 && (
                <View style={styles.cashbackInfo}>
                  <Ionicons name="gift" size={14} color="#10B981" />
                  <Text style={styles.cashbackInfoText}>
                    CashBack: {formatCurrency(cashBackBalance)}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowCustomerList(true)}>
            <Ionicons name="swap-horizontal" size={24} color="#3B82F6" />
          </TouchableOpacity>
        </View>
      )}

      {(showCustomerList || !selectedCustomer) && (
        <FlatList
          data={filteredCustomers.slice(0, 20)}
          keyExtractor={(item) => item.id}
          style={styles.customerList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.customerItem}
              onPress={() => {
                setSelectedCustomer(item);
                setShowCustomerList(false);
                setCustomerSearch('');
                setCashBackToUse(0);
                setRottamazioneAmount(0);
              }}
            >
              <View style={styles.customerItemAvatar}>
                <Text style={styles.customerItemAvatarText}>{item.business_name.charAt(0)}</Text>
              </View>
              <View style={styles.customerItemInfo}>
                <Text style={styles.customerItemName}>{item.business_name}</Text>
                <Text style={styles.customerItemCity}>{item.city}, {item.province}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Nessun cliente trovato</Text>
          }
        />
      )}
    </View>
  );

  const renderProductsStep = () => (
    <View style={styles.stepContent}>
      <View style={styles.productHeader}>
        <Text style={styles.stepTitle}>Aggiungi Prodotti</Text>
        <TouchableOpacity
          style={[styles.foreignToggle, isForeignOrder && styles.foreignToggleActive]}
          onPress={() => setIsForeignOrder(!isForeignOrder)}
        >
          <Ionicons name="globe-outline" size={16} color={isForeignOrder ? '#FFFFFF' : '#6B7280'} />
          <Text style={[styles.foreignToggleText, isForeignOrder && styles.foreignToggleTextActive]}>
            Estero
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#6B7280" />
        <TextInput
          style={styles.searchInput}
          placeholder="Cerca prodotto..."
          value={productSearch}
          onChangeText={setProductSearch}
        />
      </View>

      {/* Conflict Warning Banner */}
      {hasCartConflict && (
        <View style={styles.conflictBanner}>
          <View style={styles.conflictBannerHeader}>
            <Ionicons name="warning" size={20} color="#DC2626" />
            <Text style={styles.conflictBannerTitle}>Conflitto Ordine Estero</Text>
          </View>
          <Text style={styles.conflictBannerText}>
            Hai {getIncompatibleCartItems().length} prodotto/i nel carrello NON abilitati per ordini esteri. 
            Rimuovili dal carrello per poter procedere.
          </Text>
          <TouchableOpacity 
            style={styles.conflictViewCartBtn}
            onPress={() => setShowCartModal(true)}
          >
            <Ionicons name="cart" size={14} color="#DC2626" />
            <Text style={styles.conflictViewCartText}>Apri carrello per rimuoverli</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Products List - compact rows */}
      {loadingProducts ? (
        <ActivityIndicator size="large" color="#1E40AF" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredProducts.slice(0, 50)}
          keyExtractor={(item) => item.id}
          renderItem={renderProductRow}
          style={styles.productList}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Nessun prodotto trovato</Text>
          }
        />
      )}

      {/* Cart at BOTTOM */}
      {cart.length > 0 && (
        <View style={styles.cartBottomSection}>
          <View style={styles.cartSummaryCard}>
            <View style={styles.cartSummaryRow}>
              <Text style={styles.cartSummaryLabel}>
                {cart.reduce((sum, i) => sum + i.quantity, 0)} prodotti
              </Text>
              <Text style={styles.cartSummaryTotal}>{formatCurrency(getCartTotal())}</Text>
            </View>
            <View style={styles.cartSummaryDetails}>
              <Text style={styles.cartDetailText}>
                Imp: {formatCurrency(getCartSubtotal())}
              </Text>
              <Text style={styles.cartDetailText}>
                Acc: {formatCurrency(getTotalAccisa())}
              </Text>
              {!isForeignOrder && (
                <Text style={styles.cartDetailText}>
                  IVA: {formatCurrency(getTotalIVA())}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity 
            style={styles.viewCartBtn}
            onPress={() => setShowCartModal(true)}
          >
            <Ionicons name="cart" size={16} color="#1E40AF" />
            <Text style={styles.viewCartBtnText}>Vedi carrello</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* CashBack Disponibile Banner */}
      {cashBackBalance > 0 && selectedCustomer && !isForeignOrder && (
        <View style={styles.cashbackBanner}>
          <View style={styles.cashbackBannerLeft}>
            <Ionicons name="gift" size={18} color="#10B981" />
            <View>
              <Text style={styles.cashbackBannerTitle}>CashBack Disponibile</Text>
              <Text style={styles.cashbackBannerSub}>Utilizzabile allo step Riepilogo</Text>
            </View>
          </View>
          <View style={styles.cashbackBannerBadge}>
            <Text style={styles.cashbackBannerAmount}>{formatCurrency(cashBackBalance)}</Text>
          </View>
        </View>
      )}

      {/* Cart Modal */}
      <Modal
        visible={showCartModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCartModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.cartModal}>
            <View style={styles.cartModalHeader}>
              <Text style={styles.cartModalTitle}>Carrello ({cart.length})</Text>
              <TouchableOpacity onPress={() => setShowCartModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.cartModalList}>
              {cart.map(item => renderCartItem(item))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Product Detail Modal */}
      <Modal
        visible={selectedProductDetail !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedProductDetail(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.productDetailModal}>
            <TouchableOpacity 
              style={styles.modalClose}
              onPress={() => setSelectedProductDetail(null)}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
            
            {selectedProductDetail && (
              <>
                {selectedProductDetail.image_url ? (
                  <Image 
                    source={{ uri: selectedProductDetail.image_url }} 
                    style={styles.modalImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.modalImagePlaceholder}>
                    <Ionicons name="cube-outline" size={64} color="#D1D5DB" />
                  </View>
                )}
                
                <Text style={styles.modalProductName}>
                  {selectedProductDetail.short_description || selectedProductDetail.name}
                </Text>
                <Text style={styles.modalProductSku}>SKU: {selectedProductDetail.sku}</Text>
                
                <View style={styles.modalPriceSection}>
                  <View style={styles.modalPriceRow}>
                    <Text style={styles.modalPriceLabel}>Prezzo Base:</Text>
                    <Text style={styles.modalPriceValue}>
                      {formatCurrency(selectedProductDetail.unit_price)}
                    </Text>
                  </View>
                  <View style={styles.modalPriceRow}>
                    <Text style={styles.modalPriceLabel}>Accisa:</Text>
                    <Text style={styles.modalPriceValue}>
                      {formatCurrency(selectedProductDetail.accisa || 0)}
                    </Text>
                  </View>
                  <View style={styles.modalPriceRow}>
                    <Text style={styles.modalPriceLabel}>IVA:</Text>
                    <Text style={styles.modalPriceValue}>
                      {selectedProductDetail.iva_percentage || 22}%
                    </Text>
                  </View>
                  <View style={[styles.modalPriceRow, styles.modalPriceRowTotal]}>
                    <Text style={styles.modalPriceLabelBold}>Prezzo Finale:</Text>
                    <Text style={styles.modalPriceValueBold}>
                      {formatCurrency(
                        (selectedProductDetail.unit_price + (selectedProductDetail.accisa || 0)) 
                        * (1 + (selectedProductDetail.iva_percentage || 22) / 100)
                      )}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalBadges}>
                  {selectedProductDetail.cashback_eligible && (
                    <View style={styles.modalCashbackBadge}>
                      <Ionicons name="gift" size={16} color="#10B981" />
                      <Text style={styles.modalCashbackText}>CashBack Eligible</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.modalAddBtn}
                  onPress={() => {
                    addToCart(selectedProductDetail);
                    setSelectedProductDetail(null);
                  }}
                >
                  <Ionicons name="cart" size={20} color="#FFFFFF" />
                  <Text style={styles.modalAddBtnText}>Aggiungi al Carrello</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );

  const renderPaymentStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Metodo di Pagamento</Text>
      
      {paymentMethods.map((method) => (
        <TouchableOpacity
          key={method.id}
          style={[
            styles.optionCard,
            selectedPayment === method.id && styles.optionCardSelected
          ]}
          onPress={() => setSelectedPayment(method.id)}
        >
          <View style={styles.optionInfo}>
            <Ionicons 
              name="card-outline" 
              size={24} 
              color={selectedPayment === method.id ? '#1E40AF' : '#6B7280'} 
            />
            <View style={styles.optionText}>
              <Text style={[
                styles.optionName,
                selectedPayment === method.id && styles.optionNameSelected
              ]}>
                {method.name}
              </Text>
              {method.description && (
                <Text style={styles.optionDescription}>{method.description}</Text>
              )}
            </View>
          </View>
          {selectedPayment === method.id && (
            <Ionicons name="checkmark-circle" size={24} color="#1E40AF" />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderShippingStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Metodo di Spedizione</Text>
      
      {shippingMethods.map((method) => (
        <TouchableOpacity
          key={method.id}
          style={[
            styles.optionCard,
            selectedShipping === method.id && styles.optionCardSelected
          ]}
          onPress={() => setSelectedShipping(method.id)}
        >
          <View style={styles.optionInfo}>
            <Ionicons 
              name="cube-outline" 
              size={24} 
              color={selectedShipping === method.id ? '#1E40AF' : '#6B7280'} 
            />
            <View style={styles.optionText}>
              <Text style={[
                styles.optionName,
                selectedShipping === method.id && styles.optionNameSelected
              ]}>
                {method.name}
              </Text>
              <Text style={styles.optionPrice}>{formatCurrency(method.cost)}</Text>
            </View>
          </View>
          {selectedShipping === method.id && (
            <Ionicons name="checkmark-circle" size={24} color="#1E40AF" />
          )}
        </TouchableOpacity>
      ))}

      <View style={styles.notesSection}>
        <Text style={styles.sectionLabel}>Indirizzo di spedizione (opzionale)</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Inserisci indirizzo alternativo..."
          value={shippingAddress}
          onChangeText={setShippingAddress}
          multiline
          numberOfLines={2}
        />
      </View>
    </View>
  );

  const renderSummaryStep = () => {
    const shipping = shippingMethods.find(m => m.id === selectedShipping);
    const payment = paymentMethods.find(m => m.id === selectedPayment);
    const availableLots = getAvailableRottamazioneLots();
    const eligibleSubtotal = getCashBackEligibleSubtotal();
    const orderTotal = getCartTotal();
    const cashbackLimit50 = orderTotal * 0.5; // 50% del totale ordine
    const maxCashBack = Math.min(cashBackBalance, eligibleSubtotal, cashbackLimit50);
    const cashbackMinThreshold = 10; // Soglia minima 10€
    const eligibleProducts = cart.filter(item => item.product.cashback_eligible === true);

    return (
      <ScrollView style={styles.stepContent}>
        <Text style={styles.stepTitle}>Riepilogo Ordine</Text>

        {/* Customer */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryLabel}>Cliente</Text>
          <View style={styles.summaryCard}>
            <Ionicons name="person" size={20} color="#3B82F6" />
            <Text style={styles.summaryValue}>{selectedCustomer?.business_name}</Text>
          </View>
        </View>

        {/* Products Summary */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryLabel}>Prodotti ({cart.length})</Text>
          <View style={styles.summaryCard}>
            {cart.map((item) => (
              <View key={item.product.id} style={styles.summaryItem}>
                <Text style={styles.summaryItemName}>
                  {item.quantity}x {item.product.short_description || item.product.name}
                </Text>
                <Text style={styles.summaryItemPrice}>
                  {formatCurrency(
                    calculateLineTotal(
                      item.quantity,
                      item.unit_price,
                      item.product.accisa || 0,
                      item.product.iva_percentage || 22
                    )
                  )}
                </Text>
              </View>
            ))}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Imponibile:</Text>
              <Text style={styles.summaryItemValue}>{formatCurrency(getCartSubtotal())}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryItemLabel}>Accisa totale:</Text>
              <Text style={styles.summaryItemValue}>{formatCurrency(getTotalAccisa())}</Text>
            </View>
            {!isForeignOrder && (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryItemLabel}>IVA totale:</Text>
                <Text style={styles.summaryItemValue}>{formatCurrency(getTotalIVA())}</Text>
              </View>
            )}
          </View>
        </View>

        {/* CashBack Section */}
        {cashBackBalance > 0 && rottamazioneAmount === 0 && !isForeignOrder && (
          <View style={styles.summarySection}>
            <View style={styles.cashbackHeader}>
              <View style={styles.cashbackHeaderLeft}>
                <Ionicons name="gift" size={18} color="#10B981" />
                <Text style={styles.cashbackHeaderTitle}>Utilizza CashBack</Text>
              </View>
              <View style={styles.cashbackSaldoBadge}>
                <Text style={styles.cashbackSaldoText}>Saldo: {formatCurrency(cashBackBalance)}</Text>
              </View>
            </View>
            <View style={[styles.summaryCard, styles.cashbackCard]}>
              {eligibleSubtotal > 0 ? (
                <>
                  {/* Eligible products info */}
                  <View style={styles.cashbackEligibleBox}>
                    <Ionicons name="information-circle" size={16} color="#1E40AF" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cashbackEligibleTitle}>
                        Subtotale prodotti eligible: {formatCurrency(eligibleSubtotal)}
                      </Text>
                      <Text style={styles.cashbackEligibleProducts}>
                        Prodotti eligible: {eligibleProducts.map(i => i.product.short_description || i.product.name).join(', ')}
                      </Text>
                    </View>
                  </View>

                  {/* Input field */}
                  <Text style={styles.cashbackInputTitle}>Importo CashBack da utilizzare (€)</Text>
                  <View style={styles.cashbackInputRow}>
                    <TextInput
                      style={styles.cashbackInput}
                      keyboardType="decimal-pad"
                      value={cashBackToUse > 0 ? cashBackToUse.toString() : ''}
                      onChangeText={(text) => {
                        const val = parseFloat(text) || 0;
                        if (val < cashbackMinThreshold && val > 0) {
                          // Allow typing but will validate on submit
                        }
                        setCashBackToUse(Math.min(val, maxCashBack));
                      }}
                      placeholder="0,00"
                    />
                    <TouchableOpacity
                      style={styles.cashbackMaxBtn}
                      onPress={() => setCashBackToUse(maxCashBack)}
                    >
                      <Text style={styles.cashbackMaxBtnText}>Max</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Rules */}
                  <View style={styles.cashbackRulesBox}>
                    <Ionicons name="alert-circle-outline" size={14} color="#92400E" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cashbackRuleNote}>
                        Lo sconto CashBack verrà spalmato proporzionalmente sui prezzi unitari dei prodotti per compatibilità con PrestaShop.
                      </Text>
                      <Text style={styles.cashbackRule}>• Max utilizzabile: {formatCurrency(cashBackBalance)}</Text>
                      <Text style={styles.cashbackRule}>• Subtotale prodotti eligible: {formatCurrency(eligibleSubtotal)}</Text>
                      <Text style={styles.cashbackRule}>• Soglia minima: {formatCurrency(cashbackMinThreshold)}</Text>
                      <Text style={styles.cashbackRule}>• Limite: 50% del totale ordine</Text>
                    </View>
                  </View>
                </>
              ) : (
                <Text style={styles.cashbackNotEligible}>
                  Nessun prodotto idoneo al CashBack nel carrello
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Rottamazione Section */}
        {!isForeignOrder && cashBackToUse === 0 && (
          <View style={styles.summarySection}>
            <View style={styles.rottamazioneHeader}>
              <Ionicons name="refresh" size={18} color="#8B5CF6" />
              <Text style={styles.rottamazioneHeaderTitle}>Rottamazione</Text>
              {rottamazioneAmount > 0 && (
                <View style={styles.rottamazioneBadge}>
                  <Text style={styles.rottamazioneBadgeText}>{formatCurrency(rottamazioneAmount)}</Text>
                </View>
              )}
            </View>
            <View style={[styles.summaryCard, styles.rottamazioneCard]}>
              <Text style={styles.rottamazioneInfo}>
                Seleziona importo rottamazione
              </Text>
              <View style={styles.rottamazioneLots}>
                {availableLots.map((lot) => (
                  <TouchableOpacity
                    key={lot}
                    style={[
                      styles.rottamazioneLot,
                      rottamazioneAmount === lot && styles.rottamazioneLotSelected
                    ]}
                    onPress={() => {
                      setRottamazioneAmount(lot);
                      if (lot === 0) setRottamazioneDescription('');
                    }}
                  >
                    <Text style={[
                      styles.rottamazioneLotText,
                      rottamazioneAmount === lot && styles.rottamazioneLotTextSelected
                    ]}>
                      {lot === 0 ? 'Nessuna' : `${formatCurrency(lot)} (min: ${formatCurrency(lot * rottamazioneConfig.multiplier)})`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {rottamazioneAmount > 0 && (
                <>
                  <TextInput
                    style={styles.rottamazioneInput}
                    placeholder="Descrivi la merce da rottamare... *"
                    value={rottamazioneDescription}
                    onChangeText={setRottamazioneDescription}
                    multiline
                  />
                  {!rottamazioneDescription.trim() && (
                    <View style={styles.rottamazioneWarning}>
                      <Ionicons name="warning" size={14} color="#92400E" />
                      <Text style={styles.rottamazioneWarningText}>
                        La descrizione della merce da rottamare è obbligatoria
                      </Text>
                    </View>
                  )}
                </>
              )}

              {/* Rottamazione rules */}
              <View style={styles.rottamazioneRulesBox}>
                <Text style={styles.rottamazioneRuleText}>
                  • Imponibile attuale: {formatCurrency(getCartSubtotal())}
                </Text>
                <Text style={styles.rottamazioneRuleText}>
                  • Formula: imponibile minimo = rottamazione × {rottamazioneConfig.multiplier}
                </Text>
                {rottamazioneAmount > 0 && (
                  <>
                    <Text style={styles.rottamazioneRuleText}>
                      • Importo lordo (IVA incl.): {formatCurrency(rottamazioneAmount)}
                    </Text>
                    <Text style={styles.rottamazioneRuleTextBold}>
                      • Netto da spalmare (scorporo IVA {Math.round((rottamazioneConfig.iva_rate - 1) * 100)}%): {formatCurrency(getRottamazioneNetAmount(rottamazioneAmount))}
                    </Text>
                    <Text style={styles.rottamazioneRuleTextNote}>
                      • Lo sconto netto verrà spalmato proporzionalmente sui prezzi unitari imponibili
                    </Text>
                  </>
                )}
              </View>
            </View>

            {/* Rottamazione Summary Box */}
            {rottamazioneAmount > 0 && (
              <View style={styles.rottamazioneSummaryBox}>
                <View style={styles.rottamazioneSummaryRow}>
                  <Text style={styles.rottamazioneSummaryLabel}>Rottamazione (lordo IVA incl.):</Text>
                  <Text style={styles.rottamazioneSummaryValue}>{formatCurrency(rottamazioneAmount)}</Text>
                </View>
                <View style={styles.rottamazioneSummaryRow}>
                  <Text style={styles.rottamazioneSummaryLabel}>Sconto netto spalmato (scorporo IVA {Math.round((rottamazioneConfig.iva_rate - 1) * 100)}%):</Text>
                  <Text style={styles.rottamazioneSummaryDiscount}>-{formatCurrency(getRottamazioneNetAmount(rottamazioneAmount))}</Text>
                </View>
              </View>
            )}

            {/* Preview prezzi spalmati */}
            {rottamazioneAmount > 0 && (
              <View style={styles.spreadedPreviewBox}>
                <Text style={styles.spreadedPreviewTitle}>
                  Preview prezzi con Rottamazione spalmata (netto {formatCurrency(getRottamazioneNetAmount(rottamazioneAmount))}):
                </Text>
                {getSpreadedPrices().map((item) => (
                  <Text key={item.product.id} style={styles.spreadedPreviewItem}>
                    {item.product.short_description || item.product.name}: {formatCurrency(item.originalPrice)} → {formatCurrency(item.newPrice)} ({item.quantity} pz)
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Payment */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryLabel}>Pagamento</Text>
          <View style={styles.summaryCard}>
            <Ionicons name="card" size={20} color="#10B981" />
            <Text style={styles.summaryValue}>{payment?.name}</Text>
          </View>
        </View>

        {/* Shipping */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryLabel}>Spedizione</Text>
          <View style={styles.summaryCard}>
            <Ionicons name="cube" size={20} color="#F59E0B" />
            <Text style={styles.summaryValue}>
              {shipping?.name} - {formatCurrency(shipping?.cost || 0)}
            </Text>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.notesSection}>
          <Text style={styles.sectionLabel}>Note (opzionale)</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Aggiungi note all'ordine..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Total */}
        <View style={styles.totalSection}>
          {(cashBackToUse > 0 || rottamazioneAmount > 0) && (
            <View style={styles.discountRow}>
              <Text style={styles.discountLabel}>
                {rottamazioneAmount > 0 ? 'Rottamazione:' : 'CashBack:'}
              </Text>
              <Text style={styles.discountValue}>
                -{formatCurrency(
                  rottamazioneAmount > 0 
                    ? getRottamazioneNetAmount(rottamazioneAmount) 
                    : cashBackToUse
                )}
              </Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Totale Ordine</Text>
            <Text style={styles.totalAmount}>{formatCurrency(getCartTotal())}</Text>
          </View>
        </View>

        {isForeignOrder && (
          <View style={styles.foreignBadge}>
            <Ionicons name="globe" size={16} color="#8B5CF6" />
            <Text style={styles.foreignBadgeText}>Ordine Estero (IVA esente)</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Stepper */}
      <View style={styles.stepper}>
        {STEPS.map((step, index) => (
          <React.Fragment key={step}>
            <TouchableOpacity
              style={[
                styles.stepDot,
                index < currentStep && styles.stepDotCompleted,
                index === currentStep && styles.stepDotCurrent
              ]}
              onPress={() => index < currentStep && setCurrentStep(index)}
            >
              {index < currentStep ? (
                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
              ) : (
                <Text style={[
                  styles.stepNumber,
                  index === currentStep && styles.stepNumberCurrent
                ]}>
                  {index + 1}
                </Text>
              )}
            </TouchableOpacity>
            {index < STEPS.length - 1 && (
              <View style={[
                styles.stepLine,
                index < currentStep && styles.stepLineCompleted
              ]} />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {renderStepContent()}
      </View>

      {/* Navigation */}
      <View style={styles.navigation}>
        {currentStep > 0 && (
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={20} color="#6B7280" />
            <Text style={styles.backButtonText}>Indietro</Text>
          </TouchableOpacity>
        )}
        
        {currentStep < 4 ? (
          <TouchableOpacity
            style={[styles.nextButton, !canProceed() && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={!canProceed()}
          >
            <Text style={styles.nextButtonText}>Avanti</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting || !canProceed()}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cart" size={20} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Crea Ordine</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotCompleted: {
    backgroundColor: '#10B981',
  },
  stepDotCurrent: {
    backgroundColor: '#1E40AF',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  stepNumberCurrent: {
    color: '#FFFFFF',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },
  stepLineCompleted: {
    backgroundColor: '#10B981',
  },
  content: {
    flex: 1,
    paddingHorizontal: 12,
  },
  stepContent: {
    flex: 1,
    paddingTop: 12,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: '#1F2937',
  },
  // Product Row Styles (compact list)
  productList: {
    flex: 1,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  productRowInCart: {
    borderWidth: 1.5,
    borderColor: '#3B82F6',
    backgroundColor: '#F0F4FF',
  },
  productIconWrap: {
    position: 'relative',
    marginRight: 8,
  },
  productIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  productIconPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#3B82F6',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  rowCartBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  productRowInfo: {
    flex: 1,
    marginRight: 6,
  },
  productRowName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1F2937',
  },
  productRowPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
  },
  productRowAccisaWrap: {
    width: 52,
    alignItems: 'center',
    marginRight: 6,
  },
  productRowAccisa: {
    fontSize: 10,
    color: '#F59E0B',
    fontWeight: '500',
  },
  productRowAccisaEmpty: {
    fontSize: 10,
    color: '#D1D5DB',
  },
  addOneBtn: {
    backgroundColor: '#1E40AF',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 4,
    minWidth: 38,
    alignItems: 'center',
  },
  addOneBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  addTenBtn: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
    minWidth: 38,
    alignItems: 'center',
  },
  addTenBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  // Cart Bottom Section
  cartBottomSection: {
    marginTop: 6,
  },
  viewCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  viewCartBtnText: {
    fontSize: 13,
    color: '#1E40AF',
    fontWeight: '600',
  },
  cartModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '60%',
    width: '100%',
    position: 'absolute',
    bottom: 0,
  },
  cartModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cartModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  cartModalList: {
    maxHeight: 300,
  },
  // Conflict Banner Styles
  conflictBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  conflictBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  conflictBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  conflictBannerText: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 18,
    marginBottom: 8,
  },
  conflictViewCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  conflictViewCartText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },
  // Incompatible cart item styles
  cartItemIncompatible: {
    borderWidth: 1.5,
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  incompatibleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EF4444',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
    marginBottom: 6,
  },
  incompatibleBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
    flex: 1,
  },
  incompatibleRemoveBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  incompatibleRemoveText: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: '700',
  },
  // CashBack Banner (Step 2)
  cashbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  cashbackBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cashbackBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  cashbackBannerSub: {
    fontSize: 10,
    color: '#047857',
  },
  cashbackBannerBadge: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cashbackBannerAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // CashBack Section (Step 5)
  cashbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  cashbackHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cashbackHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46',
  },
  cashbackSaldoBadge: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cashbackSaldoText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cashbackEligibleBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    marginBottom: 10,
  },
  cashbackEligibleTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
  },
  cashbackEligibleProducts: {
    fontSize: 11,
    color: '#3B82F6',
    marginTop: 2,
  },
  cashbackInputTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    marginBottom: 4,
  },
  cashbackRulesBox: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 10,
    gap: 6,
    marginTop: 10,
  },
  cashbackRuleNote: {
    fontSize: 10,
    color: '#92400E',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  cashbackRule: {
    fontSize: 10,
    color: '#92400E',
    marginBottom: 2,
  },
  // Rottamazione Section (Step 5)
  rottamazioneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  rottamazioneHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#5B21B6',
  },
  rottamazioneRulesBox: {
    backgroundColor: '#F5F3FF',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  rottamazioneRuleText: {
    fontSize: 11,
    color: '#5B21B6',
    marginBottom: 2,
  },
  rottamazioneRuleTextBold: {
    fontSize: 11,
    color: '#5B21B6',
    fontWeight: '700',
    marginBottom: 2,
  },
  rottamazioneRuleTextNote: {
    fontSize: 10,
    color: '#7C3AED',
    fontStyle: 'italic',
    marginTop: 4,
  },
  rottamazioneBadge: {
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginLeft: 'auto',
  },
  rottamazioneBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  rottamazioneWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    padding: 10,
    gap: 6,
    marginTop: 8,
  },
  rottamazioneWarningText: {
    fontSize: 11,
    color: '#92400E',
    flex: 1,
  },
  rottamazioneSummaryBox: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FB923C',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  rottamazioneSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rottamazioneSummaryLabel: {
    fontSize: 12,
    color: '#9A3412',
    flex: 1,
  },
  rottamazioneSummaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#EA580C',
  },
  rottamazioneSummaryDiscount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  spreadedPreviewBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  spreadedPreviewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 6,
  },
  spreadedPreviewItem: {
    fontSize: 11,
    color: '#1E3A8A',
    marginBottom: 2,
  },
  // Cart Summary
  cartSummaryCard: {
    backgroundColor: '#1E40AF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  cartSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cartSummaryLabel: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  cartSummaryTotal: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  cartSummaryDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 8,
  },
  cartDetailText: {
    color: '#93C5FD',
    fontSize: 11,
  },
  // Cart Section
  cartSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    maxHeight: 200,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  cartItemsList: {
    maxHeight: 160,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cartItemImage: {
    marginRight: 10,
  },
  cartItemImg: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  cartItemImgPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartItemDetails: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1F2937',
  },
  cartItemPrice: {
    fontSize: 11,
    color: '#6B7280',
  },
  cartItemIva: {
    fontSize: 10,
    color: '#10B981',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 10,
    color: '#1F2937',
  },
  // Product Detail Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  productDetailModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 350,
  },
  modalClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  modalImage: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    marginBottom: 12,
  },
  modalImagePlaceholder: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalProductName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  modalProductSku: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  modalPriceSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  modalPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalPriceRowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    marginTop: 4,
  },
  modalPriceLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  modalPriceValue: {
    fontSize: 13,
    color: '#1F2937',
  },
  modalPriceLabelBold: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  modalPriceValueBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E40AF',
  },
  modalBadges: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  modalCashbackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  modalCashbackText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  modalAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  modalAddBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  // Options (Payment/Shipping)
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionCardSelected: {
    borderColor: '#1E40AF',
    backgroundColor: '#EEF2FF',
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionText: {
    marginLeft: 12,
  },
  optionName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  optionNameSelected: {
    color: '#1E40AF',
  },
  optionDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  optionPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  // Notes
  notesSection: {
    marginTop: 12,
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    minHeight: 70,
    textAlignVertical: 'top',
  },
  // Summary
  summarySection: {
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
  },
  summaryValue: {
    fontSize: 14,
    color: '#1F2937',
    marginLeft: 10,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryItemName: {
    fontSize: 13,
    color: '#4B5563',
    flex: 1,
  },
  summaryItemPrice: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1F2937',
  },
  summaryItemLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  summaryItemValue: {
    fontSize: 12,
    color: '#1F2937',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 8,
  },
  // CashBack
  cashbackCard: {
    borderWidth: 1,
    borderColor: '#10B981',
  },
  cashbackAvailable: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 4,
  },
  cashbackEligible: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  cashbackNotEligible: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  cashbackInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cashbackInputLabel: {
    fontSize: 13,
    color: '#374151',
  },
  cashbackInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  cashbackMaxBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cashbackMaxBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  cashbackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  cashbackInfoText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  // Rottamazione
  rottamazioneCard: {
    borderWidth: 1,
    borderColor: '#8B5CF6',
  },
  rottamazioneInfo: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  rottamazioneLots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  rottamazioneLot: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rottamazioneLotSelected: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  rottamazioneLotText: {
    fontSize: 12,
    color: '#4B5563',
  },
  rottamazioneLotTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  rottamazioneNet: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '500',
    marginBottom: 8,
  },
  rottamazioneInput: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    minHeight: 50,
    textAlignVertical: 'top',
  },
  // Total
  totalSection: {
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    marginBottom: 16,
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  discountLabel: {
    color: '#93C5FD',
    fontSize: 13,
  },
  discountValue: {
    color: '#FCD34D',
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  foreignBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  foreignBadgeText: {
    fontSize: 13,
    color: '#8B5CF6',
    marginLeft: 6,
  },
  // Navigation
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  backButtonText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 6,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E40AF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginLeft: 'auto',
  },
  nextButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 6,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginLeft: 'auto',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // Other
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  selectedCustomerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  selectedName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  selectedCity: {
    fontSize: 12,
    color: '#6B7280',
  },
  customerList: {
    flex: 1,
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  customerItemAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerItemAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  customerItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  customerItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  customerItemCity: {
    fontSize: 12,
    color: '#6B7280',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  foreignToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  foreignToggleActive: {
    backgroundColor: '#8B5CF6',
  },
  foreignToggleText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  foreignToggleTextActive: {
    color: '#FFFFFF',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    marginTop: 24,
    fontSize: 14,
  },
});
