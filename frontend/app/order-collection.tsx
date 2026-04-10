import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
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
import {
  CartItem,
  RottamazioneConfig,
  DEFAULT_ROTTAMAZIONE_LOTS,
  DEFAULT_ROTTAMAZIONE_MULTIPLIER,
  DEFAULT_ROTTAMAZIONE_IVA_RATE,
  STEPS,
} from '../components/order-collection/types';
import { styles } from '../components/order-collection/styles';

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
  
  // Cart item edit modal
  const [editCartItem, setEditCartItem] = useState<CartItem | null>(null);
  const [editPrice, setEditPrice] = useState('');

  // Packages
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [packages, setPackages] = useState<any[]>([]);
  const [packageSearch, setPackageSearch] = useState('');
  const [loadingPackages, setLoadingPackages] = useState(false);

  // Location
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    loadInitialData();
    loadRottamazioneConfig();
    loadPackages();
    getLocation();
  }, [user]);

  useEffect(() => {
    if (params.customerId || params.customerName) {
      loadCustomerFromParams();
    }
  }, [params.customerId, params.customerName]);

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
      // 1. Try loading by customer ID first
      if (params.customerId) {
        try {
          const customer = await fetchCustomerById(params.customerId as string);
          if (customer) {
            setSelectedCustomer(customer);
            setCurrentStep(1);
            return;
          }
        } catch (e) {
          console.log('[OrderCollection] Customer ID lookup failed, trying name search...');
        }
      }

      // 2. Fallback: pre-fill search box with customer name
      if (params.customerName) {
        const name = params.customerName as string;
        setCustomerSearch(name);

        // Try to auto-match the customer from the loaded list
        if (customers.length > 0) {
          const match = customers.find(c =>
            c.business_name.toLowerCase() === name.toLowerCase()
          );
          if (match) {
            setSelectedCustomer(match);
            setCurrentStep(1);
            return;
          }
        }

        // If customers not loaded yet, search Supabase directly
        if (user) {
          try {
            const { data } = await supabase
              .from('customers')
              .select('*')
              .ilike('business_name', `%${name}%`)
              .limit(1)
              .single();
            if (data) {
              setSelectedCustomer(data as Customer);
              setCurrentStep(1);
              return;
            }
          } catch (e) {
            console.log('[OrderCollection] Name search fallback, showing search results');
          }
        }
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

  // Load packages with items and product details
  const loadPackages = async () => {
    setLoadingPackages(true);
    try {
      const { data: pkgs, error: pkgError } = await supabase
        .from('packages')
        .select('*, branches(name)')
        .eq('is_active', true)
        .order('name');
      
      if (pkgError || !pkgs) {
        setLoadingPackages(false);
        return;
      }

      const packagesWithItems = await Promise.all(
        pkgs.map(async (pkg: any) => {
          const { data: items } = await supabase
            .from('package_items')
            .select('*, products(id, name, short_description, sku, unit_price, image_url, accisa, iva_percentage, stock_quantity, cashback_eligible, estero, rottamazione_no, is_active)')
            .eq('package_id', pkg.id);

          const validItems = (items || []).filter((i: any) => i.products);
          const totalPieces = validItems.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);
          const totalPrice = validItems.reduce((sum: number, i: any) => sum + (((i.unit_price ?? i.products.unit_price) ?? 0) * (i.quantity || 0)), 0);

          return {
            ...pkg,
            branchName: pkg.branches?.name || null,
            items: validItems,
            totalProducts: validItems.length,
            totalPieces,
            totalPrice,
          };
        })
      );

      setPackages(packagesWithItems);
    } catch (error) {
      console.log('Error loading packages:', error);
    } finally {
      setLoadingPackages(false);
    }
  };

  // Apply a package to the cart
  const applyPackage = (pkg: any) => {
    const newItems: CartItem[] = pkg.items.map((item: any) => ({
      product: {
        ...item.products,
        id: item.products.id || item.product_id,
      },
      quantity: item.quantity,
      unit_price: (item.unit_price ?? item.products.unit_price) ?? 0,
    }));

    let updatedCart = [...cart];
    for (const newItem of newItems) {
      const existingIndex = updatedCart.findIndex(c => c.product.id === newItem.product.id);
      if (existingIndex >= 0) {
        updatedCart[existingIndex] = {
          ...updatedCart[existingIndex],
          quantity: updatedCart[existingIndex].quantity + newItem.quantity,
          unit_price: newItem.unit_price,
        };
      } else {
        updatedCart.push(newItem);
      }
    }
    setCart(updatedCart);
    setShowPackageModal(false);
    Alert.alert('Pacchetto applicato', `"${pkg.name}" aggiunto al carrello (${pkg.totalProducts} prodotti, ${pkg.totalPieces} pz)`);
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
    const stock = product.stock_quantity || 0;
    const existing = cart.find(item => item.product.id === product.id);
    const currentQty = existing ? existing.quantity : 0;
    const maxAddable = stock - currentQty;
    
    if (maxAddable <= 0) {
      Alert.alert('Stock esaurito', `Nessun pezzo disponibile per "${product.short_description || product.name}" (magazzino: ${stock})`);
      return;
    }
    
    const actualCount = Math.min(count, maxAddable);
    if (actualCount < count) {
      Alert.alert('Limite magazzino', `Aggiunti ${actualCount} pz invece di ${count} (max disponibile: ${stock})`);
    }

    if (existing) {
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + actualCount }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: actualCount, unit_price: product.unit_price }]);
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

  // Calculate rottamazione spreaded prices - ONLY on eligible products (rottamazione_no !== true)
  const getSpreadedPrices = () => {
    if (rottamazioneAmount === 0) return [];
    const netDiscount = getRottamazioneNetAmount(rottamazioneAmount);
    // Only eligible products participate in the spread
    const eligibleItems = cart.filter(item => item.product.rottamazione_no !== true);
    const eligibleImponibile = eligibleItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    if (eligibleImponibile === 0) return [];

    return cart.map(item => {
      const isExcluded = item.product.rottamazione_no === true;
      if (isExcluded) {
        return {
          product: item.product,
          quantity: item.quantity,
          originalPrice: item.unit_price,
          newPrice: item.unit_price,
          excluded: true,
        };
      }
      const itemImponibile = item.unit_price * item.quantity;
      const itemShare = itemImponibile / eligibleImponibile;
      const itemDiscount = netDiscount * itemShare;
      const discountPerUnit = itemDiscount / item.quantity;
      const newUnitPrice = Math.round((item.unit_price - discountPerUnit) * 100) / 100;

      return {
        product: item.product,
        quantity: item.quantity,
        originalPrice: item.unit_price,
        newPrice: newUnitPrice,
        excluded: false,
      };
    });
  };

  // Rottamazione eligible imponibile (excluding rottamazione_no products)
  const getRottamazioneEligibleSubtotal = (): number => {
    return cart
      .filter(item => item.product.rottamazione_no !== true)
      .reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
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
      // Build items array with modified prices based on rottamazione/cashback
      let orderItems: { product_id: string; quantity: number; unit_price: number; discount_percent: number }[];

      if (rottamazioneAmount > 0) {
        // Apply rottamazione: use spreaded prices
        const spreadedPrices = getSpreadedPrices();
        if (spreadedPrices.length > 0) {
          orderItems = spreadedPrices.map(sp => ({
            product_id: sp.product.id,
            quantity: sp.quantity,
            unit_price: sp.newPrice,  // Spreaded price (reduced for eligible, original for excluded)
            discount_percent: 0,
          }));
        } else {
          // Fallback: no eligible products, use original prices
          orderItems = cart.map(item => ({
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: 0,
          }));
        }
      } else if (cashBackToUse > 0) {
        // Apply cashback: spread proportionally on eligible products
        const eligibleItems = cart.filter(item => item.product.cashback_eligible === true);
        const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

        orderItems = cart.map(item => {
          if (item.product.cashback_eligible === true && eligibleSubtotal > 0) {
            const itemImponibile = item.unit_price * item.quantity;
            const itemShare = itemImponibile / eligibleSubtotal;
            const itemDiscount = cashBackToUse * itemShare;
            const discountPerUnit = itemDiscount / item.quantity;
            const newUnitPrice = Math.round((item.unit_price - discountPerUnit) * 100) / 100;
            return {
              product_id: item.product.id,
              quantity: item.quantity,
              unit_price: Math.max(0, newUnitPrice),
              discount_percent: 0,
            };
          }
          return {
            product_id: item.product.id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: 0,
          };
        });
      } else {
        // No discount: use original prices
        orderItems = cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: 0,
        }));
      }

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
        items: orderItems,
        ...(rottamazioneAmount > 0 ? {
          rottamazione_amount: rottamazioneAmount,
          rottamazione_description: rottamazioneDescription,
        } : {}),
        ...(cashBackToUse > 0 ? {
          cashback_amount: cashBackToUse,
        } : {}),
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
  }).sort((a, b) => {
    const nameA = (a.short_description || a.name || '').toLowerCase();
    const nameB = (b.short_description || b.name || '').toLowerCase();
    return nameA.localeCompare(nameB, 'it');
  });

  // Render product row - compact list layout
  const renderProductRow = ({ item }: { item: Product }) => {
    const inCart = cart.find(c => c.product.id === item.id);
    const hasImage = item.image_url && item.image_url.trim() !== '';
    const stock = item.stock_quantity || 0;
    const cartQty = inCart ? inCart.quantity : 0;
    const canAdd1 = cartQty + 1 <= stock;
    const canAdd10 = cartQty + 10 <= stock;
    
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

        {/* Name + Price + Accisa (stacked) - tappable if in cart */}
        <TouchableOpacity 
          style={styles.productRowInfo}
          disabled={!inCart}
          onPress={() => {
            if (inCart) {
              setEditCartItem(inCart);
              setEditPrice(inCart.unit_price.toString());
            }
          }}
        >
          <Text style={[styles.productRowName, inCart && styles.productRowNameTappable]} numberOfLines={1}>
            {item.short_description || item.name}
          </Text>
          <View style={styles.productRowPriceRow}>
            <Text style={styles.productRowPrice}>{formatCurrency(inCart ? inCart.unit_price : item.unit_price)}</Text>
            {(item.accisa || 0) > 0 && (
              <Text style={styles.productRowAccisaInline}>+{formatCurrency(item.accisa || 0)} acc.</Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Stock Quantity (where accisa was) */}
        <View style={[styles.stockBadge, stock <= 0 && styles.stockBadgeEmpty, stock > 0 && stock <= 20 && styles.stockBadgeLow]}>
          <Text style={[styles.stockBadgeText, stock <= 0 && styles.stockBadgeTextEmpty]}>{stock}</Text>
        </View>

        {/* +1 Button */}
        <TouchableOpacity 
          style={[styles.addOneBtn, !canAdd1 && styles.addBtnDisabled]} 
          onPress={() => canAdd1 && addMultipleToCart(item, 1)}
          disabled={!canAdd1}
        >
          <Text style={[styles.addOneBtnText, !canAdd1 && styles.addBtnTextDisabled]}>+1</Text>
        </TouchableOpacity>

        {/* +10 Button */}
        <TouchableOpacity 
          style={[styles.addTenBtn, !canAdd10 && styles.addBtnDisabled]} 
          onPress={() => {
            if (canAdd10) {
              addMultipleToCart(item, 10);
            } else {
              const remaining = stock - cartQty;
              if (remaining > 0) {
                addMultipleToCart(item, remaining);
                Alert.alert('Limite raggiunto', `Aggiunti ${remaining} pz (max disponibile: ${stock})`);
              } else {
                Alert.alert('Stock esaurito', `Non ci sono più pezzi disponibili (${stock} in magazzino)`);
              }
            }
          }}
        >
          <Text style={[styles.addTenBtnText, !canAdd10 && styles.addBtnTextDisabled]}>+10</Text>
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
        <View style={styles.productHeaderBtns}>
          <TouchableOpacity
            style={styles.packageToggle}
            onPress={() => setShowPackageModal(true)}
          >
            <Ionicons name="layers-outline" size={16} color="#8B5CF6" />
            <Text style={styles.packageToggleText}>Pacchetto</Text>
          </TouchableOpacity>
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

      {/* Cart Item Edit Modal */}
      <Modal
        visible={editCartItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditCartItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editCartModal}>
            {editCartItem && (
              <>
                <View style={styles.editCartHeader}>
                  <Text style={styles.editCartTitle}>Modifica Prodotto</Text>
                  <TouchableOpacity onPress={() => setEditCartItem(null)}>
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* Product info */}
                <View style={styles.editCartProductInfo}>
                  {editCartItem.product.image_url ? (
                    <Image 
                      source={{ uri: editCartItem.product.image_url }} 
                      style={styles.editCartImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.editCartImagePlaceholder}>
                      <Ionicons name="cube" size={24} color="#9CA3AF" />
                    </View>
                  )}
                  <View style={styles.editCartDetails}>
                    <Text style={styles.editCartName}>
                      {editCartItem.product.short_description || editCartItem.product.name}
                    </Text>
                    <Text style={styles.editCartSku}>SKU: {editCartItem.product.sku}</Text>
                    <Text style={styles.editCartQty}>Quantità nel carrello: {editCartItem.quantity} pz</Text>
                    <Text style={styles.editCartStock}>
                      Magazzino: {editCartItem.product.stock_quantity || 0} pz
                    </Text>
                  </View>
                </View>

                {/* Price edit */}
                <View style={styles.editCartSection}>
                  <Text style={styles.editCartSectionTitle}>Prezzo Unitario</Text>
                  <View style={styles.editCartPriceRow}>
                    <Text style={styles.editCartOriginalLabel}>Listino:</Text>
                    <Text style={styles.editCartOriginalPrice}>
                      {formatCurrency(editCartItem.product.unit_price)}
                    </Text>
                  </View>
                  <View style={styles.editCartPriceInputRow}>
                    <Text style={styles.editCartPriceLabel}>Nuovo prezzo (€):</Text>
                    <TextInput
                      style={styles.editCartPriceInput}
                      keyboardType="decimal-pad"
                      value={editPrice}
                      onChangeText={setEditPrice}
                      placeholder="0.00"
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.editCartApplyBtn}
                    onPress={() => {
                      const parsed = parseFloat(editPrice.replace(',', '.'));
                      const newPrice = isNaN(parsed) ? -1 : parsed;
                      if (newPrice >= 0) {
                        setCart(cart.map(item =>
                          item.product.id === editCartItem.product.id
                            ? { ...item, unit_price: newPrice }
                            : item
                        ));
                        setEditCartItem(null);
                      } else {
                        Alert.alert('Errore', 'Inserisci un prezzo valido (anche 0)');
                      }
                    }}
                  >
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    <Text style={styles.editCartApplyText}>Applica Prezzo</Text>
                  </TouchableOpacity>
                </View>

                {/* Delete from cart */}
                <TouchableOpacity
                  style={styles.editCartDeleteBtn}
                  onPress={() => {
                    Alert.alert(
                      'Rimuovi dal carrello',
                      `Rimuovere "${editCartItem.product.short_description || editCartItem.product.name}" dal carrello?`,
                      [
                        { text: 'Annulla', style: 'cancel' },
                        {
                          text: 'Rimuovi',
                          style: 'destructive',
                          onPress: () => {
                            removeFromCart(editCartItem.product.id);
                            setEditCartItem(null);
                          },
                        },
                      ]
                    );
                  }}
                >
                  <Ionicons name="trash" size={16} color="#DC2626" />
                  <Text style={styles.editCartDeleteText}>Elimina dal Carrello</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

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

      {/* Package Selection Modal */}
      <Modal
        visible={showPackageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPackageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.packageModal}>
            {/* Header */}
            <View style={styles.packageModalHeader}>
              <View style={styles.packageModalHeaderLeft}>
                <Ionicons name="layers" size={22} color="#8B5CF6" />
                <Text style={styles.packageModalTitle}>Pacchetti Predefiniti</Text>
              </View>
              <TouchableOpacity onPress={() => setShowPackageModal(false)}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.packageSearchBar}>
              <Ionicons name="search" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.packageSearchInput}
                placeholder="Cerca pacchetto..."
                value={packageSearch}
                onChangeText={setPackageSearch}
                placeholderTextColor="#9CA3AF"
              />
              {packageSearch.length > 0 && (
                <TouchableOpacity onPress={() => setPackageSearch('')}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Package List */}
            {loadingPackages ? (
              <View style={styles.packageLoading}>
                <ActivityIndicator size="large" color="#8B5CF6" />
                <Text style={styles.packageLoadingText}>Caricamento pacchetti...</Text>
              </View>
            ) : (
              <ScrollView style={styles.packageList} showsVerticalScrollIndicator={false}>
                {packages
                  .filter(pkg => {
                    if (!packageSearch) return true;
                    const s = packageSearch.toLowerCase();
                    return (
                      (pkg.name || '').toLowerCase().includes(s) ||
                      (pkg.description || '').toLowerCase().includes(s) ||
                      (pkg.branchName || '').toLowerCase().includes(s)
                    );
                  })
                  .map((pkg) => (
                    <View key={pkg.id} style={styles.packageCard}>
                      {/* Package Header */}
                      <View style={styles.packageCardHeader}>
                        <View style={styles.packageCardHeaderLeft}>
                          <View style={styles.packageIconWrap}>
                            <Ionicons name="cube" size={18} color="#8B5CF6" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.packageCardName} numberOfLines={1}>{pkg.name}</Text>
                            {pkg.branchName && (
                              <Text style={styles.packageCardBranch}>{pkg.branchName}</Text>
                            )}
                          </View>
                        </View>
                        <View style={styles.packageStatsBadge}>
                          <Text style={styles.packageStatsText}>
                            {pkg.totalProducts} prod. · {pkg.totalPieces} pz
                          </Text>
                        </View>
                      </View>

                      {/* Description */}
                      {pkg.description ? (
                        <Text style={styles.packageCardDesc} numberOfLines={2}>{pkg.description}</Text>
                      ) : null}

                      {/* Items List */}
                      <View style={styles.packageItemsList}>
                        {(pkg.items || []).slice(0, 5).map((item: any, idx: number) => (
                          <View key={item.products?.id || idx} style={styles.packageItemRow}>
                            <Text style={styles.packageItemQty}>{item.quantity}x</Text>
                            <Text style={styles.packageItemName} numberOfLines={1}>
                              {item.products?.short_description || item.products?.name || 'Prodotto'}
                            </Text>
                            <Text style={styles.packageItemPrice}>
                              {formatCurrency((item.unit_price ?? item.products?.unit_price) ?? 0)}
                            </Text>
                          </View>
                        ))}
                        {(pkg.items || []).length > 5 && (
                          <Text style={styles.packageMoreItems}>
                            +{(pkg.items || []).length - 5} altri prodotti...
                          </Text>
                        )}
                      </View>

                      {/* Footer with Total + Apply Button */}
                      <View style={styles.packageCardFooter}>
                        <View>
                          <Text style={styles.packageTotalLabel}>Totale pacchetto</Text>
                          <Text style={styles.packageTotalValue}>{formatCurrency(pkg.totalPrice)}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.packageApplyBtn}
                          onPress={() => applyPackage(pkg)}
                        >
                          <Ionicons name="add-circle" size={18} color="#FFFFFF" />
                          <Text style={styles.packageApplyText}>Aggiungi</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                }
                {packages.filter(pkg => {
                  if (!packageSearch) return true;
                  const s = packageSearch.toLowerCase();
                  return (
                    (pkg.name || '').toLowerCase().includes(s) ||
                    (pkg.description || '').toLowerCase().includes(s) ||
                    (pkg.branchName || '').toLowerCase().includes(s)
                  );
                }).length === 0 && (
                  <View style={styles.packageEmptyState}>
                    <Ionicons name="layers-outline" size={48} color="#D1D5DB" />
                    <Text style={styles.packageEmptyTitle}>
                      {packageSearch ? 'Nessun pacchetto trovato' : 'Nessun pacchetto disponibile'}
                    </Text>
                    <Text style={styles.packageEmptySubtitle}>
                      {packageSearch 
                        ? 'Prova con un termine di ricerca diverso' 
                        : 'I pacchetti predefiniti verranno mostrati qui'}
                    </Text>
                  </View>
                )}
              </ScrollView>
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
                {getRottamazioneEligibleSubtotal() < getCartSubtotal() && (
                  <Text style={styles.rottamazioneRuleTextBold}>
                    • Imponibile eligible (esclusi prodotti "Rott. No"): {formatCurrency(getRottamazioneEligibleSubtotal())}
                  </Text>
                )}
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
                      • Lo sconto netto verrà spalmato solo sui prodotti eligible alla rottamazione
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
                  <Text 
                    key={item.product.id} 
                    style={item.excluded ? styles.spreadedPreviewItemExcluded : styles.spreadedPreviewItem}
                  >
                    {item.excluded 
                      ? `✗ ${item.product.short_description || item.product.name}: ${formatCurrency(item.originalPrice)} (${item.quantity} pz) — Escluso da rottamazione`
                      : `${item.product.short_description || item.product.name}: ${formatCurrency(item.originalPrice)} → ${formatCurrency(item.newPrice)} (${item.quantity} pz)`
                    }
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

