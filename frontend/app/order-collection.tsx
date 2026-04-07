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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuthStore } from '../../store/authStore';
import { fetchCustomers, fetchCustomerById } from '../../lib/api/customers';
import { 
  fetchProducts, 
  fetchPaymentMethods, 
  fetchShippingMethods,
  createOrder,
  Product,
  PaymentMethod,
  ShippingMethod,
} from '../../lib/api/order-collection';
import { Customer } from '../../types';

interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
}

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

  // Search
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showCustomerList, setShowCustomerList] = useState(false);

  // Location
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    loadInitialData();
    getLocation();
  }, []);

  useEffect(() => {
    if (params.customerId) {
      loadCustomerFromParams();
    }
  }, [params.customerId]);

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

  const getCartTotal = () => {
    const subtotal = cart.reduce((sum, item) => {
      const priceWithAccisa = item.unit_price + (item.product.accisa || 0);
      const lineTotal = priceWithAccisa * item.quantity;
      if (!isForeignOrder) {
        return sum + (lineTotal * (1 + (item.product.iva_percentage || 22) / 100));
      }
      return sum + lineTotal;
    }, 0);

    const shipping = shippingMethods.find(m => m.id === selectedShipping);
    const shippingCost = shipping?.cost || 0;
    const shippingWithVAT = isForeignOrder ? shippingCost : shippingCost * 1.22;

    return subtotal + shippingWithVAT;
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
      case 4: return true;
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
              }}
            >
              <View style={styles.customerItemAvatar}>
                <Text style={styles.customerItemAvatarText}>{item.business_name.charAt(0)}</Text>
              </View>
              <View style={styles.customerItemInfo}>
                <Text style={styles.customerItemName}>{item.business_name}</Text>
                <Text style={styles.customerItemCity}>{item.city}, {item.province}</Text>
              </View>
              <View style={[
                styles.categoryBadge,
                item.category === 'client' ? styles.clientBadge : styles.prospectBadge
              ]}>
                <Text style={[
                  styles.categoryText,
                  item.category === 'client' ? styles.clientText : styles.prospectText
                ]}>
                  {item.category === 'client' ? 'Cliente' : 'Prospect'}
                </Text>
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
        <View style={styles.cartSummary}>
          <Text style={styles.cartCount}>{cart.reduce((sum, i) => sum + i.quantity, 0)} prodotti</Text>
          <Text style={styles.cartTotal}>{formatCurrency(getCartTotal())}</Text>
        </View>
      )}

      {/* Cart Items */}
      {cart.length > 0 && (
        <View style={styles.cartSection}>
          <Text style={styles.sectionLabel}>Nel carrello:</Text>
          {cart.map((item) => (
            <View key={item.product.id} style={styles.cartItem}>
              <View style={styles.cartItemInfo}>
                <Text style={styles.cartItemName} numberOfLines={1}>
                  {item.product.short_description || item.product.name}
                </Text>
                <Text style={styles.cartItemPrice}>{formatCurrency(item.unit_price)}</Text>
              </View>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.quantityBtn}
                  onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
                >
                  <Ionicons name="remove" size={18} color="#EF4444" />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityBtn}
                  onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
                >
                  <Ionicons name="add" size={18} color="#10B981" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
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
          style={styles.productList}
          renderItem={({ item }) => {
            const inCart = cart.find(c => c.product.id === item.id);
            return (
              <TouchableOpacity
                style={[styles.productItem, inCart && styles.productItemInCart]}
                onPress={() => addToCart(item)}
              >
                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {item.short_description || item.name}
                  </Text>
                  <Text style={styles.productSku}>{item.sku}</Text>
                </View>
                <View style={styles.productPriceSection}>
                  <Text style={styles.productPrice}>{formatCurrency(item.unit_price)}</Text>
                  {inCart && (
                    <View style={styles.inCartBadge}>
                      <Text style={styles.inCartText}>{inCart.quantity}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Nessun prodotto trovato</Text>
          }
        />
      )}
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

        {/* Products */}
        <View style={styles.summarySection}>
          <Text style={styles.summaryLabel}>Prodotti ({cart.length})</Text>
          <View style={styles.summaryCard}>
            {cart.map((item) => (
              <View key={item.product.id} style={styles.summaryItem}>
                <Text style={styles.summaryItemName}>
                  {item.quantity}x {item.product.short_description || item.product.name}
                </Text>
                <Text style={styles.summaryItemPrice}>
                  {formatCurrency(item.unit_price * item.quantity)}
                </Text>
              </View>
            ))}
          </View>
        </View>

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
            <Text style={styles.summaryValue}>{shipping?.name} - {formatCurrency(shipping?.cost || 0)}</Text>
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
          <Text style={styles.totalLabel}>Totale Ordine</Text>
          <Text style={styles.totalAmount}>{formatCurrency(getCartTotal())}</Text>
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

      {/* Step Labels */}
      <View style={styles.stepLabels}>
        {STEPS.map((step, index) => (
          <Text
            key={step}
            style={[
              styles.stepLabel,
              index === currentStep && styles.stepLabelCurrent
            ]}
          >
            {step}
          </Text>
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
            disabled={isSubmitting}
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
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
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  stepLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    textAlign: 'center',
    flex: 1,
  },
  stepLabelCurrent: {
    color: '#1E40AF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#1F2937',
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  selectedCity: {
    fontSize: 13,
    color: '#6B7280',
  },
  customerList: {
    flex: 1,
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
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
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  customerItemCity: {
    fontSize: 13,
    color: '#6B7280',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  clientBadge: {
    backgroundColor: '#DCFCE7',
  },
  prospectBadge: {
    backgroundColor: '#FEF3C7',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '500',
  },
  clientText: {
    color: '#166534',
  },
  prospectText: {
    color: '#92400E',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 4,
  },
  foreignToggleTextActive: {
    color: '#FFFFFF',
  },
  cartSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  cartCount: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  cartTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cartSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    color: '#1F2937',
  },
  cartItemPrice: {
    fontSize: 13,
    color: '#6B7280',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 12,
    color: '#1F2937',
  },
  productList: {
    flex: 1,
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  productItemInCart: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  productSku: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  productPriceSection: {
    alignItems: 'flex-end',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
  },
  inCartBadge: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  inCartText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
  },
  optionNameSelected: {
    color: '#1E40AF',
  },
  optionDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  optionPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  notesSection: {
    marginTop: 16,
  },
  textArea: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  summarySection: {
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
  },
  summaryValue: {
    fontSize: 15,
    color: '#1F2937',
    marginLeft: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  summaryItemName: {
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
  },
  summaryItemPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  totalLabel: {
    fontSize: 16,
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
    padding: 12,
    marginTop: 12,
  },
  foreignBadgeText: {
    fontSize: 14,
    color: '#8B5CF6',
    marginLeft: 8,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 8,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E40AF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginLeft: 'auto',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginLeft: 'auto',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    marginTop: 24,
    fontSize: 14,
  },
});
