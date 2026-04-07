import React, { useState, useEffect } from 'react';
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

  // Location
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    loadInitialData();
    loadRottamazioneConfig();
    getLocation();
  }, []);

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
        setRottamazioneConfig({
          lots: data.lots || DEFAULT_ROTTAMAZIONE_LOTS,
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
      const { data, error } = await supabase
        .from('cashback_balances')
        .select('available_balance')
        .eq('customer_id', selectedCustomer.id)
        .single();
      
      if (data && !error) {
        setCashBackBalance(data.available_balance || 0);
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
  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product.id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { product, quantity: 1, unit_price: product.unit_price }]);
    }
  };

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
    
    const imponibile = getCartSubtotal();
    return rottamazioneConfig.lots.filter(lot => {
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

  // Navigation
  const canProceed = () => {
    switch (currentStep) {
      case 0: return selectedCustomer !== null;
      case 1: return cart.length > 0;
      case 2: return selectedPayment !== '';
      case 3: return selectedShipping !== '';
      case 4: return rottamazioneAmount === 0 || rottamazioneDescription.trim() !== '';
      default: return false;
    }
  };

  const handleNext = () => {
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

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.short_description?.toLowerCase() || '').includes(productSearch.toLowerCase())
  );

  // Render product card with image and details
  const renderProductCard = ({ item }: { item: Product }) => {
    const inCart = cart.find(c => c.product.id === item.id);
    const hasImage = item.image_url && item.image_url.trim() !== '';
    
    return (
      <TouchableOpacity
        style={[styles.productCard, inCart && styles.productCardInCart]}
        onPress={() => addToCart(item)}
        onLongPress={() => setSelectedProductDetail(item)}
      >
        {/* Product Image */}
        <View style={styles.productImageContainer}>
          {hasImage ? (
            <Image 
              source={{ uri: item.image_url! }} 
              style={styles.productImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <Ionicons name="cube-outline" size={24} color="#9CA3AF" />
            </View>
          )}
          {inCart && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{inCart.quantity}</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.short_description || item.name}
          </Text>
          <Text style={styles.productSku}>{item.sku}</Text>
          
          {/* Price Details */}
          <View style={styles.priceDetails}>
            <Text style={styles.productPrice}>{formatCurrency(item.unit_price)}</Text>
            {(item.accisa || 0) > 0 && (
              <Text style={styles.accisaText}>+{formatCurrency(item.accisa || 0)} acc.</Text>
            )}
          </View>
          
          {/* IVA Badge */}
          <View style={styles.badgeRow}>
            <View style={styles.ivaBadge}>
              <Text style={styles.ivaBadgeText}>IVA {item.iva_percentage || 22}%</Text>
            </View>
            {item.cashback_eligible && (
              <View style={styles.cashbackBadge}>
                <Ionicons name="gift-outline" size={10} color="#10B981" />
                <Text style={styles.cashbackBadgeText}>CB</Text>
              </View>
            )}
          </View>
        </View>

        {/* Quick Add Button */}
        <TouchableOpacity 
          style={styles.quickAddBtn}
          onPress={() => addToCart(item)}
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </TouchableOpacity>
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

    return (
      <View key={item.product.id} style={styles.cartItem}>
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

      {/* Cart Summary */}
      {cart.length > 0 && (
        <View style={styles.cartSummaryCard}>
          <View style={styles.cartSummaryRow}>
            <Text style={styles.cartSummaryLabel}>
              {cart.reduce((sum, i) => sum + i.quantity, 0)} prodotti
            </Text>
            <Text style={styles.cartSummaryTotal}>{formatCurrency(getCartTotal())}</Text>
          </View>
          <View style={styles.cartSummaryDetails}>
            <Text style={styles.cartDetailText}>
              Imponibile: {formatCurrency(getCartSubtotal())}
            </Text>
            <Text style={styles.cartDetailText}>
              Accisa: {formatCurrency(getTotalAccisa())}
            </Text>
            {!isForeignOrder && (
              <Text style={styles.cartDetailText}>
                IVA: {formatCurrency(getTotalIVA())}
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Cart Items */}
      {cart.length > 0 && (
        <View style={styles.cartSection}>
          <Text style={styles.sectionLabel}>Nel carrello:</Text>
          <ScrollView style={styles.cartItemsList} nestedScrollEnabled>
            {cart.map(item => renderCartItem(item))}
          </ScrollView>
        </View>
      )}

      {/* Products List */}
      <Text style={styles.sectionLabel}>Prodotti disponibili:</Text>
      {loadingProducts ? (
        <ActivityIndicator size="large" color="#1E40AF" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filteredProducts.slice(0, 50)}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.productGrid}
          renderItem={renderProductCard}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Nessun prodotto trovato</Text>
          }
        />
      )}

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
    const maxCashBack = Math.min(cashBackBalance, eligibleSubtotal);

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
            <Text style={styles.summaryLabel}>
              <Ionicons name="gift" size={16} color="#10B981" /> CashBack Disponibile
            </Text>
            <View style={[styles.summaryCard, styles.cashbackCard]}>
              <Text style={styles.cashbackAvailable}>
                Disponibile: {formatCurrency(cashBackBalance)}
              </Text>
              {eligibleSubtotal > 0 ? (
                <>
                  <Text style={styles.cashbackEligible}>
                    Applicabile (prodotti idonei): max {formatCurrency(maxCashBack)}
                  </Text>
                  <View style={styles.cashbackInputRow}>
                    <Text style={styles.cashbackInputLabel}>Usa:</Text>
                    <TextInput
                      style={styles.cashbackInput}
                      keyboardType="decimal-pad"
                      value={cashBackToUse.toString()}
                      onChangeText={(text) => {
                        const val = parseFloat(text) || 0;
                        setCashBackToUse(Math.min(val, maxCashBack));
                      }}
                      placeholder="0.00"
                    />
                    <TouchableOpacity
                      style={styles.cashbackMaxBtn}
                      onPress={() => setCashBackToUse(maxCashBack)}
                    >
                      <Text style={styles.cashbackMaxBtnText}>MAX</Text>
                    </TouchableOpacity>
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
            <Text style={styles.summaryLabel}>
              <Ionicons name="refresh" size={16} color="#8B5CF6" /> Rottamazione
            </Text>
            <View style={[styles.summaryCard, styles.rottamazioneCard]}>
              <Text style={styles.rottamazioneInfo}>
                Seleziona importo rottamazione (lordo IVA inclusa)
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
                      {lot === 0 ? 'Nessuna' : formatCurrency(lot)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {rottamazioneAmount > 0 && (
                <>
                  <Text style={styles.rottamazioneNet}>
                    Sconto netto applicato: {formatCurrency(getRottamazioneNetAmount(rottamazioneAmount))}
                  </Text>
                  <TextInput
                    style={styles.rottamazioneInput}
                    placeholder="Descrizione merce da rottamare *"
                    value={rottamazioneDescription}
                    onChangeText={setRottamazioneDescription}
                    multiline
                  />
                </>
              )}
            </View>
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
  // Product Grid Styles
  productGrid: {
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  productCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
  },
  productCardInCart: {
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  productImageContainer: {
    position: 'relative',
    marginBottom: 6,
  },
  productImage: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  productImagePlaceholder: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  productSku: {
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  priceDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  accisaText: {
    fontSize: 10,
    color: '#F59E0B',
    marginLeft: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 4,
    gap: 4,
  },
  ivaBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ivaBadgeText: {
    fontSize: 9,
    color: '#3B82F6',
    fontWeight: '500',
  },
  cashbackBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  cashbackBadgeText: {
    fontSize: 9,
    color: '#10B981',
    fontWeight: '500',
  },
  quickAddBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#1E40AF',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
